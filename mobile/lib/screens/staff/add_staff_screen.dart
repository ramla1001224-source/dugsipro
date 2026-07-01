import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';

class AddStaffScreen extends StatefulWidget {
  const AddStaffScreen({super.key});

  @override
  State<AddStaffScreen> createState() => _AddStaffScreenState();
}

class _AddStaffScreenState extends State<AddStaffScreen> {
  final _formKey = GlobalKey<FormState>();
  final ApiService _api = ApiService();

  final TextEditingController _nameCtrl = TextEditingController();
  final TextEditingController _usernameCtrl = TextEditingController();
  final TextEditingController _passwordCtrl = TextEditingController();
  final TextEditingController _positionCtrl = TextEditingController();
  final TextEditingController _salaryCtrl = TextEditingController();

  String _role = 'accountant';
  bool _submitting = false;

  Future<void> _submit() async {
    if (_submitting) return;
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitting = true);
    try {
      final data = {
        'name': _nameCtrl.text.trim(),
        'username': _usernameCtrl.text.trim(),
        'password': _passwordCtrl.text.trim(),
        'role': _role,
        'position': _positionCtrl.text.trim(),
        'salary':
            _salaryCtrl.text.isNotEmpty ? double.tryParse(_salaryCtrl.text) : 0,
      };

      await _api.post(ApiConfig.staff, data: data);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Staff member created successfully'),
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
          'Add New Staff',
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
                'Staff Information',
                style: TextStyle(
                  fontSize: 20.sp,
                  fontWeight: FontWeight.w900,
                  color: AppTheme.textPrimary,
                  letterSpacing: -0.5,
                ),
              ),
              SizedBox(height: 4.h),
              Text(
                'Register a new administrative staff member',
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
                    hintText: 'e.g. Adan Ahmed',
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
                label: 'SYSTEM ROLE',
                child: DropdownButtonHideUnderline(
                  child: DropdownButtonFormField<String>(
                    initialValue: _role,
                    decoration: InputDecoration(
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                    items: [
                      DropdownMenuItem(
                          value: 'accountant',
                          child: Text('ACCOUNTANT',
                              style: TextStyle(
                                  fontSize: 13.sp, fontWeight: FontWeight.bold))),
                      DropdownMenuItem(
                          value: 'staff',
                          child: Text('GENERAL STAFF',
                              style: TextStyle(
                                  fontSize: 13.sp, fontWeight: FontWeight.bold))),
                    ],
                    onChanged: (v) => setState(() => _role = v!),
                  ),
                ),
              ),
              SizedBox(height: 16.h),
              Row(
                children: [
                  Expanded(
                    child: _buildField(
                      label: 'POSITION / TITLE',
                      child: TextFormField(
                        controller: _positionCtrl,
                        style: TextStyle(
                            fontSize: 14.sp, fontWeight: FontWeight.bold),
                        decoration: InputDecoration(
                          hintText: 'e.g. Senior Accountant',
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
                      label: 'BASE SALARY (\$)',
                      child: TextFormField(
                        controller: _salaryCtrl,
                        keyboardType: TextInputType.number,
                        style: TextStyle(
                            fontSize: 14.sp, fontWeight: FontWeight.bold),
                        decoration: InputDecoration(
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
                        'REGISTER STAFF',
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

