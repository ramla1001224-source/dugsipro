import 'package:flutter/material.dart';
import '../services/auth_service.dart';

class AuthState extends ChangeNotifier {
  static final AuthState _instance = AuthState._internal();
  factory AuthState() => _instance;
  AuthState._internal();

  bool _isLoggedIn = false;
  String? _role;
  bool _initialized = false;
  bool _isSuspended = false;

  bool get isLoggedIn => _isLoggedIn;
  String? get role => _role;
  bool get initialized => _initialized;
  bool get isSuspended => _isSuspended;

  Future<void> initialize(AuthService auth) async {
    _isLoggedIn = await auth.isLoggedIn();
    _role = await auth.getRole();
    _initialized = true;
    notifyListeners();
  }

  void update(bool login, String? r) {
    _isLoggedIn = login;
    _role = r?.toLowerCase();
    _isSuspended = false; // Reset on login/logout
    notifyListeners();
  }

  void setSuspended(bool suspended) {
    if (_isSuspended != suspended) {
      _isSuspended = suspended;
      notifyListeners();
    }
  }
}
