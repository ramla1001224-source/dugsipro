import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../config/api_config.dart';
import '../router/auth_state.dart';
import 'database_helper.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;

  late final Dio _dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  final DatabaseHelper _dbHelper = DatabaseHelper();

  ApiService._internal() {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiConfig.baseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 15),
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storage.read(key: 'token');
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          
          // Check connectivity (v7+ returns List<ConnectivityResult>)
          final connectivityResults = await Connectivity().checkConnectivity();
          bool isOnline = connectivityResults.isNotEmpty &&
              !connectivityResults.every((r) => r == ConnectivityResult.none);

          if (!isOnline) {
            final path = options.path;
            
            // If offline and it's a GET request, return cached data
            if (options.method == 'GET') {
              final cachedData = await _dbHelper.getCache(path);
              if (cachedData != null) {
                return handler.resolve(
                  Response(
                    requestOptions: options,
                    data: cachedData,
                    statusCode: 200,
                  ),
                );
              }
            } 
            // If offline and it's a mutation, add to sync queue
            else if (['POST', 'PUT', 'DELETE', 'PATCH'].contains(options.method)) {
              await _dbHelper.enqueueSync(options.method, path, options.data);
              
              // Return a fake success response to the UI
              return handler.resolve(
                Response(
                  requestOptions: options,
                  data: {'success': true, 'message': 'Saved offline. Will sync when online.'},
                  statusCode: 200,
                ),
              );
            }
          }

          return handler.next(options);
        },
        onResponse: (response, handler) async {
          // If online and it's a GET request, cache the result
          if (response.requestOptions.method == 'GET' && response.statusCode == 200) {
            await _dbHelper.saveCache(response.requestOptions.path, response.data);
          }
          return handler.next(response);
        },
        onError: (DioException error, handler) async {
          // Check for school suspension
          if (error.response?.statusCode == 403) {
            final data = error.response?.data;
            if (data is Map && data['suspended'] == true) {
              AuthState().setSuspended(true);
            }
          }
          
          // Fallback to cache if network error occurs during a GET request
          if (error.type == DioExceptionType.connectionTimeout || error.type == DioExceptionType.unknown) {
             if (error.requestOptions.method == 'GET') {
                final cachedData = await _dbHelper.getCache(error.requestOptions.path);
                if (cachedData != null) {
                  return handler.resolve(
                    Response(
                      requestOptions: error.requestOptions,
                      data: cachedData,
                      statusCode: 200,
                    ),
                  );
                }
             }
          }
          
          return handler.next(error);
        },
      ),
    );
  }

  Future<Response> get(String path, {Map<String, dynamic>? params}) async {
    return _dio.get(path, queryParameters: params);
  }

  Future<Response> post(String path, {dynamic data}) async {
    return _dio.post(path, data: data);
  }

  Future<Response> put(String path, {dynamic data}) async {
    return _dio.put(path, data: data);
  }

  Future<Response> patch(String path, {dynamic data}) async {
    return _dio.patch(path, data: data);
  }

  Future<Response> delete(String path) async {
    return _dio.delete(path);
  }
}
