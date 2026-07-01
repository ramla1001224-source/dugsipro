import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../config/api_config.dart';

class ExamsScreen extends StatefulWidget {
  const ExamsScreen({super.key});
  @override
  State<ExamsScreen> createState() => _ExamsScreenState();
}

class _ExamsScreenState extends State<ExamsScreen> {
  final ApiService _api = ApiService();
  final AuthService _auth = AuthService();
  List<dynamic> _exams = [];
  List<dynamic> _classes = [];
  List<dynamic> _terms = [];
  bool _loading = true;
  String _activeTab = 'academic'; // 'academic' or 'other'
  String? _selectedClassId;
  String? _selectedSectionId;
  String? _selectedTermId;
  String? _selectedYearId;
  List<dynamic> _academicYears = [];
  String? _userRole;
  List<String> _teacherSubjectIds = [];
  List<String> _teacherClassIds = [];
  bool _canManageExams = true;
  String? _error;

  final List<String> _academicSequence = [
    'monthly_1',
    'midterm',
    'monthly_2',
    'final'
  ];

  String? _loadingExamId;

  @override
  void initState() {
    super.initState();
    _loadInitial();
  }

  Future<void> _loadInitial() async {
    setState(() => _loading = true);
    try {
      final resC = await _api.get(ApiConfig.classes);
      final resY = await _api.get(ApiConfig.academicYears);
      final profile = await _auth.getProfile();
      _userRole = await _auth.getRole();

      if (_userRole == 'teacher' && profile != null) {
        final teacher = profile['teacher'] ?? profile['Teacher'];
        if (teacher != null) {
          final assignments = teacher['SubjectAssignments'] as List?;
          if (assignments != null) {
            _teacherSubjectIds =
                assignments.map((a) => a['subjectId'].toString()).toList();
            _teacherClassIds = assignments
                .where((a) => a['classId'] != null)
                .map((a) => a['classId'].toString())
                .toList();
          }
        }
        _canManageExams = await _auth.hasPermission('perm_tea_manage_exams');
      } else {
        _canManageExams = true;
      }

      if (_userRole == 'student') {
        final enrollment = await _auth.getCurrentEnrollment();
        if (enrollment != null) {
          _selectedClassId = enrollment['classId']?.toString();
          if (enrollment['sectionId'] != null) {
            _selectedSectionId = enrollment['sectionId'].toString();
          }
        } else if (profile != null) {
          final student = profile['student'] ?? profile['Student'];
          if (student != null && student['classId'] != null) {
            _selectedClassId = student['classId'].toString();
            if (student['sectionId'] != null) {
              _selectedSectionId = student['sectionId'].toString();
            }
          }
        }
      }

      final classes = resC.data is List
          ? resC.data
          : (resC.data['classes'] ?? resC.data['data'] ?? []);
      final years = resY.data is List ? resY.data : [];

      List<dynamic> allTerms = [];
      for (var year in years) {
        if (year['Terms'] != null) allTerms.addAll(year['Terms']);
      }

      setState(() {
        _classes = classes;
        _academicYears = years;
        _terms = allTerms;
        
        // [Smart Default] Strictly prefer the school's current academic year
        final currentYear = years.firstWhere(
            (y) => y is Map && y['isCurrent'] == true,
            orElse: () => null);
        
        if (currentYear != null) {
          _selectedYearId = currentYear['id'].toString();
          // Pre-select first term of current year
          final currentTerms = currentYear['Terms'];
          if (currentTerms != null && currentTerms is List && currentTerms.isNotEmpty) {
            _selectedTermId = currentTerms[0]['id'].toString();
          }
        } else if (years.isNotEmpty) {
          // No current year set: default to the first available (most recent)
          _selectedYearId = years[0]['id'].toString();
        }
      });
      await _loadExams();
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
          } else {
            _error = 'Error loading initial data: ${e.toString()}';
          }
        });
      }
    }
  }

  Future<void> _loadExams() async {
    setState(() => _loading = true);
    try {
      Map<String, dynamic> params = {};
      if (_activeTab != 'history') {
        params['onlyCurrent'] = 'true';
      } else if (_selectedYearId != null) {
        params['academicYearId'] = _selectedYearId;
      }
      
      if (_selectedTermId != null) params['termId'] = _selectedTermId;
      if (_selectedSectionId != null && _selectedSectionId!.isNotEmpty) {
        params['sectionId'] = _selectedSectionId;
      }

      final res = await _api.get(ApiConfig.exams, params: params);
      final data = res.data;
      final list = data is List ? data : data['exams'] ?? data['data'] ?? [];

      if (mounted) {
        setState(() {
          _exams = list;
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
          } else {
            _error = 'Error loading exams: ${e.toString()}';
          }
        });
      }
    }
  }

  List<dynamic> get _filteredExams {
    final currentYear = _academicYears.firstWhere(
        (y) => y is Map && y['isCurrent'] == true,
        orElse: () => null);
    final String? currentYearId = currentYear?['id']?.toString();

    return _exams.where((ex) {
      final type = (ex['type'] ?? '').toString().toLowerCase();
      final examYearId = ex['term']?['academicYearId']?.toString();

      // STRICT YEAR FILTERING
      bool matchesYear = true;
      if (_activeTab != 'history') {
        // Only show exams belonging to the current year
        matchesYear = currentYearId != null && examYearId == currentYearId;
      } else {
        if (_selectedYearId != null) {
          // History tab: strictly follow selection
          matchesYear = examYearId == _selectedYearId;
        } else {
          // Default History view: show all past years (exclude current)
          matchesYear = currentYearId == null || examYearId != currentYearId;
        }
      }

      final matchesTab = _activeTab == 'academic'
          ? _academicSequence.contains(type)
          : _activeTab == 'history'
              ? _academicSequence.contains(type) // History also groups by academic
              : !_academicSequence.contains(type);
      
      final matchesClass = _selectedClassId == null ||
          ex['classId'] == null ||
          ex['classId'].toString() == _selectedClassId;

      // Teacher Subject Filter
      bool matchesSubject = true;
      if (_userRole == 'teacher') {
        matchesSubject =
            _teacherSubjectIds.contains(ex['subjectId'].toString());
      }

      return matchesYear && matchesTab && matchesClass && matchesSubject;
    }).toList();
  }

  Map<String, List<dynamic>> get _groupedExams {
    final filtered = _filteredExams;
    Map<String, List<dynamic>> groups = {};
    for (var ex in filtered) {
      final fullName = ex['name'] ?? 'Untitled Exam';
      final baseName =
          fullName.contains(' - ') ? fullName.split(' - ')[0] : fullName;
      if (!groups.containsKey(baseName)) groups[baseName] = [];
      groups[baseName]!.add(ex);
    }
    return groups;
  }

  @override
  Widget build(BuildContext context) {
    final grouped = _groupedExams;
    final groupNames = grouped.keys.toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
        title: Text('Examinations',
            style: TextStyle(
                color: AppTheme.textPrimary,
                fontWeight: FontWeight.w900,
                fontSize: 18.sp)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadExams,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.all(16.w),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_error != null)
                      Container(
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: EdgeInsets.all(12.w),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(12.r),
                          border: Border.all(color: Colors.red.shade200),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline, color: Colors.red),
                            SizedBox(width: 12.w),
                            Expanded(
                              child: Text(
                                _error!,
                                style: TextStyle(color: Colors.red.shade900, fontSize: 13.sp),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.refresh, color: Colors.red),
                              onPressed: () {
                                setState(() => _error = null);
                                _loadInitial();
                              },
                            ),
                          ],
                        ),
                      ),
                    _buildTopHeader(),
                    SizedBox(height: 24.h),
                    _buildTabs(),
                    SizedBox(height: 20.h),
                    _buildFilters(),
                    SizedBox(height: 24.h),
                    if (groupNames.isEmpty)
                      _buildEmptyState()
                    else
                      ...groupNames
                          .map((name) => _buildBatchCard(name, grouped[name]!)),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildTopHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Maamulka Imtixaanada',
                style: TextStyle(
                    fontSize: 22.sp,
                    fontWeight: FontWeight.w900,
                    color: const Color(0xFF0F172A),
                    letterSpacing: -0.5)),
            SizedBox(height: 4.h),
            Text('Create and manage exams',
                style: TextStyle(
                    fontSize: 12.sp,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF94A3B8))),
          ],
        ),
        if (_userRole != 'student' && _canManageExams)
          GestureDetector(
            onTap: () async {
              final res = await context.push('/exams/create');
              if (res == true) _loadInitial();
            },
            child: Container(
              padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 10.h),
              decoration: BoxDecoration(
                color: const Color(0xFF4F46E5),
                borderRadius: BorderRadius.circular(12.r),
              ),
              child: Text('+ Create Exam',
                  style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 11.sp)),
            ),
          ),
      ],
    );
  }

  Widget _buildTabs() {
    return Row(
      children: [
        _buildTabButton('academic', 'IMTIXAANNADA'),
        SizedBox(width: 8.w),
        _buildTabButton('other', 'KUWA KALE'),
        if (_userRole != 'teacher') ...[
          SizedBox(width: 8.w),
          _buildTabButton('history', 'HISTORY'),
        ],
      ],
    );
  }

  Widget _buildTabButton(String tab, String label) {
    final active = _activeTab == tab;
    return GestureDetector(
      onTap: () {
        setState(() => _activeTab = tab);
        _loadExams();
      },
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 12.h),
        decoration: BoxDecoration(
          color: active ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(20.r),
          boxShadow: active
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 10.r,
                    offset: const Offset(0, 4),
                  )
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 10.sp,
            fontWeight: FontWeight.w900,
            color: active ? const Color(0xFF4F46E5) : const Color(0xFF94A3B8),
            letterSpacing: 0.5,
          ),
        ),
      ),
    );
  }

  Widget _buildFilters() {
    final List<dynamic> filteredClasses =
        (_userRole == 'teacher' && _teacherClassIds.isNotEmpty)
            ? _classes
                .where((c) => _teacherClassIds.contains(c['id'].toString()))
                .toList()
            : _classes;

    return Column(
      children: [
        if (_activeTab == 'history' && _userRole != 'teacher') ...[
          Container(
            height: 48.h,
            margin: const EdgeInsets.only(bottom: 12),
            padding: EdgeInsets.symmetric(horizontal: 16.w),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24.r),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.02),
                  blurRadius: 8.r,
                  offset: const Offset(0, 2),
                )
              ],
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                isExpanded: true,
                value: _selectedYearId,
                hint: Text('SELECT YEAR',
                    style: TextStyle(
                        fontSize: 10.sp,
                        fontWeight: FontWeight.w900,
                        color: const Color(0xFF4F46E5))),
                icon: const Icon(Icons.keyboard_arrow_down,
                    size: 18, color: Color(0xFF4F46E5)),
                items: _academicYears
                    .map<DropdownMenuItem<String>>((y) => DropdownMenuItem(
                        value: y['id'].toString(),
                        child: Text(
                            'YEAR: ${y['name'].toString().toUpperCase()}',
                            style: TextStyle(
                                fontSize: 10.sp,
                                fontWeight: FontWeight.w900,
                                color: const Color(0xFF4F46E5)))))
                    .toList(),
                onChanged: (v) {
                  setState(() {
                    _selectedYearId = v;
                    _selectedTermId = null; // Reset term
                  });
                  _loadExams();
                },
              ),
            ),
          ),
        ],
        Row(
          children: [
            Expanded(
              child: Container(
                height: 48.h,
                padding: EdgeInsets.symmetric(horizontal: 16.w),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24.r),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 8.r,
                      offset: const Offset(0, 2),
                    )
                  ],
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    isExpanded: true,
                    value: _selectedTermId,
                    hint: Text('TERM: Dhamaan Term-yada',
                        style: TextStyle(
                            fontSize: 10.sp,
                            fontWeight: FontWeight.w900,
                            color: const Color(0xFF4F46E5))),
                    icon: const Icon(Icons.keyboard_arrow_down,
                        size: 18, color: Color(0xFF4F46E5)),
                    items: _terms
                        .map<DropdownMenuItem<String>>((t) => DropdownMenuItem(
                            value: t['id'].toString(),
                            child: Text(
                                'TERM: ${t['name'].toString().toUpperCase()}',
                                style: TextStyle(
                                    fontSize: 10.sp,
                                    fontWeight: FontWeight.w900,
                                    color: const Color(0xFF4F46E5)))))
                        .toList(),
                    onChanged: (v) {
                      setState(() => _selectedTermId = v);
                      _loadExams();
                    },
                  ),
                ),
              ),
            ),
            SizedBox(width: 12.w),
            Expanded(
              child: Container(
                height: 48.h,
                padding: EdgeInsets.symmetric(horizontal: 16.w),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24.r),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 8.r,
                      offset: const Offset(0, 2),
                    )
                  ],
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    isExpanded: true,
                    value: _selectedClassId,
                    hint: Text('CLASS: Dhamaan Fasallada',
                        style: TextStyle(
                            fontSize: 10.sp,
                            fontWeight: FontWeight.w900,
                            color: const Color(0xFF4F46E5))),
                    icon: const Icon(Icons.keyboard_arrow_down,
                        size: 18, color: Color(0xFF4F46E5)),
                    items: [
                      DropdownMenuItem(
                          value: null,
                          child: Text('CLASS: Dhamaan Fasallada',
                              style: TextStyle(
                                  fontSize: 10.sp,
                                  fontWeight: FontWeight.w900,
                                  color: const Color(0xFF4F46E5)))),
                      ...filteredClasses
                          .map<DropdownMenuItem<String>>((c) => DropdownMenuItem(
                              value: c['id'].toString(),
                              child: Text(
                                  'CLASS: ${c['class_name'].toString().toUpperCase()}',
                                  style: TextStyle(
                                      fontSize: 10.sp,
                                      fontWeight: FontWeight.w900,
                                      color: const Color(0xFF4F46E5)))))
                          .toList()
                    ],
                    onChanged: (v) {
                      setState(() => _selectedClassId = v);
                      _loadExams();
                    },
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildBatchCard(String name, List<dynamic> exams) {
    final totalSubmitted = exams.fold<num>(0, (sum, ex) => sum + (ex['_count']?['Results'] ?? 0)).toInt();
    final totalMissing = exams.fold<num>(0, (sum, ex) => sum + (ex['missingCount'] ?? 0)).toInt();
    final dateStr = (exams[0]['date'] ?? '').toString();
    final formattedDate = dateStr.length >= 10 ? dateStr.substring(0, 10) : dateStr;
    final termName = exams.isNotEmpty ? (exams[0]['term']?['name'] ?? 'N/A') : 'N/A';

    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24.r),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Column(
        children: [
          // Header (Dark Blue)
          Container(
            padding: EdgeInsets.all(24.w),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(24.r),
            ),
            child: Row(
              children: [
                Container(
                  padding: EdgeInsets.all(12.w),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(16.r),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                  ),
                  child: const Icon(Icons.inbox_rounded, color: Color(0xFF818CF8), size: 24),
                ),
                SizedBox(width: 16.w),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(name,
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 18.sp)),
                          SizedBox(width: 12.w),
                          Container(
                            padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                            decoration: BoxDecoration(
                              color: const Color(0xFF4F46E5).withValues(alpha: 0.3),
                              borderRadius: BorderRadius.circular(20.r),
                              border: Border.all(color: const Color(0xFF4F46E5).withValues(alpha: 0.5)),
                            ),
                            child: Text(
                              termName.toString().toUpperCase(),
                              style: TextStyle(
                                color: const Color(0xFF818CF8),
                                fontSize: 9.sp,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 8.h),
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(
                            '${exams.length} SUBJECTS',
                            style: TextStyle(
                                color: const Color(0xFF94A3B8),
                                fontSize: 10.sp,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.5)),
                          Padding(
                            padding: EdgeInsets.symmetric(horizontal: 6.w),
                            child: Text('•', style: TextStyle(color: const Color(0xFFF59E0B), fontSize: 12.sp)),
                          ),
                          Text(
                            '$totalSubmitted RESULTS',
                            style: TextStyle(
                                color: const Color(0xFF94A3B8),
                                fontSize: 10.sp,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.5)),
                          Padding(
                            padding: EdgeInsets.symmetric(horizontal: 6.w),
                            child: Text('•', style: TextStyle(color: const Color(0xFFF59E0B), fontSize: 12.sp)),
                          ),
                          Text(
                            formattedDate,
                            style: TextStyle(
                                color: const Color(0xFF94A3B8),
                                fontSize: 10.sp,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.5)),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // Subjects
          Padding(
            padding: EdgeInsets.all(24.w),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: exams.map((ex) => _buildExamRow(ex, termName)).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildExamRow(dynamic ex, String termName) {
    final subject = ex['subject']?['name'] ?? 'General';
    final className = ex['class']?['class_name'] ?? 'All';
    final resultsCount = ex['_count']?['Results'] ?? 0;
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 6.h),
          margin: EdgeInsets.only(bottom: 12.h, top: 8.h),
          decoration: BoxDecoration(
            color: const Color(0xFF4F46E5),
            borderRadius: BorderRadius.circular(20.r),
          ),
          child: Text(
            className.toString().toUpperCase(),
            style: TextStyle(
              color: Colors.white,
              fontSize: 10.sp,
              fontWeight: FontWeight.w900,
              letterSpacing: 1,
            ),
          ),
        ),
        Container(
          padding: EdgeInsets.all(20.w),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20.r),
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
                          subject.toString().toUpperCase(),
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 14.sp,
                            color: const Color(0xFF0F172A),
                            letterSpacing: 0.5,
                          ),
                        ),
                        SizedBox(height: 4.h),
                        Text(
                          'ASSESSMENT: ${termName.toString().toUpperCase()}',
                          style: TextStyle(
                            fontSize: 10.sp,
                            color: const Color(0xFF94A3B8),
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(8.r),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Text(
                      'DRAFT',
                      style: TextStyle(
                        fontSize: 9.sp,
                        fontWeight: FontWeight.w900,
                        color: const Color(0xFF64748B),
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                ],
              ),
              SizedBox(height: 20.h),
              Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        if (_userRole == 'student' || _userRole == 'parent') {
                          context.push('/student-results');
                        } else {
                          final cid = ex['classId']?.toString() ?? 'all';
                          context.push('/mark-sheet?classId=$cid');
                        }
                      },
                      icon: const Icon(Icons.analytics_outlined, size: 16),
                      label: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('EEG NATIIJADA (VIEW SHEET)',
                              style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w900, letterSpacing: 0.5)),
                          SizedBox(width: 8.w),
                          Container(
                            padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 2.h),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(6.r),
                            ),
                            child: Text('$resultsCount RECORDS', style: TextStyle(fontSize: 8.sp, fontWeight: FontWeight.w900)),
                          ),
                        ],
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF4F46E5),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
                        padding: EdgeInsets.symmetric(vertical: 16.h),
                      ),
                    ),
                  ),
                  if (_userRole != 'student') ...[
                    SizedBox(height: 12.h),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: _loadingExamId == ex['id'].toString() ? null : () async {
                          setState(() => _loadingExamId = ex['id'].toString());
                          await Future.delayed(const Duration(milliseconds: 600));
                          if (!mounted) return;
                          
                          String path = '/marks?examId=${ex['id']}&classId=${ex['classId']}';
                          if (_selectedSectionId != null && _selectedSectionId!.isNotEmpty) {
                            path += '&sectionId=$_selectedSectionId';
                          }
                          setState(() => _loadingExamId = null);
                          context.push(path);
                        },
                        icon: _loadingExamId == ex['id'].toString() 
                            ? SizedBox(width: 14.w, height: 14.h, child: const CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.edit_note_rounded, size: 16),
                        label: Text('GELI MARKS',
                            style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w900, letterSpacing: 0.5)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF4F46E5),
                          side: const BorderSide(color: Color(0xFFEEF2F6), width: 1.5),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
                          padding: EdgeInsets.symmetric(vertical: 16.h),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
  Widget _buildEmptyState() {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 60.h),
      child: Column(
        children: [
          Text('📱‚', style: TextStyle(fontSize: 48.sp)),
          SizedBox(height: 16.h),
          Text('NO EXAMS FOUND IN THIS CATEGORY',
              style: TextStyle(
                  color: AppTheme.textSecondary,
                  fontWeight: FontWeight.w900,
                  fontSize: 11.sp,
                  letterSpacing: 1)),
          SizedBox(height: 8.h),
          Text('Try creating a new exam batch using the button above',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11.sp, color: AppTheme.textSecondary)),
        ],
      ),
    );
  }
}

