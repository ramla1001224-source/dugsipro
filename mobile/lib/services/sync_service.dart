import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/api_config.dart';
import 'database_helper.dart';

/// SyncService - Marka internet soo noqoto, waxay dirtaa dhammaan
/// requests-kii offline lagu kaydiyay SyncQueue-ga.
class SyncService extends ChangeNotifier {
  static final SyncService _instance = SyncService._internal();
  factory SyncService() => _instance;
  SyncService._internal();

  bool _isSyncing = false;
  int _pendingCount = 0;
  String? _lastError;
  DateTime? _lastSyncTime;

  bool get isSyncing => _isSyncing;
  int get pendingCount => _pendingCount;
  String? get lastError => _lastError;
  DateTime? get lastSyncTime => _lastSyncTime;

  final DatabaseHelper _dbHelper = DatabaseHelper();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  /// Tiro pending requests-ka
  Future<void> refreshPendingCount() async {
    final queue = await _dbHelper.getSyncQueue();
    _pendingCount = queue.length;
    notifyListeners();
  }

  /// Marka internet soo noqoto, waxay ku samaynaysaa sync
  Future<void> syncNow() async {
    if (_isSyncing) return;

    final queue = await _dbHelper.getSyncQueue();
    if (queue.isEmpty) {
      _pendingCount = 0;
      notifyListeners();
      return;
    }

    _isSyncing = true;
    _lastError = null;
    _pendingCount = queue.length;
    notifyListeners();

    // Dio instance dedicated-ka sync-ka
    final token = await _storage.read(key: 'token');
    final dio = Dio(
      BaseOptions(
        baseUrl: ApiConfig.baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 20),
        headers: token != null ? {'Authorization': 'Bearer $token'} : {},
      ),
    );

    int successCount = 0;
    int failCount = 0;

    for (final item in queue) {
      final id = item['id'] as int;
      final method = item['method'] as String;
      final url = item['url'] as String;
      final rawData = item['data'];

      dynamic data;
      try {
        data = rawData != null ? jsonDecode(rawData as String) : null;
      } catch (_) {
        data = rawData;
      }

      try {
        switch (method.toUpperCase()) {
          case 'POST':
            await dio.post(url, data: data);
            break;
          case 'PUT':
            await dio.put(url, data: data);
            break;
          case 'PATCH':
            await dio.patch(url, data: data);
            break;
          case 'DELETE':
            await dio.delete(url, data: data);
            break;
        }

        // Guulaysatay → ka saar queue-ga
        await _dbHelper.removeFromQueue(id);
        successCount++;
        _pendingCount = (_pendingCount - 1).clamp(0, 9999);
        notifyListeners();
      } on DioException catch (e) {
        failCount++;
        debugPrint('[SyncService] Failed to sync $method $url: ${e.message}');
        // Sii xidna queue-ga (waa laga isku dayi doonaa markale)
      }
    }

    _isSyncing = false;
    _lastSyncTime = DateTime.now();
    if (failCount > 0) {
      _lastError = '$failCount requests failed to sync';
    }

    // Xidiga count-ka wax laga bedelay, cache-ka cusbi
    await _dbHelper.clearCache();

    notifyListeners();
    debugPrint('[SyncService] Sync done: $successCount success, $failCount failed');
  }
}
