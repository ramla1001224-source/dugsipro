import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:shimmer/shimmer.dart';
import 'package:dio/dio.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../services/locale_service.dart';
import 'package:provider/provider.dart';
import '../../config/api_config.dart';
import '../../widgets/nav_drawer.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../router/auth_state.dart';
import '../../providers/notification_provider.dart';

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// DashboardScreen — mirrors the web /admin/dashboard design
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final ApiService _api = ApiService();
  final AuthService _auth = AuthService();

  Map<String, dynamic>? _stats;
  String _role = '';
  String _name = '';
  bool _loading = true;
  bool _isImpersonating = false;
  String? _error;
  String _session = 'Break 1';
  String _shift = 'morning';

  List<dynamic> _academicYears = [];
  String? _selectedAcademicYearId;

  // Details modal state
  bool _showDetails = false;
  String _selectedStatus = '';
  bool _detailsLoading = false;
  List<dynamic> _details = [];

  // Parent specific state
  Map<String, dynamic>? _selectedChild;
  String? _selectedChildYearId; // Year for child details
  Map<String, dynamic> _childData = {
    'attendance': [],
    'grades': [],
    'payments': [],
    'statusHistory': [],
    'studentInfo': null // Historical metadata
  };
  bool _childLoading = false;

  // Announcements state
  List<dynamic> _announcements = [];
  bool _announcementsLoading = false;

  // â”€â”€â”€ Egress Optimization: App-level memory cache (5-minute TTL) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Static so it persists across navigations without re-fetching
  static Map<String, dynamic>? _cachedStats;
  static List<dynamic>? _cachedAnnouncements;
  static List<dynamic>? _cachedAcademicYears;
  static DateTime? _statsCacheTime;
  static DateTime? _announcementsCacheTime;
  static DateTime? _academicYearsCacheTime;
  static const _kCacheTtl = Duration(minutes: 5);
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @override
  void initState() {
    super.initState();
    _loadDashboard();
  }

  Future<void> _loadDashboard() async {
    final role = await _auth.getRole();
    _role = (role ?? 'admin').toLowerCase();
    _name = await _auth.getName() ?? '';
    _isImpersonating = await _auth.isImpersonating();

    // Trigger notification count refresh
    if (mounted) {
      Provider.of<NotificationProvider>(context, listen: false).fetchUnreadCount();
    }

    await _fetchAcademicYears();
    await _fetchStats();
    await _fetchAnnouncements();
  }

  Future<void> _fetchAnnouncements({bool forceRefresh = false}) async {
    if (!mounted) return;

    // Check cache first (skip network if fresh)
    final now = DateTime.now();
    if (!forceRefresh &&
        _cachedAnnouncements != null &&
        _announcementsCacheTime != null &&
        now.difference(_announcementsCacheTime!) < _kCacheTtl) {
      if (mounted) setState(() => _announcements = _cachedAnnouncements!);
      return;
    }

    setState(() => _announcementsLoading = true);
    try {
      final res = await _api.get(ApiConfig.announcements);
      if (mounted) {
        final data = res.data is List
            ? res.data
            : (res.data is Map ? (res.data['data'] ?? []) : []);
        // Update cache
        _cachedAnnouncements = data;
        _announcementsCacheTime = DateTime.now();
        setState(() {
          _announcements = data;
          _announcementsLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _announcementsLoading = false);
    }
  }


  Future<void> _fetchAcademicYears({bool forceRefresh = false}) async {
    // Check cache first
    final now = DateTime.now();
    if (!forceRefresh &&
        _cachedAcademicYears != null &&
        _academicYearsCacheTime != null &&
        now.difference(_academicYearsCacheTime!) < _kCacheTtl) {
      if (mounted) {
        setState(() {
          _academicYears = _cachedAcademicYears!;
          final current = _academicYears.firstWhere(
            (y) => y['isCurrent'] == true, orElse: () => null);
          if (current != null) {
            _selectedAcademicYearId = current['id']?.toString();
          } else if (_academicYears.isNotEmpty) {
            _selectedAcademicYearId = _academicYears[0]['id']?.toString();
          }
        });
      }
      return;
    }

    try {
      final res = await _api.get(ApiConfig.academicYears);
      if (mounted) {
        final data = res.data is List ? res.data : (res.data['data'] ?? []);
        // Update cache
        _cachedAcademicYears = data;
        _academicYearsCacheTime = DateTime.now();
        setState(() {
          _academicYears = data;
          final current = _academicYears
              .firstWhere((y) => y['isCurrent'] == true, orElse: () => null);
          if (current != null) {
            _selectedAcademicYearId = current['id']?.toString();
          } else {
            if (_academicYears.isNotEmpty) {
              _selectedAcademicYearId = _academicYears[0]['id']?.toString();
            }
          }
        });
      }
    } catch (_) {}
  }

  Future<void> _fetchStats({bool forceRefresh = false}) async {
    if (!mounted) return;

    // Check stats cache first (skip network if fresh and not forced)
    final now = DateTime.now();
    final cacheKey = '${_role}_${_session}_$_shift';
    if (!forceRefresh &&
        _cachedStats != null &&
        _statsCacheTime != null &&
        now.difference(_statsCacheTime!) < _kCacheTtl &&
        _cachedStats!['_cacheKey'] == cacheKey) {
      if (mounted) setState(() { _stats = _cachedStats; _loading = false; });
      return;
    }

    setState(() => _loading = true);
    try {
      if (_role == 'parent') {
        await _fetchParentDashboard();
        return;
      }

      String endpoint;
      if (_role == 'teacher') {
        endpoint = ApiConfig.teacherStats;
      } else if (_role == 'accountant') {
        endpoint = ApiConfig.accountantStats;
      } else if (_role == 'librarian') {
        endpoint = ApiConfig.librarianDashboardStats;
      } else if (_role == 'staff') {
        endpoint = ApiConfig.staffStats;
      } else if (_role == 'super_admin') {
        endpoint = ApiConfig.superAdminDashboard;
      } else if (_role == 'student') {
        endpoint = ApiConfig.studentStats;
      } else {
        endpoint = ApiConfig.dashboard;
      }

      // Append shift, session and academicYearId
      String queryParams =
          '?session=${Uri.encodeComponent(_session)}&shift=${Uri.encodeComponent(_shift)}';

      final response = await _api.get('$endpoint$queryParams');

      if (mounted) {
        final data = response.data as Map<String, dynamic>;
        // Update cache with the current key so stale filters are invalidated
        _cachedStats = {...data, '_cacheKey': cacheKey};
        _statsCacheTime = DateTime.now();
        setState(() {
          _stats = data;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          if (e is DioException &&
              (e.type == DioExceptionType.connectionTimeout ||
                  e.type == DioExceptionType.receiveTimeout ||
                  e.type == DioExceptionType.sendTimeout ||
                  e.type == DioExceptionType.connectionError ||
                  e.type == DioExceptionType.unknown)) {
            _error = 'Khadka Internet-ka ayaa kaa go\'an. Fadlan hubi.';
          } else if (e.toString().contains('401')) {
            _error = 'Fadlan dib u log-in gareey qad khaldan awgeed';
          } else {
            _error = 'Cillad: ${e.toString().split('message:').last.trim()}';
          }
        });
      }
    }
  }

  Future<void> _fetchParentDashboard() async {
    try {
      final res = await _api.get(ApiConfig.myChildren);
      final annRes = await _api.get(ApiConfig.announcements);

      if (mounted) {
        // Extract data correctly from potentially wrapped responseHelper structure
        final childrenData = res.data is List
            ? res.data
            : (res.data is Map ? (res.data['data'] ?? []) : []);
        final annData = annRes.data is List
            ? annRes.data
            : (annRes.data is Map ? (annRes.data['data'] ?? []) : []);

        setState(() {
          _stats = {
            'children': childrenData,
          };
          _announcements = annData;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error =
              'Parent data error: ${e.toString().split('message:').last.trim()}';
        });
      }
    }
  }

  Future<void> _fetchDetails(String status, {bool isPayment = false}) async {
    setState(() {
      _selectedStatus = status;
      _showDetails = true;
      _detailsLoading = true;
      _details = [];
    });
    try {
      // Since ApiConfig.dashboard is now '/api/dashboard/stats',
      // we need to get the base path '/api/dashboard' for details
      final baseDashboard = ApiConfig.dashboard.replaceAll('/stats', '');
      final endpoint = isPayment ? 'payment-details' : 'attendance-details';
      final query = isPayment
          ? 'status=$status&shift=${Uri.encodeComponent(_shift)}'
          : 'status=$status&session=${Uri.encodeComponent(_session)}&shift=${Uri.encodeComponent(_shift)}';
      final res = await _api.get('$baseDashboard/$endpoint?$query');
      if (mounted) {
        final data = res.data;
        setState(() => _details =
            data is List ? data : (data is Map ? (data['data'] ?? []) : []));
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _detailsLoading = false);
    }
  }

  Future<void> _handleSync() async {
    setState(() => _loading = true);
    try {
      // Simulate bulk sync pull/push
      await _api.get(ApiConfig.syncPull);
      await Future.delayed(const Duration(seconds: 1));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Data synced successfully!'),
          backgroundColor: AppTheme.success,
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Sync error: ${e.toString()}')));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }


  @override
  Widget build(BuildContext context) {
    final localeProvider = Provider.of<LocaleProvider>(context);
    final t = localeProvider.t;

    return Stack(
      children: [
        Scaffold(
          extendBodyBehindAppBar: true,
          backgroundColor: Colors.transparent,
          body: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFFF8FAFC), Color(0xFFEFF6FF)],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
            child: SafeArea(
              child: _loading
                  ? _buildSkeleton()
                  : _error != null
                      ? Center(
                          child: Padding(
                            padding: EdgeInsets.all(32.w),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.wifi_off_rounded,
                                    color: Color(0xFFDC2626), size: 60),
                                SizedBox(height: 16.h),
                                Text(
                                  _error!,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                      color: Color(0xFFDC2626),
                                      fontWeight: FontWeight.w700),
                                ),
                                SizedBox(height: 24.h),
                                ElevatedButton.icon(
                                  onPressed: () {
                                    setState(() => _error = null);
                                    _fetchStats();
                                  },
                                  icon: const Icon(Icons.refresh_rounded),
                                  label: const Text('Try again'),
                                ),
                              ],
                            ),
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: () => _fetchStats(forceRefresh: true),
                          child: SingleChildScrollView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
                            child: Column(
                              children: [
                                if (_isImpersonating)
                                  _buildImpersonationBanner(),
                                SizedBox(height: 10.h),
                                _role == 'super_admin'
                                    ? _buildSuperAdminBody(t)
                                    : _role == 'admin' || _role == 'owner'
                                        ? _buildAdminBody(t)
                                        : _role == 'teacher'
                                            ? _buildTeacherBody(t)
                                            : _role == 'parent'
                                                ? _buildParentBody(t)
                                                : _role == 'accountant'
                                                    ? _buildAccountantBody(t)
                                                    : _role == 'librarian'
                                                        ? _buildLibrarianBody(t)
                                                        : _role == 'staff'
                                                            ? _buildStaffBody(t)
                                                            : _buildStudentBody(t),
                              ],
                            ),
                          ),
                        ),
            ),
          ),
          drawer: NavDrawer(role: _role),
          appBar: AppBar(
            backgroundColor: Colors.white.withValues(alpha: 0.8),
            elevation: 0,
            flexibleSpace: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                child: Container(color: Colors.transparent),
              ),
            ),
            surfaceTintColor: Colors.transparent,
            title: FutureBuilder<String?>(
              future: _auth.getSchoolLogo(),
              builder: (context, snapshot) {
                final logo = snapshot.data;
                return Row(
                  children: [
                    if (logo != null)
                      Container(
                        width: 32.w,
                        height: 32.h,
                        margin: const EdgeInsets.only(right: 10),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(8.r),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.1),
                              blurRadius: 4.r,
                            )
                          ],
                        ),
                        padding: EdgeInsets.all(4.w),
                        child: Image.network(
                          logo.startsWith('http')
                              ? logo
                              : '${ApiConfig.baseUrl.endsWith('/') ? ApiConfig.baseUrl.substring(0, ApiConfig.baseUrl.length - 1) : ApiConfig.baseUrl}${logo.startsWith('/') ? logo : '/$logo'}',
                          fit: BoxFit.contain,
                          errorBuilder: (ctx, err, stack) => const Icon(
                            Icons.school_rounded,
                            color: AppTheme.primary,
                            size: 16,
                          ),
                        ),
                      ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            t('dashboard'),
                            style: TextStyle(
                                fontSize: 16.sp,
                                fontWeight: FontWeight.w900,
                                color: AppTheme.textPrimary),
                          ),
                          Text(
                            '${t('welcome')}, $_name',
                            style: TextStyle(
                                fontSize: 10.sp,
                                color: AppTheme.textSecondary,
                                fontWeight: FontWeight.w500),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              }
            ),
            actions: [
              Consumer<NotificationProvider>(
                builder: (context, notificationProvider, _) {
                  return Stack(
                    clipBehavior: Clip.none,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.notifications_outlined,
                            color: AppTheme.textPrimary),
                        onPressed: () => GoRouter.of(context).push('/notifications'),
                      ),
                      if (notificationProvider.unreadCount > 0)
                        Positioned(
                          right: 8,
                          top: 8,
                          child: Container(
                            padding: EdgeInsets.all(4.w),
                            decoration: const BoxDecoration(
                              color: Color(0xFFDC2626), // red-600
                              shape: BoxShape.circle,
                            ),
                            constraints: const BoxConstraints(
                              minWidth: 16,
                              minHeight: 16,
                            ),
                            child: Text(
                              '${notificationProvider.unreadCount}',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 8.sp,
                                fontWeight: FontWeight.w900,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
              Padding(
                padding: const EdgeInsets.only(right: 12),
                child: GestureDetector(
                  onTap: () => GoRouter.of(context).push('/profile'),
                  child: CircleAvatar(
                    backgroundColor: AppTheme.primary.withValues(alpha: 0.1),
                    child: Text(
                      _name.isNotEmpty ? _name[0].toUpperCase() : 'U',
                      style: const TextStyle(
                          color: AppTheme.primary, fontWeight: FontWeight.w900),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        if (_showDetails) _buildDetailsOverlay(),
        if (_selectedChild != null) _buildChildDetailsOverlay(t),
      ],
    );
  }

  // â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”
  Widget _buildSkeleton() {
    return Shimmer.fromColors(
      baseColor: Colors.grey[300]!,
      highlightColor: Colors.grey[100]!,
      child: SingleChildScrollView(
        padding: EdgeInsets.all(20.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: List.generate(
                  3,
                  (i) => Expanded(
                        child: Container(
                          margin: EdgeInsets.only(right: i < 2 ? 10 : 0),
                          height: 100.h,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16.r),
                          ),
                        ),
                      )),
            ),
            SizedBox(height: 24.h),
            Container(
                width: 150.w,
                height: 20.h,
                decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10.r))),
            SizedBox(height: 12.h),
            Container(
                height: 48.h,
                decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12.r))),
            SizedBox(height: 24.h),
            Row(
              children: [
                Expanded(
                    child: Container(
                        height: 120.h,
                        decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20.r)))),
                SizedBox(width: 12.w),
                Expanded(
                    child: Container(
                        height: 120.h,
                        decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20.r)))),
              ],
            ),
            SizedBox(height: 24.h),
            Container(
                height: 200.h,
                decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24.r))),
          ],
        ),
      ),
    );
  }

  // â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”

  // â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”
  Widget _buildAdminBody(String Function(String) t) {
    final counts = (_stats?['counts'] as Map?)?.cast<String, dynamic>() ??
        <String, dynamic>{};
    final financials =
        (_stats?['financials'] as Map?)?.cast<String, dynamic>() ??
            <String, dynamic>{};
    final attendance =
        (_stats?['attendance'] as Map?)?.cast<String, dynamic>() ??
            <String, dynamic>{};
    final paymentStatus =
        (_stats?['paymentStatus'] as Map?)?.cast<String, dynamic>() ??
            <String, dynamic>{};
    final graph = (_stats?['graph'] as List?) ?? [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildRecentAnnouncements(t),
        // â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”
        Row(
          children: [
            Expanded(
                child: _topStatCard(
                    t('students'),
                    '${counts['students'] ?? 0}',
                    const Color(0xFFFEF9C3),
                    const Color(0xFFCA8A04),
                    Icons.people_alt_rounded)),
            SizedBox(width: 10.w),
            Expanded(
                child: _topStatCard(
                    t('teachers'),
                    '${counts['teachers'] ?? 0}',
                    const Color(0xFFD1FAE5),
                    const Color(0xFF059669),
                    Icons.school_rounded)),
            SizedBox(width: 10.w),
            Expanded(
                child: _topStatCard(
                    t('management'),
                    '${counts['admins'] ?? 0}',
                    const Color(0xFFD1FAE5),
                    const Color(0xFF059669),
                    Icons.admin_panel_settings_rounded)),
          ],
        ),
        SizedBox(height: 10.h),
        Row(
          children: [
            Expanded(
                child: _topStatCard(
                    t('parents'),
                    '${counts['parents'] ?? 0}',
                    const Color(0xFFFFE4E6),
                    const Color(0xFFDC2626),
                    Icons.family_restroom_rounded)),
            SizedBox(width: 10.w),
            Expanded(
                child: _topStatCard(
                    t('staff'),
                    '${counts['employees'] ?? 0}',
                    const Color(0xFFEDE9FE),
                    const Color(0xFF7C3AED),
                    Icons.badge_rounded)),
            SizedBox(width: 10.w),
            Expanded(
                child: _topStatCard(
                    t('class'),
                    '${counts['classes'] ?? 0}',
                    const Color(0xFFDBEAFE),
                    const Color(0xFF2563EB),
                    Icons.class_rounded)),
          ],
        ),
        SizedBox(height: 20.h),

        // â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”
        Row(
          children: [
            Text(
              'VIEWING SESSION:',
              style: TextStyle(
                fontSize: 10.sp,
                fontWeight: FontWeight.w900,
                color: AppTheme.textSecondary,
                letterSpacing: 2,
              ),
            ),
            SizedBox(width: 12.w),
            Container(
              padding: EdgeInsets.all(4.w),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(12.r),
              ),
              child: Row(
                children: ['Break 1', 'Break 2'].map((s) {
                  final active = _session == s;
                  return GestureDetector(
                    onTap: () {
                      setState(() => _session = s);
                      _fetchStats();
                    },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: EdgeInsets.symmetric(
                          horizontal: 16.w, vertical: 8.h),
                      decoration: BoxDecoration(
                        color: active ? Colors.white : Colors.transparent,
                        borderRadius: BorderRadius.circular(8.r),
                        boxShadow: active
                            ? [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.06),
                                  blurRadius: 4.r,
                                )
                              ]
                            : [],
                      ),
                      child: Text(
                        s,
                        style: TextStyle(
                          fontSize: 10.sp,
                          fontWeight: FontWeight.w900,
                          color: active
                              ? AppTheme.primary
                              : AppTheme.textSecondary,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
        SizedBox(height: 12.h),
        Row(
          children: [
            Text(
              'VIEWING SHIFT:',
              style: TextStyle(
                fontSize: 10.sp,
                fontWeight: FontWeight.w900,
                color: AppTheme.textSecondary,
                letterSpacing: 2,
              ),
            ),
            SizedBox(width: 12.w),
            Container(
              padding: EdgeInsets.all(4.w),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(12.r),
              ),
              child: Row(
                children: [
                  {'label': 'ðŸŒ… SUBAX', 'val': 'morning'},
                  {'label': 'ðŸŒ‡ GALAB', 'val': 'afternoon'},
                  {'label': 'ðŸŒ™ HABEEN', 'val': 'night'}
                ].map((s) {
                  final active = _shift == s['val'];
                  return GestureDetector(
                    onTap: () {
                      setState(() => _shift = s['val']!);
                      _fetchStats();
                    },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: EdgeInsets.symmetric(
                          horizontal: 20.w, vertical: 8.h),
                      decoration: BoxDecoration(
                        color: active ? Colors.white : Colors.transparent,
                        borderRadius: BorderRadius.circular(8.r),
                        boxShadow: active
                            ? [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.06),
                                  blurRadius: 4.r,
                                )
                              ]
                            : [],
                      ),
                      child: Text(
                        s['label']!,
                        style: TextStyle(
                          fontSize: 10.sp,
                          fontWeight: FontWeight.w900,
                          color: active
                              ? AppTheme.primary
                              : AppTheme.textSecondary,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
        SizedBox(height: 20.h),

        // â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”
        _sectionLabel('ATTENDANCE OVERVIEW'),
        SizedBox(height: 12.h),
        Container(
          padding: EdgeInsets.all(16.w),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(28.r),
            border: Border.all(color: const Color(0xFFF1F5F9)),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                      child: _attendanceCard(
                          t('total_present').toUpperCase(),
                          '${attendance['present'] ?? 0}',
                          const Color(0xFF059669),
                          const Color(0xFFD1FAE5),
                          Icons.check_circle_rounded,
                          'Present',
                          t)),
                  SizedBox(width: 10.w),
                  Expanded(
                      child: _attendanceCard(
                          t('total_absent').toUpperCase(),
                          '${attendance['absent'] ?? 0}',
                          const Color(0xFFE11D48),
                          const Color(0xFFFFE4E6),
                          Icons.cancel_rounded,
                          'Absent',
                          t)),
                ],
              ),
              SizedBox(height: 10.h),
              Row(
                children: [
                  Expanded(
                      child: _attendanceCard(
                          t('total_late').toUpperCase(),
                          '${attendance['late'] ?? 0}',
                          const Color(0xFFD97706),
                          const Color(0xFFFEF3C7),
                          Icons.access_time_filled_rounded,
                          'Late',
                          t)),
                  SizedBox(width: 10.w),
                  Expanded(
                      child: _attendanceCard(
                          t('pending_classes').toUpperCase(),
                          '${attendance['unmarkedClasses'] ?? 0}',
                          const Color(0xFF94A3B8),
                          const Color(0xFFF1F5F9),
                          Icons.hourglass_empty_rounded,
                          'Pending',
                          t)),
                ],
              ),
            ],
          ),
        ),
        SizedBox(height: 24.h),
        // Shift & Session Toggle for Accountant
        Row(
          children: [
            Text(
              '${t('viewing').toUpperCase()}:',
              style: TextStyle(
                fontSize: 10.sp,
                fontWeight: FontWeight.w900,
                color: AppTheme.textSecondary,
                letterSpacing: 2,
              ),
            ),
            SizedBox(width: 8.w),
            _buildSmallToggle(['morning', 'afternoon', 'night'], _shift, (val) {
              setState(() => _shift = val);
              _fetchStats();
            }),
            SizedBox(width: 8.w),
            _buildSmallToggle(['Break 1', 'Break 2'], _session, (val) {
              setState(() => _session = val);
              _fetchStats();
            }),
          ],
        ),
        SizedBox(height: 24.h),

        // â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”
        _sectionLabel('${_currentMonth()} ${t('payment_status').toUpperCase()}'),
        SizedBox(height: 12.h),
        Container(
          padding: EdgeInsets.all(16.w),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(28.r),
            border: Border.all(color: const Color(0xFFF3F4F6)),
          ),
          child: Row(
            children: [
              Expanded(
                  child: _feeCard(
                      t('paid'),
                      '${paymentStatus['paid'] ?? 0}',
                      const Color(0xFF2563EB),
                      const Color(0xFFDBEAFE),
                      Icons.monetization_on_rounded,
                      'paid',
                      t)),
              SizedBox(width: 10.w),
              Expanded(
                  child: _feeCard(
                      t('unpaid'),
                      '${paymentStatus['unpaid'] ?? 0}',
                      const Color(0xFF0F172A),
                      const Color(0xFFF1F5F9),
                      Icons.hourglass_bottom_rounded,
                      'unpaid',
                      t)),
            ],
          ),
        ),
        SizedBox(height: 20.h),

        // Financial Overview
        _sectionLabel('FINANCIAL OVERVIEW'),
        SizedBox(height: 12.h),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 1.6,
          children: [
            _financialCard(
                t('collected_revenue').toUpperCase(),
                '\$${_fmt(financials['monthlyStudentPayments'])}',
                const Color(0xFF2563EB),
                const Color(0xFFDBEAFE),
                Icons.credit_card_rounded),
            _financialCard(
                t('expected_revenue').toUpperCase(),
                '\$${_fmt(financials['expectedRevenue'])}',
                const Color(0xFFF59E0B),
                const Color(0xFFFEF3C7),
                Icons.account_balance_wallet_rounded),

            _financialCard(
                'OTHER INCOME',
                '\$${_fmt(financials['currentOtherIncome'])}',
                const Color(0xFF059669),
                const Color(0xFFD1FAE5),
                Icons.trending_up_rounded),
            _financialCard(
                'MONTHLY EXPENSE',
                '\$${_fmt(financials['currentMonthExpense'])}',
                const Color(0xFFDC2626),
                const Color(0xFFFFE4E6),
                Icons.receipt_long_rounded),
          ],
        ),
        SizedBox(height: 20.h),

        // â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”
        if (graph.isNotEmpty) ...[
          _sectionLabel(t('income_expense_trend').toUpperCase()),
          SizedBox(height: 12.h),
          Container(
            padding: EdgeInsets.all(20.w),
            height: 260.h,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(28.r),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: _buildBarChart(graph),
          ),
          SizedBox(height: 8.h),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _legend(const Color(0xFF3B82F6), 'Income'),
              SizedBox(width: 20.w),
              _legend(const Color(0xFFEF4444), 'Expense'),
            ],
          ),
        ],

        // â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”
        SizedBox(height: 24.h),
        _sectionLabel('QUICK ACCESS'),
        SizedBox(height: 12.h),
        _buildQuickActions(t),
        // â”€â”€ Ad: Between sections â”€â”€
        
        SizedBox(height: 24.h),
      ],
    );
  }

  // â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”
  Widget _buildTeacherBody(String Function(String) t) {
    final s = _stats ?? {};
    final currentYear = _academicYears.isNotEmpty
        ? (_academicYears.firstWhere(
                (y) => y['isCurrent'] == true,
                orElse: () => _academicYears.first)['name'] ??
            '2026-2027 g')
        : '2026-2027 g';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildRecentAnnouncements(t),
        // Welcome Header
        Padding(
          padding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 24.h),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                t('welcome') + ', ' + (s['name']?.toString() ?? 'Teacher'),
                style: TextStyle(
                  color: const Color(0xFF1E293B),
                  fontSize: 24.sp,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                ),
              ),
              SizedBox(height: 4.h),
              Text(
                currentYear.toUpperCase(),
                style: TextStyle(
                  color: const Color(0xFF94A3B8),
                  fontSize: 10.sp,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 2,
                ),
              ),
            ],
          ),
        ),
        // Gradient School Banner
        FutureBuilder<String?>(
          future: _auth.getSchoolName(),
          builder: (context, snapshot) {
            final schName = snapshot.data ?? 'Smart School';
            return Container(
              margin: EdgeInsets.symmetric(horizontal: 20.w),
              padding: EdgeInsets.all(16.w),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppTheme.primary, AppTheme.accent],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16.r),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.primary.withValues(alpha: 0.3),
                    blurRadius: 10.r,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  const Icon(Icons.school_rounded, color: Colors.white, size: 32),
                  SizedBox(width: 16.w),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          schName.toUpperCase(),
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 12.sp,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.5,
                          ),
                        ),
                        SizedBox(height: 4.h),
                        Text(
                          'TEACHER PORTAL',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 10.sp,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        ),
        SizedBox(height: 20.h),
        // Stats Row
        Padding(
          padding: EdgeInsets.symmetric(horizontal: 20.w),
          child: Row(
            children: [
              Expanded(
                child: _studentStatCard(
                  'classes',
                  (s['myClasses'] ?? 0).toString(),
                  'ASSIGNED',
                  const Color(0xFF10B981),
                  Icons.book_rounded,
                  t,
                ),
              ),
              SizedBox(width: 10.w),
              Expanded(
                child: _studentStatCard(
                  'students',
                  (s['myStudents'] ?? 0).toString(),
                  'TOTAL',
                  const Color(0xFF6366F1),
                  Icons.people_alt_rounded,
                  t,
                ),
              ),
              SizedBox(width: 10.w),
              Expanded(
                child: _studentStatCard(
                  'attendance',
                  (s['todayAttendance'] ?? 0).toString(),
                  'TODAY',
                  const Color(0xFFF59E0B),
                  Icons.fact_check_rounded,
                  t,
                ),
              ),
            ],
          ),
        ),
        SizedBox(height: 24.h),
        _sectionLabel(t('quick_access').toUpperCase()),
        SizedBox(height: 12.h),
        _buildQuickActions(t),
        SizedBox(height: 24.h),
        Padding(
          padding: EdgeInsets.symmetric(horizontal: 20.w),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _sectionLabel('ACTIVE SESSIONS'),
              Text(
                'YOUR WORK SCHEDULE',
                style: TextStyle(
                  fontSize: 9.sp,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF94A3B8),
                ),
              ),
              SizedBox(height: 16.h),
              Row(
                children: [
                  _buildSmallToggle(
                    ['morning', 'afternoon', 'night'],
                    _shift,
                    (val) {
                      setState(() => _shift = val);
                      _fetchStats();
                    },
                  ),
                  SizedBox(width: 8.w),
                  _buildSmallToggle(
                    ['Break 1', 'Break 2'],
                    _session,
                    (val) {
                      setState(() => _session = val);
                      _fetchStats();
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
        SizedBox(height: 12.h),
        _buildTeacherClasses(s['assignedClasses'] as List?, t),
        SizedBox(height: 40.h),
      ],
    );
  }

  Widget _webTeacherStatCard(String title, String value, String subtitle, String emoji, Color bgColor, Color iconBgColor) {
    return Container(
      padding: EdgeInsets.all(16.w),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(24.r),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 9.sp,
                        fontWeight: FontWeight.w900,
                        color: const Color(0xFF94A3B8),
                        letterSpacing: 0.5,
                      ),
                    ),
                    SizedBox(height: 4.h),
                    Text(
                      value,
                      style: TextStyle(
                        fontSize: 24.sp,
                        fontWeight: FontWeight.w900,
                        color: const Color(0xFF0F172A),
                        height: 1,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                width: 32.w,
                height: 32.h,
                decoration: BoxDecoration(
                  color: iconBgColor,
                  borderRadius: BorderRadius.circular(10.r),
                ),
                alignment: Alignment.center,
                child: Text(emoji, style: TextStyle(fontSize: 16.sp)),
              ),
            ],
          ),
          Text(
            subtitle,
            style: TextStyle(
              fontSize: 8.sp,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF94A3B8),
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWebTeacherAnnouncements(String Function(String) t) {
    if (_announcementsLoading && _announcements.isEmpty) {
      return Shimmer.fromColors(
        baseColor: Colors.green[800]!,
        highlightColor: Colors.green[600]!,
        child: Container(
          height: 160.h,
          decoration: BoxDecoration(
            color: const Color(0xFF10B981),
            borderRadius: BorderRadius.circular(24.r),
          ),
        ),
      );
    }

    if (_announcements.isEmpty) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(vertical: 20.h),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF047857), Color(0xFF10B981)], // Dark green to lighter green
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24.r),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 20.w),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.campaign_rounded, color: Colors.white, size: 24),
                    SizedBox(width: 8.w),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'ANNOUNCEMENTS',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 14.sp,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1,
                          ),
                        ),
                        Text(
                          'FARRIIMAHA MAAMULKA',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 9.sp,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                GestureDetector(
                  onTap: () => GoRouter.of(context).push('/announcements'),
                  child: Container(
                    padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
                    decoration: BoxDecoration(
                      color: Colors.white.withAlpha(50),
                      borderRadius: BorderRadius.circular(20.r),
                    ),
                    child: Text(
                      'VIEW ALL →',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 9.sp,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: 16.h),
          SizedBox(
            height: 110.h,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.symmetric(horizontal: 20.w),
              itemCount: _announcements.length > 3 ? 3 : _announcements.length,
              itemBuilder: (context, i) {
                final a = _announcements[i];
                return Container(
                  width: MediaQuery.of(context).size.width * 0.65,
                  margin: EdgeInsets.only(right: 12.w),
                  padding: EdgeInsets.all(16.w),
                  decoration: BoxDecoration(
                    color: Colors.white.withAlpha(38),
                    borderRadius: BorderRadius.circular(16.r),
                    border: Border.all(color: Colors.white.withAlpha(25)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 6.w,
                            height: 6.h,
                            decoration: const BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                            ),
                          ),
                          SizedBox(width: 8.w),
                          Text(
                            a['date']?.toString().split('T')[0] ?? '',
                            style: TextStyle(
                              fontSize: 10.sp,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 8.h),
                      Text(
                        a['title'] ?? 'Notice',
                        style: TextStyle(
                          fontSize: 13.sp,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      SizedBox(height: 4.h),
                      Expanded(
                        child: Text(
                          a['content'] ?? '',
                          style: TextStyle(
                            fontSize: 11.sp,
                            color: Colors.white70,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
  Widget _buildTeacherClasses(List? classes, String Function(String) t) {
    if (classes == null || classes.isEmpty) {
      return _emptyBox(t('no_classes_assigned'));
    }
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20.r),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: classes.length,
        separatorBuilder: (_, __) => Divider(height: 1.h),
        itemBuilder: (context, i) {
          final c = classes[i];
          return ListTile(
            title: Text('${c['class_name'] ?? ''} ${c['section'] ?? ''}',
                style:
                    TextStyle(fontWeight: FontWeight.bold, fontSize: 13.sp)),
            subtitle: Text(c['subject']?['name'] ?? '',
                style: TextStyle(fontSize: 11.sp)),
            trailing: const Icon(Icons.chevron_right_rounded,
                color: Color(0xFF94A3B8)),
          );
        },
      ),
    );
  }

  Widget _buildStudentBody(String Function(String) tr) {
    final s = _stats ?? {};
    final attPercent =
        double.tryParse(s['attendancePercentage']?.toString() ?? '0') ?? 0.0;

    // Parse class block for enrolled info
    final rawClassName = s['class_name']?.toString();
    final rawSectionName = s['section_name']?.toString();
    final hasClass = rawClassName != null && rawClassName.isNotEmpty && rawClassName != 'N/A';
    final hasSection = rawSectionName != null && rawSectionName.isNotEmpty && rawSectionName != 'N/A';
    final className = hasClass ? rawClassName.toUpperCase() : tr('not_assigned').toUpperCase();
    final sectionName = hasSection ? rawSectionName.toUpperCase() : '';
    
    final isGraduated = s['status']?.toString().toLowerCase() == 'graduated';
    final classDisplay = isGraduated 
        ? 'GRADUATED'
        : (hasClass
            ? (hasSection ? '$className - $sectionName' : className)
            : tr('not_assigned').toUpperCase());

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildRecentAnnouncements(tr),
        // Welcome Header (Web Alignment)
        Padding(
          padding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 24.h),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${tr('welcome')}, ${s['name'] ?? tr('student')}',
                          style: TextStyle(
                            color: const Color(0xFF1E293B),
                            fontSize: 24.sp,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.5,
                          ),
                        ),
                        SizedBox(height: 4.h),
                        Text(
                          (s['currentYear']?['name'] ?? tr('academic_year'))
                              .toString()
                              .toUpperCase(),
                          style: TextStyle(
                            color: const Color(0xFF94A3B8),
                            fontSize: 10.sp,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 2,
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

        // Student Enrolled Class Info Banner
        FutureBuilder<String?>(
          future: _auth.getSchoolName(),
          builder: (context, snapshot) {
            final schName = snapshot.data ?? 'Smart School';
            return Container(
              margin: EdgeInsets.symmetric(horizontal: 20.w),
              padding: EdgeInsets.all(16.w),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppTheme.primary, AppTheme.accent],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16.r),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.primary.withValues(alpha: 0.3),
                    blurRadius: 10.r,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  const Icon(Icons.school_rounded, color: Colors.white, size: 32),
                  SizedBox(width: 16.w),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          schName.toUpperCase(),
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 12.sp,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.5,
                          ),
                        ),
                        SizedBox(height: 4.h),
                        Text(
                          _selectedAcademicYearId != null 
                            ? '${tr('class').toUpperCase()}: $classDisplay (${_academicYears.firstWhere((y) => y['id']?.toString() == _selectedAcademicYearId, orElse: () => {'name': ''})['name']})' 
                            : '${tr('class').toUpperCase()}: $classDisplay',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 10.sp,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }
        ),
        SizedBox(height: 20.h),
        // Stats Row
        Padding(
          padding: EdgeInsets.symmetric(horizontal: 20.w),
          child: LayoutBuilder(
            builder: (context, constraints) {
              return Row(
                children: [
                  Expanded(
                    child: _studentStatCard(
                      'payments',
                      (s['currentStatus'] == 'paid') ? tr('paid').toUpperCase() : tr('unpaid').toUpperCase(),
                      (s['currentStatus'] == 'paid')
                          ? tr('this_month')
                          : tr('required'),
                      (s['currentStatus'] == 'paid')
                          ? const Color(0xFF10B981)
                          : const Color(0xFFEF4444),
                      (s['currentStatus'] == 'paid')
                          ? Icons.check_circle_rounded
                          : Icons.pending_rounded,
                      tr,
                    ),
                  ),
                  SizedBox(width: 10.w),
                  Expanded(
                    child: _studentStatCard(
                      'attendance',
                      '${attPercent.toStringAsFixed(0)}%',
                      tr('present'),
                      const Color(0xFF6366F1),
                      Icons.fact_check_rounded,
                      tr,
                    ),
                  ),
                  SizedBox(width: 10.w),
                  Expanded(
                    child: _studentStatCard(
                      'status',
                      (s['status'] ?? 'ACTIVE').toString().toUpperCase(),
                      tr('validated'),
                      const Color(0xFF64748B),
                      Icons.verified_user_rounded,
                      tr,
                    ),
                  ),
                ],
              );
            },
          ),
        ),
        SizedBox(height: 24.h),
        _sectionLabel(tr('quick_access').toUpperCase()),
        SizedBox(height: 12.h),
        _buildQuickActions(tr),
        // â”€â”€ Ad: Between sections â”€â”€
        

        if (s['recentAttendance'] != null &&
            (s['recentAttendance'] as List).isNotEmpty) ...[
          SizedBox(height: 24.h),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 20.w),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                 Column(
                   crossAxisAlignment: CrossAxisAlignment.start,
                   children: [
                     _sectionLabel(tr('recent_attendance').toUpperCase()),
                     Text(
                       tr('last_7_days'),
                       style: TextStyle(
                         fontSize: 9.sp,
                         fontWeight: FontWeight.bold,
                         color: const Color(0xFF94A3B8),
                       ),
                     ),
                   ],
                 ),
                GestureDetector(
                  onTap: () => context.push('/student-attendance-history'),
                  child: Text(
                    tr('history').toUpperCase(),
                    style: TextStyle(
                      fontSize: 10.sp,
                      fontWeight: FontWeight.w900,
                      color: AppTheme.primary,
                      letterSpacing: 1,
                    ),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: 12.h),
          _buildRecentAttendance(s['recentAttendance'] as List),
        ],

        if (s['recentPayments'] != null &&
            (s['recentPayments'] as List).isNotEmpty) ...[
          SizedBox(height: 24.h),
          _sectionLabel(tr('recent_payments').toUpperCase()),
          SizedBox(height: 12.h),
          _buildRecentPayments(s['recentPayments'] as List),
        ],

        // Academic Performance (Align with Web)
        SizedBox(height: 24.h),
        _sectionLabel(tr('exam_results').toUpperCase()),
        SizedBox(height: 12.h),
        _buildAcademicPerformance(s, tr),

        SizedBox(height: 40.h),
      ],
    );
  }

  Widget _buildAcademicPerformance(Map? stats, String Function(String) t) {
    final results = stats?['recentResults'] as List?;
    if (results == null || results.isEmpty) {
      return _emptyBox(t('no_results_yet'));
    }
    
    final total = stats?['grandTotal']?.toString() ?? '0';
    final max = stats?['grandMax']?.toString() ?? '0';
    final avg = stats?['average']?.toString() ?? '0';
    final grade = stats?['grade']?.toString() ?? 'N/A';
    
    return Container(
      margin: EdgeInsets.symmetric(horizontal: 20.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24.r),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Column(
        children: [
          // Stats Header
          Padding(
            padding: EdgeInsets.all(16.0.w),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                Column(
                  children: [
                    Text('TOTAL', style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.bold, color: Colors.grey[400], letterSpacing: 1)),
                    SizedBox(height: 4.h),
                    Text('$total / $max', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w900, color: const Color(0xFF1E293B))),
                  ],
                ),
                Container(height: 30.h, width: 1.w, color: Colors.grey[200]),
                Column(
                  children: [
                    Text('AVERAGE', style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.bold, color: Colors.grey[400], letterSpacing: 1)),
                    SizedBox(height: 4.h),
                    Text('$avg%', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w900, color: const Color(0xFF2563EB))),
                  ],
                ),
                Container(height: 30.h, width: 1.w, color: Colors.grey[200]),
                Column(
                  children: [
                    Text('GRADE', style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.bold, color: Colors.grey[400], letterSpacing: 1)),
                    SizedBox(height: 4.h),
                    Text(grade, style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w900, color: const Color(0xFF059669))),
                  ],
                ),
              ],
            ),
          ),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 12.h),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.vertical(top: Radius.circular(24.r)),
            ),
            child: Row(
              children: [
                Expanded(
                    flex: 3,
                    child: Text(t('subject').toUpperCase(),
                        style: TextStyle(
                            fontSize: 9.sp,
                            fontWeight: FontWeight.w900,
                            color: const Color(0xFF94A3B8),
                            letterSpacing: 1))),
                Expanded(
                    flex: 2,
                    child: Text(t('score').toUpperCase(),
                        style: TextStyle(
                            fontSize: 9.sp,
                            fontWeight: FontWeight.w900,
                            color: const Color(0xFF94A3B8),
                            letterSpacing: 1))),
                Text(t('grade').toUpperCase(),
                    style: TextStyle(
                        fontSize: 9.sp,
                        fontWeight: FontWeight.w900,
                        color: const Color(0xFF94A3B8),
                        letterSpacing: 1)),
              ],
            ),
          ),
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: results.length,
            separatorBuilder: (_, __) =>
                Divider(height: 1.h, color: Color(0xFFF1F5F9)),
            itemBuilder: (context, i) {
              final g = results[i];
              final score = g['marks'] ?? g['score'] ?? g['total'] ?? 0;
              final total = g['exam']?['totalMarks'] ?? g['totalMarks'] ?? 100;
              final percent = total > 0 ? (score / total) * 100 : 0;
              final grade = g['grade'] ??
                  (percent >= 90
                      ? 'A'
                      : percent >= 75
                          ? 'B'
                          : percent >= 65
                              ? 'C'
                              : percent >= 50
                                  ? 'D'
                                  : 'F');

              return Padding(
                padding:
                    EdgeInsets.symmetric(horizontal: 20.w, vertical: 16.h),
                child: Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: Row(
                        children: [
                          Container(
                            width: 28.w,
                            height: 28.h,
                            decoration: BoxDecoration(
                                color: const Color(0xFFEFF6FF),
                                borderRadius: BorderRadius.circular(8.r)),
                            child: Center(
                                child: Text('${i + 1}',
                                    style: TextStyle(
                                        color: const Color(0xFF2563EB),
                                        fontWeight: FontWeight.bold,
                                        fontSize: 11.sp))),
                          ),
                          SizedBox(width: 12.w),
                          Expanded(
                            child: Text(
                              (g['exam']?['subject']?['name'] ??
                                      g['subject'] ??
                                      g['name'] ??
                                      'Maadada')
                                  .toString()
                                  .toUpperCase(),
                              style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 12.sp,
                                  color: const Color(0xFF1E293B)),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      flex: 2,
                      child: RichText(
                        text: TextSpan(
                          children: [
                            TextSpan(
                                text: '$score',
                                style: TextStyle(
                                    color: const Color(0xFF1E293B),
                                    fontWeight: FontWeight.w900,
                                    fontSize: 15.sp)),
                            TextSpan(
                                text: ' / $total',
                                style: TextStyle(
                                    color: const Color(0xFFCBD5E1),
                                    fontWeight: FontWeight.bold,
                                    fontSize: 10.sp)),
                          ],
                        ),
                      ),
                    ),
                    Container(
                      width: 32.w,
                      height: 32.h,
                      decoration: BoxDecoration(
                        color: (percent >= 50
                            ? const Color(0xFFECFDF5)
                            : const Color(0xFFFEF2F2)),
                        borderRadius: BorderRadius.circular(10.r),
                        border: Border.all(
                            color: (percent >= 50
                                ? const Color(0xFFD1FAE5)
                                : const Color(0xFFFEE2E2))),
                      ),
                      child: Center(
                        child: Text(
                          grade,
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 14.sp,
                            color: (percent >= 50
                                ? const Color(0xFF059669)
                                : const Color(0xFFDC2626)),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildSmallToggle(
      List<String> options, String current, Function(String) onSelect) {
    return Container(
      padding: EdgeInsets.all(2.w),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(10.r),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: options.map((s) {
          final active = current == s;
          return GestureDetector(
            onTap: () => onSelect(s),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
              decoration: BoxDecoration(
                color: active ? Colors.white : Colors.transparent,
                borderRadius: BorderRadius.circular(8.r),
                boxShadow: active
                    ? [
                        BoxShadow(
                            color: Colors.black.withValues(alpha: 0.05),
                            blurRadius: 2.r)
                      ]
                    : [],
              ),
              child: Text(
                s.toUpperCase(),
                style: TextStyle(
                  fontSize: 9.sp,
                  fontWeight: FontWeight.w900,
                  color: active ? AppTheme.primary : AppTheme.textSecondary,
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _studentStatCard(
      String label, String value, String sub, Color color, IconData icon, String Function(String) t) {
    return Container(
      padding: EdgeInsets.all(20.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24.r),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10.r,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: EdgeInsets.all(8.w),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10.r),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
          SizedBox(height: 16.h),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              t(label),
              style: TextStyle(
                fontSize: 9.sp,
                fontWeight: FontWeight.w900,
                color: AppTheme.textSecondary,
                letterSpacing: 1,
              ),
            ),
          ),
          SizedBox(height: 4.h),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: TextStyle(
                fontSize: 24.sp,
                fontWeight: FontWeight.w900,
                color: color,
                letterSpacing: -1,
              ),
            ),
          ),
          SizedBox(height: 2.h),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              sub,
              style: TextStyle(
                fontSize: 10.sp,
                fontWeight: FontWeight.w600,
                color: AppTheme.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecentAttendance(List<dynamic> list) {
    // Group by date to find the 7 most recent unique days
    final List<dynamic> displayList = [];
    final Set<String> uniqueDates = {};
    
    for (var a in list) {
      String dateStr = 'N/A';
      if (a['date'] != null) {
        try {
          final parsed = DateTime.tryParse(a['date']);
          if (parsed != null) {
            dateStr = parsed.toLocal().toString().split(' ')[0];
          }
        } catch (_) {}
      }
      
      if (uniqueDates.length < 7 || uniqueDates.contains(dateStr)) {
        displayList.add(a);
        if (dateStr != 'N/A') uniqueDates.add(dateStr);
      } else {
        break; // We have enough days
      }
    }

    return Container(
      margin: EdgeInsets.symmetric(horizontal: 20.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20.r),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxHeight: 220),
        child: SingleChildScrollView(
          child: Column(
            children: displayList.map((a) {
              final present = a['status'] == 'Present';
              final date =
                  DateTime.tryParse(a['date']?.toString() ?? '')?.toLocal();
              final dateStr =
                  date != null ? '${date.day}/${date.month}' : 'N/A';

              return ListTile(
                dense: true,
                leading: CircleAvatar(
                  radius: 14,
                  backgroundColor: (present ? Colors.green : Colors.red)
                      .withValues(alpha: 0.1),
                  child: Icon(
                    present ? Icons.check_rounded : Icons.close_rounded,
                    size: 14,
                    color: present ? Colors.green : Colors.red,
                  ),
                ),
                title: Text(
                  a['session']?.toString().toUpperCase() ?? 'CLASS',
                  style: TextStyle(
                      fontWeight: FontWeight.w900, fontSize: 11.sp),
                ),
                subtitle: Text(dateStr, style: TextStyle(fontSize: 10.sp)),
                trailing: Text(
                  a['status']?.toString() ?? '',
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 10.sp,
                    color: present ? Colors.green : Colors.red,
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }

  Widget _buildRecentPayments(List<dynamic> list) {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: 20.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20.r),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxHeight: 220),
        child: SingleChildScrollView(
          child: Column(
            children: list.map((p) {
              final date =
                  DateTime.tryParse(p['date']?.toString() ?? '')?.toLocal();
              final dateStr = date != null ? '${date.day}/${date.month}' : 'N/A';
              final amount = double.tryParse(p['amount']?.toString() ?? '0') ?? 0.0;
    
              return ListTile(
                dense: true,
                leading: const CircleAvatar(
                  radius: 14,
                  backgroundColor: Color(0xFFF1F5F9),
                  child: Icon(Icons.attach_money_rounded,
                      size: 14, color: AppTheme.textPrimary),
                ),
                title: Text(
                  p['description']?.toString() ?? 'PAYMENT',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11.sp),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                subtitle: Text(dateStr, style: TextStyle(fontSize: 10.sp)),
                trailing: Text(
                  '\$${amount.toStringAsFixed(0)}',
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 12.sp,
                    color: AppTheme.textPrimary,
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }

  // â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”

  Future<void> _downloadReportCardFromDashboard() async {
    final sId = _selectedChild?['id'];
    if (sId == null) return;

    try {
      final token = await const FlutterSecureStorage().read(key: 'token');
      String urlStr = '${ApiConfig.baseUrl}/api/reports/student-report/$sId?token=$token';
      
      // Use the year selected in the modal
      final yearId = _selectedChildYearId ?? _selectedAcademicYearId;
      if (yearId != null) {
        urlStr += '&academicYearId=$yearId';
      }

      final url = Uri.parse(urlStr);
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Ma furi karo PDF-ka')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Cillad: $e')),
        );
      }
    }
  }

  Future<void> _fetchChildDetails(Map<String, dynamic> child, {String? yearId}) async {
    setState(() {
      _selectedChild = child;
      _selectedChildYearId = yearId ?? _selectedAcademicYearId;
      _childLoading = true;
      _childData = {
        'attendance': [],
        'grades': [],
        'gradesMeta': null,
        'payments': [],
        'statusHistory': [],
        'studentInfo': null
      };
    });

    try {
      final childId = child['id'];
      final effectiveYear = yearId ?? _selectedAcademicYearId;
      final yearParam = effectiveYear != null ? '?academicYearId=$effectiveYear' : '';

      final results = await Future.wait([
        _api.get('${ApiConfig.childAttendance}/$childId$yearParam'),
        _api.get('${ApiConfig.childExams}/$childId$yearParam'),
        _api.get('${ApiConfig.payments}$yearParam'), // Backend filters by parent
        _api.get('${ApiConfig.childPaymentStatus}/$childId/status-history$yearParam'),
      ]);

      if (mounted) {
        final now = DateTime.now();
        final currentMonth = now.month;
        final currentYear = now.year;

        final paymentsData = results[2].data;
        final paymentsList = paymentsData is List
            ? paymentsData
            : (paymentsData['data'] ?? paymentsData['payments'] ?? []);

        final payments =
            paymentsList.where((p) => p['studentId'] == childId).toList();

        final statusData = results[3].data;
        final statusList = statusData is List
            ? statusData
            : (statusData is Map
                ? (statusData['data'] ?? statusData['history'] ?? [])
                : []);

        final statusHistory = statusList.where((s) {
          final sYear = int.tryParse(s['year']?.toString() ?? '0') ?? 0;
          final sMonth = int.tryParse(s['month']?.toString() ?? '0') ?? 0;
          return sYear < currentYear ||
              (sYear == currentYear && sMonth <= currentMonth);
        }).toList();

        final attData = results[0].data;
        final attendance = attData is List
            ? attData
            : (attData is Map ? (attData['data'] ?? []) : []);

        final gradesData = results[1].data;
        List grades = [];
        Map<String, dynamic>? studentInfo;

        Map<String, dynamic>? gradesMeta;

        if (gradesData is Map) {
          studentInfo = gradesData['student'];
          // The new backend structure nests subjects under 'data' or directly
          grades = (gradesData['data']?['subjects'] ??
                  gradesData['subjects'] ??
                  gradesData['results'] ??
                  [])
              .toList();
          
          if (gradesData['data'] != null) {
            gradesMeta = gradesData['data'] is Map ? Map<String, dynamic>.from(gradesData['data']) : null;
          } else {
            gradesMeta = Map<String, dynamic>.from(gradesData);
          }
        } else if (gradesData is List) {
          grades = gradesData;
        }

        setState(() {
          _childData = {
            'attendance': attendance,
            'grades': grades,
            'gradesMeta': gradesMeta,
            'payments': payments,
            'statusHistory': statusHistory,
            'studentInfo': studentInfo,
          };
          _childLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _childLoading = false);
    }
  }

  Widget _buildParentBody(String Function(String) t) {
    final children = (_stats?['children'] as List?) ?? [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildRecentAnnouncements(t),
        // Welcome Header (Web Alignment)
        Padding(
          padding: EdgeInsets.symmetric(vertical: 12.h),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                t('welcome_back').replaceAll(', ', ''), // Or just t('welcome')
                style: TextStyle(
                  color: const Color(0xFF1E293B),
                  fontSize: 24.sp,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                ),
              ),
              SizedBox(height: 4.h),
              Text(
                t('parent_dashboard_subtitle'),
                style: TextStyle(
                  color: const Color(0xFF94A3B8),
                  fontSize: 10.sp,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1,
                ),
              ),
            ],
          ),
        ),
        SizedBox(height: 20.h),
        
        _sectionLabel(t('overview').toUpperCase()),
        SizedBox(height: 12.h),
        Row(
          children: [
            Expanded(
              child: _topStatCard(
                t('children'),
                '${children.length}',
                const Color(0xFFFCE7F3),
                const Color(0xFFDB2777),
                Icons.child_care_rounded,
              ),
            ),
            SizedBox(width: 10.w),
            Expanded(
              child: _topStatCard(
                t('status'),
                'Active',
                const Color(0xFFE0E7FF),
                const Color(0xFF4F46E5),
                Icons.verified_user_rounded,
              ),
            ),
          ],
        ),
        SizedBox(height: 24.h),

        _sectionLabel(t('quick_access').toUpperCase()),
        SizedBox(height: 12.h),
        _buildQuickActions(t),
        // â”€â”€ Ad: Between sections â”€â”€
        
        SizedBox(height: 24.h),

        _sectionLabel(t('my_children').toUpperCase()),
        SizedBox(height: 12.h),
        ...children.map((child) => _childCard(child, t)),
        if (children.isEmpty)
          Padding(
            padding: EdgeInsets.symmetric(vertical: 20.h),
            child: Center(
              child: Text(
                t('no_students_assigned'),
                style: const TextStyle(
                  color: AppTheme.textSecondary, 
                  fontStyle: FontStyle.italic
                ),
              ),
            ),
          ),
        SizedBox(height: 24.h),
      ],
    );
  }

  Widget _childCard(dynamic child, String Function(String) t) {
    final name = child['user']?['name'] ?? 'Student';
    final clss = child['clss']?['class_name'] ?? '';
    final sectionData = child['section'] as Map<String, dynamic>?;
    final sectionName = sectionData?['name'] ?? 'General';
    final unpaid = child['currentMonthStatus'] == 'unpaid';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24.r),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 15.r,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          Padding(
            padding: EdgeInsets.all(16.w),
            child: Row(
              children: [
                Container(
                  width: 52.w,
                  height: 52.h,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFDB2777), Color(0xFFF472B6)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16.r),
                  ),
                  child: Center(
                    child: Text(
                      name[0].toUpperCase(),
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 22.sp,
                      ),
                    ),
                  ),
                ),
                SizedBox(width: 16.w),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 16.sp,
                          color: AppTheme.textPrimary,
                          letterSpacing: -0.5,
                        ),
                      ),
                      SizedBox(height: 2.h),
                      Text(
                        (child['status']?.toString().toLowerCase() == 'graduated'
                                ? 'GRADUATED'
                                : '$clss $sectionName')
                            .toUpperCase(),
                        style: TextStyle(
                          fontSize: 10.sp,
                          color: AppTheme.textSecondary,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 5.h),
                  decoration: BoxDecoration(
                    color: unpaid
                        ? const Color(0xFFFFF1F2)
                        : const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(10.r),
                    border: Border.all(
                      color: unpaid
                          ? const Color(0xFFFECDD3)
                          : const Color(0xFFDCFCE7),
                    ),
                  ),
                  child: Text(
                    unpaid ? t('unpaid').toUpperCase() : t('paid').toUpperCase(),
                    style: TextStyle(
                      color: unpaid
                          ? const Color(0xFFE11D48)
                          : const Color(0xFF16A34A),
                      fontSize: 9.sp,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Divider(height: 1.h, color: Color(0xFFF1F5F9)),
          InkWell(
            onTap: () => _fetchChildDetails(child as Map<String, dynamic>),
            borderRadius: BorderRadius.vertical(bottom: Radius.circular(24.r)),
            child: Container(
              padding: EdgeInsets.symmetric(vertical: 12.h),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(24.r)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    t('view_student_profile').toUpperCase(),
                    style: TextStyle(
                      fontSize: 10.sp,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF64748B),
                      letterSpacing: 1,
                    ),
                  ),
                  SizedBox(width: 8.w),
                  const Icon(Icons.arrow_forward_rounded, size: 14, color: Color(0xFF64748B)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionLabel(String text) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 10.sp,
        fontWeight: FontWeight.w900,
        color: AppTheme.textSecondary,
        letterSpacing: 2,
      ),
    );
  }

  Widget _topStatCard(String label, String value, Color bgColor,
      Color iconColor, IconData icon) {
    return Container(
      padding: EdgeInsets.all(14.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16.r),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: iconColor.withValues(alpha: 0.05),
            blurRadius: 8.r,
            offset: const Offset(0, 2),
          )
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36.w,
            height: 36.h,
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(10.r),
            ),
            child: Icon(icon, color: iconColor, size: 18),
          ),
          SizedBox(height: 10.h),
          Text(
            value,
            style: TextStyle(
              fontSize: 22.sp,
              fontWeight: FontWeight.w900,
              color: iconColor,
              letterSpacing: -0.5,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              fontSize: 10.sp,
              fontWeight: FontWeight.w700,
              color: AppTheme.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _attendanceCard(String label, String val, Color c, Color bg,
      IconData icon, String status, String Function(String) t) {
    return GestureDetector(
      onTap: () => _fetchDetails(status),
      child: Container(
        padding: EdgeInsets.all(24.w),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [c, c.withValues(alpha: 0.85)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(32.r),
          boxShadow: [
            BoxShadow(
              color: c.withValues(alpha: 0.2),
              blurRadius: 20.r,
              offset: const Offset(0, 8),
            )
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    t(label).toUpperCase(),
                    style: TextStyle(
                      fontSize: 10.sp,
                      fontWeight: FontWeight.w900,
                      color: Colors.white.withValues(alpha: 0.7),
                      letterSpacing: 1.2,
                    ),
                  ),
                  SizedBox(height: 8.h),
                  Text(
                    val,
                    style: TextStyle(
                      fontSize: 32.sp,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      height: 1.1.h,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: EdgeInsets.all(12.w),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(16.r),
              ),
              child: Icon(icon, color: Colors.white, size: 28),
            ),
          ],
        ),
      ),
    );
  }

  Widget _feeCard(String label, String val, Color c, Color bg, IconData icon,
      String status, String Function(String) t) {
    return GestureDetector(
      onTap: () => _fetchDetails(status, isPayment: true),
      child: Container(
        padding: EdgeInsets.all(24.w),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [c, c.withValues(alpha: 0.85)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(32.r),
          boxShadow: [
            BoxShadow(
              color: c.withValues(alpha: 0.2),
              blurRadius: 20.r,
              offset: const Offset(0, 8),
            )
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    t(label).toUpperCase(),
                    style: TextStyle(
                      fontSize: 10.sp,
                      fontWeight: FontWeight.w900,
                      color: Colors.white.withValues(alpha: 0.7),
                      letterSpacing: 1.2,
                    ),
                  ),
                  SizedBox(height: 8.h),
                  Text(
                    val,
                    style: TextStyle(
                      fontSize: 32.sp,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      height: 1.1.h,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: EdgeInsets.all(12.w),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(16.r),
              ),
              child: Icon(icon, color: Colors.white, size: 28),
            ),
          ],
        ),
      ),
    );
  }

  Widget _financialCard(
      String label, String value, Color color, Color bgColor, IconData icon) {
    return Container(
      padding: EdgeInsets.all(20.w),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color, color.withValues(alpha: 0.8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24.r),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.2),
            blurRadius: 15.r,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: EdgeInsets.all(10.w),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(12.r),
            ),
            child: Icon(icon, color: Colors.white, size: 22),
          ),
          const Spacer(),
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 10.sp,
              fontWeight: FontWeight.w900,
              color: Colors.white.withValues(alpha: 0.7),
              letterSpacing: 1,
            ),
          ),
          SizedBox(height: 4.h),
          Text(
            value,
            style: TextStyle(
              fontSize: 22.sp,
              fontWeight: FontWeight.w900,
              color: Colors.white,
              height: 1.1.h,
            ),
          ),
        ],
      ),
    );
  }

  Widget _legend(Color color, String label) {
    return Row(
      children: [
        Container(
          width: 10.w,
          height: 10.h,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        SizedBox(width: 6.w),
        Text(label,
            style: TextStyle(
                fontSize: 11.sp,
                fontWeight: FontWeight.w700,
                color: AppTheme.textSecondary)),
      ],
    );
  }

  // â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”
  Widget _buildQuickActions(String Function(String) t) {
    final actions = _getQuickActions(t);
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 3,
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      childAspectRatio: 0.95,
      children: actions.map((a) => _quickTile(a)).toList(),
    );
  }

  List<Map<String, dynamic>> _getQuickActions(String Function(String) t) {
    if (_role == 'admin') {
      return [
        {
          'label': t('students'),
          'icon': Icons.people_rounded,
          'route': '/students',
          'color': AppTheme.primary
        },
        {
          'label': t('attendance'),
          'icon': Icons.fact_check_rounded,
          'route': '/attendance',
          'color': AppTheme.success
        },
        {
          'label': t('payments'),
          'icon': Icons.payments_rounded,
          'route': '/payments',
          'color': AppTheme.warning
        },
        {
          'label': t('exams'),
          'icon': Icons.quiz_rounded,
          'route': '/exams',
          'color': AppTheme.accent
        },
        {
          'label': t('library'),
          'icon': Icons.local_library_rounded,
          'route': '/library',
          'color': AppTheme.primary
        },
        {
          'label': t('profile'),
          'icon': Icons.person_rounded,
          'route': '/profile',
          'color': AppTheme.textSecondary
        },
        {
          'label': t('e_learning'),
          'icon': Icons.quiz_rounded,
          'route': '/student-quizzes',
          'color': AppTheme.success
        },
        {
          'label': t('lessons'),
          'icon': Icons.video_library_rounded,
          'route': '/lessons',
          'color': AppTheme.primary
        },
        {
          'label': t('sync_data'),
          'icon': Icons.sync_rounded,
          'action': 'sync',
          'color': AppTheme.primary
        },
      ];
    } else if (_role == 'teacher') {
      return [
        {
          'label': t('exams'),
          'icon': Icons.quiz_rounded,
          'route': '/exams',
          'color': AppTheme.accent
        },
        {
          'label': t('marks'),
          'icon': Icons.assessment_rounded,
          'route': '/marks',
          'color': AppTheme.primary
        },
        {
          'label': t('homework'),
          'icon': Icons.menu_book_rounded,
          'route': '/homework',
          'color': AppTheme.warning
        },
        {
          'label': t('profile'),
          'icon': Icons.person_rounded,
          'route': '/profile',
          'color': AppTheme.textSecondary
        },
        {
          'label': t('settings'),
          'icon': Icons.settings_rounded,
          'route': '/settings',
          'color': AppTheme.accent
        },
        {
          'label': t('lessons'),
          'icon': Icons.video_library_rounded,
          'route': '/lessons',
          'color': AppTheme.primary
        },
        {
          'label': t('e_learning'),
          'icon': Icons.quiz_rounded,
          'route': '/student-quizzes',
          'color': AppTheme.success
        },
        {
          'label': t('exam_schedule'),
          'icon': Icons.calendar_today_rounded,
          'route': '/exams/schedule',
          'color': const Color(0xFFF9612C)
        },
        {
          'label': t('sync_data'),
          'icon': Icons.sync_rounded,
          'action': 'sync',
          'color': AppTheme.primary
        },
      ];
    } else if (_role == 'parent') {
      return [
        {
          'label': t('results'),
          'icon': Icons.assessment_rounded,
          'route': '/student-results',
          'color': const Color(0xFF7C3AED)
        },
        {
          'label': t('payments'),
          'icon': Icons.payments_rounded,
          'route': '/payments',
          'color': const Color(0xFF10B981)
        },
        {
          'label': t('exam_schedule'),
          'icon': Icons.calendar_today_rounded,
          'route': '/exams/schedule',
          'color': const Color(0xFFF9612C)
        },
        {
          'label': t('profile'),
          'icon': Icons.person_rounded,
          'route': '/profile',
          'color': AppTheme.textSecondary
        },
        {
          'label': t('settings'),
          'icon': Icons.settings_rounded,
          'route': '/settings',
          'color': AppTheme.accent
        },
      ];
    } else if (_role == 'librarian') {
      return [
        {
          'label': t('library'),
          'icon': Icons.local_library_rounded,
          'route': '/library',
          'color': AppTheme.primary
        },
        {
          'label': t('profile'),
          'icon': Icons.person_rounded,
          'route': '/profile',
          'color': AppTheme.textSecondary
        },
        {
          'label': t('settings'),
          'icon': Icons.settings_rounded,
          'route': '/settings',
          'color': AppTheme.accent
        },
      ];
    } else {
      // student
      return [
        {
          'label': t('results'),
          'icon': Icons.assessment_rounded,
          'route': '/student-results',
          'color': const Color(0xFF7C3AED)
        },
        {
          'label': t('lessons'),
          'icon': Icons.video_library_rounded,
          'route': '/lessons',
          'color': AppTheme.primary
        },
        {
          'label': t('e_learning'),
          'icon': Icons.quiz_rounded,
          'route': '/student-quizzes',
          'color': AppTheme.success
        },
        {
          'label': t('timetable'),
          'icon': Icons.calendar_month_rounded,
          'route': '/timetable',
          'color': AppTheme.primary
        },
        {
          'label': t('homework'),
          'icon': Icons.menu_book_rounded,
          'route': '/homework',
          'color': AppTheme.warning
        },
        {
          'label': 'Zoom Live',
          'icon': Icons.video_camera_front_rounded,
          'route': '/zoom',
          'color': const Color(0xFF0284C7)
        },
        {
          'label': t('exam_schedule'),
          'icon': Icons.calendar_today_rounded,
          'route': '/exams/schedule',
          'color': const Color(0xFFF9612C)
        },
        {
          'label': t('profile'),
          'icon': Icons.person_rounded,
          'route': '/profile',
          'color': AppTheme.textSecondary
        },
        {
          'label': t('settings'),
          'icon': Icons.settings_rounded,
          'route': '/settings',
          'color': AppTheme.accent
        },
      ];
    }
  }

  Widget _quickTile(Map<String, dynamic> action) {
    final color = action['color'] as Color;
    return GestureDetector(
      onTap: () {
        if (action['action'] == 'sync') {
          _handleSync();
        } else {
          GoRouter.of(context).push(action['route']);
        }
      },
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18.r),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 48.w,
              height: 48.h,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(14.r),
              ),
              child: Icon(action['icon'] as IconData, color: color, size: 24),
            ),
            SizedBox(height: 8.h),
            Text(
              action['label'],
              style: TextStyle(
                fontSize: 11.sp,
                fontWeight: FontWeight.w700,
                color: AppTheme.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  // â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”
  Widget _buildDetailsOverlay() {
    final isPaid = _selectedStatus == 'paid';
    final isUnpaid = _selectedStatus == 'unpaid';
    final isPresent = _selectedStatus == 'Present';
    final isAbsent = _selectedStatus == 'Absent';
    final isPending = _selectedStatus == 'Pending';

    Color headerColor;
    if (isPresent || isPaid) {
      headerColor = const Color(0xFF059669);
    } else if (isAbsent || isUnpaid) {
      headerColor = const Color(0xFFE11D48);
    } else if (isPending) {
      headerColor = const Color(0xFF475569);
    } else {
      headerColor = const Color(0xFFD97706);
    }

    String title;
    if (isPaid) {
      title = 'This Month Paid';
    } else if (isUnpaid) {
      title = 'This Month Unpaid';
    } else if (isPending) {
      title = 'Pending Classes';
    } else {
      title = 'Today $_selectedStatus Students';
    }

    return Material(
      color: Colors.transparent,
      child: Stack(
        children: [
          // Backdrop
          Positioned.fill(
            child: GestureDetector(
              onTap: () => setState(() => _showDetails = false),
              child: Container(color: Colors.black.withValues(alpha: 0.6)),
            ),
          ),
          // Content
          Center(
            child: GestureDetector(
              onTap: () {}, // Prevent tap from reaching backdrop
              child: Container(
                margin: EdgeInsets.all(20.w),
                constraints: const BoxConstraints(maxHeight: 600),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(28.r),
                ),
                child: Column(
                  children: [
                    Container(
                      padding: EdgeInsets.all(24.w),
                      decoration: BoxDecoration(
                        color: headerColor,
                        borderRadius: BorderRadius.vertical(
                            top: Radius.circular(28.r)),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  title.toUpperCase(),
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 18.sp,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: -0.5,
                                  ),
                                ),
                                Text(
                                  'Found ${_details.length} Records',
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.65),
                                    fontSize: 11.sp,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 1,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          GestureDetector(
                            onTap: () => setState(() => _showDetails = false),
                            child: Container(
                              width: 36.w,
                              height: 36.h,
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(12.r),
                              ),
                              child: const Icon(Icons.close_rounded,
                                  color: Colors.white, size: 20),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: _detailsLoading
                          ? const Center(child: CircularProgressIndicator())
                          : _details.isEmpty
                              ? Center(
                                  child: Text(
                                    'NO RECORDS FOUND',
                                    style: TextStyle(
                                      color: AppTheme.textSecondary,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 2,
                                      fontSize: 11.sp,
                                    ),
                                  ),
                                )
                              : Builder(
                                  builder: (context) {
                                    final grouped = <String, List<Map<String, dynamic>>>{};
                                    for (var item in _details) {
                                      final map = item as Map<String, dynamic>;
                                      final className = map['class']?.toString() ?? 'N/A';
                                      grouped.putIfAbsent(className, () => []).add(map);
                                    }
                                    
                                    final classes = grouped.keys.toList();
                                    
                                    return ListView.builder(
                                      padding: EdgeInsets.all(16.w),
                                      itemCount: classes.length,
                                      itemBuilder: (context, index) {
                                        final className = classes[index];
                                        final students = grouped[className]!;
                                        return Container(
                                          margin: EdgeInsets.only(bottom: 8.h),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFF8FAFC),
                                            borderRadius: BorderRadius.circular(16.r),
                                            border: Border.all(color: const Color(0xFFE2E8F0)),
                                          ),
                                          child: ListTile(
                                            onTap: () {
                                              final isPayment = _selectedStatus == 'paid' || _selectedStatus == 'unpaid';
                                              String query = 'className=${Uri.encodeComponent(className)}&status=$_selectedStatus&shift=${Uri.encodeComponent(_shift)}&isPayment=$isPayment';
                                              if (!isPayment) {
                                                query += '&session=${Uri.encodeComponent(_session)}';
                                              }
                                              GoRouter.of(context).push('/class-details?$query');
                                            },
                                            contentPadding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 4.h),
                                            leading: CircleAvatar(
                                              backgroundColor: headerColor.withValues(alpha: 0.1),
                                              child: Text(
                                                '🏫',
                                                style: TextStyle(fontSize: 14.sp),
                                              ),
                                            ),
                                            title: Text(
                                              className.toUpperCase(),
                                              style: TextStyle(
                                                fontWeight: FontWeight.w900,
                                                color: AppTheme.textPrimary,
                                                fontSize: 14.sp,
                                              ),
                                            ),
                                            subtitle: Text(
                                              '${students.length} Students',
                                              style: TextStyle(
                                                fontSize: 10.sp,
                                                color: AppTheme.textSecondary,
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                            trailing: Icon(Icons.arrow_forward_ios_rounded, size: 14.sp, color: AppTheme.textSecondary),
                                          ),
                                        );
                                      },
                                    );
                                  },
                                ),
                    ),
                    Padding(
                      padding: EdgeInsets.all(16.w),
                      child: SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0F172A),
                            foregroundColor: Colors.white,
                            padding: EdgeInsets.symmetric(vertical: 16.h),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16.r)),
                          ),
                          onPressed: () => setState(() => _showDetails = false),
                          child: Text(
                            'CLOSE VIEW',
                            style: TextStyle(
                              fontWeight: FontWeight.w900,
                              letterSpacing: 2,
                              fontSize: 11.sp,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _fmt(dynamic val) {
    if (val == null) return '';
    return val.toString();
  }

  String _fmtCurrency(dynamic val) {
    if (val == null) return '\$0';
    final n = double.tryParse(val.toString()) ?? 0.0;
    return '\$${n.toStringAsFixed(0)}';
  }

  String _fmtPercent(dynamic val) {
    if (val == null) return '0.0%';
    final n = double.tryParse(val.toString()) ?? 0.0;
    return '${n.toStringAsFixed(1)}%';
  }

  Widget _buildImpersonationBanner() {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      padding: EdgeInsets.all(16.w),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        border: Border.all(color: const Color(0xFFFCA5A5)),
        borderRadius: BorderRadius.circular(16.r),
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.warning_amber_rounded, color: Color(0xFFEF4444)),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('IMPERSONATION MODE',
                        style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 12.sp,
                            color: const Color(0xFFB91C1C))),
                    Text('You are viewing data for $_name',
                        style: TextStyle(
                            fontSize: 11.sp, color: const Color(0xFF7F1D1D))),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 12.h),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEF4444),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12.r)),
              ),
              onPressed: () async {
                await _auth.returnToOwner();
                final String? role = await _auth.getRole();
                if (mounted) {
                  AuthState().update(true, role ?? '');
                  GoRouter.of(context).go('/dashboard');
                }
              },
              icon: const Icon(Icons.exit_to_app_rounded, size: 16),
              label: Text('BACK TO OWNER',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11.sp)),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildSuperAdminBody(String Function(String) t) {
    final counts = _stats?['counts'] ?? {};
    final financials = _stats?['financials'] ?? {};
    final trends = _stats?['monthlyTrends'] ?? [];

    final isCurrent = _academicYears.firstWhere((y) => y['id']?.toString() == _selectedAcademicYearId, orElse: () => {'isCurrent': true})['isCurrent'] == true;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildRecentAnnouncements(t),
        Padding(
          padding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 8.h),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _sectionLabel('INSTITUTIONAL NETWORK'),
              if (_academicYears.isNotEmpty)
                Container(
                  height: 32.h,
                  padding: EdgeInsets.symmetric(horizontal: 12.w),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(10.r),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.1),
                        blurRadius: 4.r,
                        offset: const Offset(0, 2),
                      )
                    ],
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedAcademicYearId,
                      dropdownColor: const Color(0xFF1E293B),
                      icon: const Icon(Icons.keyboard_arrow_down_rounded,
                          color: Colors.white, size: 16),
                      style: TextStyle(
                          fontSize: 10.sp,
                          fontWeight: FontWeight.w900,
                          color: Colors.white),
                      onChanged: (val) {
                        if (val != null) {
                          setState(() => _selectedAcademicYearId = val);
                          _fetchStats();
                        }
                      },
                      items: _academicYears
                          .map((y) => DropdownMenuItem<String>(
                                value: y['id'].toString(),
                                child: Text(
                                  (y['name'] ?? '').toUpperCase(),
                                  style: TextStyle(
                                      fontSize: 10.sp,
                                      fontWeight: FontWeight.w900,
                                      color: Colors.white),
                                ),
                              ))
                          .toList(),
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (!isCurrent)
          Container(
            margin: EdgeInsets.symmetric(horizontal: 20.w, vertical: 8.h),
            padding: EdgeInsets.all(12.w),
            decoration: BoxDecoration(
              color: Colors.amber.withValues(alpha: 0.1),
              border: Border.all(color: Colors.amber.withValues(alpha: 0.2)),
              borderRadius: BorderRadius.circular(16.r),
            ),
            child: Row(
              children: [
                const Icon(Icons.archive_rounded, color: Colors.amber, size: 16),
                SizedBox(width: 8.w),
                Text(
                  'VIEWING ARCHIVED GLOBAL DATA',
                  style: TextStyle(
                      color: Colors.amber,
                      fontSize: 10.sp,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1),
                ),
              ],
            ),
          ),
        SizedBox(height: 16.h),
        // Premium Global Row
        Row(
          children: [
            Expanded(
              child: _premiumStatCard(
                'Schools',
                '${counts['totalSchools'] ?? 0}',
                const Color(0xFF6366F1),
                Icons.business_rounded,
                'Schools Active',
                gradient: const LinearGradient(
                  colors: [Color(0xFF818CF8), Color(0xFF6366F1)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
            ),
            SizedBox(width: 12.w),
            Expanded(
              child: _premiumStatCard(
                'Users',
                _fmt(counts['totalStudents']),
                const Color(0xFFF43F5E),
                Icons.people_alt_rounded,
                'Total Network',
                gradient: const LinearGradient(
                  colors: [Color(0xFFFB7185), Color(0xFFF43F5E)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
            ),
          ],
        ),
        SizedBox(height: 12.h),
        Row(
          children: [
            Expanded(
              child: _premiumStatCard(
                'Revenue',
                _fmtCurrency(financials['totalRevenue']),
                const Color(0xFF10B981),
                Icons.payments_rounded,
                'Life-time',
                gradient: const LinearGradient(
                  colors: [Color(0xFF34D399), Color(0xFF10B981)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
            ),
            SizedBox(width: 12.w),
            Expanded(
              child: _premiumStatCard(
                'This Month',
                _fmtCurrency(financials['thisMonthRevenue']),
                const Color(0xFFF59E0B),
                Icons.trending_up_rounded,
                'Efficiency: ${_fmtPercent(financials['overallCollectionEfficiency'] ?? financials['collectionsExcellence'])}',
                gradient: const LinearGradient(
                  colors: [Color(0xFFFBBF24), Color(0xFFF59E0B)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
            ),
          ],
        ),
        SizedBox(height: 24.h),
        _sectionLabel('ECOSYSTEM ANALYTICS'),
        SizedBox(height: 16.h),
        if (trends.isNotEmpty)
          Container(
            padding: EdgeInsets.all(24.w),
            height: 280.h,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.8),
              borderRadius: BorderRadius.circular(32.r),
              border: Border.all(color: Colors.white.withValues(alpha: 0.5)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 30.r,
                  offset: const Offset(0, 10),
                )
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Global Revenue Trend',
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 14.sp,
                    color: AppTheme.textPrimary,
                    letterSpacing: -0.5,
                  ),
                ),
                Text(
                  'Monthly performance across all schools',
                  style: TextStyle(
                    fontSize: 10.sp,
                    color: AppTheme.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(height: 24.h),
                Expanded(child: _buildBarChart(trends)),
              ],
            ),
          ),
        SizedBox(height: 24.h),
        _sectionLabel('GLOBAL OPERATIONS'),
        SizedBox(height: 16.h),
        _buildSuperAdminQuickActions(),
        SizedBox(height: 100.h), // Spacing for bottom nav
      ],
    );
  }

  Widget _buildSuperAdminQuickActions() {
    final actions = [
      {
        'label': 'Manage Schools',
        'icon': Icons.account_balance_rounded,
        'color': const Color(0xFF6366F1),
        'route': '/owner-dashboard'
      },
      {
        'label': 'Revenue Audit',
        'icon': Icons.analytics_rounded,
        'color': const Color(0xFF10B981),
        'route': '/admin/revenue'
      },
      {
        'label': 'Settings',
        'icon': Icons.settings_suggest_rounded,
        'color': const Color(0xFFF59E0B),
        'route': '/settings'
      },
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 1.6,
      ),
      itemCount: actions.length,
      itemBuilder: (context, i) => _glassQuickTile(actions[i]),
    );
  }

  Widget _glassQuickTile(Map<String, dynamic> action) {
    final color = action['color'] as Color;
    return GestureDetector(
      onTap: () => GoRouter.of(context).push(action['route']),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24.r),
          border: Border.all(color: const Color(0xFFF1F5F9)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 10.r,
              offset: const Offset(0, 4),
            )
          ],
        ),
        child: Padding(
          padding: EdgeInsets.all(16.0.w),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: EdgeInsets.all(8.w),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10.r),
                ),
                child: Icon(action['icon'] as IconData, color: color, size: 20),
              ),
              SizedBox(height: 12.h),
              Text(
                action['label'],
                style: TextStyle(
                  fontSize: 12.sp,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.textPrimary,
                  letterSpacing: -0.3,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _premiumStatCard(
      String label, String value, Color color, IconData icon, String subtitle,
      {Gradient? gradient}) {
    return Container(
      decoration: BoxDecoration(
        color: gradient == null ? Colors.white : null,
        gradient: gradient,
        borderRadius: BorderRadius.circular(24.r),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.15),
            blurRadius: 20.r,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24.r),
        child: Stack(
          children: [
            // Decorative background circles
            Positioned(
              right: -20,
              top: -20,
              child: Container(
                width: 80.w,
                height: 80.h,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.all(20.w),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: EdgeInsets.all(10.w),
                    decoration: BoxDecoration(
                      color: gradient == null
                          ? color.withValues(alpha: 0.1)
                          : Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(12.r),
                    ),
                    child: Icon(icon,
                        color: gradient == null ? color : Colors.white,
                        size: 24),
                  ),
                  SizedBox(height: 16.h),
                  Text(
                    value,
                    style: TextStyle(
                      fontSize: 22.sp,
                      fontWeight: FontWeight.w900,
                      color: gradient == null
                          ? AppTheme.textPrimary
                          : Colors.white,
                      height: 1.1.h,
                    ),
                  ),
                  SizedBox(height: 4.h),
                  Text(
                    label.toUpperCase(),
                    style: TextStyle(
                      fontSize: 10.sp,
                      fontWeight: FontWeight.w800,
                      color: gradient == null
                          ? AppTheme.textPrimary
                          : Colors.white.withValues(alpha: 0.9),
                      letterSpacing: 1,
                    ),
                  ),
                  SizedBox(height: 4.h),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 9.sp,
                      fontWeight: FontWeight.w600,
                      color: gradient == null
                          ? AppTheme.textSecondary.withValues(alpha: 0.6)
                          : Colors.white.withValues(alpha: 0.6),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBarChart(List<dynamic> data) {
    final max = _maxY(data);
    return BarChart(
      BarChartData(
        alignment: BarChartAlignment.spaceAround,
        maxY: max,
        barTouchData: BarTouchData(
          enabled: true,
          touchTooltipData: BarTouchTooltipData(
            getTooltipColor: (_) => Colors.white.withValues(alpha: 0.9),
            tooltipPadding:
                EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
            tooltipMargin: 8,
            getTooltipItem: (group, groupIndex, rod, rodIndex) {
              return BarTooltipItem(
                _fmtCurrency(rod.toY),
                TextStyle(
                  color: AppTheme.primary,
                  fontWeight: FontWeight.w900,
                  fontSize: 12.sp,
                ),
              );
            },
          ),
        ),
        titlesData: FlTitlesData(
          show: true,
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 32,
              getTitlesWidget: (value, meta) {
                final index = value.toInt();
                if (index < 0 || index >= data.length) return const SizedBox();
                final name = data[index]['name'] ?? data[index]['month'].toString();
                return Padding(
                  padding: const EdgeInsets.only(top: 8.0),
                  child: Text(
                    name.length > 3
                        ? name.substring(0, 3).toUpperCase()
                        : name.toUpperCase(),
                    style: TextStyle(
                        color: AppTheme.textSecondary.withValues(alpha: 0.6),
                        fontSize: 9.sp,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.5),
                  ),
                );
              },
            ),
          ),
          leftTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        ),
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          horizontalInterval: max / 4,
          getDrawingHorizontalLine: (value) => FlLine(
            color: Colors.black.withValues(alpha: 0.03),
            strokeWidth: 1,
          ),
        ),
        borderData: FlBorderData(show: false),
        barGroups: List.generate(data.length, (i) {
          final income =
              double.tryParse((data[i]['income'] ?? data[i]['revenue'] ?? '0').toString()) ?? 0;
          final expense =
              double.tryParse((data[i]['expense'] ?? '0').toString()) ?? 0;
          return BarChartGroupData(
            x: i,
            barRods: [
              BarChartRodData(
                toY: income,
                gradient: const LinearGradient(
                  colors: [Color(0xFF3B82F6), Color(0xFF60A5FA)],
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                ),
                width: 8.w,
                borderRadius:
                    BorderRadius.vertical(top: Radius.circular(4.r)),
              ),
              BarChartRodData(
                toY: expense,
                gradient: const LinearGradient(
                  colors: [Color(0xFFEF4444), Color(0xFFF87171)],
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                ),
                width: 8.w,
                borderRadius:
                    BorderRadius.vertical(top: Radius.circular(4.r)),
              ),
            ],
          );
        }),
      ),
    );
  }

  double _maxY(List<dynamic> g) {
    double m = 0;
    for (final item in g) {
      if (item is Map) {
        final i = double.tryParse(item['income']?.toString() ?? '0') ?? 0;
        final e = double.tryParse(item['expense']?.toString() ?? '0') ?? 0;
        if (i > m) m = i;
        if (e > m) m = e;
      }
    }
    return m > 0 ? m * 1.2 : 1000;
  }

  String _currentMonth() {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    return months[DateTime.now().month - 1];
  }

  Widget _buildChildDetailsOverlay(String Function(String) t) {
    final child = _selectedChild!;
    final name = child['user']?['name'] ?? 'Student';
    // Use clss.class_name (enrollment-resolved) and section.name
    final clss = child['clss']?['class_name'] ?? '';
    final section =
        child['section']?['name'] ?? child['clss']?['section'] ?? '';

    return Material(
      color: Colors.transparent,
      child: Stack(
        children: [
          // Backdrop
          Positioned.fill(
            child: GestureDetector(
              onTap: () => setState(() => _selectedChild = null),
              child: Container(color: Colors.black.withValues(alpha: 0.6)),
            ),
          ),
          // Content
          Center(
            child: GestureDetector(
              onTap: () {}, // Prevent tap from reaching backdrop
              child: Container(
                margin: EdgeInsets.all(20.w),
                constraints: const BoxConstraints(maxHeight: 700),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(28.r),
                ),
                child: Column(
                  children: [
                    Container(
                      padding: EdgeInsets.all(24.w),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0F172A),
                        borderRadius:
                            BorderRadius.vertical(top: Radius.circular(28.r)),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 50.w,
                            height: 50.h,
                            decoration: BoxDecoration(
                              color: const Color(0xFFDB2777),
                              borderRadius: BorderRadius.circular(14.r),
                            ),
                            child: Center(
                              child: Text(
                                name[0].toUpperCase(),
                                style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 24.sp),
                              ),
                            ),
                          ),
                          SizedBox(width: 16.w),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  name,
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 18.sp,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                Text(
                                  (child['status']?.toString().toLowerCase() == 'graduated'
                                          ? 'GRADUATED'
                                          : '${_childData['studentInfo']?['className'] ?? clss} ${_childData['studentInfo']?['sectionName'] ?? section}')
                                      .toUpperCase(),
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.5),
                                    fontSize: 10.sp,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 1,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          GestureDetector(
                            onTap: _downloadReportCardFromDashboard,
                            child: Container(
                              width: 36.w,
                              height: 36.h,
                              decoration: BoxDecoration(
                                color: Colors.blueAccent.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(12.r),
                              ),
                              child: const Icon(Icons.picture_as_pdf_rounded,
                                  color: Colors.blueAccent, size: 20),
                            ),
                          ),
                          SizedBox(width: 8.w),
                          GestureDetector(
                            onTap: () => setState(() => _selectedChild = null),
                            child: Container(
                              width: 36.w,
                              height: 36.h,
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(12.r),
                              ),
                              child: const Icon(Icons.close_rounded,
                                  color: Colors.white, size: 20),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: _childLoading
                          ? _buildChildDetailsShimmer()
                          : Builder(
                              builder: (context) {
                                final attendance =
                                    (_childData['attendance'] as List? ?? []);
                                final grades =
                                    (_childData['grades'] as List? ?? []);


                                return SingleChildScrollView(
                                  padding: EdgeInsets.all(20.w),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      _sectionLabel('GENERAL OVERVIEW'),
                                      SizedBox(height: 12.h),
                                      GridView.count(
                                        shrinkWrap: true,
                                        physics:
                                            const NeverScrollableScrollPhysics(),
                                        crossAxisCount: 2,
                                        crossAxisSpacing: 10,
                                        mainAxisSpacing: 10,
                                        childAspectRatio: 1.8,
                                        children: [
                                          _statMiniCard(
                                              'Attendance',
                                              '${attendance.where((a) => a['status'] == 'Present').length} / ${attendance.length}',
                                              const Color(0xFF059669)),
                                          _statMiniCard(
                                              'Exam Total',
                                              (_childData['gradesMeta']?['grandTotal'] != null && _childData['gradesMeta']?['grandMax'] != null)
                                                  ? '${_childData['gradesMeta']['grandTotal']} / ${_childData['gradesMeta']['grandMax']}'
                                                  : '${grades.length} Results',
                                              const Color(0xFF4F46E5)), // Indigo
                                          _statMiniCard(
                                              'Average',
                                              _childData['gradesMeta']?['average'] != null
                                                  ? '${_childData['gradesMeta']['average']}%'
                                                  : 'N/A',
                                              const Color(0xFF0EA5E9)), // Sky Blue
                                          _statMiniCard(
                                              'Status',
                                              _childData['gradesMeta']?['status']?.toString() ?? 'N/A',
                                              _childData['gradesMeta']?['status']?.toString() == 'Pass'
                                                  ? const Color(0xFF059669)
                                                  : const Color(0xFFDC2626)),
                                          _statMiniCard(
                                              'Class Pos',
                                              _childData['gradesMeta']?['classPosition'] != null
                                                  ? '${_childData['gradesMeta']['classPosition']}'
                                                  : 'N/A',
                                              const Color(0xFFD97706)),
                                        ],
                                      ),
                                      SizedBox(height: 24.h),
                                      Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          _sectionLabel('EXAM RESULTS'),
                                          if (_academicYears.isNotEmpty)
                                            Container(
                                              height: 32.h,
                                              padding:
                                                  EdgeInsets.symmetric(
                                                      horizontal: 12.w),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFF1E293B),
                                                borderRadius:
                                                    BorderRadius.circular(10.r),
                                                boxShadow: [
                                                  BoxShadow(
                                                    color: Colors.black.withValues(alpha: 0.1),
                                                    blurRadius: 4.r,
                                                    offset: const Offset(0, 2),
                                                  )
                                                ],
                                              ),
                                              child: DropdownButtonHideUnderline(
                                                child: DropdownButton<String>(
                                                  value: _selectedChildYearId,
                                                  isExpanded: false,
                                                  dropdownColor: const Color(0xFF1E293B),
                                                  icon: const Icon(
                                                      Icons.keyboard_arrow_down_rounded,
                                                      color: Colors.white,
                                                      size: 16),
                                                  style: TextStyle(
                                                      fontSize: 10.sp,
                                                      fontWeight: FontWeight.w900,
                                                      color: Colors.white,
                                                      letterSpacing: 0.5),
                                                  onChanged: (val) {
                                                    if (val != null) {
                                                      _fetchChildDetails(child,
                                                          yearId: val);
                                                    }
                                                  },
                                                  items: _academicYears
                                                      .map((y) =>
                                                          DropdownMenuItem<String>(
                                                            value: y['id'].toString(),
                                                            child: Text(
                                                              (y['name'] ?? '').toUpperCase(),
                                                              style: TextStyle(
                                                                fontSize: 10.sp,
                                                                fontWeight: FontWeight.w900,
                                                                color: Colors.white,
                                                              ),
                                                            ),
                                                          ))
                                                      .toList(),
                                                ),
                                              ),
                                            ),
                                        ],
                                      ),
                                      SizedBox(height: 12.h),
                                      _childGradesTable(),
                                      SizedBox(height: 24.h),
                                      _sectionLabel('PAYMENT HISTORY'),
                                      SizedBox(height: 12.h),
                                      _childStatusHistory(),
                                      SizedBox(height: 24.h),
                                      Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                           Column(
                                             crossAxisAlignment:
                                                 CrossAxisAlignment.start,
                                             children: [
                                               _sectionLabel('${t('attendance').toUpperCase()} ${t('history').toUpperCase()}'),
                                               Text(
                                                 t('last_7_days'),
                                                 style: TextStyle(
                                                   fontSize: 9.sp,
                                                   fontWeight: FontWeight.bold,
                                                   color: const Color(0xFF94A3B8),
                                                 ),
                                               ),
                                             ],
                                           ),
                                          GestureDetector(
                                            onTap: () {
                                              setState(
                                                  () => _selectedChild = null);
                                              context.push(
                                                  '/parent-attendance-history?studentId=${child['id']}&studentName=$name');
                                            },
                                            child: Text(
                                              'HISTORY',
                                              style: TextStyle(
                                                fontSize: 10.sp,
                                                fontWeight: FontWeight.w900,
                                                color: AppTheme.primary,
                                                letterSpacing: 1,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      SizedBox(height: 12.h),
                                      _childAttendanceList(),
                                    ],
                                  ),
                                );
                              },
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _statMiniCard(String label, String value, Color color) {
    return Container(
      padding: EdgeInsets.all(12.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16.r),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label,
              style: TextStyle(
                  fontSize: 8.sp,
                  fontWeight: FontWeight.w900,
                  color: AppTheme.textSecondary)),
          SizedBox(height: 2.h),
          Text(value,
              style: TextStyle(
                  fontSize: 14.sp, fontWeight: FontWeight.w900, color: color)),
        ],
      ),
    );
  }

  Widget _childGradesTable() {
    final grades = (_childData['grades'] as List? ?? []);
    if (grades.isEmpty) return const SizedBox();
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16.r),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: grades.length,
        separatorBuilder: (_, __) => Divider(height: 1.h),
        itemBuilder: (context, i) {
          final g = grades[i];
          final score = g['total'] ?? g['marks'] ?? g['score'] ?? 0;
          final total = g['totalMarks'] ?? g['exam']?['totalMarks'] ?? 100;
          final percent = total > 0 ? (score / total) * 100 : 0;

          return ListTile(
            dense: true,
            title: Text(
                g['name'] ??
                    g['exam']?['subject']?['name'] ??
                    g['subject'] ??
                    '',
                style: const TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text('Max: $total', style: TextStyle(fontSize: 10.sp)),
            trailing: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('$score / $total',
                    style: TextStyle(
                        fontWeight: FontWeight.w900,
                        color: percent >= 50
                            ? const Color(0xFF059669)
                            : const Color(0xFFDC2626))),
                Text('Grade: ${g['grade'] ?? 'N/A'}',
                    style: TextStyle(fontSize: 9.sp)),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _childStatusHistory() {
    final history = (_childData['statusHistory'] as List? ?? []);
    if (history.isEmpty) return const SizedBox();
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 8,
          mainAxisSpacing: 8,
          childAspectRatio: 2.5),
      itemCount: history.length,
      itemBuilder: (context, i) {
        final s = history[i];
        final paid = s['status'] == 'paid';
        return Container(
          padding: EdgeInsets.symmetric(horizontal: 10.w),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12.r),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              Container(
                width: 4.w,
                height: 24.h,
                decoration: BoxDecoration(
                  color:
                      paid ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                  borderRadius: BorderRadius.circular(2.r),
                ),
              ),
              SizedBox(width: 8.w),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Month ${s['month']}',
                        style: TextStyle(
                            fontSize: 10.sp, fontWeight: FontWeight.bold)),
                    Text(paid ? 'Paid' : 'Pending',
                        style: TextStyle(
                            fontSize: 8.sp,
                            fontWeight: FontWeight.w900,
                            color: paid
                                ? const Color(0xFF059669)
                                : const Color(0xFFDC2626))),
                  ],
                ),
              ),
              Icon(paid ? Icons.check_circle_rounded : Icons.error_rounded,
                  size: 14,
                  color:
                      paid ? const Color(0xFF10B981) : const Color(0xFFEF4444)),
            ],
          ),
        );
      },
    );
  }

  Widget _childAttendanceList() {
    final att = (_childData['attendance'] as List? ?? []);
    if (att.isEmpty) return const SizedBox();

    // Group by date to find the 7 most recent unique days
    final List<dynamic> displayList = [];
    final Set<String> uniqueDates = {};
    
    for (var a in att) {
      String dateStr = 'N/A';
      if (a['date'] != null) {
        try {
          final parsed = DateTime.tryParse(a['date']);
          if (parsed != null) {
            dateStr = parsed.toLocal().toString().split(' ')[0];
          }
        } catch (_) {}
      }
      
      if (uniqueDates.length < 7 || uniqueDates.contains(dateStr)) {
        displayList.add(a);
        if (dateStr != 'N/A') uniqueDates.add(dateStr);
      } else {
        break; // We have enough days
      }
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20.r),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        children: [
          // Table Header
          Container(
            padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.vertical(top: Radius.circular(20.r)),
            ),
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: Text(
                    'DATE'.toUpperCase(),
                    style: TextStyle(
                        fontSize: 9.sp,
                        fontWeight: FontWeight.w900,
                        color: AppTheme.textSecondary,
                        letterSpacing: 1),
                  ),
                ),
                Expanded(
                  flex: 2,
                  child: Text(
                    'SESSION'.toUpperCase(),
                    style: TextStyle(
                        fontSize: 9.sp,
                        fontWeight: FontWeight.w900,
                        color: AppTheme.textSecondary,
                        letterSpacing: 1),
                  ),
                ),
                Expanded(
                  flex: 2,
                  child: Text(
                    'STATUS'.toUpperCase(),
                    textAlign: TextAlign.right,
                    style: TextStyle(
                        fontSize: 9.sp,
                        fontWeight: FontWeight.w900,
                        color: AppTheme.textSecondary,
                        letterSpacing: 1),
                  ),
                ),
              ],
            ),
          ),
          Divider(height: 1.h),
          // Table Body
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 220),
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: displayList.length,
              separatorBuilder: (_, __) => Divider(height: 1.h),
              itemBuilder: (context, i) {
                final a = displayList[i];
                final status = a['status']?.toString() ?? '';
                final present = status == 'Present';
                final absent = status == 'Absent';

                String englishStatus = status;
                if (present) {
                  englishStatus = 'Present';
                } else if (absent) {
                  englishStatus = 'Absent';
                } else if (status == 'Late') {
                  englishStatus = 'Late';
                }

                String dateStr = 'N/A';
                if (a['date'] != null) {
                  try {
                    final parsed = DateTime.tryParse(a['date']);
                    if (parsed != null) {
                      dateStr = parsed.toLocal().toString().split(' ')[0];
                    }
                  } catch (_) {}
                }

                return Padding(
                  padding:
                      EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: Text(
                          dateStr,
                          style: TextStyle(
                              fontSize: 12.sp,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textPrimary),
                        ),
                      ),
                      Expanded(
                        flex: 2,
                        child: Text(
                          a['session']?.toString() ?? 'N/A',
                          style: TextStyle(
                              fontSize: 10.sp,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.textSecondary),
                        ),
                      ),
                      Expanded(
                        flex: 2,
                        child: Align(
                          alignment: Alignment.centerRight,
                          child: Container(
                            padding: EdgeInsets.symmetric(
                                horizontal: 8.w, vertical: 4.h),
                            decoration: BoxDecoration(
                              color: present
                                  ? const Color(0xFFD1FAE5)
                                  : absent
                                      ? const Color(0xFFFFF1F2)
                                      : const Color(0xFFFEF3C7),
                              borderRadius: BorderRadius.circular(8.r),
                            ),
                            child: Text(
                              englishStatus.toUpperCase(),
                              style: TextStyle(
                                fontSize: 8.sp,
                                fontWeight: FontWeight.w900,
                                color: present
                                    ? const Color(0xFF059669)
                                    : absent
                                        ? const Color(0xFFDC2626)
                                        : const Color(0xFFD97706),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _emptyBox(String msg) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(20.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16.r),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Center(
        child: Text(msg,
            style: TextStyle(
                color: AppTheme.textSecondary,
                fontSize: 11.sp,
                fontStyle: FontStyle.italic)),
      ),
    );
  }

  Widget _buildChildDetailsShimmer() {
    return Shimmer.fromColors(
      baseColor: Colors.grey[300]!,
      highlightColor: Colors.grey[100]!,
      child: SingleChildScrollView(
        padding: EdgeInsets.all(20.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
                width: 80.w,
                height: 10.h,
                decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(4.r))),
            SizedBox(height: 12.h),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 1.8,
              children: List.generate(
                  4,
                  (_) => Container(
                      decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16.r)))),
            ),
            SizedBox(height: 24.h),
            Container(
                width: 150.w,
                height: 10.h,
                decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(4.r))),
            SizedBox(height: 12.h),
            Container(
                width: double.infinity,
                height: 150.h,
                decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16.r))),
            SizedBox(height: 24.h),
            Container(
                width: 120.w,
                height: 10.h,
                decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(4.r))),
            SizedBox(height: 12.h),
            Container(
                width: double.infinity,
                height: 100.h,
                decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16.r))),
          ],
        ),
      ),
    );
  }

  Widget _buildAccountantBody(String Function(String) t) {
    final s = _stats ?? {};
    final String curr = s['currency']?.toString() ?? '\$';
    final double revenue =
        double.tryParse(s['monthlyRevenue']?.toString() ?? '0') ?? 0.0;
    final double expected =
        double.tryParse(s['expectedRevenue']?.toString() ?? '0') ?? 0.0;
    final double expense =
        double.tryParse(s['monthlyExpense']?.toString() ?? '0') ?? 0.0;

    final attendance = (s['attendance'] as Map?)?.cast<String, dynamic>() ?? {};

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildRecentAnnouncements(t),
        SizedBox(height: 12.h),
        Row(
          children: [
            Text(
              'VIEWING SESSION:',
              style: TextStyle(
                fontSize: 10.sp,
                fontWeight: FontWeight.w900,
                color: AppTheme.textSecondary,
                letterSpacing: 2,
              ),
            ),
            SizedBox(width: 12.w),
            Container(
              padding: EdgeInsets.all(4.w),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(12.r),
              ),
              child: Row(
                children: ['Break 1', 'Break 2'].map((s) {
                  final active = _session == s;
                  return GestureDetector(
                    onTap: () {
                      setState(() => _session = s);
                      _fetchStats();
                    },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: EdgeInsets.symmetric(
                          horizontal: 16.w, vertical: 8.h),
                      decoration: BoxDecoration(
                        color: active ? Colors.white : Colors.transparent,
                        borderRadius: BorderRadius.circular(8.r),
                        boxShadow: active
                            ? [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.06),
                                  blurRadius: 4.r,
                                )
                              ]
                            : [],
                      ),
                      child: Text(
                        s,
                        style: TextStyle(
                          fontSize: 10.sp,
                          fontWeight: FontWeight.w900,
                          color: active
                              ? AppTheme.primary
                              : AppTheme.textSecondary,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
        SizedBox(height: 12.h),
        Row(
          children: [
            Text(
              'VIEWING SHIFT:',
              style: TextStyle(
                fontSize: 10.sp,
                fontWeight: FontWeight.w900,
                color: AppTheme.textSecondary,
                letterSpacing: 2,
              ),
            ),
            SizedBox(width: 12.w),
            Container(
              padding: EdgeInsets.all(4.w),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(12.r),
              ),
              child: Row(
                children: [
                  {'label': 'ðŸŒ… SUBAX', 'val': 'morning'},
                  {'label': 'ðŸŒ‡ GALAB', 'val': 'afternoon'},
                  {'label': 'ðŸŒ™ HABEEN', 'val': 'night'}
                ].map((s) {
                  final active = _shift == s['val'];
                  return GestureDetector(
                    onTap: () {
                      setState(() => _shift = s['val']!);
                      _fetchStats();
                    },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: EdgeInsets.symmetric(
                          horizontal: 20.w, vertical: 8.h),
                      decoration: BoxDecoration(
                        color: active ? Colors.white : Colors.transparent,
                        borderRadius: BorderRadius.circular(8.r),
                        boxShadow: active
                            ? [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.06),
                                  blurRadius: 4.r,
                                )
                              ]
                            : [],
                      ),
                      child: Text(
                        s['label']!,
                        style: TextStyle(
                          fontSize: 10.sp,
                          fontWeight: FontWeight.w900,
                          color: active
                              ? AppTheme.primary
                              : AppTheme.textSecondary,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
        SizedBox(height: 20.h),
        _sectionLabel('${_currentMonth()} ${t('payment_status').toUpperCase()}'),
        SizedBox(height: 12.h),
        Row(
          children: [
            Expanded(
              child: _feeCard(
                t('paid'),
                '${s['paidStudents'] ?? 0}',
                const Color(0xFF2563EB),
                const Color(0xFFDBEAFE),
                Icons.check_circle_rounded,
                'paid',
                t,
              ),
            ),
            SizedBox(width: 12.w),
            Expanded(
              child: _feeCard(
                t('unpaid'),
                '${s['unpaidStudents'] ?? 0}',
                const Color(0xFFDC2626),
                const Color(0xFFFEE2E2),
                Icons.pending_rounded,
                'unpaid',
                t,
              ),
            ),
          ],
        ),
        SizedBox(height: 24.h),
        _sectionLabel(t('attendance_overview').toUpperCase()),
        SizedBox(height: 12.h),
        Container(
          padding: EdgeInsets.all(16.w),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(24.r),
            border: Border.all(color: const Color(0xFFF1F5F9)),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: _attendanceCard(
                      t('total_present').toUpperCase(),
                      '${attendance['present'] ?? 0}',
                      const Color(0xFF059669),
                      const Color(0xFFD1FAE5),
                      Icons.check_circle_rounded,
                      'Present',
                      t,
                    ),
                  ),
                  SizedBox(width: 10.w),
                  Expanded(
                    child: _attendanceCard(
                      t('total_absent').toUpperCase(),
                      '${attendance['absent'] ?? 0}',
                      const Color(0xFFDC2626),
                      const Color(0xFFFFE4E6),
                      Icons.cancel_rounded,
                      'Absent',
                      t,
                    ),
                  ),
                ],
              ),
              SizedBox(height: 10.h),
              Row(
                children: [
                  Expanded(
                    child: _attendanceCard(
                      t('total_late').toUpperCase(),
                      '${attendance['late'] ?? 0}',
                      const Color(0xFFD97706),
                      const Color(0xFFFEF3C7),
                      Icons.access_time_filled_rounded,
                      'Late',
                      t,
                    ),
                  ),
                  SizedBox(width: 10.w),
                  Expanded(
                    child: _attendanceCard(
                      t('pending_classes').toUpperCase(),
                      '${attendance['unmarkedClasses'] ?? 0}',
                      const Color(0xFF64748B),
                      const Color(0xFFF1F5F9),
                      Icons.hourglass_empty_rounded,
                      'Pending',
                      t,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        SizedBox(height: 24.h),
        _sectionLabel(t('financial_overview').toUpperCase()),
        SizedBox(height: 12.h),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 1.6,
          children: [
            _topStatCard(
                t('collected_revenue'),
                '$curr${revenue.toStringAsFixed(0)}',
                const Color(0xFFDBEAFE),
                AppTheme.primary,
                Icons.account_balance_wallet_rounded),

            _topStatCard(
                t('expected_revenue'),
                '$curr${expected.toStringAsFixed(0)}',
                const Color(0xFFFEF3C7),
                const Color(0xFFF59E0B),
                Icons.assessment_rounded),

            _topStatCard(
                t('monthly_expense'),
                '$curr${expense.toStringAsFixed(0)}',
                const Color(0xFFFFE4E6),
                const Color(0xFFE11D48),
                Icons.money_off_rounded),

            _topStatCard(
                t('net_balance'),
                '$curr${(revenue - expense).toStringAsFixed(0)}',
                const Color(0xFFDCFCE7),
                const Color(0xFF059669),
                Icons.account_balance_rounded),
          ],
        ),
        SizedBox(height: 24.h),
        _sectionLabel(t('quick_actions').toUpperCase()),
        SizedBox(height: 12.h),
        _actionGrid([
          _actionItem(t('income'), Icons.add_card_rounded, Colors.green,
              () => context.push('/payments')),
          _actionItem(t('expense'), Icons.money_off_rounded, Colors.red,
              () => context.push('/expenses')),
          _actionItem(t('attendance'), Icons.fact_check_rounded, Colors.blue,
              () => context.push('/attendance')),
          _actionItem(t('salaries'), Icons.person_search_rounded, Colors.purple,
              () => context.push('/payroll')),
        ]),
      ],
    );
  }

  Widget _buildLibrarianBody(String Function(String) t) {
    final s = _stats ?? {};
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildRecentAnnouncements(t),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 1.6,
          children: [
            _topStatCard(
                t('total_books'),
                '${s['totalBooks'] ?? 0}',
                const Color(0xFFDBEAFE),
                AppTheme.primary,
                Icons.menu_book_rounded),
            _topStatCard(
                t('issued_books'),
                '${s['issuedBooks'] ?? 0}',
                const Color(0xFFEDE9FE),
                AppTheme.accent,
                Icons.outbound_rounded),
            _topStatCard(
                t('available'),
                '${s['availableBooks'] ?? 0}',
                const Color(0xFFDCFCE7),
                Colors.green,
                Icons.check_circle_rounded),
            _topStatCard(
                t('overdue'),
                '${s['overdueBooks'] ?? 0}',
                const Color(0xFFFFE4E6),
                const Color(0xFFE11D48),
                Icons.notification_important_rounded),
          ],
        ),
        SizedBox(height: 24.h),
        _sectionLabel(t('library_management').toUpperCase()),
        SizedBox(height: 12.h),
        _actionGrid([
          _actionItem(t('books_list'), Icons.local_library_rounded, Colors.orange,
              () => context.push('/library')),
          _actionItem(t('issuing'), Icons.add_box_rounded, Colors.blue,
              () => context.push('/library')),
          _actionItem(t('returns'), Icons.assignment_return_rounded, Colors.green,
              () => context.push('/library')),
          _actionItem(t('settings'), Icons.settings_rounded, Colors.grey,
              () => context.push('/settings')),
        ]),
      ],
    );
  }

  Widget _buildStaffBody(String Function(String) t) {
    final s = _stats ?? {};
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildRecentAnnouncements(t),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 1.6,
          children: [
            _topStatCard(
                t('students'),
                '${s['totalStudents'] ?? 0}',
                const Color(0xFFDBEAFE),
                AppTheme.primary,
                Icons.people_rounded),
            _topStatCard(t('teachers'), '${s['totalTeachers'] ?? 0}',
                const Color(0xFFEDE9FE), AppTheme.accent, Icons.person_rounded),
            _topStatCard(t('events'), '${s['upcomingEvents'] ?? 0}',
                const Color(0xFFFEF3C7), AppTheme.warning, Icons.event_rounded),
            _topStatCard(
                t('notices'),
                '${s['announcements'] ?? 0}',
                const Color(0xFFFFE4E6),
                const Color(0xFFE11D48),
                Icons.campaign_rounded),
          ],
        ),
        SizedBox(height: 24.h),
        _sectionLabel(t('quick_actions').toUpperCase()),
        SizedBox(height: 12.h),
        _actionGrid([
          _actionItem(t('students'), Icons.school_rounded, Colors.blue,
              () => context.push('/students')),
          _actionItem(t('teachers'), Icons.groups_rounded, Colors.purple,
              () => context.push('/teachers')),
          _actionItem(t('attendance'), Icons.fact_check_rounded, Colors.green,
              () => context.push('/attendance')),
          _actionItem(t('exam_marks'), Icons.grading_rounded, Colors.red,
              () => context.push('/exams')),
        ]),
      ],
    );
  }

  Widget _actionGrid(List<Widget> children) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 4,
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      children: children,
    );
  }

  Widget _actionItem(
      String label, IconData icon, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            padding: EdgeInsets.all(12.w),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(16.r),
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          SizedBox(height: 4.h),
          Text(
            label,
            style: TextStyle(
                fontSize: 9.sp,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildRecentAnnouncements(String Function(String) t) {
    if (_announcementsLoading && _announcements.isEmpty) {
      return Padding(
        padding: EdgeInsets.symmetric(vertical: 16.h),
        child: Shimmer.fromColors(
          baseColor: Colors.grey[300]!,
          highlightColor: Colors.grey[100]!,
          child: Container(
            margin: EdgeInsets.symmetric(horizontal: 20.w),
            height: 100.h,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20.r),
            ),
          ),
        ),
      );
    }

    if (_announcements.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Text('📢', style: TextStyle(fontSize: 16.sp)),
                  SizedBox(width: 8.w),
                  _sectionLabel(t('announcements').toUpperCase()),
                ],
              ),
              GestureDetector(
                onTap: () => GoRouter.of(context).push('/announcements'),
                child: Text(
                  (t('view_all') != 'view_all' ? t('view_all') : 'VIEW ALL').toUpperCase(),
                  style: TextStyle(
                    fontSize: 10.sp,
                    fontWeight: FontWeight.w900,
                    color: AppTheme.primary,
                    letterSpacing: 1,
                  ),
                ),
              ),
            ],
          ),
        ),
        SizedBox(height: 4.h),
        SizedBox(
          height: 110.h,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.symmetric(horizontal: 16.w),
            itemCount: _announcements.length > 3 ? 3 : _announcements.length,
            itemBuilder: (context, i) {
              final a = _announcements[i];
              final priority = a['priority']?.toString().toLowerCase() ?? 'normal';
              final color = priority == 'urgent'
                  ? const Color(0xFFEF4444)
                  : priority == 'high'
                      ? const Color(0xFFF59E0B)
                      : AppTheme.primary;

              return Container(
                width: MediaQuery.of(context).size.width * 0.75,
                margin: const EdgeInsets.only(right: 12, bottom: 4),
                padding: EdgeInsets.all(16.w),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20.r),
                  border: Border.all(color: color.withValues(alpha: 0.1)),
                  boxShadow: [
                    BoxShadow(
                      color: color.withValues(alpha: 0.04),
                      blurRadius: 8.r,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 6.w,
                          height: 6.h,
                          decoration: BoxDecoration(
                            color: color,
                            shape: BoxShape.circle,
                          ),
                        ),
                        SizedBox(width: 8.w),
                        Expanded(
                          child: Text(
                            a['title']?.toString() ?? '',
                            style: TextStyle(
                              fontSize: 12.sp,
                              fontWeight: FontWeight.w900,
                              color: AppTheme.textPrimary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (priority == 'urgent')
                           Container(
                             padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 2.h),
                             decoration: BoxDecoration(
                               color: const Color(0xFFFEE2E2),
                               borderRadius: BorderRadius.circular(4.r),
                             ),
                             child: Text('URGENT', style: TextStyle(color: const Color(0xFFB91C1C), fontSize: 7.sp, fontWeight: FontWeight.w900)),
                           ),
                      ],
                    ),
                    SizedBox(height: 6.h),
                    Text(
                      a['content']?.toString() ?? '',
                      style: TextStyle(
                        fontSize: 10.sp,
                        color: AppTheme.textSecondary,
                        height: 1.3.h,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const Spacer(),
                    Text(
                      a['created_at'] != null
                          ? DateTime.tryParse(a['created_at'])?.toLocal().toString().split(' ')[0] ?? ''
                          : '',
                      style: TextStyle(
                        fontSize: 8.sp,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF94A3B8),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}



