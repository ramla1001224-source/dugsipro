import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:dio/dio.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../config/api_config.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});
  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  final ApiService _api = ApiService();
  final AuthService _auth = AuthService();
  String? _userRole;
  String? _studentClassId;
  List<dynamic> _classes = [];
  List<dynamic> _sections = [];
  List<dynamic> _students = [];
  String? _selectedClassId;
  String? _selectedSectionId;
  DateTime _selectedDate = DateTime.now();
  String _selectedSession = 'Break 1';
  String _selectedShift = 'morning';
  String _attendanceMode = 'Daily'; // 'Daily' or 'History'
  bool _loading = false;
  String? _error;
  Map<String, String> _attendance = {};
  bool _saving = false;
  bool _saved = false;

  bool _canEditPast = false;
  bool _canViewContact = false;

  @override
  void initState() {
    super.initState();
    _loadInitial();
  }

  Future<void> _loadInitial() async {
    setState(() => _loading = true);
    try {
      _userRole = await _auth.getRole();
      
      if (_userRole == 'teacher') {
        _canEditPast = await _auth.hasPermission('perm_tea_edit_attendance');
        _canViewContact = await _auth.hasPermission('perm_tea_view_parent_contact');
        
        final res = await _api.get(ApiConfig.teacherStats);
        final stats = res.data as Map<String, dynamic>;
        _classes = stats['assignedClasses'] ?? [];
      } else {
        _canEditPast = true; // Admin/Owner
        _canViewContact = true;
        
        final res = await _api.get(ApiConfig.classes);
        _classes = res.data is List
            ? res.data
            : res.data['classes'] ?? res.data['data'] ?? [];
      }

      if (_userRole == 'student') {
        final enrollment = await _auth.getCurrentEnrollment();
        if (enrollment != null) {
          _studentClassId = enrollment['classId']?.toString();
          _selectedClassId = _studentClassId;
          _attendanceMode = 'History';
        } else {
          final profile = await _auth.getProfile();
          if (profile != null && (profile['student'] != null || profile['Student'] != null)) {
            final student = profile['student'] ?? profile['Student'];
            _studentClassId = student['classId']?.toString();
            _selectedClassId = _studentClassId;
            _attendanceMode = 'History';
          }
        }
      }

      if (mounted) {
        setState(() => _loading = false);
        if (_selectedClassId != null) {
           _loadSections(_selectedClassId!);
        }
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
            _error = 'Error loading config: ${e.toString()}';
          }
        });
      }
    }
  }

  Future<void> _loadSections(String classId) async {
    try {
      final res = await _api.get('${ApiConfig.sections}?classId=$classId');
      if (mounted) {
        setState(() {
          _sections = res.data is List ? res.data : (res.data['data'] ?? []);
          if (_selectedSectionId == null && _sections.isNotEmpty) {
             _selectedSectionId = _sections[0]['id']?.toString() ?? _sections[0]['sectionId']?.toString();
          }
          if (_selectedClassId != null && _selectedSectionId != null) {
            _loadStudents(_selectedClassId!, _selectedSectionId!);
          } else {
            _students = [];
          }
        });
      }
    } catch (_) {
      if (mounted) setState(() => _sections = []);
    }
  }

  Future<void> _loadStudents(String classId, String sectionId) async {
    setState(() {
      _loading = true;
      _attendance = {};
    });
    try {
      final dateStr = _selectedDate.toIso8601String().substring(0, 10);
      
      Map<String, dynamic> params = {
        'classId': classId,
        'date': dateStr,
        'session': _selectedSession,
        'shift': _selectedShift
      };
      if (sectionId.isNotEmpty) params['sectionId'] = sectionId;

      // Load existing attendance first
      final resA = await _api.get(ApiConfig.attendance, params: params);
      final existing = resA.data is List 
          ? resA.data 
          : (resA.data['data'] is List ? resA.data['data'] : []);

      Map<String, dynamic> studentParams = {'classId': classId};
      if (sectionId.isNotEmpty) studentParams['sectionId'] = sectionId;

      final resS = await _api.get(
        ApiConfig.students,
        params: studentParams,
      );
      final list = resS.data is List
          ? resS.data
          : resS.data['students'] ?? resS.data['data'] ?? [];

      Map<String, String> initialAttendance = {};
      for (final s in list) {
        final eid = s['id'].toString();
        final match = existing.firstWhere(
            (a) => a['studentId'].toString() == eid,
            orElse: () => null);
        initialAttendance[eid] = match != null
            ? match['status'].toString().toLowerCase()
            : 'present';
      }

      if (mounted) {
        setState(() {
          _students = list;
          _attendance = initialAttendance;
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
            _error = 'Error loading students: ${e.toString()}';
          }
        });
      }
    }
  }

  Future<void> _save() async {
    if (_selectedClassId == null) return;
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final now = DateTime.now();
      final diff = now.difference(_selectedDate).inHours;
      if (!_canEditPast && diff > 24) {
        messenger.showSnackBar(const SnackBar(
            content: Text('Ma bedeli kartid joogitaanka 24 saac kadib.'),
            backgroundColor: Colors.red));
        setState(() => _saving = false);
        return;
      }

      final dateStr = _selectedDate.toIso8601String().substring(0, 10);
      final records = _attendance.entries.map((e) {
        final studentId = e.key;
        final status = e.value;
        // Capitalize status for backend parity (e.g. 'present' -> 'Present')
        final capStatus = status.isEmpty 
            ? 'Present' 
            : '${status[0].toUpperCase()}${status.substring(1)}';
        
        // Find student to get their specific sectionId if available
        final student = _students.firstWhere(
          (s) => s['id'].toString() == studentId,
          orElse: () => null,
        );
        final sId = student?['sectionId']?.toString() ?? _selectedSectionId;

        return {
          'studentId': studentId,
          'status': capStatus,
          'sectionId': sId,
        };
      }).toList();

      await _api.post(
        ApiConfig.attendance,
        data: {
          'attendance': records,
          'date': dateStr,
          'classId': _selectedClassId,
          'sectionId': _selectedSectionId,
          'session': _selectedSession,
          'shift': _selectedShift
        },
      );
      if (mounted) {
        setState(() {
          _saved = true;
          _saving = false;
        });
      }
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) setState(() => _saved = false);
      });
    } catch (e) {
      if (mounted) setState(() => _saving = false);
      messenger.showSnackBar(
          const SnackBar(content: Text('Error saving attendance')));
    }
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'present':
        return const Color(0xFF10B981);
      case 'absent':
        return const Color(0xFFEF4444);
      case 'late':
        return const Color(0xFFF59E0B);
      default:
        return AppTheme.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        flexibleSpace: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                const Color(0xFF0F172A).withValues(alpha: 0.9),
                const Color(0xFF1E293B).withValues(alpha: 0.8),
              ],
            ),
          ),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          'Attendance',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w900,
            fontSize: 20.sp,
            letterSpacing: -0.5,
          ),
        ),
        actions: [
          if (_userRole != 'student')
            Padding(
              padding: const EdgeInsets.only(right: 8.0),
              child: _buildModeToggleSmall(),
            ),
        ],
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFF1F5F9), Colors.white],
          ),
        ),
        child: Column(
          children: [
            SizedBox(height: 100.h),
            _buildPremiumFilterCard(),
            if (_students.isNotEmpty && _attendanceMode == 'Daily')
              Padding(
                padding: const EdgeInsets.fromLTRB(28, 16, 28, 8),
                child: Row(
                  children: [
                    Text(
                      'STUDENTS (${_students.length})',
                      style: TextStyle(
                        fontSize: 10.sp,
                        fontWeight: FontWeight.w900,
                        color: AppTheme.textSecondary,
                        letterSpacing: 1.5,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      'STATUS',
                      style: TextStyle(
                        fontSize: 10.sp,
                        fontWeight: FontWeight.w900,
                        color: AppTheme.textSecondary,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: _attendanceMode == 'Daily'
                  ? _buildDailyView()
                  : _buildHistoryView(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildModeToggleSmall() {
    return Container(
      margin: EdgeInsets.symmetric(vertical: 10.h),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12.r),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _modeBtnSmall('MARK', 'Daily'),
          _modeBtnSmall('VIEW', 'History'),
        ],
      ),
    );
  }

  Widget _modeBtnSmall(String label, String mode) {
    final active = _attendanceMode == mode;
    return GestureDetector(
      onTap: () => setState(() => _attendanceMode = mode),
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
        decoration: BoxDecoration(
          color: active ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(10.r),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? const Color(0xFF0F172A) : Colors.white70,
            fontSize: 9.sp,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }

  Widget _buildPremiumFilterCard() {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 16),
      padding: EdgeInsets.all(20.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28.r),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 20.r,
            offset: const Offset(0, 10),
          ),
        ],
        border: Border.all(color: Colors.white.withValues(alpha: 0.5)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(flex: 3, child: _premiumClassDropdown()),
              SizedBox(width: 12.w),
              Expanded(flex: 2, child: _premiumSectionDropdown()),
            ],
          ),
          SizedBox(height: 16.h),
          _buildSessionShiftToggles(),
          SizedBox(height: 16.h),
          Row(
            children: [
              Expanded(child: _premiumDatePicker()),
              SizedBox(width: 12.w),
              _buildAttendanceActionIcon(
                icon: Icons.done_all_rounded,
                color: const Color(0xFF10B981),
                onTap: _students.isEmpty ? null : () {
                  setState(() {
                    for (var s in _students) {
                      _attendance[s['id'].toString()] = 'present';
                    }
                  });
                },
              ),
              SizedBox(width: 8.w),
              _buildSaveButton(),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSessionShiftToggles() {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _toggleGroup(
                label: 'SESSION',
                value: _selectedSession,
                options: ['Break 1', 'Break 2'],
                onChanged: (v) {
                  setState(() => _selectedSession = v);
                  if (_selectedClassId != null && _selectedSectionId != null) {
                    _loadStudents(_selectedClassId!, _selectedSectionId!);
                  }
                },
              ),
            ),
            SizedBox(width: 12.w),
            Expanded(
              child: _toggleGroup(
                label: 'SHIFT',
                value: _selectedShift,
                options: ['morning', 'afternoon', 'night'],
                onChanged: (v) {
                  setState(() => _selectedShift = v);
                  if (_selectedClassId != null && _selectedSectionId != null) {
                    _loadStudents(_selectedClassId!, _selectedSectionId!);
                  }
                },
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _toggleGroup({required String label, required String value, required List<String> options, required Function(String) onChanged}) {
    return Container(
      padding: EdgeInsets.all(4.w),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(14.r),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 10, top: 4, bottom: 4),
            child: Text(label, style: TextStyle(fontSize: 7.sp, fontWeight: FontWeight.w900, color: AppTheme.textSecondary, letterSpacing: 1)),
          ),
          Row(
            children: options.map((opt) {
              final active = value == opt;
              return Expanded(
                child: GestureDetector(
                  onTap: () => onChanged(opt),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: EdgeInsets.symmetric(vertical: 8.h),
                    decoration: BoxDecoration(
                      color: active ? Colors.white : Colors.transparent,
                      borderRadius: BorderRadius.circular(10.r),
                      boxShadow: active ? [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4.r)] : [],
                    ),
                    child: Center(
                      child: Text(
                        opt.toUpperCase(),
                        style: TextStyle(
                          fontSize: 9.sp,
                          fontWeight: FontWeight.w900,
                          color: active ? AppTheme.primary : AppTheme.textSecondary,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _premiumClassDropdown() {
    final uniqueClasses = <String, dynamic>{};
    for (var c in _classes) {
      final cid = c['classId']?.toString() ?? c['id']?.toString();
      if (cid != null && !uniqueClasses.containsKey(cid)) {
        uniqueClasses[cid] = c;
      }
    }

    return Container(
      padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 8.h),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16.r),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('CLASS', style: TextStyle(fontSize: 8.sp, fontWeight: FontWeight.w900, color: AppTheme.textSecondary, letterSpacing: 1)),
          DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              isExpanded: true,
              value: _selectedClassId,
              icon: const Icon(Icons.expand_more_rounded, size: 16, color: AppTheme.textPrimary),
              style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w900, color: AppTheme.textPrimary),
              items: uniqueClasses.values.map((c) {
                final cid = c['classId']?.toString() ?? c['id']?.toString();
                return DropdownMenuItem(
                  value: cid,
                  child: Text(c['class_name'] ?? c['name'] ?? 'Class'),
                );
              }).toList(),
              onChanged: (v) {
                setState(() {
                  _selectedClassId = v;
                  _selectedSectionId = null;
                  _students = [];
                });
                if (v != null) _loadSections(v);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _premiumSectionDropdown() {
    final sections = _sections;

    return Container(
      padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 8.h),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16.r),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('SECTION', style: TextStyle(fontSize: 8.sp, fontWeight: FontWeight.w900, color: AppTheme.textSecondary, letterSpacing: 1)),
          DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              isExpanded: true,
              value: _selectedSectionId,
              icon: const Icon(Icons.expand_more_rounded, size: 16, color: AppTheme.textPrimary),
              style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w900, color: AppTheme.textPrimary),
              items: sections.map((s) {
                final sid = s['sectionId']?.toString() ?? s['id']?.toString();
                return DropdownMenuItem(
                  value: sid,
                  child: Text(s['section_name'] ?? s['section'] ?? s['name'] ?? 'Sec'),
                );
              }).toList(),
              onChanged: (v) {
                setState(() => _selectedSectionId = v);
                if (_selectedClassId != null && v != null) {
                  _loadStudents(_selectedClassId!, v);
                }
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _premiumDatePicker() {
    final now = DateTime.now();
    return GestureDetector(
      onTap: () async {
        final d = await showDatePicker(
          context: context,
          initialDate: _selectedDate.year == now.year ? _selectedDate : now,
          firstDate: DateTime(now.year, 1, 1),
          lastDate: now,
        );
        if (d != null) {
          setState(() => _selectedDate = d);
          if (_selectedClassId != null && _selectedSectionId != null) {
             _loadStudents(_selectedClassId!, _selectedSectionId!);
          }
        }
      },
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(16.r),
        ),
        child: Row(
          children: [
            const Icon(Icons.calendar_today_rounded, size: 14, color: Colors.white70),
            SizedBox(width: 8.w),
            Text(
              '${_selectedDate.day}/${_selectedDate.month}/${_selectedDate.year}',
              style: TextStyle(color: Colors.white, fontSize: 13.sp, fontWeight: FontWeight.w900),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAttendanceActionIcon({required IconData icon, required Color color, required VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.all(12.w),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(16.r),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Icon(icon, color: color, size: 20),
      ),
    );
  }

  Widget _buildSaveButton() {
    final disabled = _students.isEmpty || _saving || (!_canEditPast && DateTime.now().difference(_selectedDate).inHours > 24);
    
    return Expanded(
      child: GestureDetector(
        onTap: disabled ? null : _save,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          padding: EdgeInsets.symmetric(vertical: 12.h),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: disabled 
                ? [const Color(0xFF94A3B8), const Color(0xFF64748B)]
                : [const Color(0xFF6366F1), const Color(0xFF4F46E5)],
            ),
            borderRadius: BorderRadius.circular(16.r),
            boxShadow: disabled ? [] : [
              BoxShadow(
                color: const Color(0xFF6366F1).withValues(alpha: 0.3),
                blurRadius: 12.r,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Center(
            child: _saving 
              ? SizedBox(width: 20.w, height: 20.h, child: const CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
              : Text(
                  _saved ? 'SAVED!' : 'SAVE',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13.sp, letterSpacing: 1),
                ),
          ),
        ),
      ),
    );
  }

  Widget _buildDailyView() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
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
                if (_selectedClassId != null && _selectedSectionId != null) {
                  _loadStudents(_selectedClassId!, _selectedSectionId!);
                } else {
                  _loadInitial();
                }
              },
              child: const Text('Try Again'),
            )
          ],
        ),
      );
    }
    if (_students.isEmpty) {
      return Center(
        child: Text('No students found.',
            style: TextStyle(
                color: AppTheme.textSecondary,
                fontWeight: FontWeight.bold,
                fontSize: 16.sp)),
      );
    }

    return ListView.builder(
      padding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 8.h),
      itemCount: _students.length,
      itemBuilder: (ctx, i) {
        final s = _students[i];
        final sid = s['id'].toString();
        final status = _attendance[sid] ?? 'present';
        final name = s['name'] ?? s['user']?['name'] ?? 'Unknown';
        final initials = name.substring(0, name.length >= 2 ? 2 : 1).toUpperCase();

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: EdgeInsets.all(16.w),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24.r),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 10.r,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: const Color(0xFFE2E8F0),
                child: Text(initials, style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w900, color: const Color(0xFF64748B))),
              ),
              SizedBox(width: 14.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14.sp, color: const Color(0xFF0F172A)),
                    ),
                    if (_canViewContact && s['phone'] != null)
                      Text(
                        s['phone'],
                        style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w700, color: const Color(0xFF6366F1).withValues(alpha: 0.8)),
                      ),
                  ],
                ),
              ),
              Row(
                children: ['present', 'absent', 'late'].map((st) {
                  final active = status == st;
                  final color = _statusColor(st);
                  return Padding(
                    padding: const EdgeInsets.only(left: 6),
                    child: GestureDetector(
                      onTap: () => setState(() => _attendance[sid] = st),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: 36.w,
                        height: 36.h,
                        decoration: BoxDecoration(
                          color: active ? color : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(12.r),
                        ),
                        child: Center(
                          child: Text(
                            st[0].toUpperCase(),
                            style: TextStyle(
                              fontSize: 12.sp,
                              fontWeight: FontWeight.w900,
                              color: active ? Colors.white : const Color(0xFF94A3B8),
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildHistoryView() {
    return _HistoryView(
      classId: _selectedClassId,
      classes: _classes,
      api: _api,
    );
  }
}

class _HistoryView extends StatefulWidget {
  final String? classId;
  final List<dynamic> classes;
  final dynamic api;

  const _HistoryView({
    required this.classId,
    required this.classes,
    required this.api,
  });

  @override
  State<_HistoryView> createState() => _HistoryViewState();
}

class _HistoryViewState extends State<_HistoryView> {
  String? _selectedClassId;
  String? _selectedSectionId;
  int _month = DateTime.now().month;
  final int _year = DateTime.now().year;
  List<dynamic> _summary = [];
  bool _loading = false;
  List<dynamic> _academicYears = [];
  String? _selectedAcademicYearId;

  @override
  void initState() {
    super.initState();
    _selectedClassId = widget.classId;
    _fetchAcademicYears();
    if (_selectedClassId != null) _load();
  }

  Future<void> _fetchAcademicYears() async {
    try {
      final res = await widget.api.get(ApiConfig.academicYears);
      if (mounted) {
        setState(() {
          _academicYears = res.data is List ? res.data : (res.data['data'] ?? []);
          final current = _academicYears.firstWhere((y) => y['isCurrent'] == true, orElse: () => null);
          if (current != null) _selectedAcademicYearId = current['id']?.toString();
        });
      }
    } catch (_) {}
  }

  Future<void> _load() async {
    if (_selectedClassId == null) return;
    setState(() => _loading = true);
    try {
      String query = 'classId=$_selectedClassId';
      if (_selectedAcademicYearId != null) {
        query += '&academicYearId=$_selectedAcademicYearId';
      } else {
        query += '&month=$_month&year=$_year';
      }
      
      if (_selectedSectionId != null && _selectedSectionId!.isNotEmpty) {
        query += '&sectionId=$_selectedSectionId';
      }
      
      final res = await widget.api.get('/api/attendance/monthly-register?$query');
      final data = res.data;
      final students = data is Map ? (data['students'] ?? []) : [];
      final records = data is Map ? (data['attendanceRecords'] ?? []) : [];

      final Map<String, Map<String, dynamic>> summary = {};
      for (final s in students) {
        summary[s['id'].toString()] = {
          'name': s['user']?['name'] ?? 'Unknown',
          'present': 0,
          'absent': 0,
          'late': 0,
        };
      }
      for (final r in records) {
        final sid = r['studentId'].toString();
        if (summary.containsKey(sid)) {
          final status = (r['status'] ?? '').toString().toLowerCase();
          if (status == 'present') {
            summary[sid]!['present'] = (summary[sid]!['present'] ?? 0) + 1;
          } else if (status == 'absent') {
            summary[sid]!['absent'] = (summary[sid]!['absent'] ?? 0) + 1;
          } else if (status == 'late') {
            summary[sid]!['late'] = (summary[sid]!['late'] ?? 0) + 1;
          }
        }
      }

      if (mounted) {
        setState(() {
          _summary = summary.values.toList();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  static const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: EdgeInsets.all(16.w),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: EdgeInsets.all(18.w),
            decoration: BoxDecoration(
              color: const Color(0xFFF59E0B).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(16.r),
              border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline_rounded, color: Color(0xFFD97706), size: 20),
                SizedBox(width: 12.w),
                Expanded(
                  child: Text(
                    'Xogta imaanshaha sanadaha hore waa la kaydiyaa (archived). Kaliya sanadka hadda socda ayaa la heli karaa.',
                    style: TextStyle(
                      color: const Color(0xFF92400E),
                      fontSize: 10.sp,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: 16.h),
          Container(
            padding: EdgeInsets.all(12.w),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12.r),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              children: [
                DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    isExpanded: true,
                    value: _selectedClassId,
                    hint: Text('Select Class', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.bold)),
                    items: widget.classes.map<DropdownMenuItem<String>>((c) {
                      final cid = c['classId']?.toString() ?? c['id']?.toString();
                      return DropdownMenuItem(
                        value: cid,
                        child: Text(c['class_name'] ?? c['name'] ?? 'Class', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.bold)),
                      );
                    }).toList(),
                    onChanged: (v) {
                      setState(() {
                        _selectedClassId = v;
                        _selectedSectionId = null;
                      });
                      _load();
                    },
                  ),
                ),
                Divider(height: 16.h),
                DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    isExpanded: true,
                    value: _selectedAcademicYearId,
                    disabledHint: Text(
                      '${_academicYears.firstWhere((y) => y['id']?.toString() == _selectedAcademicYearId, orElse: () => {'name': 'Current Year'})['name'] ?? 'Current Year'} (Current)',
                      style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.bold, color: Colors.grey),
                    ),
                    hint: Text('Filter by Academic Year', style: TextStyle(fontSize: 12.sp)),
                    items: null,
                    onChanged: null,
                  ),
                ),
                if (_selectedAcademicYearId == null) ...[
                  Divider(height: 16.h),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<int>(
                            isExpanded: true,
                            value: _month,
                            items: List.generate(12, (i) => DropdownMenuItem(value: i + 1, child: Text(_months[i], style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.bold)))),
                            onChanged: (v) {
                              if (v != null) setState(() => _month = v);
                              _load();
                            },
                          ),
                        ),
                      ),
                      SizedBox(width: 12.w),
                      Expanded(
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<int>(
                            isExpanded: true,
                            value: _year,
                            disabledHint: Text(_year.toString(), style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.bold, color: Colors.grey)),
                            items: null,
                            onChanged: null,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          SizedBox(height: 16.h),
          if (_loading) const Center(child: CircularProgressIndicator())
          else if (_summary.isEmpty) const Center(child: Text('No data found for this period.'))
          else ...[
            Padding(
              padding: const EdgeInsets.only(bottom: 12, left: 4),
              child: Text(
                'REPORT FOR: ${_months[_month - 1].toUpperCase()} $_year',
                style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: AppTheme.textSecondary, letterSpacing: 1),
              ),
            ),
            ..._summary.map((s) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: EdgeInsets.all(12.w),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12.r), border: Border.all(color: const Color(0xFFE2E8F0))),
              child: Row(
                children: [
                  Expanded(child: Text(s['name'], style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.sp))),
                  _stat('P', s['present'], const Color(0xFF10B981)),
                  _stat('A', s['absent'], const Color(0xFFEF4444)),
                  _stat('L', s['late'], const Color(0xFFF59E0B)),
                ],
              ),
            )),
          ],
        ],
      ),
    );
  }

  Widget _stat(String label, int val, Color color) {
    return Container(
      margin: const EdgeInsets.only(left: 8),
      padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6.r)),
      child: Text('$label: $val', style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 10.sp)),
    );
  }
}

