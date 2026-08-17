import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:provider/provider.dart';
import '../../main.dart';
import '../../providers/notification_provider.dart';
import '../../services/locale_service.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // Fetch ALL notifications when screen opens
      context.read<NotificationProvider>().fetchNotifications();
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LocaleProvider>().t;
    final notificationProvider = context.watch<NotificationProvider>();
    final hasUnread = notificationProvider.unreadCount > 0;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              t('notifications'),
              style: TextStyle(
                color: AppTheme.textPrimary,
                fontWeight: FontWeight.w900,
                fontSize: 18.sp,
              ),
            ),
            if (notificationProvider.unreadCount > 0)
              Text(
                '${notificationProvider.unreadCount} cusub',
                style: TextStyle(
                  color: AppTheme.primary,
                  fontSize: 11.sp,
                  fontWeight: FontWeight.w700,
                ),
              ),
          ],
        ),
        actions: [
          // Mark all as read button
          if (hasUnread)
            TextButton.icon(
              onPressed: () async {
                await notificationProvider.markAllAsRead();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Dhammaan waa la akhristay'),
                      backgroundColor: AppTheme.success,
                      duration: Duration(seconds: 2),
                    ),
                  );
                }
              },
              icon: const Icon(Icons.done_all_rounded, size: 16),
              label: Text(
                'Akhri',
                style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w700),
              ),
            ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => notificationProvider.fetchNotifications(),
          ),
        ],
      ),
      body: notificationProvider.isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () => notificationProvider.fetchNotifications(),
              child: Builder(
                builder: (context) {
                  final allNotifications = notificationProvider.notifications;

                  if (allNotifications.isEmpty) {
                    return _buildEmptyState(t);
                  }

                  return ListView.builder(
                    padding: EdgeInsets.all(16.w),
                    itemCount: allNotifications.length,
                    itemBuilder: (context, index) {
                      final n = allNotifications[index];
                      return _buildNotificationCard(
                          context, n, notificationProvider);
                    },
                  );
                },
              ),
            ),
    );
  }

  Widget _buildEmptyState(Function t) {
    return ListView(
      // Wrapping in ListView to allow pull-to-refresh even on empty state
      children: [
        SizedBox(
          height: MediaQuery.of(context).size.height * 0.6,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 100.w,
                height: 100.h,
                decoration: const BoxDecoration(
                  color: Color(0xFFEFF6FF),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.notifications_none_outlined,
                  size: 52,
                  color: AppTheme.primary,
                ),
              ),
              SizedBox(height: 20.h),
              Text(
                t('no_notifications') ?? 'Ma jiraan ogeysiisyu',
                style: TextStyle(
                  color: AppTheme.textPrimary,
                  fontSize: 17.sp,
                  fontWeight: FontWeight.w800,
                ),
              ),
              SizedBox(height: 8.h),
              Text(
                'Ogeysiisyadaada halkan ayay ka muuqdaan',
                style: TextStyle(
                  color: AppTheme.textSecondary,
                  fontSize: 13.sp,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildNotificationCard(
      BuildContext context, dynamic n, NotificationProvider provider) {
    final bool isUnread =
        n['status'] == 'sent' || n['status'] == 'unread';
    final String title = n['title'] ?? 'Ogeysiis';
    final String message = n['message'] ?? '';
    final String dateStr = n['created_at']?.toString() ?? '';

    // Attendance cards get a warm amber accent to stand out
    final bool isAttendance = (n['type']?.toString().toUpperCase() == 'ATTENDANCE');
    final Color accentColor = isAttendance
        ? const Color(0xFFF59E0B)   // amber for attendance
        : const Color(0xFF2563EB);  // blue for others

    return InkWell(
      borderRadius: BorderRadius.circular(16.r),
      onTap: () {
        if (isUnread) {
          provider.markAsRead(n['id']);
        }
        _showNotificationDialog(context, n);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        margin: const EdgeInsets.only(bottom: 10),
        padding: EdgeInsets.all(16.w),
        decoration: BoxDecoration(
          color: isUnread
              ? accentColor.withValues(alpha: 0.05)
              : Colors.white,
          borderRadius: BorderRadius.circular(16.r),
          border: Border.all(
            color: isUnread
                ? accentColor.withValues(alpha: 0.25)
                : const Color(0xFFE2E8F0),
            width: isUnread ? 1.5 : 1,
          ),
          boxShadow: isUnread
              ? [
                  BoxShadow(
                    color: accentColor.withValues(alpha: 0.06),
                    blurRadius: 8.r,
                    offset: const Offset(0, 2),
                  )
                ]
              : [],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Icon circle
            Container(
              padding: EdgeInsets.all(10.w),
              decoration: BoxDecoration(
                color: isUnread
                    ? accentColor.withValues(alpha: 0.1)
                    : const Color(0xFFF1F5F9),
                shape: BoxShape.circle,
              ),
              child: Icon(
                _getIconForType(n['type']),
                size: 20,
                color: isUnread
                    ? accentColor
                    : AppTheme.textSecondary,
              ),
            ),
            SizedBox(width: 14.w),
            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: TextStyle(
                            fontWeight: isUnread
                                ? FontWeight.w900
                                : FontWeight.w600,
                            fontSize: 14.sp,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                      ),
                      SizedBox(width: 8.w),
                      if (isUnread)
                        Container(
                          width: 8.w,
                          height: 8.h,
                          margin: const EdgeInsets.only(top: 4),
                          decoration: const BoxDecoration(
                            color: Color(0xFF2563EB),
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  if (message.isNotEmpty) ...[
                    SizedBox(height: 4.h),
                    Text(
                      message,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13.sp,
                        color: isUnread
                            ? AppTheme.textPrimary.withValues(alpha: 0.80)
                            : AppTheme.textSecondary,
                        height: 1.4.h,
                      ),
                    ),
                  ],
                  SizedBox(height: 8.h),
                  Row(
                    children: [
                      Icon(
                        Icons.access_time_rounded,
                        size: 11,
                        color:
                            AppTheme.textSecondary.withValues(alpha: 0.5),
                      ),
                      SizedBox(width: 4.w),
                      Text(
                        _formatDate(dateStr),
                        style: TextStyle(
                          fontSize: 11.sp,
                          color:
                              AppTheme.textSecondary.withValues(alpha: 0.6),
                        ),
                      ),
                      const Spacer(),
                      // Status chip
                      Container(
                        padding: EdgeInsets.symmetric(
                            horizontal: 8.w, vertical: 2.h),
                        decoration: BoxDecoration(
                          color: isUnread
                              ? accentColor.withValues(alpha: 0.1)
                              : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(20.r),
                        ),
                        child: Text(
                          isUnread ? 'Cusub' : 'La akhristay',
                          style: TextStyle(
                            fontSize: 10.sp,
                            fontWeight: FontWeight.w700,
                            color: isUnread
                                ? accentColor
                                : AppTheme.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _getIconForType(String? type) {
    switch (type?.toUpperCase()) {
      case 'SMS':
        return Icons.sms_outlined;
      case 'EXAM':
        return Icons.assignment_outlined;
      case 'PAYMENT':
        return Icons.payments_outlined;
      case 'ATTENDANCE':
        return Icons.calendar_today_outlined;
      case 'HOMEWORK':
        return Icons.book_outlined;
      default:
        return Icons.notifications_outlined;
    }
  }

  String _formatDate(String dateStr) {
    if (dateStr.isEmpty) return '';
    try {
      final DateTime dt = DateTime.parse(dateStr);
      final now = DateTime.now();
      final diff = now.difference(dt);

      if (diff.inMinutes < 1) {
        return 'Hadda ayuu yimid';
      } else if (diff.inMinutes < 60) {
        return '${diff.inMinutes} daqiiqo ka hor';
      } else if (diff.inHours < 24) {
        return '${diff.inHours} saac ka hor';
      } else if (diff.inDays == 1) {
        return 'Shalay';
      } else if (diff.inDays < 7) {
        return '${diff.inDays} maalin ka hor';
      } else {
        return dateStr.length >= 10 ? dateStr.substring(0, 10) : dateStr;
      }
    } catch (_) {
      return dateStr;
    }
  }

  void _showNotificationDialog(BuildContext context, dynamic n) {
    final bool isUnread =
        n['status'] == 'sent' || n['status'] == 'unread';
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24.r)),
        titlePadding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
        contentPadding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
        title: Row(
          children: [
            Container(
              padding: EdgeInsets.all(10.w),
              decoration: BoxDecoration(
                color: const Color(0xFF2563EB).withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                _getIconForType(n['type']),
                size: 20,
                color: const Color(0xFF2563EB),
              ),
            ),
            SizedBox(width: 12.w),
            Expanded(
              child: Text(
                n['title'] ?? 'Ogeysiis',
                style: TextStyle(
                  fontSize: 16.sp,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.textPrimary,
                ),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Divider(),
            SizedBox(height: 8.h),
            Text(
              n['message'] ?? '',
              style: TextStyle(
                fontSize: 14.sp,
                color: AppTheme.textSecondary,
                height: 1.5.h,
              ),
            ),
            SizedBox(height: 12.h),
            Text(
              _formatDate(n['created_at']?.toString() ?? ''),
              style: TextStyle(
                fontSize: 11.sp,
                color: AppTheme.textSecondary.withValues(alpha: 0.5),
              ),
            ),
          ],
        ),
        actions: [
          if (isUnread)
            TextButton(
              onPressed: () {
                context
                    .read<NotificationProvider>()
                    .markAsRead(n['id']);
                Navigator.pop(context);
              },
              child: const Text('Akhristay'),
            ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12.r)),
              padding:
                  EdgeInsets.symmetric(horizontal: 20.w, vertical: 10.h),
            ),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }
}

