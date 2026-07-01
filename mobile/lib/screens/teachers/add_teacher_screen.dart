import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';

class AddTeacherScreen extends StatefulWidget {
  const AddTeacherScreen({super.key});

  @override
  State<AddTeacherScreen> createState() => _AddTeacherScreenState();
}

class _AddTeacherScreenState extends State<AddTeacherScreen> {
  final _formKey = GlobalKey<FormState>();
  final ApiService _api = ApiService();

  final TextEditingController _nameCtrl = TextEditingController();
  final TextEditingController _usernameCtrl = TextEditingController();
  final TextEditingController _passwordCtrl = TextEditingController();
  final TextEditingController _phoneCtrl = TextEditingController();
  final TextEditingController _salaryCtrl = TextEditingController();

  final List<String> _selectedSubjects = [];
  List<dynamic> _availableSubjects = [];
  bool _loadingSubjects = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _fetchSubjects();
  }

  Future<void> _fetchSubjects() async {
    try {
      final res = await _api.get(ApiConfig.subjects);
      if (mounted) {
        setState(() {
          _availableSubjects = res.data;
          _loadingSubjects = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingSubjects = false);
    }
  }

  void _showSubjectDialog() {
    if (_loadingSubjects) return;
    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Select Subjects'),
              content: SizedBox(
                width: double.maxFinite,
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: _availableSubjects.length,
                  itemBuilder: (context, index) {
                    final subject = _availableSubjects[index];
                    final String name = subject['name'];
                    final bool isSelected = _selectedSubjects.contains(name);
                    return CheckboxListTile(
                      title: Text(name),
                      value: isSelected,
                      onChanged: (bool? value) {
                        setDialogState(() {
                          if (value == true) {
                            _selectedSubjects.add(name);
                          } else {
                            _selectedSubjects.remove(name);
                          }
                        });
                        setState(() {});
                      },
                    );
                  },
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('DONE'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _submit() async {
    if (_submitting) return;
    if (!_formKey.currentState!.validate()) return;
    if (_selectedSubjects.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select at least one subject')),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final data = {
        'name': _nameCtrl.text.trim(),
        'username': _usernameCtrl.text.trim(),
        'password': _passwordCtrl.text.trim(),
        'subject': _selectedSubjects.join(', '),
        'phone': _phoneCtrl.text.trim(),
        'salary': _salaryCtrl.text.isNotEmpty
            ? double.tryParse(_salaryCtrl.text)
            : null,
      };

      await _api.post('${ApiConfig.teachers}/create', data: data);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Teacher created successfully'),
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
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
        title: Text(
          'Add New Teacher',
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
                'Teacher Information',
                style: TextStyle(
                  fontSize: 20.sp,
                  fontWeight: FontWeight.w900,
                  color: AppTheme.textPrimary,
                  letterSpacing: -0.5,
                ),
              ),
              SizedBox(height: 4.h),
              Text(
                'Enter the professional details for the new instructor',
                style: TextStyle(fontSize: 13.sp, color: AppTheme.textSecondary),
              ),
              SizedBox(height: 24.h),
              _buildField(
                label: 'FULL NAME',
                child: TextFormField(
                  controller: _nameCtrl,
                  style: TextStyle(
                      fontSize: 14.sp, fontWeight: FontWeight.bold),
                  decoration: InputDecoration(
                    hintText: 'e.g. Master Ahmed',
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                  validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                ),
              ),
              SizedBox(height: 16.h),
              Row(
                children: [
                  Expanded(
                    child: _buildField(
                      label: 'USERNAME',
                      child: TextFormField(
                        controller: _usernameCtrl,
                        style: TextStyle(
                            fontSize: 14.sp, fontWeight: FontWeight.bold),
                        decoration: InputDecoration(
                          hintText: 'login_username',
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.zero,
                        ),
                        validator: (v) =>
                            v == null || v.isEmpty ? 'Required' : null,
                      ),
                    ),
                  ),
                  SizedBox(width: 16.w),
                  Expanded(
                    child: _buildField(
                      label: 'PASSWORD',
                      child: TextFormField(
                        controller: _passwordCtrl,
                        obscureText: true,
                        style: TextStyle(
                            fontSize: 14.sp, fontWeight: FontWeight.bold),
                        decoration: InputDecoration(
                          hintText: 'Login pass',
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.zero,
                        ),
                        validator: (v) =>
                            v == null || v.isEmpty ? 'Required' : null,
                      ),
                    ),
                  ),
                ],
              ),
              SizedBox(height: 16.h),
              _buildField(
                label: 'PRIMARY SUBJECT / DEPARTMENT',
                child: InkWell(
                  onTap: _showSubjectDialog,
                  child: Container(
                    padding: EdgeInsets.symmetric(vertical: 12.h),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            _selectedSubjects.isEmpty
                                ? 'Select Subject(s)'
                                : _selectedSubjects.join(', '),
                            style: TextStyle(
                              fontSize: 14.sp,
                              fontWeight: FontWeight.bold,
                              color: _selectedSubjects.isEmpty
                                  ? Colors.black38
                                  : Colors.black87,
                            ),
                          ),
                        ),
                        const Icon(Icons.arrow_drop_down,
                            color: Colors.black54),
                      ],
                    ),
                  ),
                ),
              ),
              if (_selectedSubjects.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4, left: 16),
                  child: Text('Required',
                      style: TextStyle(color: Colors.red, fontSize: 12.sp)),
                ),
              SizedBox(height: 16.h),
              Row(
                children: [
                  Expanded(
                    child: _buildField(
                      label: 'PHONE NUMBER',
                      child: TextFormField(
                        controller: _phoneCtrl,
                        keyboardType: TextInputType.phone,
                        style: TextStyle(
                            fontSize: 14.sp, fontWeight: FontWeight.bold),
                        decoration: InputDecoration(
                          hintText: '061XXXXXXX',
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.zero,
                        ),
                      ),
                    ),
                  ),
                  SizedBox(width: 16.w),
                  Expanded(
                    child: _buildField(
                      label: 'MONTHLY SALARY (\$)',
                      child: TextFormField(
                        controller: _salaryCtrl,
                        keyboardType: TextInputType.number,
                        style: TextStyle(
                            fontSize: 14.sp, fontWeight: FontWeight.bold),
                        decoration: InputDecoration(
                          hintText: 'e.g. 500',
                          border: InputBorder.none,
                          isDense: true,
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
                        'CREATE TEACHER',
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

