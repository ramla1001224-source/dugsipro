import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:file_picker/file_picker.dart';
import 'package:dio/dio.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../config/api_config.dart';

class AddHomeworkScreen extends StatefulWidget {
  const AddHomeworkScreen({super.key});

  @override
  State<AddHomeworkScreen> createState() => _AddHomeworkScreenState();
}

class _AddHomeworkScreenState extends State<AddHomeworkScreen> {
  final _formKey = GlobalKey<FormState>();
  final ApiService _api = ApiService();
  final AuthService _auth = AuthService();

  final TextEditingController _titleCtrl = TextEditingController();
  final TextEditingController _descCtrl = TextEditingController();
  final TextEditingController _dateCtrl = TextEditingController(
      text: DateFormat('yyyy-MM-dd')
          .format(DateTime.now().add(const Duration(days: 1))));

  String? _selectedClassId;
  String? _selectedSectionId;
  String? _selectedSubjectId;
  String? _selectedTeacherId;

  List<dynamic> _classes = [];
  List<dynamic> _subjects = [];
  List<dynamic> _teachers = [];
  bool _loading = true;
  bool _submitting = false;

  PlatformFile? _pickedFile;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final results = await Future.wait([
        _api.get(ApiConfig.classes),
        _api.get(ApiConfig.subjects),
        _api.get(ApiConfig.teachers),
        _auth.getTeacherId(),
      ]);

      final resC = results[0] as dynamic;
      final resS = results[1] as dynamic;
      final resT = results[2] as dynamic;
      final myTeacherId = results[3] as String?;

      if (mounted) {
        setState(() {
          _classes = resC.data is List ? resC.data : (resC.data['data'] ?? []);
          _subjects = resS.data is List ? resS.data : (resS.data['data'] ?? []);
          _teachers = resT.data is List ? resT.data : (resT.data['data'] ?? []);
          
          if (myTeacherId != null) {
            _selectedTeacherId = myTeacherId;
          }
          
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
    );
    if (result != null && result.files.isNotEmpty) {
      setState(() => _pickedFile = result.files.first);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitting = true);
    try {
      FormData data = FormData.fromMap({
        'title': _titleCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
        'classId': _selectedClassId,
        'sectionId': _selectedSectionId, // 'all' or specific sectionId
        'subjectId': _selectedSubjectId,
        'teacherId': _selectedTeacherId,
        'dueDate': _dateCtrl.text,
      });

      final pickedFilePath = _pickedFile?.path;
      if (pickedFilePath != null) {
        data.files.add(MapEntry(
          'attachment',
          await MultipartFile.fromFile(pickedFilePath,
              filename: _pickedFile!.name),
        ));
      }

      await _api.post('${ApiConfig.homework}/create', data: data);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Homework assigned successfully'),
              backgroundColor: Colors.green),
        );
        context.pop(true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Error: ${e.toString()}'),
              backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
        title: Text(
          'Assign Homework',
          style: TextStyle(
            color: AppTheme.textPrimary,
            fontWeight: FontWeight.w900,
            fontSize: 18.sp,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(24.w),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'New Assignment',
                style: TextStyle(
                  fontSize: 20.sp,
                  fontWeight: FontWeight.w900,
                  color: AppTheme.textPrimary,
                  letterSpacing: -0.5,
                ),
              ),
              SizedBox(height: 4.h),
              Text(
                'Fill in the details to post a new homework',
                style: TextStyle(fontSize: 13.sp, color: AppTheme.textSecondary),
              ),
              SizedBox(height: 24.h),
              _buildField(
                label: 'HOMEWORK TITLE',
                child: TextFormField(
                  controller: _titleCtrl,
                  style: TextStyle(
                      fontSize: 14.sp, fontWeight: FontWeight.bold),
                  decoration: InputDecoration(
                    hintText: 'e.g. Algebra Chapter 2 Exercises',
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                  validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                ),
              ),
              SizedBox(height: 16.h),
              _buildField(
                label: 'DESCRIPTION / INSTRUCTIONS',
                child: TextFormField(
                  controller: _descCtrl,
                  maxLines: 3,
                  style: TextStyle(
                      fontSize: 14.sp, fontWeight: FontWeight.bold),
                  decoration: InputDecoration(
                    hintText: 'Describe the homework tasks...',
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              ),
              SizedBox(height: 16.h),
              _buildField(
                label: 'TARGET CLASS',
                child: DropdownButtonHideUnderline(
                  child: DropdownButtonFormField<String>(
                    initialValue: _selectedClassId,
                    isExpanded: true,
                    decoration: InputDecoration(
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                    items: () {
                      final uniqueClasses = <String, Map<String, dynamic>>{};
                      for (final c in _classes) {
                        final id = c['classId']?.toString() ?? c['id']?.toString() ?? '';
                        if (id.isNotEmpty && !uniqueClasses.containsKey(id)) {
                          uniqueClasses[id] = c;
                        }
                      }
                      return uniqueClasses.values.map((c) {
                        final className = c['class_name']?.toString() ?? 'Class';
                        final id = c['id']?.toString() ?? c['classId']?.toString() ?? '';
                        return DropdownMenuItem<String>(
                          value: id,
                          child: Text(
                            className.toUpperCase(),
                            style: TextStyle(
                                fontSize: 13.sp, fontWeight: FontWeight.bold),
                          ),
                        );
                      }).toList();
                    }(),
                    onChanged: (v) => setState(() {
                      _selectedClassId = v;
                      _selectedSectionId = null;
                      _selectedSubjectId = null;
                    }),
                    validator: (v) => v == null ? 'Required' : null,
                  ),
                ),
              ),
              SizedBox(height: 16.h),
              _buildField(
                label: 'TARGET SECTION',
                child: DropdownButtonHideUnderline(
                  child: DropdownButtonFormField<String>(
                    initialValue: _selectedSectionId,
                    isExpanded: true,
                    decoration: InputDecoration(
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                    items: _selectedClassId == null ? [] : [
                      DropdownMenuItem<String>(
                        value: 'all',
                        child: Text(
                          'ALL SECTIONS (DHAMMAAN)',
                          style: TextStyle(
                              fontSize: 13.sp, fontWeight: FontWeight.w900, color: Colors.blue),
                        ),
                      ),
                      ..._classes.where((c) {
                        final id = c['id']?.toString() ?? c['classId']?.toString() ?? '';
                        return id == _selectedClassId;
                      }).expand<DropdownMenuItem<String>>((c) {
                        if (c.containsKey('Sections')) {
                          final sections = c['Sections'] as List<dynamic>? ?? [];
                          return sections.map((sec) {
                            final sectionName = sec['name']?.toString() ?? 'Sec';
                            final shift = sec['shift']?.toString() ?? '';
                            return DropdownMenuItem<String>(
                              value: sec['id'].toString(),
                              child: Text(
                                '${sectionName.toUpperCase()} ($shift)',
                                style: TextStyle(
                                    fontSize: 13.sp, fontWeight: FontWeight.bold),
                              ),
                            );
                          });
                        }
                        return [];
                      }),
                    ],
                    onChanged: (v) => setState(() {
                      _selectedSectionId = v;
                      _selectedSubjectId = null;
                    }),
                    validator: (v) => v == null ? 'Required' : null,
                  ),
                ),
              ),
              SizedBox(height: 16.h),
              _buildField(
                label: 'SUBJECT',
                child: DropdownButtonHideUnderline(
                  child: DropdownButtonFormField<String>(
                    initialValue: _selectedSubjectId,
                    isExpanded: true,
                    decoration: InputDecoration(
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                    items: _selectedSectionId == null ? [] : _subjects.where((s) {
                        final assignments = s['Assignments'] as List<dynamic>? ?? [];
                        if (_selectedSectionId == 'all') {
                          // Find all sections of the selected class
                          final classSections = _classes.firstWhere((c) => (c['id']?.toString() ?? c['classId']?.toString()) == _selectedClassId)['Sections'] as List<dynamic>? ?? [];
                          final sectionIds = classSections.map((sec) => sec['id'].toString()).toList();
                          return assignments.any((a) => 
                            sectionIds.contains(a['sectionId']?.toString()) &&
                            (_selectedTeacherId == null || a['teacherId']?.toString() == _selectedTeacherId)
                          );
                        }
                        return assignments.any((a) => 
                          a['sectionId']?.toString() == _selectedSectionId &&
                          (_selectedTeacherId == null || a['teacherId']?.toString() == _selectedTeacherId)
                        );
                    }).map((s) {
                      return DropdownMenuItem<String>(
                        value: s['id'].toString(),
                        child: Text(
                          s['name']?.toString().toUpperCase() ?? 'SUBJECT',
                          style: TextStyle(
                              fontSize: 13.sp, fontWeight: FontWeight.bold),
                        ),
                      );
                    }).toList(),
                    onChanged: (v) => setState(() => _selectedSubjectId = v),
                    validator: (v) => v == null ? 'Required' : null,
                  ),
                ),
              ),
              SizedBox(height: 16.h),
              _buildField(
                label: 'ASSIGNED TEACHER',
                child: DropdownButtonHideUnderline(
                  child: DropdownButtonFormField<String>(
                    initialValue: _selectedTeacherId,
                    isExpanded: true,
                    decoration: InputDecoration(
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                    items: _teachers.map((t) {
                      final name = t['user']?['name'] ?? t['name'] ?? 'TEACHER';
                      return DropdownMenuItem(
                        value: t['id'].toString(),
                        child: Text(
                          name.toString().toUpperCase(),
                          style: TextStyle(
                              fontSize: 13.sp, fontWeight: FontWeight.bold),
                        ),
                      );
                    }).toList(),
                    onChanged: (v) => setState(() => _selectedTeacherId = v),
                    validator: (v) => v == null ? 'Required' : null,
                  ),
                ),
              ),
              SizedBox(height: 16.h),
              _buildField(
                label: 'DUE DATE',
                child: TextFormField(
                  controller: _dateCtrl,
                  readOnly: true,
                  style: TextStyle(
                      fontSize: 14.sp, fontWeight: FontWeight.bold),
                  decoration: InputDecoration(
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                    suffixIcon: Icon(Icons.calendar_month_rounded, size: 18),
                  ),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: DateTime.now().add(const Duration(days: 1)),
                      firstDate: DateTime.now(),
                      lastDate: DateTime(2030),
                    );
                    if (picked != null) {
                      setState(() {
                        _dateCtrl.text =
                            DateFormat('yyyy-MM-dd').format(picked);
                      });
                    }
                  },
                ),
              ),
              SizedBox(height: 16.h),
              _buildField(
                label: 'ATTACHMENT (FILE)',
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        _pickedFile == null
                            ? 'No file selected'
                            : _pickedFile!.name,
                        style: TextStyle(
                            fontSize: 12.sp, color: AppTheme.textSecondary),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    TextButton.icon(
                      onPressed: _pickFile,
                      icon: const Icon(Icons.file_upload_outlined, size: 18),
                      label: const Text('PICK',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
              SizedBox(height: 32.h),
              ElevatedButton(
                onPressed: _submitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white,
                  padding: EdgeInsets.symmetric(vertical: 16.h),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12.r)),
                  elevation: 0,
                ),
                child: _submitting
                    ? SizedBox(
                        height: 20.h,
                        width: 20.w,
                        child: const CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2))
                    : Text(
                        'POST ASSIGNMENT',
                        style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 14.sp,
                            letterSpacing: 1),
                      ),
              ),
              SizedBox(height: 40.h),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildField({required String label, required Widget child}) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 10.h),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12.r),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 9.sp,
              fontWeight: FontWeight.w900,
              color: AppTheme.textSecondary,
              letterSpacing: 1,
            ),
          ),
          SizedBox(height: 6.h),
          child,
        ],
      ),
    );
  }
}

