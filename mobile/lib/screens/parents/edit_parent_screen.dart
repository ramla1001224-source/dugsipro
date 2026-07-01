import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';
import '../../services/auth_service.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class EditParentScreen extends StatefulWidget {
  final String parentId;
  const EditParentScreen({super.key, required this.parentId});

  @override
  State<EditParentScreen> createState() => _EditParentScreenState();
}

class _EditParentScreenState extends State<EditParentScreen> {
  final _formKey = GlobalKey<FormState>();
  final ApiService _api = ApiService();

  final TextEditingController _nameCtrl = TextEditingController();
  final TextEditingController _phoneCtrl = TextEditingController();
  final TextEditingController _occupationCtrl = TextEditingController();
  final TextEditingController _addressCtrl = TextEditingController();

  List<dynamic> _classes = [];
  List<dynamic> _sections = [];
  List<dynamic> _studentsInClass = [];
  final List<Map<String, dynamic>> _selectedStudents = [];

  String? _selectedClassId;
  String? _selectedSectionId;
  String? _selectedStudentId;
  bool _loadingSections = false;
  bool _loadingStudents = false;
  bool _loadingInitial = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadInitial();
  }

  Future<void> _loadInitial() async {
    setState(() => _loadingInitial = true);
    try {
      // 1. Load Parent Data
      final res = await _api.get(ApiConfig.parents);
      final data = res.data;
      final list =
          data is List ? data : (data['parents'] ?? data['data'] ?? []);

      final parent = list.firstWhere((p) => p['id'] == widget.parentId,
          orElse: () => null);

      if (parent != null) {
        _nameCtrl.text = parent['user']?['name'] ?? parent['name'] ?? '';
        _phoneCtrl.text = parent['phone'] ?? '';
        _occupationCtrl.text = parent['occupation'] ?? '';
        _addressCtrl.text = parent['address'] ?? '';

        if (parent['Children'] != null && parent['Children'] is List) {
          for (var c in parent['Children']) {
            if (c['student'] != null) {
              _selectedStudents.add({
                'id': c['student']['id'],
                'name': c['student']['user']?['name'] ??
                    c['student']['name'] ??
                    'Unknown',
                'student_id': c['student']['student_id'] ??
                    c['student']['studentId'] ??
                    '',
              });
            }
          }
        }
      }

      // 2. Load Classes
      final AuthService auth = AuthService();
      final schoolId = await auth.getRole() == 'super_admin' ||
              await auth.getRole() == 'owner'
          ? await const FlutterSecureStorage().read(key: 'schoolId')
          : null;

      Map<String, dynamic> params = {};
      if (schoolId != null) params['schoolId'] = schoolId;

      final cres = await _api.get(ApiConfig.classes, params: params);
      final cdata = cres.data;
      final clist =
          cdata is List ? cdata : (cdata['classes'] ?? cdata['data'] ?? []);

      setState(() {
        _classes = clist;
        _loadingInitial = false;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Xogta lama soo rari karo: $e')));
        context.pop();
      }
    }
  }

  Future<void> _loadSections(String classId) async {
    setState(() {
      _loadingSections = true;
      _sections = [];
      _selectedSectionId = null;
      _studentsInClass = [];
      _selectedStudentId = null;
    });
    try {
      final res = await _api.get(ApiConfig.sections, params: {'classId': classId});
      final data = res.data;
      final list = data is List ? data : (data['sections'] ?? data['data'] ?? []);
      setState(() => _sections = list);
    } catch (_) {
    } finally {
      setState(() => _loadingSections = false);
    }
  }

  Future<void> _loadStudents(String classId, {String? sectionId}) async {
    setState(() {
      _loadingStudents = true;
      _studentsInClass = [];
      _selectedStudentId = null;
    });
    try {
      Map<String, dynamic> params = {'classId': classId};
      if (sectionId != null) params['sectionId'] = sectionId;

      final res = await _api.get(ApiConfig.students, params: params);
      final data = res.data;
      final list =
          data is List ? data : (data['students'] ?? data['data'] ?? []);
      setState(() => _studentsInClass = list);
    } catch (_) {
    } finally {
      setState(() => _loadingStudents = false);
    }
  }

  void _addStudent() {
    if (_selectedStudentId == null) return;

    final student =
        _studentsInClass.firstWhere((s) => s['id'] == _selectedStudentId);
    if (!_selectedStudents.any((s) => s['id'] == student['id'])) {
      setState(() {
        _selectedStudents.add({
          'id': student['id'],
          'name': student['user']?['name'] ?? student['name'] ?? 'Unknown',
          'student_id': student['student_id'] ?? student['studentId'] ?? '',
        });
        _selectedStudentId = null;
      });
    }
  }

  void _removeStudent(String id) {
    setState(() {
      _selectedStudents.removeWhere((s) => s['id'] == id);
    });
  }

  Future<void> _submit() async {
    if (_submitting) return;
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitting = true);
    try {
      final Map<String, dynamic> data = {
        'name': _nameCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'address': _addressCtrl.text.trim(),
        'occupation': _occupationCtrl.text.trim(),
        'studentIds': _selectedStudents.map((s) => s['id']).toList(),
      };

      await _api.put('${ApiConfig.parents}/${widget.parentId}', data: data);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content:
                  Text('Xogta waalidka si sax ah ayaa loola cusboonaysiiyey'),
              backgroundColor: Colors.green),
        );
        context.pop(true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Khalad: ${e.toString()}'),
              backgroundColor: Colors.red),
        );
      }
    } finally {
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loadingInitial) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          'Wax ka bedel Waalidka',
          style: TextStyle(
              color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18.sp),
        ),
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
                        offset: const Offset(0, 10)),
                  ],
                ),
                padding: EdgeInsets.all(24.w),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildField(
                      label: 'MAGACA OO BUUXA *',
                      child: TextFormField(
                        controller: _nameCtrl,
                        decoration: InputDecoration(
                            hintText: 'Ahmed Mohamed',
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.zero),
                        validator: (v) =>
                            v == null || v.isEmpty ? 'Required' : null,
                      ),
                    ),
                    SizedBox(height: 16.h),
                    _buildField(
                      label: 'TELEFOONKA *',
                      child: TextFormField(
                        controller: _phoneCtrl,
                        keyboardType: TextInputType.phone,
                        decoration: InputDecoration(
                            hintText: '061...',
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.zero),
                        validator: (v) =>
                            v == null || v.isEmpty ? 'Required' : null,
                      ),
                    ),
                    SizedBox(height: 16.h),
                    _buildField(
                      label: 'SIIAQADA (OCCUPATION)',
                      child: TextFormField(
                        controller: _occupationCtrl,
                        decoration: InputDecoration(
                            hintText: 'Ganacsade',
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.zero),
                      ),
                    ),
                    SizedBox(height: 16.h),
                    _buildField(
                      label: 'CINWAANKA (ADDRESS)',
                      child: TextFormField(
                        controller: _addressCtrl,
                        decoration: InputDecoration(
                            hintText: 'Mogadishu, Somalia',
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.zero),
                      ),
                    ),
                    SizedBox(height: 32.h),
                    Text(
                      'XIRIIRI CARRUURTA',
                      style: TextStyle(
                          fontSize: 12.sp,
                          fontWeight: FontWeight.w900,
                          color: const Color(0xFF64748B),
                          letterSpacing: 1),
                    ),
                    SizedBox(height: 12.h),
                    Container(
                      padding: EdgeInsets.all(16.w),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(16.r),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        children: [
                          Column(
                            children: [
                              Row(
                                children: [
                                  // Class Dropdown
                                  Expanded(
                                    child: DropdownButtonHideUnderline(
                                      child: DropdownButtonFormField<String?>(
                                        initialValue: _selectedClassId,
                                        hint: Text('Fasalka dooro',
                                            style: TextStyle(fontSize: 12.sp)),
                                        items: _classes.map((c) {
                                          final sections = c['Sections'] as List? ?? [];
                                          final shift = sections.isNotEmpty ? (sections[0]['shift'] ?? '') : '';
                                          final shiftLabel = shift == 'morning' ? 'Subax' : shift == 'afternoon' ? 'Galabnimo' : shift == 'night' ? 'Habeenimo' : shift;
                                          return DropdownMenuItem(
                                            value: c['id'].toString(),
                                            child: Text(
                                                '${c['class_name']?.toString() ?? 'Class'}${shiftLabel.isNotEmpty ? ' ($shiftLabel)' : ''}',
                                                style: TextStyle(
                                                    fontSize: 12.sp)),
                                          );
                                        }).toList(),
                                        onChanged: (v) {
                                          setState(() => _selectedClassId = v);
                                          if (v != null) {
                                            _loadSections(v);
                                            _loadStudents(v);
                                          }
                                        },
                                        decoration: InputDecoration(
                                            border: InputBorder.none,
                                            contentPadding: EdgeInsets.zero),
                                      ),
                                    ),
                                  ),
                                  SizedBox(width: 8.w),
                                  // Section Dropdown
                                  Expanded(
                                    child: DropdownButtonHideUnderline(
                                      child: DropdownButtonFormField<String?>(
                                        initialValue: _selectedSectionId,
                                        hint: Text(
                                            _loadingSections
                                                ? 'Waa la rabaa...'
                                                : 'Qaybta dooro',
                                            style:
                                                TextStyle(fontSize: 12.sp)),
                                        items: _sections.map((s) {
                                          final shift = s['shift']?.toString() ?? '';
                                          final shiftLabel = shift == 'morning' ? 'Subax' : shift == 'afternoon' ? 'Galabnimo' : shift == 'night' ? 'Habeenimo' : shift;
                                          return DropdownMenuItem(
                                            value: s['id'].toString(),
                                            child: Text(
                                                '${s['name']?.toString() ?? 'Section'}${shiftLabel.isNotEmpty ? ' ($shiftLabel)' : ''}',
                                                style: TextStyle(
                                                    fontSize: 12.sp)),
                                          );
                                        }).toList(),
                                        onChanged: (v) {
                                          setState(() => _selectedSectionId = v);
                                          if (_selectedClassId != null) {
                                            _loadStudents(_selectedClassId!,
                                                sectionId: v);
                                          }
                                        },
                                        decoration: InputDecoration(
                                            border: InputBorder.none,
                                            contentPadding: EdgeInsets.zero),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              SizedBox(height: 8.h),
                              Row(
                                children: [
                                  // Student Dropdown
                                  Expanded(
                                    child: DropdownButtonHideUnderline(
                                      child: DropdownButtonFormField<String?>(
                                        initialValue: _selectedStudentId,
                                        hint: Text(
                                            _loadingStudents
                                                ? 'Waa la rabaa...'
                                                : 'Ardayda dooro',
                                            style:
                                                TextStyle(fontSize: 12.sp)),
                                        items: _studentsInClass.map((s) {
                                          return DropdownMenuItem(
                                            value: s['id'].toString(),
                                            child: Text(
                                                s['user']?['name'] ??
                                                    s['name'] ??
                                                    'Student',
                                                style: TextStyle(
                                                    fontSize: 12.sp)),
                                          );
                                        }).toList(),
                                        onChanged: (v) => setState(
                                            () => _selectedStudentId = v),
                                        decoration: InputDecoration(
                                            border: InputBorder.none,
                                            contentPadding: EdgeInsets.zero),
                                      ),
                                    ),
                                  ),
                                  SizedBox(width: 8.w),
                                  IconButton(
                                    onPressed: _selectedStudentId != null
                                        ? _addStudent
                                        : null,
                                    icon: const Icon(Icons.add_circle,
                                        color: Color(0xFFDB2777)),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          if (_selectedStudents.isNotEmpty) ...[
                            Divider(height: 24.h),
                            ListView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: _selectedStudents.length,
                              itemBuilder: (ctx, i) {
                                final s = _selectedStudents[i];
                                return Container(
                                  margin: const EdgeInsets.only(bottom: 6),
                                  padding: EdgeInsets.symmetric(
                                      horizontal: 12.w, vertical: 8.h),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(8.r),
                                    border: Border.all(
                                        color: const Color(0xFFE2E8F0)),
                                  ),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(s['name'],
                                                style: TextStyle(
                                                    fontSize: 12.sp,
                                                    fontWeight:
                                                        FontWeight.bold)),
                                            Text(s['student_id'],
                                                style: TextStyle(
                                                    fontSize: 10.sp,
                                                    color: Colors.grey)),
                                          ],
                                        ),
                                      ),
                                      IconButton(
                                        onPressed: () =>
                                            _removeStudent(s['id']),
                                        icon: const Icon(
                                            Icons.remove_circle_outline,
                                            size: 18,
                                            color: Colors.redAccent),
                                        visualDensity: VisualDensity.compact,
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                          ],
                        ],
                      ),
                    ),
                    SizedBox(height: 32.h),
                    ElevatedButton(
                      onPressed: _submitting ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFDB2777),
                        padding: EdgeInsets.symmetric(vertical: 18.h),
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
                          : Text('Cusboonaysii Xogta Waalidka',
                              style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 15.sp,
                                  color: Colors.white)),
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
          Text(label,
              style: TextStyle(
                  fontSize: 9.sp,
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFF64748B),
                  letterSpacing: 0.5)),
          SizedBox(height: 4.h),
          child,
        ],
      ),
    );
  }
}


