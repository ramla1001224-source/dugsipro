import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../config/api_config.dart';
import 'dart:async';
import 'package:flutter_app_badger/flutter_app_badger.dart';

class NotificationProvider with ChangeNotifier {
  final ApiService _api = ApiService();
  final AuthService _auth = AuthService();
  int _unreadCount = 0;
  List<dynamic> _notifications = [];
  bool _isLoading = false;
  Timer? _timer;

  int get unreadCount => _unreadCount;
  List<dynamic> get notifications => _notifications;
  bool get isLoading => _isLoading;

  NotificationProvider() {
    // Check token on startup before fetching
    _initFetch();
    // Poll every 1 minute for fresh badge count
    _timer = Timer.periodic(const Duration(minutes: 1), (timer) {
      _fetchIfLoggedIn();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  /// Called at startup — only fetches if user already has a valid token
  Future<void> _initFetch() async {
    final isLoggedIn = await _auth.isLoggedIn();
    if (isLoggedIn) {
      await fetchUnreadCount();
    }
  }

  /// Timer-based poll — skips if not logged in
  Future<void> _fetchIfLoggedIn() async {
    try {
      final isLoggedIn = await _auth.isLoggedIn();
      if (isLoggedIn) {
        await fetchUnreadCount();
      }
    } catch (_) {}
  }

  /// Called immediately after a successful login to refresh count
  Future<void> refreshAfterLogin() async {
    // Small delay to ensure token is saved to secure storage before fetching
    await Future.delayed(const Duration(milliseconds: 300));
    await fetchUnreadCount();
  }

  Future<void> fetchUnreadCount() async {
    try {
      final res = await _api.get(ApiConfig.notificationsUnreadCount);
      if (res.data != null && res.data['count'] != null) {
        _unreadCount = res.data['count'];
        _updateSystemBadge();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error fetching unread count: $e');
    }
  }

  void _updateSystemBadge() {
    try {
      if (_unreadCount > 0) {
        FlutterAppBadger.updateBadgeCount(_unreadCount);
      } else {
        FlutterAppBadger.removeBadge();
      }
    } catch (_) {}
  }

  Future<void> fetchNotifications() async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await _api.get(ApiConfig.notifications);
      _notifications = res.data is List ? res.data : (res.data['data'] ?? []);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      debugPrint('Error fetching notifications: $e');
    }
  }

  Future<void> markAsRead(String id) async {
    try {
      await _api.put('${ApiConfig.notifications}/$id/read', data: {});
      // Update local state
      final index = _notifications.indexWhere((n) => n['id'] == id);
      if (index != -1) {
        _notifications[index]['status'] = 'read';
        if (_unreadCount > 0) _unreadCount--;
        _updateSystemBadge();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error marking as read: $e');
    }
  }

  Future<void> markAllAsRead() async {
    try {
      for (final n in _notifications) {
        final status = n['status'];
        if (status == 'sent' || status == 'unread') {
          await _api.put('${ApiConfig.notifications}/${n['id']}/read', data: {});
          n['status'] = 'read';
        }
      }
      _unreadCount = 0;
      _updateSystemBadge();
      notifyListeners();
    } catch (e) {
      debugPrint('Error marking all as read: $e');
    }
  }

  Future<void> refresh() async {
    await fetchUnreadCount();
    await fetchNotifications();
  }
}
