import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../config/api_config.dart';

class MarksScreen extends StatefulWidget {
  final String? examId;
  final String? classId;
  final String? sectionId;
  const MarksScreen({super.key, this.examId, this.classId, this.sectionId});
  @override
  State<MarksScreen> createState() => _MarksScreenState();
}

class _MarksScreenState extends State<MarksScreen> {
  final ApiService _api = ApiService();
  final AuthService _auth = AuthService();
  List<dynamic> _exams = [];
  List<dynamic> _classes = [];
  List<dynamic> _subjects = [];
  List<dynamic> _marks = [];
  List<String> _uniqueExamNames = [];
  String? _selectedExamId;
  String? _selectedExamName;
  String? _selectedYearId;
  List<dynamic> _academicYears = [];
  String? _selectedClassId;
  String? _selectedSectionId;
  String? _selectedSubjectId;
  String? _userRole;
  List<String> _teacherSubjectIds = [];
  List<String> _teacherClassIds = [];

  bool _loadingInitial = true;
  bool _loadingMarks = false;
  bool _saving = false;
  bool _isReadOnly = false;
  
  @override
  void initState() {
    super.initState();
    _loadInitial();
  }

  Future<void> _loadInitial() async {
    try {
      final resE = await _api.get(ApiConfig.exams);
      final resC = await _api.get(ApiConfig.classes);
      final resS = await _api.get(ApiConfig.subjects);
      final resY = await _api.get(ApiConfig.academicYears, params: {'onlyCurrent': 'true'});
      _userRole = await _auth.getRole();
      final profile = await _auth.getProfile();

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
      }

      if (mounted) {
        setState(() {
          final allExams = resE.data is List
              ? resE.data
              : (resE.data['exams'] ?? resE.data['data'] ?? []);
          final allClasses = resC.data is List
              ? resC.data
              : (resC.data['classes'] ?? resC.data['data'] ?? []);
          final allSubjects = resS.data is List
              ? resS.data
              : (resS.data['subjects'] ?? resS.data['data'] ?? []);
          final allYears = resY.data is List
              ? resY.data
              : (resY.data['years'] ?? resY.data['data'] ?? []);

          _subjects = allSubjects;
          _academicYears = allYears;

          if (_selectedYearId == null && allYears.isNotEmpty) {
            final current = allYears.firstWhere((y) => y['isCurrent'] == true,
                orElse: () => allYears.first);
            _selectedYearId = current['id'].toString();
          }

          // Filter by teacher assignments
          if (_userRole == 'teacher') {
            _exams = allExams
                .where((e) =>
                    _teacherSubjectIds.contains(e['subjectId'].toString()))
                .toList();
            _classes = allClasses
                .where((c) => _teacherClassIds.contains(c['id'].toString()))
                .toList();
            _isReadOnly = false;
          } else {
            _exams = allExams;
            _classes = allClasses;
            // Admin is now allowed to enter marks
            _isReadOnly = false;
          }

          _uniqueExamNames = _exams
              .where((e) =>
                  _selectedYearId == null ||
                  (e['term']?['academicYearId']?.toString() == _selectedYearId))
              .map((e) {
            String name = e['name']?.toString() ?? '';
            return name.contains(' - ') ? name.split(' - ')[0] : name;
          }).toSet().cast<String>().toList();

          if (widget.examId != null) {
            _selectedExamId = widget.examId;
            final ex = _exams.firstWhere((e) => e['id'].toString() == widget.examId, orElse: () => null);
            if (ex != null) {
              String name = ex['name']?.toString() ?? '';
              _selectedExamName = name.contains(' - ') ? name.split(' - ')[0] : name;
              _selectedSubjectId = ex['subjectId']?.toString();
            }
          }
          if (widget.classId != null) _selectedClassId = widget.classId;
          if (widget.sectionId != null) _selectedSectionId = widget.sectionId;

          _loadingInitial = false;
        });

        if (_selectedExamId != null && _selectedClassId != null) {
          _loadMarks();
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loadingInitial = false;
          if (e is DioException && 
              (e.type == DioExceptionType.connectionTimeout || 
               e.type == DioExceptionType.receiveTimeout || 
               e.type == DioExceptionType.sendTimeout ||
               e.type == DioExceptionType.connectionError ||
               e.type == DioExceptionType.unknown)) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Khadka Internet-ka ayaa kaa go\'an. Fadlan hubi.')),
            );
          }
        });
      }
    }
  }

  Future<void> _loadMarks() async {
    if (_selectedExamName == null || _selectedClassId == null || _selectedSubjectId == null) return;
    
    debugPrint('SEARCHING FOR: $_selectedExamName, $_selectedClassId, $_selectedSubjectId');
    // 1. Try exact match (Name + Subject + Class)
    var targetExam = _exams.firstWhere((e) {
      String baseName = (e['name']?.toString() ?? '').trim();
      baseName = baseName.contains(' - ') ? baseName.split(' - ')[0].trim() : baseName;
      bool nameMatch = baseName == _selectedExamName;
      bool classMatch = e['classId']?.toString() == _selectedClassId;
      bool subMatch = e['subjectId']?.toString() == _selectedSubjectId;
      if (nameMatch && subMatch) {
         debugPrint('NAME & SUB MATCH: ${e['name']} - classId: ${e['classId']}');
      }
      return nameMatch && classMatch && subMatch;
    }, orElse: () => null);

    // 2. Fallback: match Name + Subject but with ClassId being null (Global/Template exam)
    targetExam ??= _exams.firstWhere((e) {
      String baseName = (e['name']?.toString() ?? '').trim();
      baseName = baseName.contains(' - ') ? baseName.split(' - ')[0].trim() : baseName;
      return baseName == _selectedExamName &&
             e['classId'] == null &&
             e['subjectId']?.toString() == _selectedSubjectId;
    }, orElse: () => null);

    if (targetExam == null) {
       debugPrint('EXAM NOT FOUND IN _exams LIST. Count: ${_exams.length}');
       if (mounted) {
         setState(() {
           _marks = [];
           _selectedExamId = null;
           _loadingMarks = false;
         });
         // The UI will now show "Exam not found" instead of just a snackbar
       }
       return;
    }
    
    _selectedExamId = targetExam['id'].toString();
    _isReadOnly = targetExam['status'] == 'locked';
    setState(() => _loadingMarks = true);

    try {
      Map<String, dynamic> params = {'grading': 'true', 'classId': _selectedClassId};
      if (_selectedSectionId != null && _selectedSectionId!.isNotEmpty) {
        params['sectionId'] = _selectedSectionId;
      }
      final res = await _api.get('${ApiConfig.exams}/$_selectedExamId/results',
          params: params);
      if (mounted) {
        setState(() {
          _marks = res.data is List 
              ? res.data 
              : (res.data['data'] is List ? res.data['data'] : []);
          _loadingMarks = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loadingMarks = false);
        if (e is DioException && 
              (e.type == DioExceptionType.connectionTimeout || 
               e.type == DioExceptionType.receiveTimeout || 
               e.type == DioExceptionType.sendTimeout ||
               e.type == DioExceptionType.connectionError ||
               e.type == DioExceptionType.unknown)) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Khadka Internet-ka ayaa kaa go\'an. Fadlan hubi.')),
          );
        }
      }
    }
  }

  Future<void> _save() async {
    if (_selectedExamId == null || _marks.isEmpty || _isReadOnly) return;

    setState(() => _saving = true);
    try {
      final results = _marks
          .map((m) => {
                'studentId': m['studentId'],
                'marks': m['marks'],
                'remarks': m['remarks'],
                'classId': m['classId']?.toString(),
                'sectionId': m['sectionId']?.toString(),
              })
          .toList();

      await _api.post('${ApiConfig.exams}/$_selectedExamId/results',
          data: {'results': results});

      if (mounted) {
        // Actual save logic...
        await Future.delayed(const Duration(seconds: 1)); // Mock save
        setState(() {
          _saving = false;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Marks saved successfully!')),
          );
        }
      }
    } catch (e) {
      if (mounted) setState(() => _saving = false);
      if (mounted) {
        String msg = 'Error saving marks';
        if (e is DioException && 
              (e.type == DioExceptionType.connectionTimeout || 
               e.type == DioExceptionType.receiveTimeout || 
               e.type == DioExceptionType.sendTimeout ||
               e.type == DioExceptionType.connectionError ||
               e.type == DioExceptionType.unknown)) {
          msg = 'Khadka Internet-ka ayaa kaa go\'an. Fadlan hubi.';
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg)),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final selectedExam = _exams.firstWhere(
        (e) => e['id'].toString() == _selectedExamId,
        orElse: () => null);
    final totalMarks = selectedExam?['totalMarks'] ?? 20;
    final examName = (selectedExam?['name'] ?? 'EXAM').toString().toLowerCase();
    final subjectName = (selectedExam?['subject']?['name'] ?? 'Subject').toString();

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: SafeArea(
        child: Column(
          children: [
            _buildPremiumHeader(examName, subjectName),

            // Main Content Area
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(32.r),
                    topRight: Radius.circular(32.r),
                  ),
                ),
                child: _loadingInitial
                    ? const Center(child: CircularProgressIndicator())
                    : Column(
                        children: [
                          if (_marks.isNotEmpty) _buildInfoBar(totalMarks),
                          Expanded(
                            child: _loadingMarks
                                ? Center(
                                    child: Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        const CircularProgressIndicator(color: Color(0xFF4F46E5)),
                                        SizedBox(height: 16.h),
                                        Text(
                                          'RAADINAYAA NATIIJADA...',
                                          style: TextStyle(
                                            color: const Color(0xFF4F46E5).withValues(alpha: 0.6),
                                            fontSize: 10.sp,
                                            fontWeight: FontWeight.w900,
                                            letterSpacing: 2,
                                          ),
                                        ),
                                      ],
                                    ),
                                  )
                                : _marks.isEmpty
                                    ? _buildEmptyState()
                                    : ListView.builder(
                                        padding: EdgeInsets.fromLTRB(
                                            20, 10, 20, _isReadOnly ? 20 : 100),
                                        itemCount: _marks.length,
                                        itemBuilder: (ctx, i) =>
                                            _buildStudentCard(
                                                _marks[i], i, totalMarks),
                                      ),
                          ),
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
      bottomSheet: (!_isReadOnly && _marks.isNotEmpty) ? _buildStickyFooter() : null,
    );
  }

  Widget _buildPremiumHeader(String examName, String subjectName) {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 20),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(32.r),
          bottomRight: Radius.circular(32.r),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                decoration: BoxDecoration(
                  color: const Color(0xFF4F46E5),
                  borderRadius: BorderRadius.circular(10.r),
                ),
                child: Text(
                  'GRADING',
                  style: TextStyle(color: Colors.white, fontSize: 8.sp, fontWeight: FontWeight.w900),
                ),
              ),
              SizedBox(width: 10.w),
              Text(
                subjectName.toUpperCase(),
                style: TextStyle(color: const Color(0xFF64748B), fontSize: 8.sp, fontWeight: FontWeight.w900, letterSpacing: 1),
              ),
            ],
          ),
          SizedBox(height: 8.h),
          Text(
            examName,
            style: TextStyle(
              color: Colors.white,
              fontSize: 24.sp,
              fontStyle: FontStyle.italic,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }


  Widget _buildInfoBar(dynamic maxMarks) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 12, 20, 8),
      padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(20.r),
      ),
      child: Row(
        children: [
          const Icon(Icons.lightbulb_outline, color: Color(0xFFF59E0B), size: 16),
          SizedBox(width: 12.w),
          Expanded(
            child: Text(
              'Geli dhibcaha ardayda hoose.',
              style: TextStyle(color: const Color(0xFF64748B), fontSize: 10.sp, fontWeight: FontWeight.w600),
            ),
          ),
          Text(
            'MAX: $maxMarks',
            style: TextStyle(color: const Color(0xFF1E293B), fontSize: 14.sp, fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }


  Widget _buildStudentCard(dynamic m, int index, dynamic maxMarks) {
    final bool isEntering = (m['marks'] ?? '').toString().isNotEmpty;
    
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      margin: const EdgeInsets.only(bottom: 12),
      padding: EdgeInsets.all(16.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24.r),
        border: Border.all(
          color: isEntering ? const Color(0xFF4F46E5).withValues(alpha: 0.1) : Colors.transparent,
          width: 1.5.w,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32.w,
                height: 32.h,
                decoration: BoxDecoration(
                  color: isEntering ? const Color(0xFF4F46E5) : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(10.r),
                ),
                child: Center(
                  child: Text(
                    (index + 1).toString().padLeft(2, '0'),
                    style: TextStyle(
                      color: isEntering ? Colors.white : const Color(0xFF64748B),
                      fontSize: 11.sp,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      m['studentName'] ?? 'No Name',
                      style: TextStyle(color: const Color(0xFF1E293B), fontSize: 14.sp, fontWeight: FontWeight.w900),
                    ),
                    Text(
                      'ID: ${m['studentRegId'] ?? "-"}',
                      style: TextStyle(color: const Color(0xFF94A3B8), fontSize: 10.sp, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
              if (isEntering)
                const Icon(Icons.check_circle, color: Color(0xFF10B981), size: 16),
            ],
          ),
          SizedBox(height: 16.h),
          Row(
            children: [
              Expanded(
                flex: 2,
                child: Container(
                  height: 48.h,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(14.r),
                    border: Border.all(color: isEntering ? const Color(0xFF4F46E5) : const Color(0xFFE2E8F0), width: 1.5.w),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          initialValue: (m['marks'] ?? '').toString(),
                          textAlign: TextAlign.center,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          style: TextStyle(color: const Color(0xFF1E293B), fontSize: 18.sp, fontWeight: FontWeight.w900),
                          decoration: InputDecoration(border: InputBorder.none, hintText: '00', isDense: true, contentPadding: EdgeInsets.zero),
                          onChanged: _isReadOnly ? null : (v) => setState(() => m['marks'] = v),
                          readOnly: _isReadOnly,
                        ),
                      ),
                      Text('/$maxMarks ', style: TextStyle(color: const Color(0xFF94A3B8), fontSize: 11.sp, fontWeight: FontWeight.w900)),
                    ],
                  ),
                ),
              ),
              SizedBox(width: 10.w),
              Expanded(
                flex: 3,
                child: Container(
                  height: 48.h,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(14.r),
                    border: Border.all(color: const Color(0xFFF1F5F9)),
                  ),
                  child: TextFormField(
                    initialValue: (m['remarks'] ?? '').toString(),
                    style: TextStyle(color: const Color(0xFF64748B), fontSize: 11.sp, fontWeight: FontWeight.w600),
                    decoration: InputDecoration(border: InputBorder.none, hintText: 'Remarks...', contentPadding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 12.h)),
                    onChanged: _isReadOnly ? null : (v) => m['remarks'] = v,
                    readOnly: _isReadOnly,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );

  }


  Widget _buildStickyFooter() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.only(topLeft: Radius.circular(32.r), topRight: Radius.circular(32.r)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 20.r, offset: const Offset(0, -5))],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          TextButton(
            onPressed: () => context.pop(),
            child: Text('KA NOQO', style: TextStyle(color: const Color(0xFF94A3B8), fontSize: 10.sp, fontWeight: FontWeight.w900)),
          ),
          if (!_isReadOnly)
            ElevatedButton(
              onPressed: _saving ? null : _save,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4F46E5),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
                padding: EdgeInsets.symmetric(horizontal: 32.w, vertical: 16.h),
              ),
              child: Text(_saving ? 'KAYDINAYA...' : 'KAYDI', style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w900)),
            )
          else
            Container(
              padding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 12.h),
              decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(12.r), border: Border.all(color: Colors.red.shade100)),
              child: Row(
                children: [
                  Icon(Icons.lock_outline_rounded, color: Colors.red.shade700, size: 16),
                  SizedBox(width: 8.w),
                  Text('LOCKED (WAXBA LAMA BADALI KARO)', style: TextStyle(color: Colors.red.shade700, fontSize: 10.sp, fontWeight: FontWeight.w900)),
                ],
              ),
            ),

        ],
      ),
    );
  }



  Widget _buildEmptyState() {
    String title = 'SELECT OPTIONS ABOVE';
    String subtitle = 'Dooro imtixaanka, fasalka iyo maaddada.';
    IconData icon = Icons.edit_note_rounded;

    if (_selectedExamName != null && _selectedClassId != null && _selectedSubjectId != null) {
      final examExists = _exams.any((e) {
        String baseName = e['name']?.toString() ?? '';
        baseName = baseName.contains(' - ') ? baseName.split(' - ')[0] : baseName;
        return baseName == _selectedExamName && e['subjectId']?.toString() == _selectedSubjectId;
      });

      if (!examExists) {
        title = 'IMTIXAANKA LAMA HELIN';
        subtitle = 'Maaddadan looma samayn imtixaankan. Fadlan hubi.';
        icon = Icons.search_off_rounded;
      } else {
        title = 'ARDAY LAMA HELIN';
        subtitle = 'Fasalkan ama section-kan arday firfircoon ma leh.';
        icon = Icons.person_off_rounded;
      }
    }

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 80, color: const Color(0xFFE2E8F0)),
          SizedBox(height: 16.h),
          Text(
            title,
            style: TextStyle(
              color: const Color(0xFF94A3B8),
              fontSize: 12.sp,
              fontWeight: FontWeight.w900,
              letterSpacing: 2,
            ),
          ),
          SizedBox(height: 8.h),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 40.w),
            child: Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: const Color(0xFFCBD5E1),
                fontSize: 11.sp,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          if (_selectedExamName == null || _selectedClassId == null || _selectedSubjectId == null)
            _buildFilterCompact(),
        ],
      ),
    );
  }

  Widget _buildFilterCompact() {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: 40.w, vertical: 20.h),
      padding: EdgeInsets.all(20.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24.r),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        children: [
          DropdownButtonFormField<String>(
            initialValue: _selectedYearId,
            decoration: InputDecoration(
                labelText: 'ACADEMIC YEAR', border: InputBorder.none),
            items: _academicYears.map((y) {
              return DropdownMenuItem(
                value: y['id'].toString(),
                child: Text('${y['name']} - ${y['schoolName'] ?? ""} ${y['isCurrent'] == true ? "(Current)" : ""}'),
              );
            }).toList(),
            onChanged: (v) {
              setState(() {
                _selectedYearId = v;
                _selectedExamName = null;
                _selectedExamId = null;
                // Re-filter unique exam names for the new year
                _uniqueExamNames = _exams
                    .where((e) =>
                        e['term']?['academicYearId']?.toString() == _selectedYearId)
                    .map((e) {
                  String name = e['name']?.toString() ?? '';
                  return name.contains(' - ') ? name.split(' - ')[0] : name;
                }).toSet().cast<String>().toList();
              });
            },
          ),
          const Divider(),
          DropdownButtonFormField<String>(
            key: ValueKey('exam_$_selectedYearId'),
            initialValue: _selectedExamName,
            decoration: InputDecoration(
                labelText: 'EXAM', border: InputBorder.none),
            items: _uniqueExamNames.map((name) {
              return DropdownMenuItem(
                value: name,
                child: Text(name),
              );
            }).toList(),
            onChanged: (v) {
              setState(() => _selectedExamName = v);
              _loadMarks();
            },
          ),
          const Divider(),
          DropdownButtonFormField<String>(
            initialValue: _selectedClassId,
            decoration: InputDecoration(
                labelText: 'CLASS', border: InputBorder.none),
            items: () {
              final uniqueClassesMap = <String, Map<String, dynamic>>{};
              for (final c in _classes) {
                final id = c['classId']?.toString() ?? c['id']?.toString() ?? '';
                if (id.isNotEmpty && !uniqueClassesMap.containsKey(id)) {
                  uniqueClassesMap[id] = c;
                }
              }
              return uniqueClassesMap.values.map((c) {
                final id = c['classId']?.toString() ?? c['id']?.toString() ?? '';
                return DropdownMenuItem(
                  value: id,
                  child: Text(c['class_name'] ?? ''),
                );
              }).toList();
            }(),
            onChanged: (v) {
              setState(() {
                _selectedClassId = v;
                _selectedSectionId = null;
              });
              _loadMarks();
            },
          ),
          const Divider(),
          DropdownButtonFormField<String>(
            initialValue: _selectedSectionId,
            decoration: InputDecoration(
                labelText: 'SECTION', border: InputBorder.none),
            items: [
              DropdownMenuItem(value: null, child: Text('ALL')),
              ...(_selectedClassId == null
                      ? []
                      : ((_classes.firstWhere((c) => c['id'].toString() == _selectedClassId, orElse: () => {'Sections': []})['Sections'] ?? []) as List))
                  .map((s) => DropdownMenuItem(
                      value: s['id'].toString(),
                      child: Text(s['name'] ?? '')))
            ],
            onChanged: (v) {
              setState(() => _selectedSectionId = v);
              _loadMarks();
            },
          ),
          const Divider(),
          DropdownButtonFormField<String>(
            initialValue: _selectedSubjectId,
            decoration: InputDecoration(
                labelText: 'SUBJECT', border: InputBorder.none),
            items: _subjects.map((sub) {
              return DropdownMenuItem(
                value: sub['id'].toString(),
                child: Text(sub['name'] ?? ''),
              );
            }).toList(),
            onChanged: (v) {
              setState(() => _selectedSubjectId = v);
              _loadMarks();
            },
          ),
        ],
      ),
    );
  }
}

