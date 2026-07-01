import 'package:flutter/foundation.dart';
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_service.dart';
import '../config/api_config.dart';

class AuthService {
  final ApiService _api = ApiService();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Future<Map<String, dynamic>> login({
    required String username,
    required String password,
    String? schoolCode,
    String? schoolId,
    String? fcmToken,
  }) async {
    final response = await _api.post(
      ApiConfig.login,
      data: {
        'username': username,
        'password': password,
        if (schoolCode != null && schoolCode.isNotEmpty)
          'schoolCode': schoolCode,
        if (schoolId != null && schoolId.isNotEmpty)
          'schoolId': schoolId,
        if (fcmToken != null)
          'fcmToken': fcmToken,
      },
    );

    final data = response.data as Map<String, dynamic>;

    // Store token and core info securely
    if (data['token'] != null) {
      await _storage.write(key: 'token', value: data['token']);
      await _storage.write(key: 'role', value: (data['role'] ?? '').toString().toLowerCase());
      await _storage.write(key: 'name', value: data['name'] ?? '');
      await _storage.write(
        key: 'schoolId',
        value: (data['schoolId'] ?? '').toString(),
      );

      // Store role-specific profile IDs if present
      if (data['studentId'] != null) {
        await _storage.write(key: 'studentId', value: data['studentId'].toString());
      }
      if (data['teacherId'] != null) {
        await _storage.write(key: 'teacherId', value: data['teacherId'].toString());
      }
      if (data['parentId'] != null) {
        await _storage.write(key: 'parentId', value: data['parentId'].toString());
      }
      if (data['userId'] != null) {
        await _storage.write(key: 'userId', value: data['userId'].toString());
      }
      if (data['settings'] != null) {
        await _storage.write(key: 'settings', value: json.encode(data['settings']));
      }
      // Save current enrollment info for students (avoids extra API call on first load)
      if (data['currentEnrollment'] != null) {
        await _storage.write(key: 'currentEnrollment', value: json.encode(data['currentEnrollment']));
      } else {
        await _storage.delete(key: 'currentEnrollment');
      }
    }

    return data;
  }

  Future<void> impersonateSuperAdmin(String adminId) async {
    final currentToken = await _storage.read(key: 'token');
    if (currentToken == null) throw Exception('No current token');

    final response = await _api.post('${ApiConfig.ownerImpersonate}/$adminId');
    final data = response.data as Map<String, dynamic>;

    if (data['token'] != null) {
      await _storage.write(key: 'originalOwnerToken', value: currentToken);
      await _storage.write(key: 'originalOwnerRole', value: 'owner');
      await _storage.write(key: 'token', value: data['token']);
      await _storage.write(key: 'role', value: 'super_admin');
      await _storage.write(key: 'name', value: data['name'] ?? '');
    }
  }

  Future<void> impersonateSchool(String schoolId) async {
    final currentToken = await _storage.read(key: 'token');
    final currentRole = await _storage.read(key: 'role');
    if (currentToken == null) throw Exception('No current token');

    final response = await _api.post('${ApiConfig.schoolImpersonate}/$schoolId');
    final data = response.data as Map<String, dynamic>;

    if (data['token'] != null) {
      // If we are already impersonating, we keep the FIRST original token to return all the way back
      // or we can stack them. For now, most systems just need one level of "Back to System Control"
      final existingOriginal = await _storage.read(key: 'originalOwnerToken');
      if (existingOriginal == null) {
        // Save original token and role so we can return later
        await _storage.write(key: 'originalOwnerToken', value: currentToken);
        await _storage.write(key: 'originalOwnerRole', value: currentRole ?? '');
        // Save original schoolId (null for owner/super_admin) to restore later
        final originalSchoolId = await _storage.read(key: 'schoolId');
        await _storage.write(key: 'originalOwnerSchoolId', value: originalSchoolId ?? '');
      }

      await _storage.write(key: 'token', value: data['token']);
      await _storage.write(key: 'role', value: 'admin');
      // CRITICAL: Store the impersonated school's ID so all school-scoped APIs work
      await _storage.write(key: 'schoolId', value: schoolId);
    }
  }

  Future<void> returnToOwner() async {
    final originalToken = await _storage.read(key: 'originalOwnerToken');
    final originalRole = await _storage.read(key: 'originalOwnerRole');
    final originalSchoolId = await _storage.read(key: 'originalOwnerSchoolId');
    if (originalToken != null) {
      await _storage.write(key: 'token', value: originalToken);
      await _storage.write(key: 'role', value: originalRole ?? 'owner');
      // Restore original schoolId (empty string means null for owner)
      if (originalSchoolId != null && originalSchoolId.isNotEmpty) {
        await _storage.write(key: 'schoolId', value: originalSchoolId);
      } else {
        await _storage.delete(key: 'schoolId');
      }
      await _storage.delete(key: 'originalOwnerToken');
      await _storage.delete(key: 'originalOwnerRole');
      await _storage.delete(key: 'originalOwnerSchoolId');
    }
  }

  Future<bool> isImpersonating() async {
    final token = await _storage.read(key: 'originalOwnerToken');
    return token != null;
  }

  Future<void> logout() async {
    await _storage.deleteAll();
  }

  Future<bool> isLoggedIn() async {
    final token = await _storage.read(key: 'token');
    if (token == null) return false;
    // Simple expiry check by decoding JWT payload
    try {
      final parts = token.split('.');
      if (parts.length != 3) return false;
      final payload = parts[1];
      final normalized = base64Url.normalize(payload);
      final decoded = utf8.decode(base64Url.decode(normalized));
      final map = json.decode(decoded) as Map<String, dynamic>;
      final exp = map['exp'] as int?;
      if (exp == null) return true;
      return DateTime.fromMillisecondsSinceEpoch(
        exp * 1000,
      ).isAfter(DateTime.now());
    } catch (_) {
      return false;
    }
  }

  Future<String?> getRole() async {
    final role = await _storage.read(key: 'role');
    return role?.toLowerCase();
  }
  Future<String?> getName() => _storage.read(key: 'name');
  Future<String?> getToken() => _storage.read(key: 'token');
  Future<String?> getSchoolId() => _storage.read(key: 'schoolId');
  Future<String?> getStudentId() => _storage.read(key: 'studentId');
  Future<String?> getTeacherId() => _storage.read(key: 'teacherId');
  Future<String?> getParentId() => _storage.read(key: 'parentId');
  Future<String?> getUserId() => _storage.read(key: 'userId');
  Future<String?> getSchoolName() => _storage.read(key: 'schoolName');
  Future<String?> getSchoolLogo() => _storage.read(key: 'schoolLogo');

  Future<Map<String, dynamic>?> getCurrentEnrollment() async {
    final s = await _storage.read(key: 'currentEnrollment');
    if (s == null) return null;
    try { return json.decode(s) as Map<String, dynamic>; } catch (_) { return null; }
  }

  Future<void> saveSchoolConfig(String? name, String? logo) async {
    if (name != null) await _storage.write(key: 'schoolName', value: name);
    if (logo != null) await _storage.write(key: 'schoolLogo', value: logo);
  }

  Future<bool> hasPermission(String key) async {
    final s = await _storage.read(key: 'settings');
    if (s == null) return false;
    try {
      final List list = json.decode(s);
      final item = list.firstWhere((p) => p['key'] == key, orElse: () => null);
      return item != null && item['value'] == 'true';
    } catch (_) {
      return false;
    }
  }

  Future<void> saveToken(String token) =>
      _storage.write(key: 'token', value: token);
  Future<void> setRole(String role) => _storage.write(key: 'role', value: role);

  Future<Map<String, dynamic>?> getProfile() async {
    try {
      final res = await _api.get(ApiConfig.profile);
      return res.data as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> getSchoolByCode(String code) async {
    try {
      final res = await _api.get('${ApiConfig.schoolByCode}/${code.toUpperCase().trim()}');
      return res.data as Map<String, dynamic>?;
    } catch (e) {
      throw Exception('School not found');
    }
  }

  Future<void> updateFCMToken(String token) async {
    try {
      await _api.put('${ApiConfig.baseUrl}/api/auth/fcm-token', data: {'fcmToken': token});
    } catch (e) {
      debugPrint('AuthService: Failed to update FCM token: $e');
    }
  }
}
