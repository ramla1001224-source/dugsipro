import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../main.dart';
import '../../services/auth_service.dart';
import '../../config/api_config.dart';
import '../router/auth_state.dart';
import '../../services/locale_service.dart';
import 'package:provider/provider.dart';

class NavDrawer extends StatefulWidget {
  final String role;
  const NavDrawer({super.key, required this.role});

  @override
  State<NavDrawer> createState() => _NavDrawerState();
}

class _NavDrawerState extends State<NavDrawer> {
  final AuthService _auth = AuthService();
  bool _isImpersonating = false;

  String? _schoolName;
  String? _schoolLogo;
  String? _userName;

  @override
  void initState() {
    super.initState();
    _checkImpersonation();
  }

  Future<void> _checkImpersonation() async {
    final isImp = await _auth.isImpersonating();
    final name = await _auth.getSchoolName();
    final logo = await _auth.getSchoolLogo();
    final userName = await _auth.getName();
    if (mounted) {
      setState(() {
        _schoolName = name;
        _schoolLogo = logo;
        _isImpersonating = isImp;
        _userName = userName;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final localeProvider = Provider.of<LocaleProvider>(context);
    final t = localeProvider.t;
    final items = _getMenuItems(widget.role, t);
    return Drawer(
      backgroundColor: const Color(0xFF0F172A), // Matches Next.js dark sidebar
      child: SafeArea(
        child: Column(
          children: [
            // Header
            Container(
              padding: EdgeInsets.all(24.w),
              width: double.infinity,
              decoration: const BoxDecoration(
                border: Border(
                  bottom: BorderSide(color: Color(0xFF1E293B)),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // School row
                  Row(
                    children: [
                      Container(
                        width: 40.w,
                        height: 40.h,
                        decoration: BoxDecoration(
                          color: _schoolLogo != null ? Colors.transparent : null,
                          gradient: _schoolLogo == null
                              ? const LinearGradient(
                                  colors: [AppTheme.primary, AppTheme.accent],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                )
                              : null,
                          borderRadius: BorderRadius.circular(10.r),
                        ),
                        child: _schoolLogo != null
                            ? ClipRRect(
                                borderRadius: BorderRadius.circular(10.r),
                                child: Image.network(
                                  _schoolLogo!.startsWith('http')
                                      ? _schoolLogo!
                                      : '${ApiConfig.baseUrl.endsWith('/') ? ApiConfig.baseUrl.substring(0, ApiConfig.baseUrl.length - 1) : ApiConfig.baseUrl}${_schoolLogo!.startsWith('/') ? _schoolLogo : '/$_schoolLogo'}',
                                  fit: BoxFit.cover,
                                  errorBuilder: (ctx, err, stack) => const Icon(
                                    Icons.school_rounded,
                                    color: Colors.white,
                                    size: 24,
                                  ),
                                ),
                              )
                            : ClipRRect(
                                borderRadius: BorderRadius.circular(10.r),
                                child: Image.asset(
                                  'assets/images/app_icon.png',
                                  fit: BoxFit.cover,
                                ),
                              ),
                      ),
                      SizedBox(width: 14.w),
                      Expanded(
                        child: Text(
                          _schoolName ?? 'Smart School',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 15.sp,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.5,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 20.h),
                  // User avatar + name row
                  Row(
                    children: [
                      Container(
                        width: 44.w,
                        height: 44.h,
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(14.r),
                          border: Border.all(color: const Color(0xFF334155), width: 2.w),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(12.r),
                        child: const Icon(
                          Icons.person_rounded,
                          color: Colors.white70,
                          size: 24,
                        ),
                        ),
                      ),
                      SizedBox(width: 12.w),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _userName ?? 'User',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 13.sp,
                                fontWeight: FontWeight.w700,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                            SizedBox(height: 4.h),
                            Container(
                              padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 2.h),
                              decoration: BoxDecoration(
                                color: AppTheme.primary.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(6.r),
                                border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
                              ),
                              child: Text(
                                widget.role.toUpperCase(),
                                style: TextStyle(
                                  color: const Color(0xFF93C5FD),
                                  fontSize: 9.sp,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 1,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            if (_isImpersonating)
              Container(
                margin: EdgeInsets.all(16.w),
                width: double.infinity,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor:
                        const Color(0xFFDC2626).withValues(alpha: 0.2),
                    foregroundColor: const Color(0xFFFCA5A5),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12.r),
                      side: BorderSide(
                          color:
                              const Color(0xFFDC2626).withValues(alpha: 0.3)),
                    ),
                    padding: EdgeInsets.symmetric(vertical: 12.h),
                  ),
                  icon: const Icon(Icons.exit_to_app_rounded, size: 16),
                  label: Text(
                    t('return_to_super'),
                    style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w800),
                  ),
                  onPressed: () async {
                    await _auth.returnToOwner();
                    final role = await _auth.getRole();
                    if (context.mounted) {
                      AuthState().update(true, role);
                      Navigator.pop(context);
                      // Adding a timestamp forces GoRouter to re-build the page if already on it
                      final uri = Uri(
                        path: '/owner-dashboard',
                        queryParameters: {
                          't': DateTime.now().millisecondsSinceEpoch.toString()
                        },
                      ).toString();
                      GoRouter.of(context).go(uri);
                    }
                  },
                ),
              ),

            // Menu items
            Expanded(
              child: ListView(
                padding: EdgeInsets.symmetric(
                  vertical: 12.h,
                  horizontal: 16.w,
                ),
                children:
                    items.map((item) => _buildMenuNode(context, item)).toList(),
              ),
            ),

            // Logout Footer
            Container(
              padding: EdgeInsets.all(16.w),
              decoration: const BoxDecoration(
                border: Border(
                  top: BorderSide(color: Color(0xFF1E293B)),
                ),
              ),
              child: ListTile(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12.r),
                ),
                hoverColor: Colors.white.withValues(alpha: 0.05),
                leading: const Icon(
                  Icons.logout_rounded,
                  color: Color(0xFFFCA5A5),
                  size: 20,
                ),
                title: Text(
                  t('logout'),
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13.sp,
                    color: const Color(0xFFFCA5A5),
                  ),
                ),
                onTap: () async {
                  await _auth.logout();
                  if (context.mounted) {
                    AuthState().update(false, null);
                    Navigator.pop(context);
                    GoRouter.of(context).go('/login');
                  }
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuNode(BuildContext context, Map<String, dynamic> item) {
    if (item.containsKey('isDivider') && item['isDivider'] == true) {
      return Padding(
        padding: const EdgeInsets.only(top: 24, bottom: 8, left: 12),
        child: Text(
          (item['label'] as String).toUpperCase(),
          style: TextStyle(
            color: const Color(0xFF64748B),
            fontSize: 10.sp,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.5,
          ),
        ),
      );
    }

    if (item.containsKey('children')) {
      final children = item['children'] as List<Map<String, dynamic>>;
      final currentRoute = GoRouterState.of(context).matchedLocation;
      final isExpanded = children.any((c) => currentRoute == c['route']);

      return Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: isExpanded,
          tilePadding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 0.h),
          childrenPadding: const EdgeInsets.only(left: 12, bottom: 8),
          iconColor: const Color(0xFF94A3B8),
          collapsedIconColor: const Color(0xFF64748B),
          leading: Icon(
            item['icon'],
            color: isExpanded ? Colors.white : const Color(0xFF94A3B8),
            size: 20,
          ),
          title: Text(
            item['label'],
            style: TextStyle(
              fontWeight: isExpanded ? FontWeight.w700 : FontWeight.w600,
              fontSize: 13.sp,
              color: isExpanded ? Colors.white : const Color(0xFFCBD5E1),
            ),
          ),
          children: children
              .map((child) => _menuTile(context, child, isSub: true))
              .toList(),
        ),
      );
    }

    return _menuTile(context, item);
  }

  Widget _menuTile(BuildContext context, Map<String, dynamic> item,
      {bool isSub = false}) {
    final currentRoute = GoRouterState.of(context).matchedLocation;
    final isActive = currentRoute == item['route'];

    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: ListTile(
        dense: true,
        contentPadding:
            EdgeInsets.symmetric(horizontal: isSub ? 16 : 12, vertical: 0.h),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10.r)),
        tileColor: isActive
            ? AppTheme.primary.withValues(alpha: 0.15)
            : Colors.transparent,
        leading: isSub
            ? Container(
                width: 6.w,
                height: 6.h,
                margin: const EdgeInsets.only(left: 8, right: 8),
                decoration: BoxDecoration(
                  color: isActive ? AppTheme.primary : const Color(0xFF475569),
                  shape: BoxShape.circle,
                ),
              )
            : Icon(
                item['icon'],
                color: isActive ? AppTheme.primary : const Color(0xFF94A3B8),
                size: 20,
              ),
        title: Text(
          item['label'],
          style: TextStyle(
            fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
            fontSize: isSub ? 12 : 13,
            color: isActive ? Colors.white : const Color(0xFFCBD5E1),
          ),
        ),
        onTap: () {
          Navigator.pop(context);
          if (item['route'] == '/dashboard' ||
              item['route'] == '/owner-dashboard') {
            GoRouter.of(context).go(item['route']);
          } else {
            GoRouter.of(context).push(item['route']);
          }
        },
      ),
    );
  }

  List<Map<String, dynamic>> _getMenuItems(String role, String Function(String) t) {
    final roleLower = (role).toLowerCase();
    if (roleLower == 'owner' || roleLower == 'super_admin') {
      return [
        {
          'label': t('dashboard'),
          'icon': Icons.dashboard_rounded,
          'route': roleLower == 'owner' ? '/owner-dashboard' : '/dashboard'
        },
        if (roleLower == 'super_admin')
          {
            'label': 'Maamul Dugsiyada',
            'icon': Icons.account_balance_rounded,
            'route': '/owner-dashboard'
          },
        if (widget.role == 'owner')
          {
            'label': t('manage_super_admins'),
            'icon': Icons.admin_panel_settings_rounded,
            'route': '/owner-admins'
          },
        {'label': t('profile'), 'icon': Icons.person_rounded, 'route': '/profile'},
        {'label': t('settings'), 'icon': Icons.settings_rounded, 'route': '/settings'},
      ];
    } else if (roleLower == 'admin') {
      return [
        {'label': t('management'), 'isDivider': true},
        {
          'label': t('dashboard'),
          'icon': Icons.dashboard_rounded,
          'route': '/dashboard'
        },
        {'label': t('profile'), 'icon': Icons.person_rounded, 'route': '/profile'},
        {
          'label': t('student_hub'),
          'icon': Icons.face_rounded,
          'route': '/student-hub'
        },
        {
          'label': t('parents'),
          'icon': Icons.family_restroom_rounded,
          'route': '/parents'
        },
        {
          'label': t('teachers'),
          'icon': Icons.assignment_ind_rounded,
          'route': '/teachers'
        },
        {'label': t('staff'), 'icon': Icons.groups_rounded, 'route': '/staff'},
        {
          'label': t('academic'),
          'icon': Icons.school_rounded,
          'route': '/academic'
        },
        {
          'label': t('library'),
          'icon': Icons.local_library_rounded,
          'route': '/library'
        },
        {'label': t('academic'), 'isDivider': true},
        {
          'label': t('exam_center'),
          'icon': Icons.quiz_rounded,
          'route': '/exam-hub'
        },
        {
          'label': t('timetable'),
          'icon': Icons.calendar_month_rounded,
          'route': '/timetable'
        },
        {
          'label': t('elearning'),
          'icon': Icons.assignment_rounded,
          'route': '/student-quizzes'
        },
        {
          'label': t('video_lessons'),
          'icon': Icons.video_collection_rounded,
          'route': '/lessons'
        },
        {
          'label': t('homework'),
          'icon': Icons.menu_book_rounded,
          'route': '/homework'
        },
        {
          'label': t('zoom_live'),
          'icon': Icons.video_camera_front_rounded,
          'route': '/zoom'
        },
        {'label': t('finance'), 'isDivider': true},
        {
          'label': t('reports'),
          'icon': Icons.trending_up_rounded,
          'route': '/reports'
        },
        {
          'label': t('fees'),
          'icon': Icons.payments_rounded,
          'route': '/fees'
        },
        {'label': t('payroll'), 'icon': Icons.money_rounded, 'route': '/payroll'},
        {
          'label': t('expenses'),
          'icon': Icons.receipt_long_rounded,
          'route': '/expenses'
        },
        {
          'label': t('notifications'),
          'icon': Icons.notifications_active_rounded,
          'route': '/notifications'
        },
        {
          'label': 'SMS Waalidiinta',
          'icon': Icons.sms_rounded,
          'route': '/sms-parents'
        },
        {
          'label': t('announcements'),
          'icon': Icons.campaign_rounded,
          'route': '/announcements'
        },
        {'label': t('events'), 'icon': Icons.event_rounded, 'route': '/events'},
        {'label': t('system'), 'isDivider': true},
        {
          'label': t('settings'),
          'icon': Icons.settings_rounded,
          'route': '/settings'
        },
      ];
    } else if (roleLower == 'teacher') {
      return [
        {
          'label': t('dashboard'),
          'icon': Icons.dashboard_rounded,
          'route': '/dashboard'
        },
        {'label': t('exams'), 'icon': Icons.quiz_rounded, 'route': '/exams'},
        {
          'label': t('exam_schedule') ?? 'Exams Schedule',
          'icon': Icons.event_available_rounded,
          'route': '/exam-schedule'
        },
        {
          'label': t('timetable'),
          'icon': Icons.calendar_month_rounded,
          'route': '/timetable'
        },
        {
          'label': t('homework'),
          'icon': Icons.menu_book_rounded,
          'route': '/homework'
        },
        {
          'label': t('zoom_live'),
          'icon': Icons.video_camera_front_rounded,
          'route': '/zoom'
        },
        {
          'label': t('video_lessons'),
          'icon': Icons.video_collection_rounded,
          'route': '/lessons'
        },
        {
          'label': t('elearning'),
          'icon': Icons.assignment_rounded,
          'route': '/student-quizzes'
        },
        {
          'label': t('announcements'),
          'icon': Icons.campaign_rounded,
          'route': '/announcements'
        },
        {
          'label': t('settings'),
          'icon': Icons.settings_rounded,
          'route': '/settings'
        },
      ];
    } else if (roleLower == 'accountant') {
      return [
        {
          'label': t('dashboard'),
          'icon': Icons.dashboard_rounded,
          'route': '/dashboard'
        },
        {
          'label': t('attendance'),
          'icon': Icons.fact_check_rounded,
          'route': '/attendance'
        },
        {
          'label': t('fees'),
          'icon': Icons.payments_rounded,
          'route': '/fees'
        },
        {'label': t('profile'), 'icon': Icons.person_rounded, 'route': '/profile'},
        {
          'label': t('settings'),
          'icon': Icons.settings_rounded,
          'route': '/settings'
        },
      ];
    } else if (roleLower == 'librarian') {
      return [
        {
          'label': t('dashboard'),
          'icon': Icons.dashboard_rounded,
          'route': '/dashboard'
        },
        {
          'label': t('library'),
          'icon': Icons.local_library_rounded,
          'route': '/library'
        },
        {'label': t('profile'), 'icon': Icons.person_rounded, 'route': '/profile'},
        {
          'label': t('settings'),
          'icon': Icons.settings_rounded,
          'route': '/settings'
        },
      ];
    } else if (roleLower == 'parent') {
      return [
        {
          'label': t('dashboard'),
          'icon': Icons.dashboard_rounded,
          'route': '/dashboard'
        },
        {
          'label': t('attendance'),
          'icon': Icons.fact_check_rounded,
          'route': '/parent-attendance-history'
        },
        {
          'label': t('marks'),
          'icon': Icons.assessment_rounded,
          'route': '/student-results'
        },
        {
          'label': t('exams_schedule'),
          'icon': Icons.calendar_today_rounded,
          'route': '/exams/schedule'
        },
        {'label': t('profile'), 'icon': Icons.person_rounded, 'route': '/profile'},
        {
          'label': t('announcements'),
          'icon': Icons.campaign_rounded,
          'route': '/announcements'
        },
        {
          'label': t('settings'),
          'icon': Icons.settings_rounded,
          'route': '/settings'
        },
      ];
    } else if (roleLower == 'staff') {
      return [
        {
          'label': t('dashboard'),
          'icon': Icons.dashboard_rounded,
          'route': '/dashboard'
        },
        {'label': t('profile'), 'icon': Icons.person_rounded, 'route': '/profile'},
        {
          'label': t('settings'),
          'icon': Icons.settings_rounded,
          'route': '/settings'
        },
      ];
    } else {
      // student role
      return [
        {
          'label': t('dashboard'),
          'icon': Icons.dashboard_rounded,
          'route': '/dashboard'
        },
        {'label': t('profile'), 'icon': Icons.person_rounded, 'route': '/profile'},
        {
          'label': t('timetable'),
          'icon': Icons.calendar_month_rounded,
          'route': '/timetable'
        },
        {
          'label': t('homework'),
          'icon': Icons.menu_book_rounded,
          'route': '/homework'
        },
        {
          'label': t('zoom_live'),
          'icon': Icons.video_camera_front_rounded,
          'route': '/zoom'
        },
        {
          'label': t('marks'),
          'icon': Icons.assessment_rounded,
          'route': '/student-results'
        },
        {
          'label': t('elearning'),
          'icon': Icons.assignment_rounded,
          'route': '/student-quizzes'
        },
        {
          'label': t('video_lessons'),
          'icon': Icons.video_collection_rounded,
          'route': '/lessons'
        },
        {
          'label': t('exams_schedule'),
          'icon': Icons.calendar_today_rounded,
          'route': '/exams/schedule'
        },
        {
          'label': t('announcements'),
          'icon': Icons.campaign_rounded,
          'route': '/announcements'
        },
        {
          'label': t('settings'),
          'icon': Icons.settings_rounded,
          'route': '/settings'
        },
      ];
    }
  }
}

