import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';
import '../../services/auth_service.dart';
import '../../router/auth_state.dart';

class OwnerAdminsScreen extends StatefulWidget {
  const OwnerAdminsScreen({super.key});

  @override
  State<OwnerAdminsScreen> createState() => _OwnerAdminsScreenState();
}

class _OwnerAdminsScreenState extends State<OwnerAdminsScreen> {
  final ApiService _api = ApiService();
  final AuthService _auth = AuthService();
  List<dynamic> _admins = [];
  bool _loading = true;
  Map<String, dynamic>? _smsStats; // SMS stats per super admin
  String? _togglingId; // track which admin's SMS is being toggled

  static const _monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    await Future.wait([_fetchAdmins(), _fetchSmsStats()]);
  }

  Future<void> _fetchAdmins() async {
    try {
      if (mounted) setState(() => _loading = true);
      final res = await _api.get(ApiConfig.ownerAdmins);
      if (mounted) {
        setState(() {
          if (res.data is List) {
            _admins = res.data;
          } else if (res.data is Map && res.data['data'] is List) {
            _admins = res.data['data'];
          } else if (res.data is Map && res.data['admins'] is List) {
            _admins = res.data['admins'];
          } else {
            _admins = [];
          }
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Cillad ayaa dhacday: $e')),
        );
      }
    }
  }

  Future<void> _fetchSmsStats() async {
    try {
      final res = await _api.get('/api/owner/sms-stats');
      if (mounted) {
        setState(() => _smsStats = res.data is Map ? Map<String, dynamic>.from(res.data) : null);
      }
    } catch (e) {
      // non-critical, ignore
    }
  }

  Map<String, dynamic>? _getAdminSmsData(String adminId) {
    if (_smsStats == null) return null;
    final stats = _smsStats!['stats'];
    if (stats is List) {
      try {
        return Map<String, dynamic>.from(stats.firstWhere((s) => s['id'] == adminId, orElse: () => null));
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  Future<void> _toggleSmsAuth(Map<String, dynamic> admin) async {
    final bool current = admin['isSmsEnabled'] ?? false;
    final String action = current ? 'xirto' : 'furto';

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20.r)),
        title: const Text('SMS Oggolaanshaha', style: TextStyle(fontWeight: FontWeight.w900)),
        content: Text('Ma hubtaa inaad SMS-ka $action ${admin['name']}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Jooji')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: current ? Colors.red : Colors.blue,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(current ? 'Xir SMS' : 'Fur SMS'),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      setState(() => _togglingId = admin['id']);
      try {
        await _api.put('${ApiConfig.ownerAdmins}/${admin['id']}', data: {'isSmsEnabled': !current});
        await Future.wait([_fetchAdmins(), _fetchSmsStats()]);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('SMS waa la ${!current ? "furay" : "xiray"} â€” ${admin['name']}'),
              backgroundColor: !current ? Colors.blue : Colors.grey[700],
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Cillad: $e'), backgroundColor: Colors.red),
          );
        }
      } finally {
        if (mounted) setState(() => _togglingId = null);
      }
    }
  }

  void _showAdminSmsDetail(Map<String, dynamic> admin) {
    final smsData = _getAdminSmsData(admin['id']);
    final schoolBreakdown = smsData?['schoolBreakdown'] as List? ?? [];
    final totalThisMonth = smsData?['totalSmsThisMonth'] ?? 0;
    final totalAllTime = smsData?['totalSmsAllTime'] ?? 0;
    final currentMonth = _smsStats?['currentMonth'] ?? DateTime.now().month;
    final currentYear = _smsStats?['currentYear'] ?? DateTime.now().year;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        height: MediaQuery.of(context).size.height * 0.75,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28.r)),
        ),
        child: Column(
          children: [
            SizedBox(height: 10.h),
            Container(
              width: 36.w, height: 4.h,
              decoration: BoxDecoration(color: Colors.grey[200], borderRadius: BorderRadius.circular(2.r)),
            ),
            // Header
            Container(
              padding: EdgeInsets.all(20.w),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF1E293B), Color(0xFF1E40AF)],
                  begin: Alignment.topLeft, end: Alignment.bottomRight,
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 48.w, height: 48.h,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(16.r),
                    ),
                    child: Center(
                      child: Text(
                        admin['name'][0].toUpperCase(),
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 20.sp),
                      ),
                    ),
                  ),
                  SizedBox(width: 14.w),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(admin['name'], style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18.sp)),
                        Text(
                          '${_monthNames[currentMonth - 1]} $currentYear â€” SMS Statistics',
                          style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 10.sp, fontWeight: FontWeight.w700, letterSpacing: 1),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 5.h),
                    decoration: BoxDecoration(
                      color: (admin['isSmsEnabled'] ?? false)
                          ? Colors.blue.withValues(alpha: 0.3)
                          : Colors.red.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(20.r),
                    ),
                    child: Text(
                      (admin['isSmsEnabled'] ?? false) ? '🔍“ AUTHORIZED' : '🔒 RESTRICTED',
                      style: TextStyle(color: Colors.white, fontSize: 9.sp, fontWeight: FontWeight.w900),
                    ),
                  ),
                ],
              ),
            ),

            Expanded(
              child: ListView(
                padding: EdgeInsets.all(20.w),
                children: [
                  // Total stats row
                  Row(
                    children: [
                      _smsStatCard('SMS This Month', totalThisMonth.toString(), Icons.message_rounded, Colors.blue),
                      SizedBox(width: 12.w),
                      _smsStatCard('Total All Time', totalAllTime.toString(), Icons.history_rounded, const Color(0xFF7C3AED)),
                      SizedBox(width: 12.w),
                      _smsStatCard('Schools', schoolBreakdown.length.toString(), Icons.school_rounded, Colors.green),
                    ],
                  ),
                  SizedBox(height: 24.h),

                  if (schoolBreakdown.isNotEmpty) ...[
                    Text(
                      'DUGSI KASTA INTA FARIIN',
                      style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: AppTheme.textSecondary, letterSpacing: 1.5),
                    ),
                    SizedBox(height: 12.h),

                    // School breakdown bars
                    ...(() {
                      final maxVal = schoolBreakdown.map<int>((s) => (s['thisMonth'] as num? ?? 0).toInt()).reduce((a, b) => a > b ? a : b);
                      final safeMax = maxVal > 0 ? maxVal : 1;
                      return schoolBreakdown.map<Widget>((school) {
                        final int count = (school['thisMonth'] as num? ?? 0).toInt();
                        final int allTime = (school['allTime'] as num? ?? 0).toInt();
                        final double pct = count / safeMax;
                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: EdgeInsets.all(14.w),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(16.r),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    width: 32.w, height: 32.h,
                                    decoration: BoxDecoration(
                                      color: Colors.blue.withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(10.r),
                                    ),
                                    child: const Icon(Icons.school_rounded, size: 16, color: Colors.blue),
                                  ),
                                  SizedBox(width: 10.w),
                                  Expanded(
                                    child: Text(
                                      school['schoolName'] ?? 'Dugsi',
                                      style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13.sp),
                                    ),
                                  ),
                                  Text(
                                    '$count SMS',
                                    style: TextStyle(fontWeight: FontWeight.w900, color: Colors.blue, fontSize: 13.sp),
                                  ),
                                ],
                              ),
                              SizedBox(height: 10.h),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(6.r),
                                child: LinearProgressIndicator(
                                  value: pct,
                                  minHeight: 6,
                                  backgroundColor: Colors.blue.withValues(alpha: 0.1),
                                  valueColor: const AlwaysStoppedAnimation(Colors.blue),
                                ),
                              ),
                              SizedBox(height: 4.h),
                              Text(
                                'Wadarta oo dhan: $allTime SMS',
                                style: TextStyle(fontSize: 10.sp, color: AppTheme.textSecondary, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        );
                      }).toList();
                    })(),
                  ] else
                    Container(
                      padding: EdgeInsets.all(24.w),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(20.r),
                      ),
                      child: Column(
                        children: [
                          Text('📱­', style: TextStyle(fontSize: 32.sp)),
                          SizedBox(height: 8.h),
                          const Text('Wali SMS la ma dirin', style: TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),

                  SizedBox(height: 24.h),
                  // SMS Toggle button from detail view
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: (admin['isSmsEnabled'] ?? false) ? Colors.red[50] : Colors.blue[50],
                        foregroundColor: (admin['isSmsEnabled'] ?? false) ? Colors.red : Colors.blue,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
                        padding: EdgeInsets.symmetric(vertical: 14.h),
                        side: BorderSide(
                          color: (admin['isSmsEnabled'] ?? false)
                              ? Colors.red.withValues(alpha: 0.3)
                              : Colors.blue.withValues(alpha: 0.3),
                        ),
                      ),
                      onPressed: () {
                        Navigator.pop(ctx);
                        _toggleSmsAuth(admin);
                      },
                      icon: Icon((admin['isSmsEnabled'] ?? false) ? Icons.lock_rounded : Icons.lock_open_rounded, size: 18),
                      label: Text(
                        (admin['isSmsEnabled'] ?? false) ? 'XID SMS ACCESS' : 'FUR SMS ACCESS',
                        style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12.sp, letterSpacing: 0.5),
                      ),
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

  Widget _smsStatCard(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: EdgeInsets.all(12.w),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(16.r),
          border: Border.all(color: color.withValues(alpha: 0.15)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 20),
            SizedBox(height: 6.h),
            Text(value, style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.w900, color: color)),
            SizedBox(height: 2.h),
            Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 8.sp, fontWeight: FontWeight.w800, color: AppTheme.textSecondary, letterSpacing: 0.5)),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        title: Text('MAAMULAYAASHA SARE',
            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18.sp)),
        actions: [
          // More obvious SMS Gateway button
          TextButton.icon(
            onPressed: _showSmsGatewayConfig,
            icon: const Icon(Icons.settings_input_component_rounded, color: Colors.blue, size: 20),
            label: Text('SMS API', style: TextStyle(color: Colors.blue, fontSize: 10.sp, fontWeight: FontWeight.w900)),
          ),
          IconButton(
            icon: const Icon(Icons.add_rounded, color: AppTheme.primary),
            onPressed: () => _showAdminDialog(),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: Column(
                children: [
                  // Platform SMS overview bar
                  if (_smsStats != null)
                    Container(
                      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                      padding: EdgeInsets.all(16.w),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF1E293B), Color(0xFF1E40AF)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(20.r),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.send_rounded, color: Colors.white70, size: 20),
                          SizedBox(width: 12.w),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('SMS PLATFORM â€” THIS MONTH',
                                    style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.w900, color: Colors.white54, letterSpacing: 1.5)),
                                Text(
                                  '${_smsStats!['totalPlatformSmsThisMonth'] ?? 0} Farriimood',
                                  style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.w900, color: Colors.white),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '${_monthNames[(_smsStats!['currentMonth'] ?? 1) - 1]} ${_smsStats!['currentYear'] ?? ''}',
                            style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w700, color: Colors.white60),
                          ),
                        ],
                      ),
                    ),

                  // List
                  Expanded(
                    child: _admins.isEmpty
                        ? _buildEmptyState()
                        : ListView.builder(
                            padding: EdgeInsets.all(16.w),
                            itemCount: _admins.length,
                            itemBuilder: (context, index) {
                              final admin = _admins[index];
                              return _buildAdminCard(admin);
                            },
                          ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.admin_panel_settings_rounded,
              size: 64, color: AppTheme.primary.withValues(alpha: 0.2)),
          SizedBox(height: 16.h),
          const Text(
            'LAMA HELIN MAAMULAYAAL',
            style: TextStyle(fontWeight: FontWeight.w900, color: AppTheme.textSecondary, letterSpacing: 1),
          ),
          SizedBox(height: 8.h),
          Text('Ku dar maamulihii ugu horreeyay',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 12.sp)),
        ],
      ),
    );
  }

  Widget _buildAdminCard(Map<String, dynamic> admin) {
    final smsData = _getAdminSmsData(admin['id']);
    final bool isSmsEnabled = admin['isSmsEnabled'] ?? false;
    final bool isActive = admin['isActive'] ?? true;
    final int smsThisMonth = smsData?['totalSmsThisMonth'] ?? 0;
    final bool isToggling = _togglingId == admin['id'];

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20.r),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8.r, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        children: [
          // Main row
          Padding(
            padding: EdgeInsets.all(16.w),
            child: Row(
              children: [
                // Avatar
                Container(
                  width: 48.w, height: 48.h,
                  decoration: BoxDecoration(
                    color: isActive
                        ? AppTheme.primary.withValues(alpha: 0.1)
                        : Colors.grey.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(14.r),
                  ),
                  child: Center(
                    child: Text(
                      admin['name'][0].toUpperCase(),
                      style: TextStyle(
                        color: isActive ? AppTheme.primary : Colors.grey,
                        fontWeight: FontWeight.w900,
                        fontSize: 18.sp,
                      ),
                    ),
                  ),
                ),
                SizedBox(width: 14.w),
                // Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              admin['name'] ?? '',
                              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15.sp),
                            ),
                          ),
                          if (!isActive)
                            Container(
                              padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 2.h),
                              decoration: BoxDecoration(
                                color: Colors.red[50],
                                borderRadius: BorderRadius.circular(6.r),
                              ),
                              child: Text('XIDHAN', style: TextStyle(fontSize: 8.sp, fontWeight: FontWeight.w900, color: Colors.red, letterSpacing: 0.5)),
                            ),
                        ],
                      ),
                      SizedBox(height: 2.h),
                      Text(
                        '@${admin['username']} • ${admin['shortCode'] ?? ''}',
                        style: TextStyle(fontSize: 11.sp, color: AppTheme.textSecondary, fontWeight: FontWeight.w600),
                      ),
                      if (admin['schoolName'] != null && admin['schoolName'].toString().isNotEmpty) ...[
                        SizedBox(height: 3.h),
                        Text(
                          admin['schoolName'],
                          style: TextStyle(fontSize: 12.sp, color: Colors.blue, fontWeight: FontWeight.w800),
                        ),
                      ],
                      SizedBox(height: 6.h),
                      // SMS status row
                      Row(
                        children: [
                          Icon(
                            isSmsEnabled ? Icons.sms_rounded : Icons.sms_failed_rounded,
                            size: 12,
                            color: isSmsEnabled ? Colors.blue : Colors.grey,
                          ),
                          SizedBox(width: 4.w),
                          Text(
                            isSmsEnabled ? '$smsThisMonth SMS this month' : 'SMS Restricted',
                            style: TextStyle(
                              fontSize: 10.sp,
                              fontWeight: FontWeight.w700,
                              color: isSmsEnabled ? Colors.blue : Colors.grey,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                // SMS Toggle
                GestureDetector(
                  onTap: isToggling ? null : () => _toggleSmsAuth(admin),
                  child: isToggling
                    ? SizedBox(
                        width: 40.w, height: 24.h,
                        child: Center(child: SizedBox(width: 16.w, height: 16.h, child: const CircularProgressIndicator(strokeWidth: 2))),
                      )
                    : AnimatedContainer(
                        duration: const Duration(milliseconds: 250),
                        width: 44.w, height: 24.h,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12.r),
                          color: isSmsEnabled ? Colors.blue : Colors.grey[300],
                        ),
                        child: Stack(
                          children: [
                            AnimatedPositioned(
                              duration: const Duration(milliseconds: 250),
                              left: isSmsEnabled ? 22 : 2,
                              top: 2,
                              child: Container(
                                width: 20.w, height: 20.h,
                                decoration: const BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                ),
              ],
            ),
          ),

          // Bottom action row
          Container(
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: Color(0xFFF1F5F9))),
            ),
            child: Row(
              children: [
                // View SMS stats
                Expanded(
                  child: TextButton.icon(
                    onPressed: () => _showAdminSmsDetail(admin),
                    icon: const Icon(Icons.bar_chart_rounded, size: 14, color: Colors.blue),
                    label: Text(
                      'SMS Stats',
                      style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w800, color: Colors.blue),
                    ),
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.symmetric(vertical: 10.h),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.only(bottomLeft: Radius.circular(20.r)),
                      ),
                    ),
                  ),
                ),
                Container(width: 1.w, height: 32.h, color: const Color(0xFFF1F5F9)),
                // Launch
                Expanded(
                  child: TextButton.icon(
                    onPressed: () => _impersonateAdmin(admin['id']),
                    icon: const Icon(Icons.login_rounded, size: 14, color: AppTheme.primary),
                    label: Text(
                      'Gal',
                      style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w800, color: AppTheme.primary),
                    ),
                    style: TextButton.styleFrom(padding: EdgeInsets.symmetric(vertical: 10.h)),
                  ),
                ),
                Container(width: 1.w, height: 32.h, color: const Color(0xFFF1F5F9)),
                // More options
                PopupMenuButton(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
                  icon: const Icon(Icons.more_vert_rounded, size: 18, color: AppTheme.textSecondary),
                  itemBuilder: (context) => [
                    PopupMenuItem(
                      value: 'edit',
                      child: Row(children: [
                        Icon(Icons.edit_rounded, size: 16, color: Colors.blue),
                        SizedBox(width: 8.w),
                        Text('Wax ka bedel', style: TextStyle(fontWeight: FontWeight.bold)),
                      ]),
                    ),
                    PopupMenuItem(
                      value: 'status',
                      child: Row(children: [
                        Icon(isActive ? Icons.lock_rounded : Icons.lock_open_rounded,
                            size: 16, color: isActive ? Colors.orange : Colors.green),
                        SizedBox(width: 8.w),
                        Text(isActive ? 'Xidh' : 'Fur', style: const TextStyle(fontWeight: FontWeight.bold)),
                      ]),
                    ),
                    PopupMenuItem(
                      value: 'delete',
                      child: Row(children: [
                        Icon(Icons.delete_outline_rounded, size: 16, color: Colors.red),
                        SizedBox(width: 8.w),
                        Text('Tirtir', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
                      ]),
                    ),
                  ],
                  onSelected: (val) {
                    if (val == 'impersonate') _impersonateAdmin(admin['id']);
                    if (val == 'edit') _showAdminDialog(admin: admin);
                    if (val == 'status') _toggleAdminStatus(admin);
                    if (val == 'delete') _deleteAdmin(admin['id']);
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _impersonateAdmin(String adminId) async {
    final router = GoRouter.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await _auth.impersonateSuperAdmin(adminId);
      AuthState().update(true, 'super_admin');
      router.go('/dashboard');
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Laguma guulaysan: $e')));
    }
  }

  Future<void> _showAdminDialog({Map<String, dynamic>? admin}) async {
    final bool isEdit = admin != null;
    final nameCtrl = TextEditingController(text: admin?['name'] ?? '');
    final userCtrl = TextEditingController(text: admin?['username'] ?? '');
    final passCtrl = TextEditingController();
    final codeCtrl = TextEditingController(text: admin?['shortCode'] ?? '');
    final schoolList = admin?['SuperAdminSchools'] as List?;
    final schoolCtrl = TextEditingController(text: admin?['schoolName'] ?? '');
    final branchCtrl = TextEditingController(
        text: (schoolList != null && schoolList.isNotEmpty) ? schoolList[0]['name']?.toString() ?? '' : '');
    bool saving = false;

    if (!mounted) return;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24.r)),
          title: Text(
            isEdit ? 'Cusboonaysii Maamulaha' : 'Abuur Super Admin',
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildField(nameCtrl, 'Magaca Oo Buuxa', Icons.person_rounded),
                SizedBox(height: 12.h),
                _buildField(userCtrl, 'Username', Icons.alternate_email_rounded),
                SizedBox(height: 12.h),
                _buildField(passCtrl, isEdit ? 'Password (Ikhtiyaari)' : 'Password', Icons.lock_rounded, isPassword: true),
                SizedBox(height: 12.h),
                _buildField(codeCtrl, 'ShortCode (WAA QASAB)', Icons.key_rounded, hint: 'Tusaale: ADMIN101'),
                SizedBox(height: 12.h),
                _buildField(schoolCtrl, 'Magaca School-ka (WAA QASAB)', Icons.school_rounded, hint: 'Tusaale: ALWAXA SCHOOL'),
                SizedBox(height: 12.h),
                _buildField(branchCtrl, 'Magaca Faraca (WAA QASAB)', Icons.apartment_rounded, hint: 'Tusaale: Primary'),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: saving ? null : () => Navigator.pop(dialogContext),
              child: const Text('Jooji', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
              ),
              onPressed: saving
                  ? null
                  : () async {
                      if (nameCtrl.text.trim().isEmpty || userCtrl.text.trim().isEmpty ||
                          (!isEdit && passCtrl.text.trim().isEmpty) ||
                          codeCtrl.text.trim().isEmpty || schoolCtrl.text.trim().isEmpty ||
                          branchCtrl.text.trim().isEmpty) {
                        ScaffoldMessenger.of(dialogContext).showSnackBar(
                          const SnackBar(content: Text('Fadlan buuxi dhamaan meelaha banaan')),
                        );
                        return;
                      }
                      setDialogState(() => saving = true);
                      final messenger = ScaffoldMessenger.of(dialogContext);
                      final rootMessenger = ScaffoldMessenger.of(context);
                      try {
                        final data = {
                          'name': nameCtrl.text.trim(),
                          'username': userCtrl.text.trim().toLowerCase(),
                          if (passCtrl.text.isNotEmpty) 'password': passCtrl.text,
                          'shortCode': codeCtrl.text.trim().toUpperCase(),
                          'schoolName': schoolCtrl.text.trim(),
                          'branchName': branchCtrl.text.trim(),
                        };
                        if (isEdit) {
                          await _api.put('${ApiConfig.ownerAdmins}/${admin['id']}', data: data);
                        } else {
                          await _api.post(ApiConfig.ownerAdmins, data: data);
                        }
                        if (!mounted || !dialogContext.mounted) return;
                        Navigator.pop(dialogContext);
                        _loadData();
                        rootMessenger.showSnackBar(const SnackBar(content: Text('Si guul leh ayaa loo kaydiyay')));
                      } catch (e) {
                        setDialogState(() => saving = false);
                        messenger.showSnackBar(SnackBar(content: Text('Cillad: $e')));
                      }
                    },
              child: Text(saving ? 'Kaydinaya...' : 'Xaqiiji', style: const TextStyle(fontWeight: FontWeight.w900)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildField(TextEditingController ctrl, String label, IconData icon,
      {bool isPassword = false, String? hint}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(), style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: AppTheme.textSecondary, letterSpacing: 1)),
        SizedBox(height: 6.h),
        TextField(
          controller: ctrl,
          obscureText: isPassword,
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14.sp),
          decoration: InputDecoration(
            isDense: true,
            hintText: hint,
            prefixIcon: Icon(icon, size: 20, color: AppTheme.primary),
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
          ),
        ),
      ],
    );
  }

  Future<void> _toggleAdminStatus(Map<String, dynamic> admin) async {
    final bool currentStatus = admin['isActive'] ?? true;
    final String actionText = currentStatus ? 'xirto maamulahan' : 'dib u furto maamulahan';

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20.r)),
        title: const Text('Hubi Xaaladda', style: TextStyle(fontWeight: FontWeight.w900)),
        content: Text('Ma hubtaa inaad $actionText?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Jooji')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: currentStatus ? Colors.red : Colors.green, foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(currentStatus ? 'Xir' : 'Fur'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      if (!mounted) return;
      final messenger = ScaffoldMessenger.of(context);
      try {
        final nextStatus = !currentStatus;
        await _api.put('${ApiConfig.ownerAdmins}/${admin['id']}', data: {'isActive': nextStatus});
        _fetchAdmins();
        messenger.showSnackBar(const SnackBar(content: Text('Xaaladda si guul leh ayaa loo beddelay')));
      } catch (e) {
        messenger.showSnackBar(SnackBar(content: Text('Beddelidda waa lagu fashilmay: $e')));
      }
    }
  }

  Future<void> _deleteAdmin(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20.r)),
        title: const Text('Hubi Tirtirista', style: TextStyle(fontWeight: FontWeight.w900)),
        content: const Text('Ma hubtaa inaad tirtirto maamulahan? Ma awoodi doonid inaad dib u soo celiso!'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Jooji')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Tirtir'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      if (!mounted) return;
      final messenger = ScaffoldMessenger.of(context);
      try {
        await _api.delete('${ApiConfig.ownerAdmins}/$id');
        _loadData();
        messenger.showSnackBar(const SnackBar(content: Text('Si guul leh ayaa loo tirtiray')));
      } catch (e) {
        messenger.showSnackBar(SnackBar(content: Text('Tirtirista waa lagu fashilmay: $e')));
      }
    }
  }

  // ------------------------- SMS GATEWAY CONFIG -------------------------
  Future<void> _showSmsGatewayConfig() async {
    // 1. Fetch current global configs
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );

    Map<String, dynamic> hormuud = {'apiUrl': '', 'apiKey': '', 'senderId': ''};
    Map<String, dynamic> golis = {'apiUrl': '', 'apiKey': '', 'apiSecret': '', 'senderId': ''};
    Map<String, dynamic> somtel = {'apiUrl': '', 'username': '', 'password': '', 'senderId': ''};
    String defaultProvider = 'hormuud';

    try {
      final res = await _api.get('/api/owner/global-config');
      final configs = res.data as List;
      for (var c in configs) {
        switch (c['key']) {
          case 'sms_default_provider':
            defaultProvider = c['value'];
            break;
          case 'sms_hormuud_config':
            hormuud = jsonDecode(c['value']);
            break;
          case 'sms_golis_config':
            golis = jsonDecode(c['value']);
            break;
          case 'sms_somtel_config':
            somtel = jsonDecode(c['value']);
            break;
        }
      }
    } catch (_) {} // Ignore fetch errors, use defaults

    if (!mounted) return;
    Navigator.pop(context); // close loader

    String selectedTab = defaultProvider;
    bool saving = false;

    final hormuudUrlCtrl = TextEditingController(text: hormuud['apiUrl'] ?? '');
    final hormuudKeyCtrl = TextEditingController(text: hormuud['apiKey'] ?? '');
    final hormuudSenderCtrl = TextEditingController(text: hormuud['senderId'] ?? '');

    final golisUrlCtrl = TextEditingController(text: golis['apiUrl'] ?? '');
    final golisKeyCtrl = TextEditingController(text: golis['apiKey'] ?? '');
    final golisSecretCtrl = TextEditingController(text: golis['apiSecret'] ?? '');
    final golisSenderCtrl = TextEditingController(text: golis['senderId'] ?? '');

    final somtelUrlCtrl = TextEditingController(text: somtel['apiUrl'] ?? '');
    final somtelUserCtrl = TextEditingController(text: somtel['username'] ?? '');
    final somtelPassCtrl = TextEditingController(text: somtel['password'] ?? '');
    final somtelSenderCtrl = TextEditingController(text: somtel['senderId'] ?? '');

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (bottomCtx, setSheetState) {
            return Container(
              height: MediaQuery.of(context).size.height * 0.9,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(28.r)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(height: 10.h),
                  Center(
                    child: Container(
                      width: 40.w, height: 4.h,
                      decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2.r)),
                    ),
                  ),
                  SizedBox(height: 16.h),
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 20.w),
                    child: Text('Global SMS Gateways', style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.w900)),
                  ),
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 20.w),
                    child: Text('Maamul xiriirka shirkadaha isgaarsiinta.', style: TextStyle(fontSize: 12.sp, color: AppTheme.textSecondary, fontWeight: FontWeight.w600)),
                  ),
                  SizedBox(height: 16.h),
                  
                  // Provider Tabs
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 20.w),
                    child: Container(
                      padding: EdgeInsets.all(4.w),
                      decoration: BoxDecoration(color: Colors.grey[100], borderRadius: BorderRadius.circular(16.r)),
                      child: Row(
                        children: ['hormuud', 'golis', 'somtel'].map((tab) {
                          final isActive = selectedTab == tab;
                          return Expanded(
                            child: GestureDetector(
                              onTap: () => setSheetState(() => selectedTab = tab),
                              child: Container(
                                padding: EdgeInsets.symmetric(vertical: 10.h),
                                decoration: BoxDecoration(
                                  color: isActive ? Colors.white : Colors.transparent,
                                  borderRadius: BorderRadius.circular(12.r),
                                  boxShadow: isActive ? [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4.r, offset: const Offset(0, 2))] : null,
                                ),
                                child: Center(
                                  child: Text(
                                    tab.toUpperCase(),
                                    style: TextStyle(
                                      fontWeight: FontWeight.w900, fontSize: 11.sp,
                                      color: isActive ? AppTheme.primary : Colors.grey[500],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ),
                  SizedBox(height: 16.h),
                  
                  // Default Provider Selection
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 20.w),
                    child: Container(
                      padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
                      decoration: BoxDecoration(
                        color: Colors.blue[50],
                        borderRadius: BorderRadius.circular(16.r),
                        border: Border.all(color: Colors.blue[100]!),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Default Provider', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.blue, fontSize: 13.sp)),
                              SizedBox(height: 2.h),
                              Text('SMS-ka cusub ayaa raacaya', style: TextStyle(fontSize: 10.sp, color: Colors.blue, fontWeight: FontWeight.w600)),
                            ],
                          ),
                          DropdownButton<String>(
                            value: defaultProvider,
                            underline: const SizedBox(),
                            icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Colors.blue),
                            style: TextStyle(fontWeight: FontWeight.w900, color: Colors.blue, fontSize: 12.sp),
                            items: ['hormuud', 'golis', 'somtel'].map((p) {
                              return DropdownMenuItem(value: p, child: Text(p.toUpperCase()));
                            }).toList(),
                            onChanged: (val) {
                              if (val != null) setSheetState(() => defaultProvider = val);
                            },
                          ),
                        ],
                      ),
                    ),
                  ),
                  SizedBox(height: 16.h),

                  // Fields content
                  Expanded(
                    child: ListView(
                      padding: EdgeInsets.symmetric(horizontal: 20.w),
                      children: [
                        if (selectedTab == 'hormuud') ...[
                          _buildField(hormuudUrlCtrl, 'Hormuud API URL', Icons.link_rounded),
                          SizedBox(height: 12.h),
                          _buildField(hormuudKeyCtrl, 'API Key', Icons.key_rounded, isPassword: true),
                          SizedBox(height: 12.h),
                          _buildField(hormuudSenderCtrl, 'Sender ID', Icons.badge_rounded),
                        ] else if (selectedTab == 'golis') ...[
                          _buildField(golisUrlCtrl, 'Golis API URL', Icons.link_rounded),
                          SizedBox(height: 12.h),
                          _buildField(golisKeyCtrl, 'Client ID / Key', Icons.key_rounded, isPassword: true),
                          SizedBox(height: 12.h),
                          _buildField(golisSecretCtrl, 'Client Secret', Icons.security_rounded, isPassword: true),
                          SizedBox(height: 12.h),
                          _buildField(golisSenderCtrl, 'Sender ID', Icons.badge_rounded),
                        ] else if (selectedTab == 'somtel') ...[
                          _buildField(somtelUrlCtrl, 'Somtel API URL', Icons.link_rounded),
                          SizedBox(height: 12.h),
                          _buildField(somtelUserCtrl, 'Username', Icons.person_rounded),
                          SizedBox(height: 12.h),
                          _buildField(somtelPassCtrl, 'Password', Icons.lock_rounded, isPassword: true),
                          SizedBox(height: 12.h),
                          _buildField(somtelSenderCtrl, 'Sender ID', Icons.badge_rounded),
                        ],
                        SizedBox(height: 40.h),
                      ],
                    ),
                  ),

                  // Save button
                  Padding(
                    padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        foregroundColor: Colors.white,
                        padding: EdgeInsets.symmetric(vertical: 16.h),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
                      ),
                      onPressed: saving ? null : () async {
                        setSheetState(() => saving = true);
                        try {
                          final configArray = [
                            {'key': 'sms_default_provider', 'value': defaultProvider},
                            {'key': 'sms_hormuud_config', 'value': jsonEncode({
                              'apiUrl': hormuudUrlCtrl.text.trim(),
                              'apiKey': hormuudKeyCtrl.text.trim(),
                              'senderId': hormuudSenderCtrl.text.trim(),
                            })},
                            {'key': 'sms_golis_config', 'value': jsonEncode({
                              'apiUrl': golisUrlCtrl.text.trim(),
                              'apiKey': golisKeyCtrl.text.trim(),
                              'apiSecret': golisSecretCtrl.text.trim(),
                              'senderId': golisSenderCtrl.text.trim(),
                            })},
                            {'key': 'sms_somtel_config', 'value': jsonEncode({
                              'apiUrl': somtelUrlCtrl.text.trim(),
                              'username': somtelUserCtrl.text.trim(),
                              'password': somtelPassCtrl.text.trim(),
                              'senderId': somtelSenderCtrl.text.trim(),
                            })},
                          ];
                          
                          await _api.post('/api/owner/global-config', data: {'configs': configArray});
                          
                          if (mounted && bottomCtx.mounted) {
                            Navigator.pop(bottomCtx);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Guul! Gateways waa la keydiyay!'), backgroundColor: Colors.green),
                            );
                          }
                        } catch (e) {
                          if (mounted && bottomCtx.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Cillad: $e'), backgroundColor: Colors.red),
                            );
                            setSheetState(() => saving = false);
                          }
                        }
                      },
                      child: saving
                          ? SizedBox(width: 20.w, height: 20.h, child: const CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Text('KAYDI SMS GATEWAYS', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.5)),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

