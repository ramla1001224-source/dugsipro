import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';

class ParentsScreen extends StatefulWidget {
  const ParentsScreen({super.key});
  @override
  State<ParentsScreen> createState() => _ParentsScreenState();
}

class _ParentsScreenState extends State<ParentsScreen> {
  final ApiService _api = ApiService();
  List<dynamic> _parents = [];
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
      final res = await _api.get(ApiConfig.parents);
      final data = res.data;
      final list =
          data is List ? data : (data['parents'] ?? data['data'] ?? []);
      if (mounted) {
        setState(() {
          _parents = list;
          _filtered = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _deleteParent(String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Ma hubtaa?',
            style: TextStyle(fontWeight: FontWeight.bold)),
        content: const Text('Ma rabtaa inaad tirtirto waalidkan?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Maya')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child:
                const Text('Haa, Tirtir', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await _api.delete('${ApiConfig.parents}/$id');
        _load();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content: Text('Waalidka waa la tirtiray'),
                backgroundColor: Colors.green),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Khalad: $e'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  void _search(String q) {
    setState(() {
      _filtered = _parents.where((p) {
        final name =
            (p['user']?['name'] ?? p['name'] ?? '').toString().toLowerCase();
        final phone = (p['phone'] ?? '').toString().toLowerCase();
        return name.contains(q.toLowerCase()) ||
            phone.contains(q.toLowerCase());
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
          'Maamulka Waalidiinta',
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
                      'Maamulka Waalidiinta',
                      style: TextStyle(
                        fontSize: 24.sp,
                        fontWeight: FontWeight.w900,
                        color: AppTheme.textPrimary,
                        letterSpacing: -0.5,
                      ),
                    ),
                    SizedBox(height: 4.h),
                    Text(
                      'Maareynta akoonnada waalidiinta iyo carruurtooda',
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
                                hintText: 'Raadi waalid...',
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
                          _actionBtn(
                            'Ku dar Waalid Cusub',
                            const Color(0xFFDB2777),
                            Colors.white,
                            isSolid: true,
                            onTap: () async {
                              final res = await context.push('/parents/add');
                              if (res == true) _load();
                            },
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
                                _th('MAGACA', flex: 3),
                                _th('TELEFOONKA', flex: 2),
                                _th('SHAQADA', flex: 2),
                                _th('CARRUURTA', flex: 3),
                                _th('WAXQABAD', flex: 2, alignEnd: true),
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
                                    'Lama helin waalid',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      color: AppTheme.textSecondary,
                                      fontSize: 16.sp,
                                    ),
                                  ),
                                  SizedBox(height: 4.h),
                                  Text(
                                    'Kudar waalid cusub ama bedel raadintaada',
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
                                final p = _filtered[i];
                                final name = p['user']?['name'] ??
                                    p['name'] ??
                                    'Unknown';
                                final phone = p['phone'] ?? '-';
                                final occupation = p['occupation'] ?? '-';

                                List childrenList = [];
                                if (p['Children'] != null &&
                                    p['Children'] is List) {
                                  childrenList = p['Children'];
                                }

                                return InkWell(
                                  onTap: () {},
                                  hoverColor: const Color(0xFFF8FAFC),
                                  child: Padding(
                                    padding: EdgeInsets.symmetric(
                                        horizontal: 16.w, vertical: 12.h),
                                    child: Row(
                                      children: [
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
                                        // Occupation
                                        Expanded(
                                          flex: 2,
                                          child: Text(
                                            occupation,
                                            style: TextStyle(
                                              fontSize: 12.sp,
                                              fontWeight: FontWeight.w500,
                                              color: AppTheme.textSecondary,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                        // Children
                                        Expanded(
                                          flex: 3,
                                          child: Wrap(
                                            spacing: 4,
                                            runSpacing: 4,
                                            children:
                                                childrenList.map<Widget>((c) {
                                              final cName = c['student']
                                                      ?['user']?['name'] ??
                                                  'U';
                                              return Container(
                                                padding:
                                                    EdgeInsets.symmetric(
                                                        horizontal: 6.w,
                                                        vertical: 2.h),
                                                decoration: BoxDecoration(
                                                    color:
                                                        const Color(0xFFFDF2F8),
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                            4.r)),
                                                child: Text(
                                                  cName,
                                                  style: TextStyle(
                                                    fontSize: 10.sp,
                                                    fontWeight: FontWeight.w700,
                                                    color: const Color(0xFFDB2777),
                                                  ),
                                                  maxLines: 1,
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                ),
                                              );
                                            }).toList(),
                                          ),
                                        ),
                                        // Actions
                                        Expanded(
                                          flex: 2,
                                          child: Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.end,
                                            children: [
                                              _miniAction(
                                                'Edit',
                                                const Color(0xFFFDF2F8),
                                                const Color(0xFFDB2777),
                                                onTap: () async {
                                                  final res = await context.push(
                                                      '/parents/edit/${p['id']}');
                                                  if (res == true) _load();
                                                },
                                              ),
                                              SizedBox(width: 4.w),
                                              GestureDetector(
                                                onTap: () =>
                                                    _deleteParent(p['id']),
                                                child: Text('Delete',
                                                    style: TextStyle(
                                                        fontSize: 11.sp,
                                                        fontWeight:
                                                            FontWeight.w800,
                                                        color:
                                                            const Color(0xFFF87171))),
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
                                    'SHOWING ${_filtered.length} PARENTS',
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

  Widget _actionBtn(String label, Color bg, Color fg,
      {bool isSolid = false, VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
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
      ),
    );
  }

  Widget _miniAction(String label, Color bg, Color fg,
      {bool hasBorder = false, VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
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
      ),
    );
  }
}


