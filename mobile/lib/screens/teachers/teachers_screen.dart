import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';

class TeachersScreen extends StatefulWidget {
  const TeachersScreen({super.key});
  @override
  State<TeachersScreen> createState() => _TeachersScreenState();
}

class _TeachersScreenState extends State<TeachersScreen> {
  final ApiService _api = ApiService();
  List<dynamic> _teachers = [];
  List<dynamic> _filtered = [];
  bool _loading = true;
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api.get(ApiConfig.teachers);
      final data = res.data;
      final list =
          data is List ? data : (data['teachers'] ?? data['data'] ?? []);
      if (mounted) {
        setState(() {
          _teachers = list;
          _filtered = list;
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
        title: const Text('Delete Teacher?'),
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
      await _api.delete('${ApiConfig.teachers}/$id');
      if (!mounted) return;
      messenger.showSnackBar(
        const SnackBar(
            content: Text('Teacher deleted'), backgroundColor: Colors.green),
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

  void _search(String q) {
    setState(() {
      _filtered = _teachers.where((t) {
        final name =
            (t['user']?['name'] ?? t['name'] ?? '').toString().toLowerCase();
        final subject = (t['subject'] ?? '').toString().toLowerCase();
        return name.contains(q.toLowerCase()) ||
            subject.contains(q.toLowerCase());
      }).toList();
    });
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
          'Faculty Directory',
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
                      'Faculty Directory',
                      style: TextStyle(
                        fontSize: 24.sp,
                        fontWeight: FontWeight.w900,
                        color: AppTheme.textPrimary,
                        letterSpacing: -0.5,
                      ),
                    ),
                    SizedBox(height: 4.h),
                    Text(
                      'Manage all teaching staff',
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
                          Container(
                            width: 200.w,
                            height: 42.h,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(10.r),
                              border:
                                  Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: TextField(
                              controller: _searchCtrl,
                              onChanged: _search,
                              style: TextStyle(fontSize: 13.sp),
                              decoration: InputDecoration(
                                hintText: 'Search teachers...',
                                hintStyle: TextStyle(
                                    color: AppTheme.textSecondary,
                                    fontSize: 13.sp),
                                prefixIcon: Icon(Icons.search_rounded,
                                    size: 18, color: AppTheme.textSecondary),
                                border: InputBorder.none,
                                contentPadding: EdgeInsets.symmetric(
                                    horizontal: 10.w, vertical: 12.h),
                              ),
                            ),
                          ),
                          SizedBox(width: 8.w),
                          GestureDetector(
                            onTap: () async {
                              final res = await context.push('/teachers/add');
                              if (res == true) _load();
                            },
                            child: _actionBtn('Add New Teacher',
                                const Color(0xFF4F46E5), Colors.white,
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
                                _th('#', flex: 1),
                                _th('NAME', flex: 3),
                                _th('SUBJECT', flex: 2),
                                _th('PHONE', flex: 2),
                                _th('ACTION', flex: 3, alignEnd: true),
                              ],
                            ),
                          ),

                          // Table Body / Empty State
                          if (_filtered.isEmpty)
                            Padding(
                              padding: EdgeInsets.symmetric(vertical: 40.h),
                              child: Column(
                                children: [
                                  Text(
                                    'No teachers yet',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      color: AppTheme.textSecondary,
                                      fontSize: 16.sp,
                                    ),
                                  ),
                                  SizedBox(height: 4.h),
                                  Text(
                                    'Add teachers manually or import from Excel',
                                    style: TextStyle(
                                      color: Colors.grey.shade400,
                                      fontSize: 12.sp,
                                    ),
                                  ),
                                ],
                              ),
                            )
                          else
                            ListView.separated(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: _filtered.length,
                              separatorBuilder: (ctx, i) => Divider(
                                  height: 1.h, color: Color(0xFFF1F5F9)),
                              itemBuilder: (ctx, i) {
                                final t = _filtered[i];
                                final name = t['user']?['name'] ??
                                    t['name'] ??
                                    'Unknown';
                                final subject = t['subject'] ?? 'Unassigned';
                                final phone = t['phone'] ?? '-';

                                return InkWell(
                                  onTap: () {},
                                  hoverColor: const Color(0xFFF8FAFC),
                                  child: Padding(
                                    padding: EdgeInsets.symmetric(
                                        horizontal: 16.w, vertical: 12.h),
                                    child: Row(
                                      children: [
                                        // #
                                        Expanded(
                                          flex: 1,
                                          child: Text(
                                            '${i + 1}',
                                            style: TextStyle(
                                              fontWeight: FontWeight.w800,
                                              fontSize: 11.sp,
                                              color: AppTheme.textSecondary,
                                            ),
                                          ),
                                        ),
                                        // Name
                                        Expanded(
                                          flex: 3,
                                          child: Text(
                                            name,
                                            style: TextStyle(
                                              fontWeight: FontWeight.w800,
                                              fontSize: 12.sp,
                                              color: AppTheme.textPrimary,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                        // Subject
                                        Expanded(
                                          flex: 2,
                                          child: Container(
                                            padding: EdgeInsets.symmetric(
                                                horizontal: 6.w, vertical: 2.h),
                                            decoration: BoxDecoration(
                                                color: const Color(0xFFEEF2FF),
                                                borderRadius:
                                                    BorderRadius.circular(4.r)),
                                            child: Text(
                                              subject,
                                              style: TextStyle(
                                                fontSize: 11.sp,
                                                fontWeight: FontWeight.w600,
                                                color: const Color(0xFF4F46E5),
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                        ),
                                        // Phone
                                        Expanded(
                                          flex: 2,
                                          child: Text(
                                            phone,
                                            style: TextStyle(
                                              fontSize: 12.sp,
                                              fontWeight: FontWeight.w500,
                                              color: AppTheme.textSecondary,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                        // Actions
                                        Expanded(
                                          flex: 3,
                                          child: Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.end,
                                            children: [
                                              GestureDetector(
                                                onTap: () async {
                                                  final res = await context.push(
                                                      '/teachers/edit/${t['id']}');
                                                  if (res == true) _load();
                                                },
                                                child: const Icon(
                                                  Icons.edit_note_rounded,
                                                  color: Color(0xFF64748B),
                                                  size: 20,
                                                ),
                                              ),
                                              SizedBox(width: 12.w),
                                              GestureDetector(
                                                onTap: () => _confirmDelete(
                                                    t['id'].toString()),
                                                child: const Icon(
                                                  Icons.delete_outline_rounded,
                                                  color: Color(0xFFFCA5A5),
                                                  size: 20,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),

                          // Optional Pagination Footer
                          if (_filtered.isNotEmpty)
                            Container(
                              padding: EdgeInsets.symmetric(
                                  horizontal: 16.w, vertical: 12.h),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                border: const Border(
                                    top: BorderSide(color: Color(0xFFF1F5F9))),
                                borderRadius: BorderRadius.only(
                                  bottomLeft: Radius.circular(16.r),
                                  bottomRight: Radius.circular(16.r),
                                ),
                              ),
                              child: Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'SHOWING ${_filtered.length} TEACHERS',
                                    style: TextStyle(
                                      fontSize: 10.sp,
                                      fontWeight: FontWeight.w900,
                                      color: AppTheme.textSecondary,
                                      letterSpacing: 1,
                                    ),
                                  ),
                                  Row(
                                    children: [
                                      _miniAction('Previous', Colors.white,
                                          AppTheme.textSecondary,
                                          hasBorder: true),
                                      SizedBox(width: 4.w),
                                      _miniAction('Next', Colors.white,
                                          AppTheme.textSecondary,
                                          hasBorder: true),
                                    ],
                                  )
                                ],
                              ),
                            )
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
          fontSize: 10.sp,
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

  Widget _miniAction(String label, Color bg, Color fg,
      {bool hasBorder = false}) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6.r),
        border: hasBorder ? Border.all(color: const Color(0xFFE2E8F0)) : null,
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: 11.sp,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}


