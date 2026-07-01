import 'package:flutter/material.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../services/sync_service.dart';

/// ConnectivityProvider - Internet xaaladda la socda oo UI-ga ogeysiya.
/// Marka online la noqdo, waxay automatically ku call-gareysaa SyncService.
class ConnectivityProvider extends ChangeNotifier {
  static final ConnectivityProvider _instance = ConnectivityProvider._internal();
  factory ConnectivityProvider() => _instance;
  ConnectivityProvider._internal() {
    _init();
  }

  bool _isOnline = true;
  bool get isOnline => _isOnline;

  final SyncService _syncService = SyncService();

  void _init() {
    // Xaalada bilowga ah hubi
    Connectivity().checkConnectivity().then((results) {
      _updateStatus(results);
    });

    // Isbeddelada daawo si joogto ah
    Connectivity().onConnectivityChanged.listen((results) {
      final wasOffline = !_isOnline;
      _updateStatus(results);

      // Haddii horay offline ahayn oo hadda online noqotay → sync samee
      if (wasOffline && _isOnline) {
        debugPrint('[ConnectivityProvider] Back online! Triggering sync...');
        _syncService.syncNow();
      }
    });
  }

  void _updateStatus(List<ConnectivityResult> results) {
    final online = results.isNotEmpty &&
        !results.every((r) => r == ConnectivityResult.none);
    if (_isOnline != online) {
      _isOnline = online;
      notifyListeners();
      debugPrint('[ConnectivityProvider] Status changed: ${online ? "ONLINE" : "OFFLINE"}');
    }
  }
}
