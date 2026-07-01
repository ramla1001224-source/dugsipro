import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';
import '../../services/auth_service.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:dio/dio.dart' as dio;

class EditStudentScreen extends StatefulWidget {
  final String studentId;
  const EditStudentScreen({super.key, required this.studentId});

  @override
  State<EditStudentScreen> createState() => _EditStudentScreenState();
}

class _EditStudentScreenState extends State<EditStudentScreen> {
  final _formKey = GlobalKey<FormState>();
  final ApiService _api = ApiService();

  final TextEditingController _nameCtrl = TextEditingController();
  final TextEditingController _studentIdCtrl = TextEditingController();
  final TextEditingController _passwordCtrl = TextEditingController();
  final TextEditingController _phoneCtrl = TextEditingController();
  final TextEditingController _addressCtrl = TextEditingController();
  final TextEditingController _dobCtrl = TextEditingController();

  String? _selectedClassId;
  String? _selectedSectionId;
  String? _gender;
  String _scholarship = 'none';
  List<dynamic> _classes = [];
  List<dynamic> _sections = []; // Sections of selected class
  bool _loading = true;
  bool _submitting = false;


  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  Future<void> _loadAll() async {
    try {
      final AuthService auth = AuthService();
      final schoolId = await auth.getRole() == 'super_admin' ||
              await auth.getRole() == 'owner'
          ? await const FlutterSecureStorage().read(key: 'schoolId')
          : null;

      Map<String, dynamic> params = {};
      if (schoolId != null) params['schoolId'] = schoolId;

      final resC = await _api.get(ApiConfig.classes, params: params);
      final resS = await _api.get('${ApiConfig.students}/${widget.studentId}');

      final classes = resC.data is List
          ? resC.data
          : (resC.data['classes'] ?? resC.data['data'] ?? []);
      final s = resS.data;

      // Determine sections for the student's current class
      final currentClassId = s['classId']?.toString();
      List<dynamic> currentSections = [];
      if (currentClassId != null) {
        final currentClass = (classes as List).firstWhere(
          (c) => c['id'].toString() == currentClassId,
          orElse: () => null,
        );
        if (currentClass != null) {
          currentSections = List<dynamic>.from(currentClass['Sections'] ?? []);
        }
      }

      setState(() {
        _classes = classes;
        _sections = currentSections;
        _nameCtrl.text = s['user']?['name'] ?? s['name'] ?? '';
        _studentIdCtrl.text = s['student_id'] ?? s['studentId'] ?? '';
        _phoneCtrl.text = s['phone'] ?? '';
        _addressCtrl.text = s['address'] ?? '';
        _dobCtrl.text =
            s['dob'] != null ? s['dob'].toString().substring(0, 10) : '';
        _gender = s['gender'];
        _scholarship = s['scholarship'] ?? 'none';
        _selectedClassId = currentClassId;
        _selectedSectionId = s['sectionId']?.toString();
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Error loading student: ${e.toString()}'),
              backgroundColor: Colors.red),
        );
      }
    }
  }

  /// Marka class la doortaa, section-keeda lood soo saaro
  void _onClassChanged(String? classId) {
    setState(() {
      _selectedClassId = classId;
      _selectedSectionId = null; // Reset section
      _sections = [];
    });

    if (classId == null) return;

    final selectedClass = _classes.firstWhere(
      (c) => c['id'].toString() == classId,
      orElse: () => null,
    );

    if (selectedClass != null) {
      final rawSections = selectedClass['Sections'] ?? [];
      setState(() => _sections = List<dynamic>.from(rawSections));
    }
  }


  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitting = true);
    debugPrint('Submitting student update for ID: ${widget.studentId}');
    try {
      final selectedClass = _classes.firstWhere(
        (c) => c['id'].toString() == _selectedClassId,
        orElse: () => null,
      );

      final Map<String, dynamic> data = {
        'name': _nameCtrl.text.trim(),
        'student_id': _studentIdCtrl.text.trim(),
        'classId': _selectedClassId,
        'class': selectedClass != null ? selectedClass['class_name'] : null,
        'sectionId': _selectedSectionId ?? '',
        'phone': _phoneCtrl.text.trim(),
        'address': _addressCtrl.text.trim(),
        'gender': _gender,
        'scholarship': _scholarship,
      };

      if (_dobCtrl.text.trim().isNotEmpty) {
        data['dob'] = _dobCtrl.text.trim();
      }

      if (_passwordCtrl.text.isNotEmpty) {
        data['password'] = _passwordCtrl.text.trim();
      }

      final formData = dio.FormData.fromMap(data);


      debugPrint(
          'Sending PUT request to: ${ApiConfig.students}/${widget.studentId}');
      debugPrint('Data: $data');

      final res = await _api.put('${ApiConfig.students}/${widget.studentId}',
          data: formData);
      debugPrint('Response status: ${res.statusCode}');

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Student updated successfully'),
              backgroundColor: Colors.green),
        );
        context.pop(true);
      }
    } catch (e) {
      debugPrint('Error in _submit: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Update failed: ${e.toString()}'),
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
          'Edit Student',
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
                'Update Information',
                style: TextStyle(
                  fontSize: 20.sp,
                  fontWeight: FontWeight.w900,
                  color: AppTheme.textPrimary,
                  letterSpacing: -0.5,
                ),
              ),
              SizedBox(height: 4.h),
              Text(
                'Modify the student details below',
                style: TextStyle(fontSize: 13.sp, color: AppTheme.textSecondary),
              ),
              SizedBox(height: 24.h),
              _buildField(
                label: 'STUDENT ID',
                child: TextFormField(
                  controller: _studentIdCtrl,
                  style: TextStyle(
                      fontSize: 14.sp, fontWeight: FontWeight.bold),
                  decoration: InputDecoration(
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                  validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                ),
              ),
              SizedBox(height: 16.h),
              _buildField(
                label: 'FULL NAME',
                child: TextFormField(
                  controller: _nameCtrl,
                  style: TextStyle(
                      fontSize: 14.sp, fontWeight: FontWeight.bold),
                  decoration: InputDecoration(
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                  validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                ),
              ),
              SizedBox(height: 16.h),
              _buildField(
                label: 'PASSWORD (LEAVE BLANK TO UNCHANGED)',
                child: TextFormField(
                  controller: _passwordCtrl,
                  obscureText: true,
                  style: TextStyle(
                      fontSize: 14.sp, fontWeight: FontWeight.bold),
                  decoration: InputDecoration(
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              ),
              SizedBox(height: 16.h),
              _buildField(
                label: 'DATE OF BIRTH (YYYY-MM-DD)',
                child: TextFormField(
                  controller: _dobCtrl,
                  style: TextStyle(
                      fontSize: 14.sp, fontWeight: FontWeight.bold),
                  decoration: InputDecoration(
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                    hintText: 'e.g. 2005-05-20',
                  ),
                ),
              ),
              SizedBox(height: 16.h),
              _buildField(
                label: 'SCHOLARSHIP STATUS',
                child: DropdownButtonHideUnderline(
                  child: DropdownButtonFormField<String>(
                    initialValue: _scholarship,
                    isExpanded: true,
                    decoration: InputDecoration(
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                    items: [
                      {'val': 'none', 'lab': 'NON SCHOLARSHIP'},
                      {'val': 'full', 'lab': 'FULL SCHOLARSHIP'},
                      {'val': 'half', 'lab': 'HALF SCHOLARSHIP'},
                    ].map((s) {
                      return DropdownMenuItem(
                        value: s['val'],
                        child: Text(s['lab']!,
                            style: TextStyle(
                                fontSize: 13.sp, fontWeight: FontWeight.bold)),
                      );
                    }).toList(),
                    onChanged: (v) => setState(() => _scholarship = v!),
                  ),
                ),
              ),
              SizedBox(height: 16.h),

              // â”€â”€â”€ CLASS DROPDOWN â”€â”€â”€
              _buildField(
                label: 'ASSIGNED CLASS / GRADE',
                child: DropdownButtonHideUnderline(
                  child: DropdownButtonFormField<String?>(
                    initialValue: _selectedClassId,
                    isExpanded: true,
                    decoration: InputDecoration(
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                    items: _classes.map((c) {
                      return DropdownMenuItem(
                        value: c['id'].toString(),
                        child: Text(
                          c['class_name']?.toString().toUpperCase() ?? 'CLASS',
                          style: TextStyle(
                              fontSize: 13.sp, fontWeight: FontWeight.bold),
                        ),
                      );
                    }).toList(),
                    onChanged: _onClassChanged,
                    validator: (v) => v == null ? 'Required' : null,
                  ),
                ),
              ),
              SizedBox(height: 16.h),

              // â”€â”€â”€ SECTION DROPDOWN â”€â”€â”€
              _buildField(
                label: 'SECTION',
                child: _selectedClassId == null
                    ? Text(
                        'Select a class first',
                        style: TextStyle(
                            fontSize: 12.sp, color: AppTheme.textSecondary),
                      )
                    : _sections.isEmpty
                        ? Text(
                            'No sections available for this class',
                            style: TextStyle(
                                fontSize: 12.sp, color: AppTheme.textSecondary),
                          )
                        : DropdownButtonHideUnderline(
                            child: DropdownButtonFormField<String?>(
                              key: ValueKey(_selectedClassId),
                              initialValue: _selectedSectionId,
                              isExpanded: true,
                              decoration: InputDecoration(
                                border: InputBorder.none,
                                isDense: true,
                                contentPadding: EdgeInsets.zero,
                              ),
                              hint: Text('Select Section...',
                                  style: TextStyle(fontSize: 13.sp)),
                              items: _sections.map((s) {
                                return DropdownMenuItem(
                                  value: s['id'].toString(),
                                  child: Text(
                                    s['name']?.toString().toUpperCase() ??
                                        'SECTION',
                                    style: TextStyle(
                                        fontSize: 13.sp,
                                        fontWeight: FontWeight.bold),
                                  ),
                                );
                              }).toList(),
                              onChanged: (v) =>
                                  setState(() => _selectedSectionId = v),
                              validator: (v) =>
                                  v == null ? 'Required' : null,
                            ),
                          ),
              ),
              SizedBox(height: 16.h),

              _buildField(
                label: 'GENDER',
                child: DropdownButtonHideUnderline(
                  child: DropdownButtonFormField<String?>(
                    initialValue: _gender,
                    isExpanded: true,
                    decoration: InputDecoration(
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                    items: ['Male', 'Female'].map((g) {
                      return DropdownMenuItem(
                        value: g,
                        child: Text(g,
                            style: TextStyle(
                                fontSize: 13.sp, fontWeight: FontWeight.bold)),
                      );
                    }).toList(),
                    onChanged: (v) => setState(() => _gender = v),
                  ),
                ),
              ),
              SizedBox(height: 16.h),
              _buildField(
                label: 'PHONE NUMBER',
                child: TextFormField(
                  controller: _phoneCtrl,
                  keyboardType: TextInputType.phone,
                  style: TextStyle(
                      fontSize: 14.sp, fontWeight: FontWeight.bold),
                  decoration: InputDecoration(
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              ),
              SizedBox(height: 16.h),
              _buildField(
                label: 'ADDRESS',
                child: TextFormField(
                  controller: _addressCtrl,
                  style: TextStyle(
                      fontSize: 14.sp, fontWeight: FontWeight.bold),
                  decoration: InputDecoration(
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
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
                        'UPDATE STUDENT',
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

