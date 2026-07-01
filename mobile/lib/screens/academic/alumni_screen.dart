import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';

class AlumniScreen extends StatefulWidget {
  const AlumniScreen({super.key});
  @override
  State<AlumniScreen> createState() => _AlumniScreenState();
}

class _AlumniScreenState extends State<AlumniScreen> {
  final ApiService _api = ApiService();
  final TextEditingController _searchCtrl = TextEditingController();
  List<dynamic> _alumni = [];
  Map<String, dynamic> _filterOptions = {'classes': [], 'years': []};
  String? _selectedYear;
  String? _selectedClass;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final Map<String, dynamic> params = {};
      if (_searchCtrl.text.isNotEmpty) params['search'] = _searchCtrl.text;
      if (_selectedYear != null) params['year'] = _selectedYear;
      if (_selectedClass != null) params['className'] = _selectedClass;

      final res = await _api.get(ApiConfig.alumni, params: params);
      final data = res.data;
      
      if (mounted) {
        setState(() {
          _alumni = data['students'] ?? [];
          _filterOptions = data['filterOptions'] ?? {'classes': [], 'years': []};
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
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
          'Graduates & Alumni',
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
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Graduates',
                          style: TextStyle(
                            fontSize: 24.sp,
                            fontWeight: FontWeight.w900,
                            color: AppTheme.textPrimary,
                            letterSpacing: -0.5,
                          ),
                        ),
                        SizedBox(height: 4.h),
                        Text(
                          'View and manage graduated student records',
                          style: TextStyle(
                            fontSize: 13.sp,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 20.h),
                    // Filter Row
                    Container(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Row(
                        children: [
                          Expanded(
                            flex: 4,
                            child: _buildFilterBox(
                              label: 'SEARCH',
                              child: TextField(
                                controller: _searchCtrl,
                                onSubmitted: (_) => _load(),
                                style: TextStyle(
                                    fontSize: 11.sp, fontWeight: FontWeight.bold),
                                decoration: InputDecoration(
                                  isDense: true,
                                  hintText: 'Name or ID...',
                                  hintStyle: TextStyle(
                                      fontSize: 11.sp,
                                      color: AppTheme.textSecondary),
                                  border: InputBorder.none,
                                  contentPadding: EdgeInsets.zero,
                                ),
                              ),
                            ),
                          ),
                          SizedBox(width: 8.w),
                          Expanded(
                            flex: 3,
                            child: _buildFilterBox(
                              label: 'YEAR',
                              child: DropdownButtonHideUnderline(
                                child: DropdownButton<String?>(
                                  isExpanded: true,
                                  value: _selectedYear,
                                  hint: Text('ALL',
                                      style: TextStyle(
                                          fontSize: 10.sp,
                                          fontWeight: FontWeight.bold)),
                                  icon: const Icon(Icons.keyboard_arrow_down,
                                      size: 16),
                                  items: [
                                    DropdownMenuItem(
                                        value: null,
                                        child: Text('ALL',
                                            style: TextStyle(fontSize: 10.sp))),
                                    ...(_filterOptions['years'] as List)
                                        .map<DropdownMenuItem<String?>>((y) {
                                      return DropdownMenuItem(
                                        value: y.toString(),
                                        child: Text(y.toString().toUpperCase(),
                                            style: TextStyle(
                                                fontSize: 10.sp,
                                                fontWeight: FontWeight.bold)),
                                      );
                                    }),
                                  ],
                                  onChanged: (v) {
                                    setState(() => _selectedYear = v);
                                    _load();
                                  },
                                ),
                              ),
                            ),
                          ),
                          SizedBox(width: 8.w),
                          Expanded(
                            flex: 3,
                            child: _buildFilterBox(
                              label: 'CLASS',
                              child: DropdownButtonHideUnderline(
                                child: DropdownButton<String?>(
                                  isExpanded: true,
                                  value: _selectedClass,
                                  hint: Text('ALL',
                                      style: TextStyle(
                                          fontSize: 10.sp,
                                          fontWeight: FontWeight.bold)),
                                  icon: const Icon(Icons.keyboard_arrow_down,
                                      size: 16),
                                  items: [
                                    DropdownMenuItem(
                                        value: null,
                                        child: Text('ALL',
                                            style: TextStyle(fontSize: 10.sp))),
                                    ...(_filterOptions['classes'] as List)
                                        .map<DropdownMenuItem<String?>>((c) {
                                      return DropdownMenuItem(
                                        value: c.toString(),
                                        child: Text(c.toString().toUpperCase(),
                                            style: TextStyle(
                                                fontSize: 10.sp,
                                                fontWeight: FontWeight.bold)),
                                      );
                                    }),
                                  ],
                                  onChanged: (v) {
                                    setState(() => _selectedClass = v);
                                    _load();
                                  },
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    Container(
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
                                _th('STUDENT NAME', flex: 3),
                                _th('YEAR', flex: 2),
                                _th('ACTIONS', flex: 2, alignEnd: true),
                              ],
                            ),
                          ),
                          if (_alumni.isEmpty)
                            Padding(
                              padding: EdgeInsets.all(60.w),
                              child: Column(
                                children: [
                                  const Icon(Icons.school_outlined,
                                      size: 48, color: Color(0xFFE2E8F0)),
                                  SizedBox(height: 16.h),
                                  const Text(
                                    'No graduate records found.',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      color: AppTheme.textSecondary,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ],
                              ),
                            )
                          else
                            ListView.separated(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: _alumni.length,
                              separatorBuilder: (_, __) => Divider(
                                  height: 1.h, color: const Color(0xFFF1F5F9)),
                              itemBuilder: (ctx, i) {
                                final a = _alumni[i];
                                final name = a['name'] ?? 'N/A';
                                final year = a['graduationYear'] ?? '-';

                                return Padding(
                                  padding: EdgeInsets.symmetric(
                                      horizontal: 16.w, vertical: 12.h),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        flex: 3,
                                        child: Text(
                                          name,
                                          style: TextStyle(
                                            fontWeight: FontWeight.w900,
                                            fontSize: 14.sp,
                                            color: AppTheme.textPrimary,
                                          ),
                                        ),
                                      ),
                                      Expanded(
                                        flex: 2,
                                        child: Text(
                                          year.toString(),
                                          style: TextStyle(
                                            fontSize: 12.sp,
                                            fontWeight: FontWeight.w800,
                                            color: AppTheme.textSecondary,
                                          ),
                                        ),
                                      ),
                                      Expanded(
                                        flex: 2,
                                        child: Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.end,
                                          children: [
                                            const Icon(
                                                Icons.visibility_outlined,
                                                color: Color(0xFF64748B),
                                                size: 20),
                                            SizedBox(width: 8.w),
                                            const Icon(Icons.print_outlined,
                                                color: Color(0xFF64748B),
                                                size: 20),
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

  Widget _buildFilterBox({required String label, required Widget child}) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10.r),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: TextStyle(
                  fontSize: 8.sp,
                  fontWeight: FontWeight.w900,
                  color: AppTheme.textSecondary,
                  letterSpacing: 0.5)),
          SizedBox(height: 2.h),
          child,
        ],
      ),
    );
  }
}

