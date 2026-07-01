import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../config/api_config.dart';
import '../../main.dart';

class MarkSheetScreen extends StatefulWidget {
  final String classId;
  final String? sectionId;
  const MarkSheetScreen({super.key, required this.classId, this.sectionId});

  @override
  State<MarkSheetScreen> createState() => _MarkSheetScreenState();
}

class _MarkSheetScreenState extends State<MarkSheetScreen> {
  final ApiService _api = ApiService();
  final AuthService _auth = AuthService();
  bool _loading = true;
  String? _userRole;
  String? _effectiveClassId;
  String? _effectiveSectionId;
  List<dynamic> _markSheet = [];
  List<dynamic> _subjects = [];
  List<dynamic> _gradingScales = [];
  String _filterType = 'all';

  @override
  void initState() {
    super.initState();
    _effectiveClassId = widget.classId;
    _effectiveSectionId = widget.sectionId;
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _loading = true);
    try {
      _userRole = await _auth.getRole();

      if ((_effectiveClassId == null || _effectiveClassId!.isEmpty) &&
          _userRole == 'student') {
        final profile = await _auth.getProfile();
        if (profile != null && profile['Student'] != null) {
          _effectiveClassId = profile['Student']['classId']?.toString();
          _effectiveSectionId = profile['Student']['sectionId']?.toString();
        }
      }

      if (_effectiveClassId == null || _effectiveClassId!.isEmpty) {
        setState(() => _loading = false);
        return;
      }

      String url = '${ApiConfig.exams}/class-results/$_effectiveClassId';
      if (_effectiveSectionId != null && _effectiveSectionId!.isNotEmpty) {
        url += '?sectionId=$_effectiveSectionId';
      }

      final res = await _api.get(url);
      if (mounted) {
        setState(() {
          _markSheet = res.data['markSheet'] ?? [];
          _subjects = res.data['subjects'] ?? [];
          _gradingScales = res.data['gradingScales'] ?? [];
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error fetching result sheet')),
        );
      }
    }
  }

  Color _getGradeColor(dynamic marks, dynamic totalMarks) {
    if (marks is! num || totalMarks is! num || totalMarks == 0) return Colors.grey;
    final percentage = (marks / totalMarks) * 100;

    if (_gradingScales.isNotEmpty) {
      // Robust DESC sorting to match highest threshold
      final sortedScales = List<dynamic>.from(_gradingScales);
      sortedScales.sort((a, b) => (b['minScore'] ?? 0).compareTo(a['minScore'] ?? 0));

      for (var s in sortedScales) {
        final min = s['minScore'] ?? 0;
        if (percentage >= min) {
          final g = s['grade']?.toString() ?? '';
          if (g.startsWith('A')) return Colors.green;
          if (g.startsWith('B')) return Colors.blue;
          if (g.startsWith('C')) return Colors.cyan;
          if (g.startsWith('D')) return Colors.amber;
          if (g == 'F') return Colors.red;
          return Colors.blueGrey; // Default color for other dynamic grades
        }
      }
    }

    // Standard Universal Fallback Callbacks
    if (percentage >= 90) return Colors.green;
    if (percentage >= 75) return Colors.blue;
    if (percentage >= 65) return Colors.cyan;
    if (percentage >= 50) return Colors.amber;
    return Colors.red;
  }

  List<dynamic> get _processedData {
    final milestones = [
      {'key': 'monthly_1', 'label': 'M1'},
      {'key': 'midterm', 'label': 'MT'},
      {'key': 'monthly_2', 'label': 'M2'},
      {'key': 'final', 'label': 'FN'},
    ];

    final filteredMilestones = _filterType == 'all'
        ? milestones
        : milestones.where((m) => m['key'] == _filterType).toList();

    return _markSheet.map((student) {
      double displayTotal = 0;
      Map<String, dynamic> subjectsWithScores = {};

      final studentSubjects =
          student['subjects'] as Map<String, dynamic>? ?? {};
      studentSubjects.forEach((subId, sub) {
        double subTotal = 0;
        Map<String, dynamic> scores = {};

        final subScores = sub['scores'] as Map<String, dynamic>? ?? {};
        for (var m in filteredMilestones) {
          final score = (subScores[m['key']] ?? 0).toDouble();
          scores[m['key']!] = subScores[m['key']];
          subTotal += score;
        }

        subjectsWithScores[subId] = {
          ...sub,
          'scores': scores,
          'total': subTotal,
        };
        displayTotal += subTotal;
      });

      return {
        ...student,
        'subjects': subjectsWithScores,
        'displayTotal': displayTotal,
      };
    }).toList()
      ..sort((a, b) =>
          (b['displayTotal'] as double).compareTo(a['displayTotal'] as double));
  }

  double get _milestoneTotalMarks {
    // This is an approximation since each exam can have different total marks.
    // In a consolidated view, we usually assume a standard (e.g. 20 for monthly, 100 for final).
    if (_filterType == 'all') return 100.0; // Summary total
    if (_filterType == 'midterm' || _filterType == 'final') return 100.0;
    return 20.0; // Monthly
  }

  double get _grandTotalMarks {
    if (_filterType == 'all') return 100.0 * _subjects.length;
    return _milestoneTotalMarks * _subjects.length;
  }

  @override
  Widget build(BuildContext context) {
    final data = _processedData;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: FutureBuilder<String?>(
          future: _auth.getSchoolLogo(),
          builder: (context, snapshot) {
            final logo = snapshot.data;
            return Row(
              children: [
                if (logo != null)
                  Container(
                    width: 28.w,
                    height: 28.h,
                    margin: const EdgeInsets.only(right: 10),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(6.r),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.1),
                          blurRadius: 4.r,
                        )
                      ],
                    ),
                    padding: EdgeInsets.all(3.w),
                    child: Image.network(
                      logo.startsWith('http')
                          ? logo
                          : '${ApiConfig.baseUrl.endsWith('/') ? ApiConfig.baseUrl.substring(0, ApiConfig.baseUrl.length - 1) : ApiConfig.baseUrl}${logo.startsWith('/') ? logo : '/$logo'}',
                      fit: BoxFit.contain,
                      errorBuilder: (ctx, err, stack) => const Icon(
                        Icons.school_rounded,
                        color: AppTheme.primary,
                        size: 14,
                      ),
                    ),
                  ),
                Expanded(
                  child: Text(
                    'Result Sheet',
                    style: TextStyle(
                        color: AppTheme.textPrimary,
                        fontWeight: FontWeight.w900,
                        fontSize: 16.sp),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            );
          }
        ),
        actions: [
          _buildFilterDropdown(),
          SizedBox(width: 8.w),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                _buildHeaderInfo(),
                Expanded(
                  child: data.isEmpty
                      ? const Center(
                          child: Text('No results found for this class'))
                      : SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: SingleChildScrollView(
                            child: _buildTable(data),
                          ),
                        ),
                ),
              ],
            ),
    );
  }

  Widget _buildFilterDropdown() {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12.w),
      margin: EdgeInsets.symmetric(vertical: 8.h),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(10.r),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _filterType,
          style: TextStyle(
              color: const Color(0xFF2563EB),
              fontWeight: FontWeight.w900,
              fontSize: 11.sp),
          items: [
            DropdownMenuItem(value: 'all', child: Text('ALL EXAMS')),
            DropdownMenuItem(value: 'monthly_1', child: Text('MONTHLY 1')),
            DropdownMenuItem(value: 'midterm', child: Text('MIDTERM')),
            DropdownMenuItem(value: 'monthly_2', child: Text('MONTHLY 2')),
            DropdownMenuItem(value: 'final', child: Text('FINAL')),
          ],
          onChanged: (v) => setState(() => _filterType = v!),
        ),
      ),
    );
  }

  Widget _buildHeaderInfo() {
    return Container(
      padding: EdgeInsets.all(16.w),
      color: Colors.white,
      child: Row(
        children: [
          const Icon(Icons.info_outline, size: 16, color: Colors.grey),
          SizedBox(width: 8.w),
          Text(
            'Consolidated performance table',
            style: TextStyle(
                fontSize: 12.sp, color: Colors.grey, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }

  Widget _buildTable(List<dynamic> data) {
    final milestones = _filterType == 'all'
        ? ['M1', 'MT', 'M2', 'FN']
        : [_filterType.toUpperCase()];

    return DataTable(
      columnSpacing: 24,
      headingRowHeight: 60,
      headingRowColor: WidgetStateProperty.all(const Color(0xFF0F172A)),
      columns: [
        DataColumn(
            label: Text('POS',
                style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 11.sp))),
        DataColumn(
            label: Text('STUDENT NAME',
                style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 11.sp))),
        ..._subjects.map((sub) => DataColumn(
              label: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(sub['name'].toUpperCase(),
                      style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 10.sp)),
                  Row(
                    children: [
                      ...milestones.map((m) => Padding(
                            padding: EdgeInsets.symmetric(horizontal: 2.w),
                            child: Text(m,
                                style: TextStyle(
                                    color: Colors.white60, fontSize: 8.sp)),
                          )),
                      Text(' TOT',
                          style: TextStyle(
                              color: Colors.blue,
                              fontSize: 8.sp,
                              fontWeight: FontWeight.bold)),
                    ],
                  )
                ],
              ),
            )),
        DataColumn(
            label: Text('GRAND TOTAL',
                style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 11.sp))),
      ],
      rows: List.generate(data.length, (index) {
        final student = data[index];
        final position = index + 1;

        return DataRow(
          cells: [
            DataCell(Text('#$position',
                style: const TextStyle(
                    fontWeight: FontWeight.bold, color: Colors.grey))),
            DataCell(Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(student['studentName'] ?? '',
                    style: TextStyle(
                        fontWeight: FontWeight.w900, fontSize: 13.sp)),
                Text('Reg: ${student['studentRegId']}',
                    style: TextStyle(fontSize: 10.sp, color: Colors.grey)),
              ],
            )),
            ..._subjects.map((sub) {
              final subData = student['subjects'][sub['id']] ??
                  {'scores': {}, 'total': 0.0};
              final scores = subData['scores'] as Map<String, dynamic>;

              return DataCell(Row(
                children: [
                  ...(_filterType == 'all'
                          ? ['monthly_1', 'midterm', 'monthly_2', 'final']
                          : [_filterType])
                      .map((key) => Padding(
                            padding: EdgeInsets.symmetric(horizontal: 4.w),
                            child: Text(
                              (scores[key] ?? '-').toString(),
                              style: TextStyle(
                                  fontSize: 11.sp, fontWeight: FontWeight.w500),
                            ),
                          )),
                  Container(
                    margin: const EdgeInsets.only(left: 8),
                    padding:
                        EdgeInsets.symmetric(horizontal: 6.w, vertical: 2.h),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEEF2FF),
                      borderRadius: BorderRadius.circular(4.r),
                    ),
                    child: Text(
                      subData['total'].toInt().toString(),
                      style: TextStyle(
                          fontWeight: FontWeight.w900,
                          color: _getGradeColor(subData['total'], _milestoneTotalMarks),
                          fontSize: 11.sp),
                    ),
                  ),
                ],
              ));
            }),
            DataCell(Container(
              padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
              decoration: BoxDecoration(
                color: _getGradeColor(student['displayTotal'], _grandTotalMarks),
                borderRadius: BorderRadius.circular(8.r),
              ),
              child: Text(
                student['displayTotal'].toInt().toString(),
                style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w900),
              ),
            )),
          ],
        );
      }),
    );
  }
}

