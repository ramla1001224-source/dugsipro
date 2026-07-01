import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../config/api_config.dart';

class TimetableScreen extends StatefulWidget {
  const TimetableScreen({super.key});
  @override
  State<TimetableScreen> createState() => _TimetableScreenState();
}

class _TimetableScreenState extends State<TimetableScreen> {
  final ApiService _api = ApiService();
  final List<String> _days = [
    'Saturday',
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday'
  ];

  List<dynamic> _classes = [];
  List<dynamic> _sections = [];
  List<dynamic> _subjects = [];
  List<dynamic> _teachers = [];
  List<dynamic> _entries = [];
  String? _selectedClassId;
  String? _selectedSectionId;
  String _selectedShift = 'morning';
  String? _role;
  bool _loadingInitial = true;
  bool _loadingTimetable = false;
  final AuthService _auth = AuthService();

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    try {
      final role = await _auth.getRole();
      final profile = await _auth.getProfile();

      if (mounted) {
        setState(() {
          _role = role;
        });
      }

      if (role == 'student') {
        final enrollment = await _auth.getCurrentEnrollment();
        if (enrollment != null) {
          _selectedClassId = enrollment['classId']?.toString();
          _selectedSectionId = enrollment['sectionId']?.toString();
          if (_selectedSectionId != null) {
            await _loadTimetable();
          }
        } else if (profile != null) {
          final student = profile['student'] ?? profile['Student'];
          if (student != null) {
            _selectedClassId = student['classId']?.toString();
            _selectedSectionId = student['sectionId']?.toString();
            if (_selectedSectionId != null) {
              await _loadTimetable();
            }
          }
        }
      } else {
        final resC = await _api.get(ApiConfig.classes);
        final resS = await _api.get(ApiConfig.subjects);
        final resT = await _api.get(ApiConfig.teachers);

        if (mounted) {
          setState(() {
            final cData = resC.data;
            _classes = cData is List ? cData : (cData['classes'] ?? cData['data'] ?? []);
            
            // For teachers, we load their full schedule by default
            if (role == 'teacher') {
              _loadTimetable();
            } else if (_classes.isNotEmpty) {
              // For others (admins), we default to the first class/section
              if (_selectedClassId == null) {
                _selectedClassId = _classes[0]['id'].toString();
                _sections = _classes[0]['Sections'] ?? [];
                if (_sections.isNotEmpty) {
                  _selectedSectionId = _sections[0]['id'].toString();
                  _loadTimetable();
                }
              }
            }

            final sData = resS.data;
            _subjects = sData is List ? sData : (sData['subjects'] ?? sData['data'] ?? []);

            final tData = resT.data;
            _teachers = tData is List ? tData : (tData['teachers'] ?? tData['staff'] ?? tData['data'] ?? []);
          });
        }
      }

      if (mounted) setState(() => _loadingInitial = false);
    } catch (_) {
      if (mounted) setState(() => _loadingInitial = false);
    }
  }

  Future<void> _loadTimetable() async {
    // If no section and not a teacher, we can't load
    if (_selectedSectionId == null && _role != 'teacher') return;
    
    setState(() => _loadingTimetable = true);
    try {
      String url = '${ApiConfig.timetable}?shift=$_selectedShift';
      if (_selectedSectionId != null) {
        url += '&sectionId=$_selectedSectionId';
      }
      
      final res = await _api.get(url);
      final data = res.data;
      if (mounted) {
        setState(() {
          _entries = data is List ? data : (data['data'] ?? []);
          _loadingTimetable = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingTimetable = false);
    }
  }

  Future<void> _showAddPeriodDialog() async {
    if (_selectedClassId == null) return;
    String? selectedSubjectId;
    String? selectedTeacherId;
    final startCtrl = TextEditingController();
    final endCtrl = TextEditingController();
    final roomCtrl = TextEditingController();
    String day = _days[0];
    String formShift = _selectedShift;

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Add Period'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: day,
                  decoration: InputDecoration(labelText: 'Day'),
                  items: _days
                      .map((d) => DropdownMenuItem(value: d, child: Text(d)))
                      .toList(),
                  onChanged: (v) {
                    if (v != null) setDialogState(() => day = v);
                  },
                ),
                DropdownButtonFormField<String>(
                  initialValue: selectedSubjectId,
                  decoration: InputDecoration(labelText: 'Subject'),
                  items: _subjects
                      .map((s) => DropdownMenuItem(
                          value: s['id'].toString(),
                          child: Text(s['name'].toString())))
                      .toList(),
                  onChanged: (v) {
                    setDialogState(() => selectedSubjectId = v);
                  },
                ),
                DropdownButtonFormField<String>(
                  initialValue: selectedTeacherId,
                  decoration: InputDecoration(labelText: 'Teacher'),
                  items: _teachers
                      .map((t) => DropdownMenuItem(
                          value: t['id'].toString(),
                          child: Text(
                              (t['user']?['name'] ?? t['name'] ?? 'Teacher')
                                  .toString())))
                      .toList(),
                  onChanged: (v) {
                    setDialogState(() => selectedTeacherId = v);
                  },
                ),
                TextField(
                    controller: startCtrl,
                    decoration: InputDecoration(
                        labelText: 'Start Time (e.g. 08:00 AM)')),
                TextField(
                    controller: endCtrl,
                    decoration: InputDecoration(
                        labelText: 'End Time (e.g. 09:00 AM)')),
                TextField(
                    controller: roomCtrl,
                    decoration: InputDecoration(labelText: 'Room')),
                DropdownButtonFormField<String>(
                  initialValue: formShift,
                  decoration: InputDecoration(labelText: 'Shift'),
                  items: ['morning', 'afternoon', 'night']
                      .map((s) => DropdownMenuItem(value: s, child: Text(s.toUpperCase())))
                      .toList(),
                  onChanged: (v) {
                    if (v != null) setDialogState(() => formShift = v);
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('CANCEL')),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('ADD'),
            ),
          ],
        ),
      ),
    );

    if (ok == true && selectedSubjectId != null && selectedTeacherId != null) {
      setState(() => _loadingTimetable = true);
      try {
        await _api.post(ApiConfig.timetable, data: {
          'sectionId': _selectedSectionId,
          'day': day,
          'subjectId': selectedSubjectId,
          'teacherId': selectedTeacherId,
          'startTime': startCtrl.text.trim(),
          'endTime': endCtrl.text.trim(),
          'room': roomCtrl.text.trim(),
          'shift': formShift,
        });
        _loadTimetable();
      } catch (e) {
        if (mounted) {
          setState(() => _loadingTimetable = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
                content: Text('Error: ${e.toString()}'),
                backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  Future<void> _deletePeriod(String id) async {
    final bool? confirm = await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Delete'),
        content: const Text('Are you sure you want to delete this period?'),
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

    if (confirm == true) {
      setState(() => _loadingTimetable = true);
      try {
        await _api.delete('${ApiConfig.timetable}/$id');
        _loadTimetable();
      } catch (e) {
        if (mounted) {
          setState(() => _loadingTimetable = false);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Error deleting period')),
          );
        }
      }
    }
  }

  Map<String, List<dynamic>> _getGrouped() {
    final map = <String, List<dynamic>>{};
    for (final day in _days) {
      final dayEntries = _entries.where((e) => e['day'] == day).toList();
      dayEntries.sort((a, b) => (a['startTime'] ?? '')
          .toString()
          .compareTo((b['startTime'] ?? '').toString()));
      map[day] = dayEntries;
    }
    return map;
  }

  @override
  Widget build(BuildContext context) {
    if (_loadingInitial) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final bool isStudent = _role == 'student';
    final bool isTeacher = _role == 'teacher';
    final grouped = _getGrouped();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
        title: Text(
          'Weekly Timetable',
          style: TextStyle(
            color: AppTheme.textPrimary,
            fontWeight: FontWeight.w900,
            fontSize: 18.sp,
          ),
        ),
      ),
      body: Column(
        children: [
          Container(
            padding: EdgeInsets.all(16.w),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Schedule Manager',
                          style: TextStyle(
                            fontSize: 22.sp,
                            fontWeight: FontWeight.w900,
                            color: AppTheme.textPrimary,
                            letterSpacing: -0.5,
                          ),
                        ),
                        SizedBox(height: 4.h),
                        Text(
                          'Organize and view class sessions',
                          style: TextStyle(
                              fontSize: 13.sp, color: AppTheme.textSecondary),
                        ),
                      ],
                    ),
                    if (!isStudent && !isTeacher)
                      GestureDetector(
                        onTap: _showAddPeriodDialog,
                        child: Container(
                          padding: EdgeInsets.symmetric(
                              horizontal: 16.w, vertical: 8.h),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A),
                            borderRadius: BorderRadius.circular(12.r),
                            boxShadow: [
                              BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.1),
                                  blurRadius: 10.r,
                                  offset: const Offset(0, 4))
                            ],
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.add_rounded,
                                  color: Colors.white, size: 16),
                              SizedBox(width: 4.w),
                              Text(
                                'PERIOD',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 10.sp,
                                    letterSpacing: 0.5),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
                if (!isStudent && !isTeacher) ...[
                  SizedBox(height: 20.h),
                  // Class & Section Selector
                  Row(
                    children: [
                      Expanded(
                        child: _buildFilterBox(
                          label: 'GRADE',
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              isExpanded: true,
                              value: _selectedClassId,
                              hint: Text('Grade', style: TextStyle(fontSize: 11.sp)),
                              icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 16),
                              items: _classes.map<DropdownMenuItem<String>>((c) {
                                return DropdownMenuItem<String>(
                                  value: c['id'].toString(),
                                  child: Text((c['class_name'] ?? '').toString().toUpperCase(), 
                                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11.sp)),
                                );
                              }).toList(),
                              onChanged: (val) {
                                if (val != null) {
                                  setState(() {
                                    _selectedClassId = val;
                                    final cls = _classes.firstWhere((c) => c['id'].toString() == val);
                                    _sections = cls['Sections'] ?? [];
                                    _selectedSectionId = _sections.isNotEmpty ? _sections[0]['id'].toString() : null;
                                  });
                                  if (_selectedSectionId != null) _loadTimetable();
                                }
                              },
                            ),
                          ),
                        ),
                      ),
                      SizedBox(width: 8.w),
                      Expanded(
                        child: _buildFilterBox(
                          label: 'SECTION',
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              isExpanded: true,
                              value: _selectedSectionId,
                              hint: Text('Section', style: TextStyle(fontSize: 11.sp)),
                              icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 16),
                              items: _sections.map<DropdownMenuItem<String>>((s) {
                                return DropdownMenuItem<String>(
                                  value: s['id'].toString(),
                                  child: Text((s['name'] ?? 'General').toString().toUpperCase(), 
                                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11.sp)),
                                );
                              }).toList(),
                              onChanged: (val) {
                                if (val != null) {
                                  setState(() => _selectedSectionId = val);
                                  _loadTimetable();
                                }
                              },
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 12.h),
                  // Shift Toggle
                  Container(
                    padding: EdgeInsets.all(4.w),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(12.r),
                    ),
                    child: Row(
                      children: [
                        _buildShiftTab('morning', 'ðŸŒ… SUBAX'),
                        _buildShiftTab('afternoon', 'ðŸŒ‡ GALAB'),
                        _buildShiftTab('night', 'ðŸŒ™ HABEEN'),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          Expanded(
            child: _loadingTimetable
                ? const Center(child: CircularProgressIndicator())
                : (_selectedSectionId == null && _role != 'teacher')
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.calendar_month_rounded, size: 48, color: Color(0xFFE2E8F0)),
                            SizedBox(height: 16.h),
                            Text(
                              'Ma jiro jadwal la helay',
                              style: TextStyle(
                                  color: AppTheme.textSecondary,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 13.sp),
                            ),
                            SizedBox(height: 8.h),
                            Text(
                              'Dooro fasal si aad u aragto jadwalka',
                              style: TextStyle(
                                  color: AppTheme.textSecondary, fontSize: 11.sp),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: EdgeInsets.all(16.w),
                        itemCount: _days.length,
                        itemBuilder: (ctx, idx) {
                          final day = _days[idx];
                          final dayEntries = grouped[day] ?? [];

                          return Container(
                            margin: const EdgeInsets.only(bottom: 24),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20.r),
                              border:
                                  Border.all(color: const Color(0xFFF1F5F9)),
                              boxShadow: [
                                BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.02),
                                    blurRadius: 15.r,
                                    offset: const Offset(0, 8))
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                // Day Header
                                Container(
                                  padding: EdgeInsets.symmetric(
                                      horizontal: 20.w, vertical: 14.h),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF8FAFC),
                                    borderRadius: BorderRadius.only(
                                        topLeft: Radius.circular(20.r),
                                        topRight: Radius.circular(20.r)),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.calendar_today_rounded,
                                          size: 14, color: Color(0xFF64748B)),
                                      SizedBox(width: 8.w),
                                      Text(
                                        day.toUpperCase(),
                                        style: TextStyle(
                                          fontSize: 11.sp,
                                          fontWeight: FontWeight.w900,
                                          color: const Color(0xFF64748B),
                                          letterSpacing: 1.5,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),

                                if (dayEntries.isEmpty)
                                  Padding(
                                    padding: EdgeInsets.all(30.w),
                                    child: Center(
                                      child: Text(
                                        'Ma jiro jadwal maalintan ah',
                                        style: TextStyle(
                                            color: const Color(0xFFCBD5E1),
                                            fontSize: 12.sp,
                                            fontWeight: FontWeight.w600),
                                      ),
                                    ),
                                  )
                                else
                                  ...dayEntries.asMap().entries.map((entry) {
                                    final i = entry.key;
                                    final e = entry.value;
                                    final isLast = i == dayEntries.length - 1;

                                    final start = e['startTime'] ?? '';
                                    final end = e['endTime'] ?? '';
                                    final subject =
                                        e['subject']?['name'] ?? 'Subject';
                                    final teacher = e['teacher']?['user']
                                            ?['name'] ??
                                        'Staff';
                                    final room = e['room'] ?? '-';

                                    return Container(
                                      decoration: BoxDecoration(
                                        border: Border(
                                            bottom: BorderSide(
                                                color: const Color(0xFFF1F5F9),
                                                width: isLast ? 0 : 1)),
                                      ),
                                      child: Padding(
                                        padding: EdgeInsets.symmetric(
                                            horizontal: 16.w, vertical: 14.h),
                                        child: Row(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.center,
                                          children: [
                                            // Time column — fixed width
                                            SizedBox(
                                              width: 48.w,
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(start,
                                                      style: TextStyle(
                                                          fontWeight:
                                                              FontWeight.w900,
                                                          fontSize: 13.sp,
                                                          color: AppTheme
                                                              .textPrimary)),
                                                  Text(end,
                                                      style: TextStyle(
                                                          fontWeight:
                                                              FontWeight.w600,
                                                          fontSize: 10.sp,
                                                          color: AppTheme
                                                              .textSecondary)),
                                                ],
                                              ),
                                            ),
                                            // Vertical divider
                                            Container(
                                                width: 2.w,
                                                height: 44.h,
                                                margin: EdgeInsets.symmetric(
                                                    horizontal: 12.w),
                                                decoration: BoxDecoration(
                                                    color:
                                                        const Color(0xFFE2E8F0),
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                            2.r))),
                                            // Subject details — takes remaining space
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  // Subject name — single line with ellipsis
                                                  Text(
                                                    subject,
                                                    maxLines: 1,
                                                    overflow:
                                                        TextOverflow.ellipsis,
                                                    style: TextStyle(
                                                        fontWeight:
                                                            FontWeight.w900,
                                                        fontSize: 14.sp,
                                                        color: AppTheme
                                                            .textPrimary,
                                                        letterSpacing: -0.3),
                                                  ),
                                                  SizedBox(height: 4.h),
                                                  // Grade chip (if available)
                                                  if (e['section'] != null)
                                                    Container(
                                                      margin: EdgeInsets.only(
                                                          bottom: 4.h),
                                                      padding:
                                                          EdgeInsets.symmetric(
                                                              horizontal: 6.w,
                                                              vertical: 2.h),
                                                      decoration: BoxDecoration(
                                                        color: AppTheme.primary
                                                            .withValues(
                                                                alpha: 0.08),
                                                        borderRadius:
                                                            BorderRadius
                                                                .circular(6.r),
                                                      ),
                                                      child: Text(
                                                        '${e['section']['class']?['class_name'] ?? ''} · ${(e['section']['name'] ?? '').toUpperCase()}',
                                                        style: TextStyle(
                                                          fontSize: 9.sp,
                                                          fontWeight:
                                                              FontWeight.w900,
                                                          color: AppTheme
                                                              .primary,
                                                          letterSpacing: 0.3,
                                                        ),
                                                      ),
                                                    ),
                                                  // Teacher · Room · Shift — all truncated safely
                                                  Row(
                                                    children: [
                                                      const Icon(
                                                          Icons
                                                              .person_outline_rounded,
                                                          size: 11,
                                                          color: Color(
                                                              0xFF94A3B8)),
                                                      SizedBox(width: 3.w),
                                                      Flexible(
                                                        child: Text(
                                                          teacher,
                                                          maxLines: 1,
                                                          overflow: TextOverflow
                                                              .ellipsis,
                                                          style: TextStyle(
                                                              fontWeight:
                                                                  FontWeight
                                                                      .w600,
                                                              fontSize: 10.sp,
                                                              color: AppTheme
                                                                  .textSecondary),
                                                        ),
                                                      ),
                                                      if (room != '-') ...[
                                                        SizedBox(width: 8.w),
                                                        const Icon(
                                                            Icons.room_outlined,
                                                            size: 11,
                                                            color: Color(
                                                                0xFF94A3B8)),
                                                        SizedBox(width: 3.w),
                                                        Text(room,
                                                            style: TextStyle(
                                                                fontWeight:
                                                                    FontWeight
                                                                        .w600,
                                                                fontSize: 10.sp,
                                                                color: AppTheme
                                                                    .textSecondary)),
                                                      ],
                                                      SizedBox(width: 8.w),
                                                      Container(
                                                        padding: EdgeInsets
                                                            .symmetric(
                                                                horizontal: 5.w,
                                                                vertical: 2.h),
                                                        decoration: BoxDecoration(
                                                          color: const Color(
                                                              0xFF3B82F6),
                                                          borderRadius:
                                                              BorderRadius
                                                                  .circular(
                                                                      4.r),
                                                        ),
                                                        child: Text(
                                                          (e['shift'] ?? '')
                                                              .toString()
                                                              .toUpperCase(),
                                                          style: TextStyle(
                                                              fontWeight:
                                                                  FontWeight
                                                                      .w900,
                                                              fontSize: 8.sp,
                                                              color:
                                                                  Colors.white,
                                                              letterSpacing:
                                                                  0.3),
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ],
                                              ),
                                            ),
                                            // Delete button (admin only)
                                            if (!isStudent && !isTeacher)
                                              IconButton(
                                                padding: EdgeInsets.zero,
                                                constraints:
                                                    const BoxConstraints(),
                                                icon: const Icon(
                                                    Icons
                                                        .delete_outline_rounded,
                                                    size: 18,
                                                    color: Color(0xFFEF4444)),
                                                onPressed: () => _deletePeriod(
                                                    e['id'].toString()),
                                              ),
                                          ],
                                        ),
                                      ),
                                    );
                                  }),
                              ],
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildShiftTab(String value, String label) {
    final active = _selectedShift == value;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() => _selectedShift = value);
          _loadTimetable();
        },
        child: Container(
          padding: EdgeInsets.symmetric(vertical: 10.h),
          decoration: BoxDecoration(
            color: active ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(10.r),
            boxShadow: active
                ? [
                    BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 4.r,
                        offset: const Offset(0, 2))
                  ]
                : null,
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 11.sp,
                fontWeight: FontWeight.w900,
                color: active ? const Color(0xFF0F172A) : const Color(0xFF64748B),
                letterSpacing: 0.5,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFilterBox({required String label, required Widget child}) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 8.h),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12.r),
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
                  letterSpacing: 1)),
          SizedBox(height: 2.h),
          child,
        ],
      ),
    );
  }
}


