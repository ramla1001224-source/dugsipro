import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';

class StaffScreen extends StatefulWidget {
  const StaffScreen({super.key});
  @override
  State<StaffScreen> createState() => _StaffScreenState();
}

class _StaffScreenState extends State<StaffScreen> {
  final ApiService _api = ApiService();
  List<dynamic> _staff = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api.get(ApiConfig.staff);
      final data = res.data;
      final list = data is List ? data : (data['data'] ?? []);
      if (mounted) {
        setState(() {
          _staff = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _confirmDelete(String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Staff?'),
        content: const Text('This action cannot be undone. Are you sure?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('CANCEL')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('DELETE', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (ok == true) _delete(id);
  }

  Future<void> _delete(String id) async {
    setState(() => _loading = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await _api.delete('${ApiConfig.staff}/$id');
      if (!mounted) return;
      messenger.showSnackBar(
        const SnackBar(
            content: Text('Staff member deleted'),
            backgroundColor: Colors.green),
      );
      _load();
    } catch (e) {
      if (mounted) setState(() => _loading = false);
      messenger.showSnackBar(
        SnackBar(
            content: Text('Error: ${e.toString()}'),
            backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
        title: Text(
          'System Staff',
          style: TextStyle(
            color: AppTheme.textPrimary,
            fontWeight: FontWeight.w900,
            fontSize: 18.sp,
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.all(16.w),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header Titles
                    Text(
                      'System Staff',
                      style: TextStyle(
                        fontSize: 24.sp,
                        fontWeight: FontWeight.w900,
                        color: AppTheme.textPrimary,
                        letterSpacing: -0.5,
                      ),
                    ),
                    SizedBox(height: 4.h),
                    Text(
                      'Manage accountants and administrative staff',
                      style: TextStyle(
                        fontSize: 13.sp,
                        color: AppTheme.textSecondary,
                      ),
                    ),
                    SizedBox(height: 20.h),

                    // Actions Row
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          GestureDetector(
                            onTap: () async {
                              final res = await context.push('/staff/add');
                              if (res == true) _load();
                            },
                            child: _actionBtn('+ Add New Staff',
                                const Color(0xFF2563EB), Colors.white,
                                isSolid: true),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: 20.h),

                    // Table Card
                    Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16.r),
                        border: Border.all(color: const Color(0xFFF1F5F9)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.02),
                            blurRadius: 10.r,
                            offset: const Offset(0, 4),
                          )
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Table Header
                          Container(
                            padding: EdgeInsets.symmetric(
                                horizontal: 16.w, vertical: 12.h),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.only(
                                topLeft: Radius.circular(16.r),
                                topRight: Radius.circular(16.r),
                              ),
                            ),
                            child: Row(
                              children: [
                                _th('NAME', flex: 3),
                                _th('ROLE / POSITION', flex: 3),
                                _th('SALARY', flex: 2),
                                _th('ACTIONS', flex: 2, alignEnd: true),
                              ],
                            ),
                          ),

                          // Table Body / Empty State
                          if (_staff.isEmpty)
                            Padding(
                              padding: EdgeInsets.symmetric(vertical: 40.h),
                              child: Column(
                                children: [
                                  Text(
                                    'No staff members found.',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      color: AppTheme.textSecondary,
                                      fontSize: 14.sp,
                                    ),
                                  ),
                                ],
                              ),
                            )
                          else
                            ListView.separated(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: _staff.length,
                              separatorBuilder: (ctx, i) => Divider(
                                  height: 1.h, color: Color(0xFFF1F5F9)),
                              itemBuilder: (ctx, i) {
                                final s = _staff[i];
                                final name = s['user']?['name'] ?? 'Unknown';
                                final role = s['user']?['role'] ?? 'staff';
                                final position = s['position'] ?? 'N/A';
                                final salary = '\$${s['salary'] ?? 0}';

                                final isAccountant = role == 'accountant';
                                final roleBg = isAccountant
                                    ? const Color(0xFFECFDF5)
                                    : const Color(0xFFEFF6FF);
                                final roleFg = isAccountant
                                    ? const Color(0xFF059669)
                                    : const Color(0xFF2563EB);

                                return Padding(
                                  padding: EdgeInsets.symmetric(
                                      horizontal: 16.w, vertical: 12.h),
                                  child: Row(
                                    children: [
                                      // Name
                                      Expanded(
                                        flex: 3,
                                        child: Row(
                                          children: [
                                            Container(
                                              width: 32.w,
                                              height: 32.h,
                                              alignment: Alignment.center,
                                              decoration: const BoxDecoration(
                                                color: Color(0xFFEFF6FF),
                                                shape: BoxShape.circle,
                                              ),
                                              child: Text(
                                                name
                                                    .substring(0,
                                                        name.length > 2 ? 2 : 1)
                                                    .toUpperCase(),
                                                style: TextStyle(
                                                    color: const Color(0xFF2563EB),
                                                    fontSize: 10.sp,
                                                    fontWeight:
                                                        FontWeight.w900),
                                              ),
                                            ),
                                            SizedBox(width: 8.w),
                                            Expanded(
                                              child: Text(
                                                name,
                                                style: TextStyle(
                                                  fontWeight: FontWeight.w800,
                                                  fontSize: 13.sp,
                                                  color: AppTheme.textPrimary,
                                                ),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      // Role
                                      Expanded(
                                        flex: 3,
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Container(
                                              padding:
                                                  EdgeInsets.symmetric(
                                                      horizontal: 6.w,
                                                      vertical: 2.h),
                                              decoration: BoxDecoration(
                                                color: roleBg,
                                                borderRadius:
                                                    BorderRadius.circular(10.r),
                                                border: Border.all(
                                                    color: roleFg
                                                        .withValues(alpha: 0.2)),
                                              ),
                                              child: Text(
                                                role.toString().toUpperCase(),
                                                style: TextStyle(
                                                  fontSize: 8.sp,
                                                  fontWeight: FontWeight.w900,
                                                  color: roleFg,
                                                  letterSpacing: 1,
                                                ),
                                              ),
                                            ),
                                            SizedBox(height: 2.h),
                                            Text(
                                              position.toString().toUpperCase(),
                                              style: TextStyle(
                                                fontSize: 9.sp,
                                                fontWeight: FontWeight.w800,
                                                color: AppTheme.textSecondary,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      // Salary
                                      Expanded(
                                        flex: 2,
                                        child: Text(
                                          salary,
                                          style: TextStyle(
                                            fontSize: 12.sp,
                                            fontWeight: FontWeight.w900,
                                            color: AppTheme.textPrimary,
                                          ),
                                        ),
                                      ),
                                      // Actions
                                      Expanded(
                                        flex: 2,
                                        child: Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.end,
                                          children: [
                                            GestureDetector(
                                              onTap: () async {
                                                final res = await context.push(
                                                    '/staff/edit/${s['id']}');
                                                if (res == true) _load();
                                              },
                                              child: _miniAction(
                                                  'Edit',
                                                  const Color(0xFFEFF6FF),
                                                  const Color(0xFF2563EB)),
                                            ),
                                            SizedBox(width: 6.w),
                                            GestureDetector(
                                              onTap: () => _confirmDelete(
                                                  s['id'].toString()),
                                              child: const Icon(
                                                Icons.delete_outline_rounded,
                                                color: Color(0xFFFCA5A5),
                                                size: 18,
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
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _th(String label, {int flex = 1, bool alignEnd = false}) {
    return Expanded(
      flex: flex,
      child: Text(
        label,
        textAlign: alignEnd ? TextAlign.right : TextAlign.left,
        style: TextStyle(
          fontSize: 9.sp,
          fontWeight: FontWeight.w900,
          color: AppTheme.textSecondary,
          letterSpacing: 1.5,
        ),
      ),
    );
  }

  Widget _actionBtn(String label, Color bg, Color fg, {bool isSolid = false}) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 10.h),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10.r),
        boxShadow: isSolid
            ? [
                BoxShadow(
                    color: bg.withValues(alpha: 0.3),
                    blurRadius: 8.r,
                    offset: const Offset(0, 4))
              ]
            : null,
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontWeight: FontWeight.w900,
          fontSize: 13.sp,
        ),
      ),
    );
  }

  Widget _miniAction(String label, Color bg, Color fg) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 4.h),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6.r),
        border: Border.all(color: fg.withValues(alpha: 0.2)),
      ),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          color: fg,
          fontSize: 8.sp,
          fontWeight: FontWeight.w900,
          letterSpacing: 1,
        ),
      ),
    );
  }
}


