import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../config/api_config.dart';
import '../../main.dart';
import 'package:intl/intl.dart';

class ExamScheduleScreen extends StatefulWidget {
  const ExamScheduleScreen({super.key});

  @override
  State<ExamScheduleScreen> createState() => _ExamScheduleScreenState();
}

class _ExamScheduleScreenState extends State<ExamScheduleScreen> {
  final ApiService _api = ApiService();
  final AuthService _auth = AuthService();
  
  List<dynamic> _exams = [];
  Map<String, List<dynamic>> _groupedExams = {};
  List<dynamic> _children = [];
  List<dynamic> _classes = [];
  Map<String, dynamic>? _selectedChild;
  String? _selectedClassId;
  bool _loading = true;
  bool _examsLoading = false;
  String? _userRole;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadInitial();
  }

  Future<void> _loadInitial() async {
    setState(() => _loading = true);
    try {
      _userRole = await _auth.getRole();
      
      if (_userRole == 'teacher' || _userRole == 'admin' || _userRole == 'super_admin') {
        final res = await _api.get('/api/classes');
        final data = res.data is List ? res.data : (res.data['data'] ?? []);
        
        // Deduplicate classes by id (backend returns Class objects with `id` not `classId`)
        final List<dynamic> unique = [];
        final Set<String> seen = {};
        for (var c in data) {
          final cid = c['id']?.toString();
          if (cid != null && !seen.contains(cid)) {
            seen.add(cid);
            unique.add(c);
          }
        }
        _classes = unique;
        await _loadExams();
      } else if (_userRole == 'parent') {
        final res = await _api.get('/api/parents/my-children');
        final data = res.data is List ? res.data : (res.data['data'] ?? []);
        _children = data;
        if (_children.isNotEmpty) {
          _selectedChild = _children[0];
          if (_selectedChild != null && _selectedChild!['classId'] != null) {
            await _loadExams(
                classId: _selectedChild!['classId'].toString(),
                sectionId: _selectedChild!['sectionId']?.toString());
          }
        }
      } else if (_userRole == 'student') {
        final enrollment = await _auth.getCurrentEnrollment();
        if (enrollment != null) {
          await _loadExams(
              classId: enrollment['classId']?.toString(),
              sectionId: enrollment['sectionId']?.toString());
        } else {
          // Fallback to profile Student object if no persistent enrollment found
          final profile = await _auth.getProfile();
          final student = profile?['student'] ?? profile?['Student'];
          if (student != null) {
            await _loadExams(
                classId: student['classId']?.toString(),
                sectionId: student['sectionId']?.toString());
          }
        }
      }
      
      if (mounted) setState(() => _loading = false);
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Error loading data: ${e.toString()}';
        });
      }
    }
  }

  Future<void> _loadExams({String? classId, String? sectionId}) async {
    if (mounted) setState(() => _examsLoading = true);
    try {
      final res = await _api.get(ApiConfig.exams, params: {
        'onlyCurrent': 'true',
        if (classId != null) 'classId': classId,
        if (sectionId != null) 'sectionId': sectionId,
      });
      final data = res.data is List ? res.data : (res.data['data'] ?? []);
      
      final scheduled = data.where((ex) => ex['date'] != null).toList();
      scheduled.sort((a, b) => DateTime.parse(a['date']).compareTo(DateTime.parse(b['date'])));
      
      final Map<String, List<dynamic>> groups = {};
      for (var ex in scheduled) {
        final termName = ex['term']?['name']?.toString() ?? 'General / Unassigned';
        if (!groups.containsKey(termName)) groups[termName] = [];
        groups[termName]!.add(ex);
      }

      if (mounted) {
        setState(() {
          _exams = scheduled;
          _groupedExams = groups;
          _examsLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _examsLoading = false;
          _error = 'Error loading exams: ${e.toString()}';
        });
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
        title: Text('Jadwalka Imtixaanka',
            style: TextStyle(
                color: AppTheme.textPrimary,
                fontWeight: FontWeight.w900,
                fontSize: 18.sp)),
        centerTitle: true,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                if (_userRole == 'parent' && _children.length > 1)
                  _buildChildSelector(),
                if (_selectedChild != null && _userRole == 'parent')
                   _buildSelectedChildHeader(),
                if ((_userRole == 'teacher' || _userRole == 'admin' || _userRole == 'super_admin') && _classes.isNotEmpty)
                   _buildClassFilter(),
                Expanded(
                  child: _error != null
                       ? _buildErrorState()
                       : _examsLoading
                           ? const Center(child: CircularProgressIndicator())
                           : _exams.isEmpty
                               ? _buildEmptyState()
                               : _buildExamsList(),
                ),
              ],
            ),
    );
  }

  Widget _buildChildSelector() {
    return Container(
      height: 60.h,
      padding: EdgeInsets.symmetric(vertical: 8.h),
      color: Colors.white,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsets.symmetric(horizontal: 16.w),
        itemCount: _children.length,
        itemBuilder: (context, index) {
          final child = _children[index];
          final isSelected = _selectedChild != null && _selectedChild!['id'] == child['id'];
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(child['user']?['name']?.split(' ')[0] ?? 'Child',
                  style: TextStyle(
                      color: isSelected ? Colors.white : AppTheme.textSecondary,
                      fontWeight: FontWeight.bold,
                      fontSize: 12.sp)),
              selected: isSelected,
              onSelected: (selected) {
                if (selected) {
                  setState(() => _selectedChild = child);
                  _loadExams(classId: child['classId'].toString(),
                      sectionId: child['sectionId']?.toString());
                }
              },
              selectedColor: AppTheme.primary,
              backgroundColor: const Color(0xFFF1F5F9),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
              side: BorderSide.none,
              showCheckmark: false,
            ),
          );
        },
      ),
    );
  }

  Widget _buildSelectedChildHeader() {
    return Container(
      width: double.infinity,
      margin: EdgeInsets.all(16.w),
      padding: EdgeInsets.all(20.w),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF4F46E5), Color(0xFF6366F1)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24.r),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF4F46E5).withValues(alpha: 0.2),
            blurRadius: 15.r,
            offset: const Offset(0, 8),
          )
        ],
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 25,
            backgroundColor: Colors.white.withValues(alpha: 0.2),
            child: Text(
              _selectedChild != null && _selectedChild!['user']?['name'] != null ? _selectedChild!['user']!['name']![0] : '?',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 20.sp),
            ),
          ),
          SizedBox(width: 16.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_selectedChild?['user']?['name'] ?? '',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16.sp)),
                SizedBox(height: 2.h),
                Text('${_selectedChild?['class_name'] ?? ''}${(_selectedChild?['section_name'] != null && _selectedChild?['section_name'] != 'N/A') ? ' - ${_selectedChild?['section_name']}' : ''}',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontWeight: FontWeight.bold, fontSize: 11.sp)),
              ],
            ),
          ),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10.r),
            ),
            child: Column(
              children: [
                Text(_exams.length.toString(),
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18.sp)),
                Text('EXAMS',
                    style: TextStyle(color: Colors.white60, fontWeight: FontWeight.bold, fontSize: 8.sp)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildClassFilter() {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
      padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 4.h),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(12.r),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          isExpanded: true,
          value: _selectedClassId,
          icon: const Icon(Icons.arrow_drop_down, color: AppTheme.textSecondary),
          style: TextStyle(
            color: AppTheme.textPrimary,
            fontWeight: FontWeight.bold,
            fontSize: 14.sp,
          ),
          onChanged: (String? newValue) {
            if (newValue != null) {
              setState(() {
                _selectedClassId = newValue;
              });
              _loadExams(classId: newValue);
            }
          },
          items: _classes.map<DropdownMenuItem<String>>((dynamic classItem) {
            return DropdownMenuItem<String>(
              value: classItem['id'].toString(),
              child: Text(classItem['class_name'] ?? 'Unknown Class'),
            );
          }).toList(),
        ),
      ),
    );
  }

  Future<void> _showScheduleDialog(dynamic ex) async {
    DateTime initialDate = DateTime.now();
    if (ex['date'] != null) {
      initialDate = DateTime.parse(ex['date']);
    }

    final DateTime? pickedDate = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
 
    if (!mounted) return;
 
    if (pickedDate != null) {
      final TimeOfDay? pickedStartTime = await showTimePicker(
        context: context,
        initialTime: TimeOfDay.fromDateTime(initialDate),
        helpText: 'SELECT START TIME',
      );
 
      if (!mounted) return;
 
      if (pickedStartTime != null) {
        final TimeOfDay? pickedEndTime = await showTimePicker(
          context: context,
          initialTime: TimeOfDay(hour: pickedStartTime.hour + 1, minute: pickedStartTime.minute),
          helpText: 'SELECT END TIME',
        );
 
        if (!mounted) return;

        final startDateTime = DateTime(
          pickedDate.year,
          pickedDate.month,
          pickedDate.day,
          pickedStartTime.hour,
          pickedStartTime.minute,
        );

        DateTime? endDateTime;
        if (pickedEndTime != null) {
          endDateTime = DateTime(
            pickedDate.year,
            pickedDate.month,
            pickedDate.day,
            pickedEndTime.hour,
            pickedEndTime.minute,
          );
        }

        final controller = TextEditingController(text: ex['description'] ?? '');
        
        if (!mounted) return;
        
        final bool? confirm = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24.r)),
            title: const Text('Schedule Exam', style: TextStyle(fontWeight: FontWeight.bold)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Subject: ${ex['subject']?['name'] ?? 'General'}', style: const TextStyle(fontWeight: FontWeight.bold)),
                SizedBox(height: 16.h),
                Text('Date: ${DateFormat('EEE, MMM d, yyyy').format(startDateTime)}'),
                Text('Start: ${pickedStartTime.format(context)}'),
                if (pickedEndTime != null)
                  Text('End: ${pickedEndTime.format(context)}', style: const TextStyle(color: Colors.indigo, fontWeight: FontWeight.bold)),
                SizedBox(height: 20.h),
                TextField(
                  controller: controller,
                  decoration: InputDecoration(
                    labelText: 'Description / Notes',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r)),
                  ),
                  maxLines: 2,
                ),
              ],
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('CANCEL')),
              ElevatedButton(
                onPressed: () => Navigator.pop(context, true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
                ),
                child: const Text('SAVE', style: TextStyle(color: Colors.white)),
              ),
            ],
          ),
        );

        if (confirm == true && mounted) {
          setState(() => _examsLoading = true);
          try {
            await _api.patch('${ApiConfig.exams}/${ex['id']}', data: {
              'date': startDateTime.toIso8601String(),
              'endTime': endDateTime?.toIso8601String(),
              'description': controller.text,
            });
            await _loadExams();
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Jadwalka si guul leh ayaa loo beddelay!')),
              );
            }
          } catch (e) {
            setState(() {
              _examsLoading = false;
              _error = 'Error updating schedule: $e';
            });
          }
        }
      }
    }
  }

  Future<void> _bulkUnschedule(String termName, List<dynamic> examIds) async {
    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Ma Hubtaa?', style: TextStyle(fontWeight: FontWeight.bold)),
        content: Text('$termName â€” ${examIds.length} imtixaan oo dhamaan jadwalkooda laga saari doonaa.'),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24.r)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Jooji')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
            ),
            child: const Text('Haa, Tirtir', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      setState(() => _examsLoading = true);
      try {
        await _api.patch('${ApiConfig.exams}/bulk-unschedule', data: {
          'examIds': examIds,
        });
        await _loadExams();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Jadwalka waa la tirtiray!')),
          );
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _examsLoading = false;
            _error = 'Error unscheduling: $e';
          });
        }
      }
    }
  }

  Widget _buildExamsList() {
    final terms = _groupedExams.keys.toList();
    return ListView.builder(
      padding: EdgeInsets.all(16.w),
      itemCount: terms.length,
      itemBuilder: (context, termIndex) {
        final termName = terms[termIndex];
        final termExams = _groupedExams[termName]!;
        
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 12, top: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 4.w,
                        height: 20.h,
                        decoration: BoxDecoration(
                          color: AppTheme.primary,
                          borderRadius: BorderRadius.circular(2.r),
                        ),
                      ),
                      SizedBox(width: 10.w),
                      Text(
                        termName.toUpperCase(),
                        style: TextStyle(
                          fontSize: 14.sp,
                          fontWeight: FontWeight.w900,
                          color: AppTheme.textPrimary,
                          letterSpacing: 1.2,
                        ),
                      ),
                    ],
                  ),
                  if ((_userRole == 'admin' || _userRole == 'super_admin' || _userRole == 'owner') && termExams.isNotEmpty)
                    TextButton.icon(
                      onPressed: () => _bulkUnschedule(termName, termExams.map((e) => e['id']).toList()),
                      icon: const Icon(Icons.delete_sweep, color: Colors.red, size: 16),
                      label: Text('Ka saar Jadwalka', style: TextStyle(color: Colors.red, fontSize: 10.sp, fontWeight: FontWeight.bold)),
                      style: TextButton.styleFrom(
                        padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
                        backgroundColor: Colors.red.withValues(alpha: 0.1),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                    ),
                ],
              ),
            ),
            ...termExams.map((ex) => _buildExamCard(ex)),
            SizedBox(height: 16.h),
          ],
        );
      },
    );
  }

  Widget _buildExamCard(dynamic ex) {
    final isUnscheduled = ex['date'] == null;
    DateTime? date;
    bool isToday = false;
    
    if (!isUnscheduled) {
      date = DateTime.parse(ex['date']);
      isToday = DateTime.now().year == date.year &&
          DateTime.now().month == date.month &&
          DateTime.now().day == date.day;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24.r),
        border: Border.all(color: isToday ? Colors.orange.shade200 : const Color(0xFFF1F5F9), width: 2.w),
        boxShadow: [
          BoxShadow(
            color: (isToday ? Colors.orange : Colors.black).withValues(alpha: 0.03),
            blurRadius: 10.r,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: Column(
        children: [
          Padding(
            padding: EdgeInsets.all(20.w),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: EdgeInsets.all(10.w),
                      decoration: BoxDecoration(
                        color: (isToday ? Colors.orange : const Color(0xFF4F46E5)).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(14.r),
                      ),
                      child: Icon(
                        isUnscheduled ? Icons.calendar_today_outlined : Icons.calendar_today_rounded,
                        color: isToday ? Colors.orange : const Color(0xFF4F46E5),
                        size: 20,
                      ),
                    ),
                    if (isToday)
                      Container(
                        padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
                        decoration: BoxDecoration(
                          color: Colors.orange.shade50,
                          borderRadius: BorderRadius.circular(20.r),
                        ),
                        child: Text('MAANTA (TODAY)',
                            style: TextStyle(color: Colors.orange, fontWeight: FontWeight.w900, fontSize: 8.sp)),
                      ),
                    if (_userRole == 'teacher' || _userRole == 'admin' || _userRole == 'super_admin')
                      IconButton(
                        icon: const Icon(Icons.edit_calendar_rounded, color: AppTheme.primary),
                        onPressed: () => _showScheduleDialog(ex),
                      ),
                  ],
                ),
                SizedBox(height: 16.h),
                Text(ex['subject']?['name']?.toString().toUpperCase() ?? 'GENERAL',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18.sp, color: AppTheme.textPrimary)),
                if (_userRole != 'student' && _userRole != 'parent')
                   Text('CLASS: ${ex['class_name'] ?? 'ALL'}', 
                      style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w900, fontSize: 10.sp)),
                SizedBox(height: 2.h),
                Text(ex['name'] ?? '',
                    style: TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.bold, fontSize: 12.sp)),
                SizedBox(height: 20.h),
                if (!isUnscheduled && date != null)
                  Row(
                    children: [
                      _infoItem(
                        Icons.access_time_rounded, 
                        'Waqtiga', 
                        ex['endTime'] != null 
                          ? '${DateFormat.jm().format(date)} - ${DateFormat.jm().format(DateTime.parse(ex['endTime']))}'
                          : DateFormat.jm().format(date), 
                        Colors.indigo
                      ),
                      SizedBox(width: 20.w),
                      _infoItem(Icons.event_available_rounded, 'Maalinta', DateFormat('EEE, MMM d').format(date), Colors.teal),
                    ],
                  )
                else
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8.r),
                    ),
                    child: Text('JADWALNA MA LAHA / NOT SCHEDULED',
                        style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 10.sp)),
                  ),
                if (ex['description'] != null && ex['description'].toString().isNotEmpty) ...[
                  SizedBox(height: 20.h),
                  Container(
                    width: double.infinity,
                    padding: EdgeInsets.all(16.w),
                    decoration: BoxDecoration(
                      color: Colors.amber.shade50,
                      borderRadius: BorderRadius.circular(16.r),
                      border: Border.all(color: Colors.amber.shade100),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('FIIRO GAAR AH / NOTES:',
                            style: TextStyle(color: Colors.amber, fontWeight: FontWeight.w900, fontSize: 8.sp)),
                        SizedBox(height: 4.h),
                        Text(ex['description'],
                            style: TextStyle(color: Colors.amber.shade900, fontWeight: FontWeight.bold, fontSize: 11.sp)),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoItem(IconData icon, String label, String value, Color color) {
    return Row(
      children: [
        Icon(icon, color: color, size: 16),
        SizedBox(width: 8.w),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label.toUpperCase(),
                style: TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.bold, fontSize: 8.sp)),
            Text(value,
                style: TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w900, fontSize: 12.sp)),
          ],
        ),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('📅', style: TextStyle(fontSize: 64.sp)),
          SizedBox(height: 16.h),
          Text('MA JIRTO JADWAL LA DIYAARIYAY',
              style: TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.w900, fontSize: 14.sp)),
          SizedBox(height: 4.h),
          Text('Scheduled exams will appear here',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 12.sp)),
          SizedBox(height: 24.h),
          ElevatedButton(
            onPressed: () => _loadInitial(),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF4F46E5),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
            ),
            child: const Text('RETRY', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          )
        ],
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(32.w),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: Colors.red, size: 48),
            SizedBox(height: 16.h),
            Text(_error ?? 'An unexpected error occurred',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
            SizedBox(height: 24.h),
            ElevatedButton(
              onPressed: () => _loadInitial(),
              child: const Text('RETRY'),
            )
          ],
        ),
      ),
    );
  }
}

