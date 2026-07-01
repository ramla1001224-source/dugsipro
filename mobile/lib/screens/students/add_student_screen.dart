import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart' as dio;
import '../../services/api_service.dart';
import '../../config/api_config.dart';
import '../../services/auth_service.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AddStudentScreen extends StatefulWidget {
  const AddStudentScreen({super.key});

  @override
  State<AddStudentScreen> createState() => _AddStudentScreenState();
}

class _AddStudentScreenState extends State<AddStudentScreen> {
  final _formKey = GlobalKey<FormState>();
  final ApiService _api = ApiService();

  final TextEditingController _nameCtrl = TextEditingController();
  final TextEditingController _passwordCtrl = TextEditingController();
  final TextEditingController _phoneCtrl = TextEditingController();
  final TextEditingController _addressCtrl = TextEditingController();

  String? _selectedClassId;
  String? _selectedSectionId;
  String? _gender;
  String _scholarship = 'none';
  List<dynamic> _classes = [];
  List<dynamic> _sections = []; // Sections of selected class
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadClasses();
  }

  Future<void> _loadClasses() async {
    try {
      final AuthService auth = AuthService();
      final schoolId = await auth.getRole() == 'super_admin' ||
              await auth.getRole() == 'owner'
          ? await const FlutterSecureStorage().read(key: 'schoolId')
          : null;

      Map<String, dynamic> params = {};
      if (schoolId != null) params['schoolId'] = schoolId;

      final res = await _api.get(ApiConfig.classes, params: params);
      final data = res.data;
      final list =
          data is List ? data : (data['classes'] ?? data['data'] ?? []);
      setState(() => _classes = list);
    } catch (_) {}
  }

  /// Marka class la doortaa, section-keeda lood soo saaro
  void _onClassChanged(String? classId) {
    setState(() {
      _selectedClassId = classId;
      _selectedSectionId = null; // Reset section
      _sections = [];
    });

    if (classId == null) return;

    // Find sections from the already-loaded classes list
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
    try {
      final selectedClass = _classes.firstWhere(
        (c) => c['id'].toString() == _selectedClassId,
        orElse: () => null,
      );

      final Map<String, dynamic> data = {
        'name': _nameCtrl.text.trim(),
        'password': _passwordCtrl.text.trim(),
        'classId': _selectedClassId,
        'class': selectedClass != null ? selectedClass['class_name'] : null,
        'phone': _phoneCtrl.text.trim(),
        'address': _addressCtrl.text.trim(),
        'gender': _gender,
        'scholarship': _scholarship,
      };

      // Ku dar sectionId haddii la doortay
      if (_selectedSectionId != null && _selectedSectionId!.isNotEmpty) {
        data['sectionId'] = _selectedSectionId;
      }

      final formData = dio.FormData.fromMap(data);


      await _api.post('${ApiConfig.students}/create', data: formData);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Student created successfully'),
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
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        centerTitle: false,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          'Register New Student',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w900,
            fontSize: 18.sp,
          ),
        ),
        actions: [
          IconButton(
            onPressed: () => context.pop(),
            icon: const Icon(Icons.close, color: Colors.white70),
          ),
          SizedBox(width: 8.w),
        ],
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(20.w),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24.r),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 20.r,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                padding: EdgeInsets.all(24.w),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [

                    _buildField(
                      label: 'FULL NAME *',
                      child: TextFormField(
                        controller: _nameCtrl,
                        decoration: InputDecoration(
                          hintText: 'Ahmed Mohamed',
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          fillColor: Colors.transparent,
                          contentPadding: EdgeInsets.zero,
                        ),
                        validator: (v) =>
                            v == null || v.isEmpty ? 'Required' : null,
                      ),
                    ),
                    SizedBox(height: 16.h),

                    // Info box
                    Container(
                      padding: EdgeInsets.symmetric(
                          horizontal: 12.w, vertical: 10.h),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(12.r),
                        border: Border.all(color: const Color(0xFFDBEAFE)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.info_outline,
                              size: 16, color: Color(0xFF2563EB)),
                          SizedBox(width: 8.w),
                          Expanded(
                            child: Text(
                              'Student login ID will be auto-generated by the system',
                              style: TextStyle(
                                fontSize: 11.sp,
                                color: const Color(0xFF1E40AF),
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: 16.h),

                    Row(
                      children: [
                        Expanded(
                          child: _buildField(
                            label: 'PASSWORD *',
                            child: TextFormField(
                              controller: _passwordCtrl,
                              obscureText: true,
                              decoration: InputDecoration(
                                hintText: '••••••••',
                                border: InputBorder.none,
                                enabledBorder: InputBorder.none,
                                focusedBorder: InputBorder.none,
                                fillColor: Colors.transparent,
                                contentPadding: EdgeInsets.zero,
                              ),
                              validator: (v) =>
                                  v == null || v.isEmpty ? 'Required' : null,
                            ),
                          ),
                        ),
                        SizedBox(width: 12.w),
                        Expanded(
                          child: _buildField(
                            label: 'GENDER *',
                            child: DropdownButtonHideUnderline(
                              child: DropdownButtonFormField<String>(
                                initialValue: _gender,
                                decoration: InputDecoration(
                                  border: InputBorder.none,
                                  enabledBorder: InputBorder.none,
                                  focusedBorder: InputBorder.none,
                                  fillColor: Colors.transparent,
                                  contentPadding: EdgeInsets.zero,
                                ),
                                items: ['Male', 'Female'].map((g) {
                                  return DropdownMenuItem(
                                    value: g,
                                    child: Text(g,
                                        style: TextStyle(fontSize: 13.sp)),
                                  );
                                }).toList(),
                                onChanged: (v) => setState(() => _gender = v),
                                validator: (v) => v == null ? 'Required' : null,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 16.h),

                    _buildField(
                      label: 'SCHOLARSHIP STATUS',
                      child: DropdownButtonHideUnderline(
                        child: DropdownButtonFormField<String>(
                          initialValue: _scholarship,
                          decoration: InputDecoration(
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            fillColor: Colors.transparent,
                            contentPadding: EdgeInsets.zero,
                          ),
                          items: [
                            {'val': 'none', 'lab': 'No Scholarship (None)'},
                            {'val': 'full', 'lab': 'Full Scholarship'},
                            {'val': 'half', 'lab': 'Half Scholarship'},
                          ].map((s) {
                            return DropdownMenuItem(
                              value: s['val'],
                              child: Text(s['lab']!,
                                  style: TextStyle(fontSize: 13.sp)),
                            );
                          }).toList(),
                          onChanged: (v) => setState(() => _scholarship = v!),
                        ),
                      ),
                    ),
                    SizedBox(height: 16.h),

                    // â”€â”€â”€ CLASS DROPDOWN â”€â”€â”€
                    _buildField(
                      label: 'ASSIGNED CLASS / GRADE *',
                      child: DropdownButtonHideUnderline(
                        child: DropdownButtonFormField<String>(
                          initialValue: _selectedClassId,
                          hint: Text('Select Class...',
                              style: TextStyle(fontSize: 13.sp)),
                          decoration: InputDecoration(
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            fillColor: Colors.transparent,
                            contentPadding: EdgeInsets.zero,
                          ),
                          items: _classes.map((c) {
                            return DropdownMenuItem(
                              value: c['id'].toString(),
                              child: Text(
                                c['class_name']?.toString() ?? 'Class',
                                style: TextStyle(fontSize: 13.sp),
                              ),
                            );
                          }).toList(),
                          onChanged: _onClassChanged,
                          validator: (v) => v == null ? 'Required' : null,
                        ),
                      ),
                    ),
                    SizedBox(height: 16.h),

                    // â”€â”€â”€ SECTION DROPDOWN (yimaadda class loo doortay) â”€â”€â”€
                    _buildField(
                      label: 'SECTION *',
                      child: _selectedClassId == null
                          ? Text(
                              'Select a class first',
                              style: TextStyle(
                                  fontSize: 12.sp, color: const Color(0xFF94A3B8)),
                            )
                          : _sections.isEmpty
                              ? Text(
                                  'No sections found for this class',
                                  style: TextStyle(
                                      fontSize: 12.sp, color: const Color(0xFF94A3B8)),
                                )
                              : DropdownButtonHideUnderline(
                                  child: DropdownButtonFormField<String>(
                                    key: ValueKey(_selectedClassId),
                                    initialValue: _selectedSectionId,
                                    hint: Text('Select Section...',
                                        style: TextStyle(fontSize: 13.sp)),
                                    decoration: InputDecoration(
                                      border: InputBorder.none,
                                      enabledBorder: InputBorder.none,
                                      focusedBorder: InputBorder.none,
                                      fillColor: Colors.transparent,
                                      contentPadding: EdgeInsets.zero,
                                    ),
                                    items: _sections.map((s) {
                                      return DropdownMenuItem(
                                        value: s['id'].toString(),
                                        child: Text(
                                          s['name']?.toString() ?? 'Section',
                                          style:
                                              TextStyle(fontSize: 13.sp),
                                        ),
                                      );
                                    }).toList(),
                                    onChanged: (v) => setState(
                                        () => _selectedSectionId = v),
                                    validator: (v) =>
                                        v == null ? 'Required' : null,
                                  ),
                                ),
                    ),
                    SizedBox(height: 16.h),

                    Row(
                      children: [
                        Expanded(
                          child: _buildField(
                            label: 'PHONE',
                            child: TextFormField(
                              controller: _phoneCtrl,
                              keyboardType: TextInputType.phone,
                              decoration: InputDecoration(
                                hintText: '061...',
                                border: InputBorder.none,
                                enabledBorder: InputBorder.none,
                                focusedBorder: InputBorder.none,
                                fillColor: Colors.transparent,
                                contentPadding: EdgeInsets.zero,
                              ),
                            ),
                          ),
                        ),
                        SizedBox(width: 12.w),
                        Expanded(
                          child: _buildField(
                            label: 'ADDRESS',
                            child: TextFormField(
                              controller: _addressCtrl,
                              decoration: InputDecoration(
                                hintText: 'Location',
                                border: InputBorder.none,
                                enabledBorder: InputBorder.none,
                                focusedBorder: InputBorder.none,
                                fillColor: Colors.transparent,
                                contentPadding: EdgeInsets.zero,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 32.h),

                    ElevatedButton(
                      onPressed: _submitting ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB),
                        padding: EdgeInsets.symmetric(vertical: 18.h),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12.r)),
                      ),
                      child: _submitting
                          ? SizedBox(
                              height: 20.h,
                              width: 20.w,
                              child: const CircularProgressIndicator(
                                  color: Colors.white, strokeWidth: 2))
                          : Text(
                              'Register Student',
                              style: TextStyle(
                                fontWeight: FontWeight.w900,
                                fontSize: 15.sp,
                              ),
                            ),
                    ),
                    SizedBox(height: 12.h),
                    TextButton(
                      onPressed: () => context.pop(),
                      child: const Text(
                        'Cancel',
                        style: TextStyle(
                          color: Colors.black45,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
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
      padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
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
              color: const Color(0xFF64748B),
              letterSpacing: 0.5,
            ),
          ),
          SizedBox(height: 4.h),
          child,
        ],
      ),
    );
  }
}

