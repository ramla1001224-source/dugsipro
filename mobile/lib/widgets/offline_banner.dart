import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:provider/provider.dart';
import '../providers/connectivity_provider.dart';
import '../services/sync_service.dart';

/// OfflineBanner - Widget-ka sare ee muujiya xaalada internet
/// 🔍´ Offline: "Offline Mode - Data la kaydinayaa"
/// 🟡 Syncing: "Online - Xogta la dirayo..."
/// (Wuu is-qariyaa marka fully online uu noqdo)
class OfflineBanner extends StatefulWidget {
  final Widget child;
  const OfflineBanner({super.key, required this.child});

  @override
  State<OfflineBanner> createState() => _OfflineBannerState();
}

class _OfflineBannerState extends State<OfflineBanner>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _slideAnim;
  bool _wasOnline = true;
  bool _showSyncSuccess = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );
    _slideAnim = CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleStateChange(bool isOnline, bool isSyncing) {
    final shouldShow = !isOnline || isSyncing || _showSyncSuccess;

    if (shouldShow) {
      _controller.forward();
    } else {
      _controller.reverse();
    }

    // Marka online noqoto, show success flash kooban
    if (isOnline && !_wasOnline) {
      _showSyncSuccess = true;
      Future.delayed(const Duration(seconds: 3), () {
        if (mounted) {
          setState(() => _showSyncSuccess = false);
        }
      });
    }
    _wasOnline = isOnline;
  }

  @override
  Widget build(BuildContext context) {
    return Consumer2<ConnectivityProvider, SyncService>(
      builder: (context, connectivity, syncService, _) {
        final isOnline = connectivity.isOnline;
        final isSyncing = syncService.isSyncing;
        final pendingCount = syncService.pendingCount;

        WidgetsBinding.instance.addPostFrameCallback((_) {
          _handleStateChange(isOnline, isSyncing);
        });

        return Column(
          children: [
            // â”€â”€ Banner â”€â”€
            SizeTransition(
              sizeFactor: _slideAnim,
              axisAlignment: -1,
              child: _BannerContent(
                isOnline: isOnline,
                isSyncing: isSyncing,
                showSuccess: _showSyncSuccess,
                pendingCount: pendingCount,
              ),
            ),

            // â”€â”€ Page content â”€â”€
            Expanded(child: widget.child),
          ],
        );
      },
    );
  }
}

class _BannerContent extends StatelessWidget {
  final bool isOnline;
  final bool isSyncing;
  final bool showSuccess;
  final int pendingCount;

  const _BannerContent({
    required this.isOnline,
    required this.isSyncing,
    required this.showSuccess,
    required this.pendingCount,
  });

  @override
  Widget build(BuildContext context) {
    Color bgColor;
    Color textColor;
    IconData icon;
    String message;
    bool showSpinner = false;

    if (!isOnline) {
      bgColor = const Color(0xFFDC2626); // Red
      textColor = Colors.white;
      icon = Icons.wifi_off_rounded;
      message = pendingCount > 0
          ? 'Offline Â· $pendingCount changes saved locally'
          : 'Offline Mode Â· No internet connection';
    } else if (isSyncing) {
      bgColor = const Color(0xFFF59E0B); // Amber
      textColor = const Color(0xFF78350F);
      icon = Icons.sync_rounded;
      message = 'Syncing changes to server...';
      showSpinner = true;
    } else {
      // Success flash
      bgColor = const Color(0xFF10B981); // Green
      textColor = Colors.white;
      icon = Icons.wifi_rounded;
      message = 'Back online Â· All changes synced!';
    }

    return Container(
      width: double.infinity,
      color: bgColor,
      padding: EdgeInsets.only(
        top: MediaQuery.of(context).padding.top + 4,
        bottom: 8,
        left: 16,
        right: 16,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (showSpinner)
            SizedBox(
              width: 14.w,
              height: 14.h,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: textColor,
              ),
            )
          else
            Icon(icon, color: textColor, size: 15),
          SizedBox(width: 8.w),
          Flexible(
            child: Text(
              message,
              style: TextStyle(
                color: textColor,
                fontSize: 12.sp,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

