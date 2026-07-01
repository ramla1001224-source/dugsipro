import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../config/api_config.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:url_launcher/url_launcher.dart';

class StudentResultsScreen extends StatefulWidget {
  final String? studentId;
  const StudentResultsScreen({super.key, this.studentId});

  @override
  State<StudentResultsScreen> createState() => _StudentResultsScreenState();
}

class _StudentResultsScreenState extends State<StudentResultsScreen> {
  final ApiService _api = ApiService();
  final AuthService _auth = AuthService();
  List<dynamic> _results = [];
  List<dynamic> _children = [];
  List<dynamic> _academicYears = [];
  String? _selectedStudentId;
  String? _selectedYearId;
  List<dynamic> _gradingScales = [];
  String? _role;
  bool _loading = true;
  Map<String, dynamic> _fullData = {};

  @override
  void initState() {
    super.initState();
    _selectedStudentId = widget.studentId;
    _init();
  }

  Future<void> _init() async {
    _role = await _auth.getRole();
    if (_role == 'parent') {
      await _fetchChildren();
    } else {
      // For students: fetch years first, then results
      await _fetchYearsForCurrentStudent();
      await _fetchResults();
    }
  }

  Future<void> _fetchYearsForCurrentStudent() async {
    try {
      // Get student ID from token for the student role
      final profile = await _auth.getProfile();
      final studentRecord = profile?['Student'];
      if (studentRecord != null) {
        _selectedStudentId = studentRecord['id'];
        await _fetchYears();
      }
    } catch (e) {
      debugPrint('Error fetching student id: $e');
    }
  }

  Future<void> _fetchChildren() async {
    setState(() => _loading = true);
    try {
      final profile = await _auth.getProfile();
      if (profile != null && profile['Parent'] != null) {
        final childrenData = profile['Parent']['Children'] as List?;
        if (childrenData != null) {
          _children = childrenData.map((c) => c['student']).toList();
          if (_children.isNotEmpty && _selectedStudentId == null) {
            _selectedStudentId = _children[0]['id'];
          }
        }
      }
      if (_selectedStudentId != null) {
        await _fetchYears();
        await _fetchResults();
      } else {
        setState(() => _loading = false);
      }
    } catch (e) {
      debugPrint('Error fetching children: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _fetchYears() async {
    if (_selectedStudentId == null) {
      return;
    }
    try {
      final res = await _api
          .get('${ApiConfig.exams}/student-history-years/$_selectedStudentId');
      if (res.data is List) {
        final years = List<dynamic>.from(res.data);
        setState(() {
          _academicYears = years;
          // User request: Default to current year first.
          // Student can then manually select any other year (e.g. from history).
          final current = years.firstWhere(
            (y) => y['isCurrent'] == true,
            orElse: () => years.isNotEmpty ? years[0] : null,
          );

          if (current != null) {
            _selectedYearId = current['id'];
          }
        });
      }
    } catch (e) {
      debugPrint('Error fetching years: $e');
    }
  }

  Future<void> _fetchResults() async {
    if (!mounted) {
      return;
    }
    setState(() => _loading = true);
    try {
      String endpoint = ApiConfig.studentResults;
      
      List<String> queryParams = [];
      if (_selectedStudentId != null && _selectedStudentId!.isNotEmpty) {
        queryParams.add('studentId=$_selectedStudentId');
      }
      if (_selectedYearId != null && _selectedYearId!.isNotEmpty) {
        queryParams.add('academicYearId=$_selectedYearId');
      }
      
      if (queryParams.isNotEmpty) {
        endpoint += '?${queryParams.join('&')}';
      }

      debugPrint('[Results] Fetching: $endpoint');
      final res = await _api.get(endpoint);
      if (!mounted) {
        return;
      }

      setState(() {
        final payload = res.data is Map ? (res.data['data'] ?? res.data) : {};
        _fullData = Map<String, dynamic>.from(payload as Map);
        _results =
            (payload['subjects'] ?? payload['results'] ?? []) as List<dynamic>;
        _gradingScales = (payload['gradingScales'] ?? []) as List<dynamic>;
        _loading = false;
      });
    } catch (e) {
      debugPrint('[Results] Error: $e');
      if (!mounted) {
        return;
      }
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(
                'Natiijada lama helin: ${e.toString().substring(0, e.toString().length > 60 ? 60 : e.toString().length)}')),
      );
    }
  }

  Future<void> _downloadReportCard() async {
    final sId = _selectedStudentId;
    if (sId == null) return;

    try {
      final token = await const FlutterSecureStorage().read(key: 'token');
      final path = '/api/reports/student-report/$sId?token=$token${_selectedYearId != null ? '&academicYearId=$_selectedYearId' : ''}';
      
      final cleanPath = path.startsWith('/') ? path : '/$path';
      final cleanBaseUrl = ApiConfig.baseUrl.endsWith('/') 
          ? ApiConfig.baseUrl.substring(0, ApiConfig.baseUrl.length - 1) 
          : ApiConfig.baseUrl;
      
      final fullUrl = '$cleanBaseUrl$cleanPath';
      final url = Uri.parse(fullUrl);

      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Ma furi karo PDF-ka: $fullUrl')),
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

  Color _getGradeColor(dynamic grade, dynamic marks, dynamic totalMarks) {
    if (_gradingScales.isNotEmpty) {
      final g = grade?.toString() ?? _calculateGrade(marks, totalMarks);
      if (g.startsWith('A')) return const Color(0xFF10B981); // Emerald
      if (g.startsWith('B')) return const Color(0xFF3B82F6); // Blue
      if (g.startsWith('C')) return const Color(0xFF0EA5E9); // Light Blue/Cyan
      if (g.startsWith('D')) return const Color(0xFFF59E0B); // Amber
      if (g == 'F') return const Color(0xFFEF4444); // Red
    }

    if (marks is! num || totalMarks is! num || totalMarks == 0) {
      return const Color(0xFF94A3B8); // Slate 400
    }
    final percentage = (marks / totalMarks) * 100;
    if (percentage >= 90) return const Color(0xFF10B981);
    if (percentage >= 75) return const Color(0xFF3B82F6);
    if (percentage >= 65) return const Color(0xFF0EA5E9);
    if (percentage >= 50) return const Color(0xFFF59E0B);
    return const Color(0xFFEF4444);
  }

  String _calculateGrade(dynamic marks, dynamic totalMarks) {
    if (marks is! num || totalMarks is! num || totalMarks == 0) {
      return 'F';
    }
    final percentage = ((marks / totalMarks) * 100).round();

    if (_gradingScales.isNotEmpty) {
      // Explicitly sort DESC to ensure we match the highest threshold first
      final sortedScales = List<dynamic>.from(_gradingScales);
      sortedScales.sort((a, b) => (b['minScore'] ?? 0).compareTo(a['minScore'] ?? 0));

      for (var s in sortedScales) {
        final min = s['minScore'] ?? 0;
        if (percentage >= min) {
          return s['grade']?.toString() ?? 'F';
        }
      }
    }

    // Standard Universal Fallback (Matching Somali Standard)
    if (percentage >= 90) return 'A+';
    if (percentage >= 85) return 'B++';
    if (percentage >= 80) return 'B-';
    if (percentage >= 75) return 'C+';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B101E),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          'EXAMINATION RESULTS',
          style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              fontSize: 14.sp,
              letterSpacing: 2),
        ),
        actions: [
          if (_results.isNotEmpty && _selectedStudentId != null)
            IconButton(
              icon: const Icon(Icons.picture_as_pdf, color: Color(0xFF3B82F6)),
              onPressed: _downloadReportCard,
              tooltip: 'Download Report Card',
            ),
        ],
      ),
      body: Column(
        children: [
          if (_role == 'parent' && _children.isNotEmpty) _buildChildSelector(),
          if (_academicYears.isNotEmpty) _buildYearSelector(),
          if (!_loading && _results.isNotEmpty) _buildResultsHeader(),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF3B82F6)))
                : RefreshIndicator(
                    color: const Color(0xFF3B82F6),
                    backgroundColor: const Color(0xFF1E293B),
                    onRefresh: _fetchResults,
                    child: _results.isEmpty
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: [
                              SizedBox(
                                height: MediaQuery.of(context).size.height * 0.5,
                                child: _buildEmptyState(),
                              )
                            ],
                          )
                        : ListView.builder(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.fromLTRB(20, 10, 20, 20),
                            itemCount: _results.length,
                            itemBuilder: (context, index) {
                              final res = _results[index];
                              return _buildResultCard(res, index);
                            },
                          ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildChildSelector() {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: 20.w, vertical: 10.h),
      padding: EdgeInsets.symmetric(horizontal: 16.w),
      decoration: BoxDecoration(
        color: const Color(0xFF151E2E), // Darker elegant box
        borderRadius: BorderRadius.circular(16.r),
        border: Border.all(color: const Color(0xFF263238)), // Subtle border
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _selectedStudentId,
          isExpanded: true,
          dropdownColor: const Color(0xFF151E2E),
          icon: const Icon(Icons.keyboard_arrow_down, color: Color(0xFF94A3B8)),
          items: _children.map((child) {
            String childName = child['user']?['name']?.toString() ??
                child['name']?.toString() ??
                'UNKNOWN';
            return DropdownMenuItem<String>(
              value: child['id'],
              child: Text(
                childName.toUpperCase(),
                style: TextStyle(
                  fontSize: 14.sp,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            );
          }).toList(),
          onChanged: (val) {
            if (val != null) {
              setState(() {
                _selectedStudentId = val;
                _selectedYearId = null;
                _academicYears = [];
                _loading = true;
                _results = [];
              });
              _fetchYears().then((_) => _fetchResults());
            }
          },
        ),
      ),
    );
  }

  Widget _buildYearSelector() {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: 20.w, vertical: 5.h),
      padding: EdgeInsets.symmetric(horizontal: 16.w),
      decoration: BoxDecoration(
        color: const Color(0xFF111827),
        borderRadius: BorderRadius.circular(16.r),
        border: Border.all(color: const Color(0xFF1F2937)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _selectedYearId,
          isExpanded: true,
          dropdownColor: const Color(0xFF1F2937),
          icon: const Icon(Icons.keyboard_arrow_down, color: Color(0xFF94A3B8)),
          items: _academicYears.map((year) {
            final schoolLabel = year['schoolName'] != null ? ' - ${year['schoolName']}' : '';
            return DropdownMenuItem<String>(
              value: year['id'],
              child: Text(
                '${year['name']}${year['isCurrent'] == true ? ' (CURRENT)' : ''}$schoolLabel'.toUpperCase(),
                style: TextStyle(
                  fontSize: 13.sp,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF94A3B8),
                ),
                overflow: TextOverflow.ellipsis,
              ),
            );
          }).toList(),
          onChanged: (val) {
            if (val != null && val != _selectedYearId) {
              setState(() {
                _selectedYearId = val;
                _loading = true;
                _results = [];
              });
              _fetchResults();
            }
          },
        ),
      ),
    );
  }

  Widget _buildResultsHeader() {
    final student = _fullData['student'] ?? {};
    final grandTotal = _fullData['grandTotal'] ?? 0;
    final grandMax = _fullData['grandMax'] ?? 0;
    final name = student['name'] ?? 'STUDENT';
    final regId = student['regId'] ?? student['id'] ?? '-';
    final className = student['className'] ?? '-';
    final sectionName = student['sectionName'] ?? '';

    // Compute display values
    final rawAverage = _fullData['average'];
    final double average = rawAverage != null
        ? (rawAverage as num).toDouble()
        : (grandMax > 0 ? ((grandTotal as num) / (grandMax as num) * 100) : 0.0);
    final displayAverage = average.toStringAsFixed(1);
    final String status = _fullData['status']?.toString() ?? (average >= 50 ? 'Pass' : 'Fail');
    final bool isPass = status == 'Pass';
    final classPosition = _fullData['classPosition'];
    final totalStudents = _fullData['totalStudentsInClass'] ?? 0;

    final aggregateGrade = _fullData['grade']?.toString() ?? _calculateGrade(grandTotal, grandMax);
    final gradeColor = _getGradeColor(aggregateGrade, grandTotal, grandMax);

    return FutureBuilder<String?>(
      future: _auth.getSchoolLogo(),
      builder: (context, logoSnapshot) {
        return FutureBuilder<String?>(
          future: _auth.getSchoolName(),
          builder: (context, nameSnapshot) {
            final logo = logoSnapshot.data;
            final schoolName = nameSnapshot.data ?? 'Educational Portal';

            return Container(
              margin: const EdgeInsets.fromLTRB(20, 15, 20, 10),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24.r),
                boxShadow: [
                  BoxShadow(
                    color: gradeColor.withValues(alpha: 0.15),
                    blurRadius: 20.r,
                    offset: const Offset(0, 10),
                  ),
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.2),
                    blurRadius: 10.r,
                    offset: const Offset(0, 4),
                  ),
                ],
                border: Border.all(color: gradeColor.withValues(alpha: 0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header info
                  Padding(
                    padding: EdgeInsets.all(24.w),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (logo != null)
                                Container(
                                  width: 50.w,
                                  height: 50.h,
                                  margin: const EdgeInsets.only(right: 15),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(12.r),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.1),
                                        blurRadius: 10.r,
                                      )
                                    ],
                                  ),
                                  padding: EdgeInsets.all(6.w),
                                  child: Image.network(
                                    logo.startsWith('http')
                                        ? logo
                                        : '${ApiConfig.baseUrl.endsWith('/') ? ApiConfig.baseUrl.substring(0, ApiConfig.baseUrl.length - 1) : ApiConfig.baseUrl}${logo.startsWith('/') ? logo : '/$logo'}',
                                    fit: BoxFit.contain,
                                    errorBuilder: (ctx, err, stack) => const Icon(
                                      Icons.school_rounded,
                                      color: Color(0xFF1E293B),
                                      size: 24,
                                    ),
                                  ),
                                ),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      name.toString().toUpperCase(),
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 18.sp,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: -0.5,
                                      ),
                                    ),
                                    SizedBox(height: 6.h),
                                    Text(
                                      schoolName.toUpperCase(),
                                      style: TextStyle(
                                        color: const Color(0xFF3B82F6),
                                        fontSize: 10.sp,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 1.0,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    SizedBox(height: 4.h),
                                    Text(
                                      '$className ${sectionName.isNotEmpty ? '($sectionName)' : ''} • ID: $regId'.toUpperCase(),
                                      style: TextStyle(
                                        color: const Color(0xFF94A3B8),
                                        fontSize: 9.sp,
                                        fontWeight: FontWeight.w700,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        SizedBox(width: 10.w),
                        Container(
                          alignment: Alignment.center,
                          height: 56.h,
                          width: 56.w,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: gradeColor.withValues(alpha: 0.15),
                            border: Border.all(color: gradeColor.withValues(alpha: 0.5), width: 2.w),
                            boxShadow: [
                              BoxShadow(
                                color: gradeColor.withValues(alpha: 0.3),
                                blurRadius: 10.r,
                                spreadRadius: 2,
                              )
                            ],
                          ),
                          child: Text(
                            aggregateGrade,
                            style: TextStyle(
                              color: gradeColor,
                              fontSize: 20.sp,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Stats bar: Total | Average | Status | Class Position
                  Container(
                    decoration: BoxDecoration(
                      border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
                    ),
                    child: Row(
                      children: [
                        _buildStatCell('Total', '$grandTotal/$grandMax', Colors.white),
                        _buildStatCell('Average', '$displayAverage%', const Color(0xFF818CF8)),
                        _buildStatCell(
                          'Status',
                          status,
                          isPass ? const Color(0xFF34D399) : const Color(0xFFF87171),
                          highlight: true,
                          isPass: isPass,
                        ),
                        _buildStatCell(
                          'Class Pos.',
                          classPosition != null
                              ? (totalStudents > 0 ? '$classPosition of $totalStudents' : '$classPosition')
                              : 'â€”',
                          const Color(0xFFFBBF24),
                        ),
                      ],
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

  Widget _buildStatCell(String label, String value, Color valueColor, {bool highlight = false, bool isPass = true}) {
    return Expanded(
      child: Container(
        padding: EdgeInsets.symmetric(vertical: 14.h, horizontal: 6.w),
        decoration: BoxDecoration(
          color: highlight
              ? (isPass
                  ? const Color(0xFF064E3B).withValues(alpha: 0.4)
                  : const Color(0xFF7F1D1D).withValues(alpha: 0.4))
              : Colors.transparent,
          border: Border(right: BorderSide(color: Colors.white.withValues(alpha: 0.06))),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              label.toUpperCase(),
              style: TextStyle(
                color: const Color(0xFF64748B),
                fontSize: 8.sp,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.8,
              ),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: 4.h),
            Text(
              value,
              style: TextStyle(
                color: valueColor,
                fontSize: 13.sp,
                fontWeight: FontWeight.w900,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildResultCard(dynamic sub, int index) {
    final name = (sub['name'] ?? 'Unknown Subject').toString().toUpperCase();
    final scores = sub['scores'] ?? {};
    final total = sub['total'] ?? 0;
    final totalMarks = sub['totalMarks'] ?? 100;
    final grade = sub['grade'] ?? _calculateGrade(total, totalMarks);
    final gradeColor = _getGradeColor(grade, total, totalMarks);

    final bile1 = scores['bile_1']?.toString() ?? scores['monthly_1']?.toString() ?? '-';
    final term1 = scores['term_1']?.toString() ?? scores['midterm']?.toString() ?? scores['midterm_exam']?.toString() ?? '-';
    final bile2 = scores['bile_2']?.toString() ?? scores['monthly_2']?.toString() ?? '-';
    final finalTerm = scores['final_term']?.toString() ?? scores['final']?.toString() ?? '-';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF111827),
        borderRadius: BorderRadius.circular(20.r),
        border: Border.all(color: const Color(0xFF1F2937)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 10.r,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Left border accent
          Positioned(
            left: 0,
            top: 20,
            bottom: 20,
            child: Container(
              width: 4.w,
              decoration: BoxDecoration(
                color: gradeColor,
                borderRadius: BorderRadius.only(
                  topRight: Radius.circular(4.r),
                  bottomRight: Radius.circular(4.r),
                ),
                boxShadow: [
                  BoxShadow(
                    color: gradeColor.withValues(alpha: 0.5),
                    blurRadius: 6.r,
                    spreadRadius: 1,
                  )
                ],
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.all(20.w),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        name,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16.sp,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                     Container(
                      padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                      decoration: BoxDecoration(
                        color: gradeColor.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8.r),
                      ),
                      child: Text(
                        grade,
                        style: TextStyle(
                          color: gradeColor,
                          fontSize: 14.sp,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 20.h),
                Container(
                  padding: EdgeInsets.all(16.w),
                  decoration: BoxDecoration(
                    color: const Color(0xFF151E2E), // Sub-card
                    borderRadius: BorderRadius.circular(16.r),
                    border: Border.all(color: const Color(0xFF1E293B)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildScoreColumn('BILE 1', bile1),
                      _buildScoreColumn('TERM 1', term1),
                      _buildScoreColumn('BILE 2', bile2),
                      _buildScoreColumn('FINAL', finalTerm),
                      _buildScoreColumn('TOTAL', '$total', isTotal: true),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScoreColumn(String label, String val, {bool isTotal = false}) {
    return Column(
      children: [
        Text(
          label,
          style: TextStyle(
            color: isTotal ? const Color(0xFF3B82F6) : const Color(0xFF64748B),
            fontSize: 9.sp,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.5,
          ),
        ),
        SizedBox(height: 6.h),
        Text(
          val,
          style: TextStyle(
            color: isTotal ? const Color(0xFF3B82F6) : Colors.white,
            fontSize: isTotal ? 16 : 14,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState() {
    final code = _fullData['code'] ?? '';
    final message = _fullData['message'] ??
        'Your examination results will appear here once they are published.';
    final title = code == 'NOT_ENROLLED_IN_CLASS'
        ? 'FASAL LAGUMA QORIN'
        : 'NATIIJO LAMA HELIN';
    final icon = code == 'NOT_ENROLLED_IN_CLASS' ? Icons.class_outlined : Icons.insert_chart_outlined;

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: EdgeInsets.all(24.w),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B).withValues(alpha: 0.5),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 48, color: const Color(0xFF3B82F6)),
          ),
          SizedBox(height: 24.h),
          Text(
            title,
            style: TextStyle(
              color: Colors.white,
              fontSize: 18.sp,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.0,
            ),
          ),
          SizedBox(height: 12.h),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 40.w),
            child: Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: const Color(0xFF94A3B8),
                fontSize: 13.sp,
                fontWeight: FontWeight.w500,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}



