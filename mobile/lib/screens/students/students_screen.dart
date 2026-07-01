import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';

class StudentsScreen extends StatefulWidget {
  const StudentsScreen({super.key});
  @override
  State<StudentsScreen> createState() => _StudentsScreenState();
}

class _StudentsScreenState extends State<StudentsScreen> {
  final ApiService _api = ApiService();
  List<dynamic> _students = [];
  List<dynamic> _filtered = [];
  List<dynamic> _classes = [];
  String? _selectedClassId;
  String? _selectedSectionId;
  bool _loading = true;
  String? _error;
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadInitial();
  }

  Future<void> _loadInitial() async {
    setState(() => _loading = true);
    try {
      final resC = await _api.get(ApiConfig.classes);
      final resS = await _api.get(ApiConfig.students);

      final classes = resC.data is List
          ? resC.data
          : (resC.data['classes'] ?? resC.data['data'] ?? []);
      final students = resS.data is List
          ? resS.data
          : (resS.data['students'] ?? resS.data['data'] ?? []);

      if (mounted) {
        setState(() {
          _classes = classes;
          _students = students;
          _filtered = students;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Error loading students: ${e.toString()}';
        });
      }
    }
  }

  Future<void> _loadStudents() async {
    setState(() => _loading = true);
    try {
      Map<String, dynamic> params = {};
      if (_selectedClassId != null) params['classId'] = _selectedClassId;
      if (_selectedSectionId != null && _selectedSectionId!.isNotEmpty) {
        params['sectionId'] = _selectedSectionId;
      }

      final res = await _api.get(ApiConfig.students, params: params);
      final data = res.data;
      final list =
          data is List ? data : (data['students'] ?? data['data'] ?? []);

      if (mounted) {
        setState(() {
          _students = list;
          _filtered = list;
          _loading = false;
          _searchCtrl.clear();
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Error filtering students: ${e.toString()}';
        });
      }
    }
  }

  void _search(String q) {
    setState(() {
      _filtered = _students.where((s) {
        final name =
            (s['name'] ?? s['user']?['name'] ?? '').toString().toLowerCase();
        final id = (s['studentId'] ?? '').toString().toLowerCase();
        return name.contains(q.toLowerCase()) || id.contains(q.toLowerCase());
      }).toList();
    });
  }

  Future<void> _deleteStudent(String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Student?'),
        content: const Text('This action cannot be undone.'),
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

    if (ok == true) {
      if (!mounted) return;
      setState(() => _loading = true);
      final messenger = ScaffoldMessenger.of(context);
      try {
        await _api.delete('${ApiConfig.students}/$id');
        if (mounted) _loadInitial();
      } catch (e) {
        if (mounted) setState(() => _loading = false);
        messenger.showSnackBar(
          SnackBar(
              content: Text('Error: ${e.toString()}'),
              backgroundColor: Colors.red),
        );
      }
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
          'Student Management',
          style: TextStyle(
            color: AppTheme.textPrimary,
            fontWeight: FontWeight.w900,
            fontSize: 18.sp,
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, color: Colors.red, size: 48),
                      SizedBox(height: 16.h),
                      Text(_error!, style: const TextStyle(color: Colors.red)),
                      SizedBox(height: 16.h),
                      ElevatedButton(
                        onPressed: () {
                          setState(() => _error = null);
                          _loadInitial();
                        },
                        child: const Text('Try Again'),
                      )
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadInitial,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header Section
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.fromLTRB(16, 24, 16, 16),
                      color: Colors.white,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Students List',
                            style: TextStyle(
                              fontSize: 24.sp,
                              fontWeight: FontWeight.w900,
                              color: AppTheme.textPrimary,
                              letterSpacing: -0.5,
                            ),
                          ),
                          SizedBox(height: 4.h),
                          Text(
                            'Manage admissions, records and student history',
                            style: TextStyle(
                                fontSize: 13.sp, color: AppTheme.textSecondary),
                          ),
                        ],
                      ),
                    ),

                    // Filter Row
                    Container(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        border: Border(
                            bottom: BorderSide(color: Color(0xFFF1F5F9))),
                      ),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              Expanded(
                                flex: 4,
                                child: _buildFilterBox(
                                  label: 'SEARCH',
                                  child: TextField(
                                    controller: _searchCtrl,
                                    onChanged: _search,
                                    style: TextStyle(
                                        fontSize: 11.sp,
                                        fontWeight: FontWeight.bold),
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
                                  label: 'CLASS',
                                  child: DropdownButtonHideUnderline(
                                    child: DropdownButton<String?>(
                                      isExpanded: true,
                                      value: _selectedClassId,
                                      hint: Text('ALL CLASSES',
                                          style: TextStyle(
                                              fontSize: 10.sp,
                                              fontWeight: FontWeight.bold)),
                                      icon: const Icon(
                                          Icons.keyboard_arrow_down,
                                          size: 16),
                                      items: [
                                        DropdownMenuItem(
                                            value: null,
                                            child: Text('ALL CLASSES',
                                                style:
                                                    TextStyle(fontSize: 10.sp))),
                                        ..._classes
                                            .map<DropdownMenuItem<String?>>(
                                                (c) {
                                          return DropdownMenuItem(
                                            value: c['id'].toString(),
                                            child: Text(
                                                (c['class_name'] ?? 'Class')
                                                    .toString()
                                                    .toUpperCase(),
                                                style: TextStyle(
                                                    fontSize: 10.sp,
                                                    fontWeight:
                                                        FontWeight.bold)),
                                          );
                                        }),
                                      ],
                                      onChanged: (v) {
                                        setState(() {
                                          _selectedClassId = v;
                                          _selectedSectionId = null;
                                        });
                                        _loadStudents();
                                      },
                                    ),
                                  ),
                                ),
                              ),
                              SizedBox(width: 8.w),
                              Expanded(
                                flex: 3,
                                child: _buildFilterBox(
                                  label: 'SECTION',
                                  child: DropdownButtonHideUnderline(
                                    child: DropdownButton<String?>(
                                      isExpanded: true,
                                      value: _selectedSectionId,
                                      hint: Text('ALL SECTIONS',
                                          style: TextStyle(
                                              fontSize: 10.sp,
                                              fontWeight: FontWeight.bold)),
                                      icon: const Icon(Icons.keyboard_arrow_down, size: 16),
                                      items: [
                                        DropdownMenuItem(
                                            value: null,
                                            child: Text('ALL SECTIONS', style: TextStyle(fontSize: 10.sp))),
                                        ...(_selectedClassId == null
                                                ? []
                                                : ((_classes.firstWhere((c) => c['id'].toString() == _selectedClassId, orElse: () => {'Sections': []})['Sections'] ?? []) as List))
                                            .map<DropdownMenuItem<String?>>((s) {
                                          return DropdownMenuItem(
                                            value: s['id'].toString(),
                                            child: Text((s['name'] ?? 'Sec').toString().toUpperCase(),
                                                style: TextStyle(
                                                    fontSize: 10.sp,
                                                    fontWeight: FontWeight.bold)),
                                          );
                                        }),
                                      ],
                                      onChanged: (v) {
                                        setState(() => _selectedSectionId = v);
                                        _loadStudents();
                                      },
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          SizedBox(height: 12.h),
                          // Actions
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: [
                                GestureDetector(
                                  onTap: () async {
                                    final res =
                                        await context.push('/students/add');
                                    if (res == true) _loadInitial();
                                  },
                                  child: _actionBtn(
                                      'ADD NEW', AppTheme.primary, Colors.white,
                                      isSolid: true),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Table Header
                    if (_filtered.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
                        child: Row(
                          children: [
                            _th('NAME', flex: 4),
                            _th('ID', flex: 2),
                            _th('CLASS', flex: 2),
                          ],
                        ),
                      ),

                    // Students List
                    if (_filtered.isEmpty)
                      Center(
                        child: Padding(
                          padding: EdgeInsets.symmetric(vertical: 60.h),
                          child: Column(
                            children: [
                              Text('Ã°Å¸â€˜Â¨Ã¢â‚¬ÂÃ°Å¸Å½â€œ', style: TextStyle(fontSize: 48.sp)),
                              SizedBox(height: 16.h),
                              Text('No students found',
                                  style: TextStyle(
                                      color: AppTheme.textSecondary,
                                      fontWeight: FontWeight.w900,
                                      fontSize: 13.sp)),
                            ],
                          ),
                        ),
                      )
                    else
                      ListView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        padding: EdgeInsets.symmetric(
                            horizontal: 16.w, vertical: 8.h),
                        itemCount: _filtered.length,
                        itemBuilder: (ctx, i) {
                          final s = _filtered[i];
                          final name =
                              s['name'] ?? s['user']?['name'] ?? 'Unknown';
                          final studentId =
                              s['student_id'] ?? s['studentId'] ?? '';
                          final className = s['clss']?['class_name'] ??
                              s['className'] ??
                              'N/A';

                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: EdgeInsets.all(12.w),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12.r),
                              border:
                                  Border.all(color: const Color(0xFFF1F5F9)),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  flex: 4,
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        name,
                                        style: TextStyle(
                                            fontWeight: FontWeight.w800,
                                            fontSize: 13.sp,
                                            color: AppTheme.textPrimary),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                                Expanded(
                                  flex: 2,
                                  child: Text(
                                    studentId,
                                    style: TextStyle(
                                        fontSize: 11.sp,
                                        fontWeight: FontWeight.bold,
                                        color: const Color(0xFF475569)),
                                  ),
                                ),
                                Expanded(
                                  flex: 2,
                                  child: Text(
                                    className,
                                    style: TextStyle(
                                        fontSize: 11.sp,
                                        fontWeight: FontWeight.bold,
                                        color: AppTheme.primary),
                                  ),
                                ),
                                Row(
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.edit_outlined,
                                          size: 18, color: AppTheme.primary),
                                      onPressed: () async {
                                        final res = await context
                                            .push('/students/edit/${s['id']}');
                                        if (res == true) _loadInitial();
                                      },
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline,
                                          size: 18, color: AppTheme.danger),
                                      onPressed: () => _deleteStudent(s['id']),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _th(String label, {int flex = 1}) {
    return Expanded(
      flex: flex,
      child: Text(
        label,
        style: TextStyle(
            fontSize: 10.sp,
            fontWeight: FontWeight.w900,
            color: AppTheme.textSecondary,
            letterSpacing: 1),
      ),
    );
  }

  Widget _actionBtn(String label, Color bg, Color fg, {bool isSolid = false}) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 8.h),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8.r),
        boxShadow: isSolid
            ? [
                BoxShadow(
                    color: bg.withValues(alpha: 0.2),
                    blurRadius: 4.r,
                    offset: const Offset(0, 2))
              ]
            : null,
      ),
      child: Text(
        label,
        style: TextStyle(color: fg, fontWeight: FontWeight.w900, fontSize: 11.sp),
      ),
    );
  }

  Widget _buildFilterBox({required String label, required Widget child}) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
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



