import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';

class CreateExamScreen extends StatefulWidget {
  const CreateExamScreen({super.key});

  @override
  State<CreateExamScreen> createState() => _CreateExamScreenState();
}

class _CreateExamScreenState extends State<CreateExamScreen> {
  final _formKey = GlobalKey<FormState>();
  final ApiService _api = ApiService();

  final TextEditingController _nameCtrl = TextEditingController();
  final TextEditingController _totalMarksCtrl =
      TextEditingController(text: '100');
  final TextEditingController _dateCtrl = TextEditingController(
      text: DateFormat('yyyy-MM-dd').format(DateTime.now()));

  String? _selectedType;
  String? _selectedClassId;
  String? _selectedSectionId;
  String? _selectedTermId;
  List<dynamic> _classes = [];
  List<dynamic> _terms = [];
  bool _submitting = false;

  final List<Map<String, String>> _examTypes = [
    {'value': 'monthly_1', 'label': 'Monthly 1'},
    {'value': 'midterm', 'label': 'Mid-Term'},
    {'value': 'monthly_2', 'label': 'Monthly 2'},
    {'value': 'final', 'label': 'Final-Term'},
    {'value': 'quiz', 'label': 'Quiz'},
    {'value': 'assignment', 'label': 'Assignment'},
  ];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final resC = await _api.get(ApiConfig.classes);
      final resY = await _api.get(ApiConfig.academicYears, params: {'onlyCurrent': 'true'});

      final classes = resC.data is List
          ? resC.data
          : (resC.data['classes'] ?? resC.data['data'] ?? []);
      final years = resY.data is List ? resY.data : [];

      List<dynamic> allTerms = [];
      for (var year in years) {
        if (year['Terms'] != null) allTerms.addAll(year['Terms']);
      }

      setState(() {
        _classes = classes;
        _terms = allTerms;
        if (_terms.isNotEmpty) {
          final currentYear = years.firstWhere((y) => y['isCurrent'] == true,
              orElse: () => null);
          if (currentYear != null &&
              currentYear['Terms'] != null &&
              currentYear['Terms'].isNotEmpty) {
            _selectedTermId = currentYear['Terms'][0]['id'].toString();
          } else {
            _selectedTermId = _terms[0]['id'].toString();
          }
        }
      });
    } catch (e) {
      debugPrint('Error loading exam data: $e');
    }
  }

  Future<void> _submit() async {
    if (_submitting) return;
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitting = true);
    try {
      // Check for duplicates before creation
      final checkRes = await _api.get(ApiConfig.exams, params: {
        'termId': _selectedTermId,
        'classId': _selectedClassId,
        'type': _selectedType,
      });
      final List existing = checkRes.data is List
          ? checkRes.data
          : (checkRes.data['data'] ?? []);

      if (existing.isNotEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                  'Imtixaankan (Category-gan) mar hore ayuu fasalkan iyo term-kan ugu jiraa.'),
              backgroundColor: Colors.orange,
            ),
          );
        }
        setState(() => _submitting = false);
        return;
      }

      final data = {
        'name': _nameCtrl.text.trim(),
        'type': _selectedType,
        'classId': _selectedClassId,
        'sectionId': _selectedSectionId,
        'termId': _selectedTermId,
        'totalMarks': int.tryParse(_totalMarksCtrl.text) ?? 100,
        'date': _dateCtrl.text,
      };

      await _api.post(ApiConfig.exams, data: data);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Exam created successfully'),
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
          'Create New Exam',
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
                'Examination Details',
                style: TextStyle(
                  fontSize: 20.sp,
                  fontWeight: FontWeight.w900,
                  color: AppTheme.textPrimary,
                  letterSpacing: -0.5,
                ),
              ),
              SizedBox(height: 4.h),
              Text(
                'Schedule a new academic or other assessment',
                style: TextStyle(fontSize: 13.sp, color: AppTheme.textSecondary),
              ),
              SizedBox(height: 24.h),
              Container(
                padding: EdgeInsets.all(16.w),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(16.r),
                  border: Border.all(color: const Color(0xFFDBEAFE)),
                ),
                child: Row(
                  children: [
                    Text('📚', style: TextStyle(fontSize: 20.sp)),
                    SizedBox(width: 12.w),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Bulk Creation',
                            style: TextStyle(
                              fontSize: 11.sp,
                              fontWeight: FontWeight.w900,
                              color: const Color(0xFF1E40AF),
                              letterSpacing: 1,
                            ),
                          ),
                          SizedBox(height: 2.h),
                          Text(
                            'Imtixaan ayaa loo samaynayaa dhammaan maadooyinka fasalka (One exam for EVERY subject in this class).',
                            style: TextStyle(
                              fontSize: 11.sp,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFF1E40AF).withValues(alpha: 0.7),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: 24.h),
              _buildField(
                label: 'EXAM TITLE / NAME',
                child: TextFormField(
                  controller: _nameCtrl,
                  style: TextStyle(
                      fontSize: 14.sp, fontWeight: FontWeight.bold),
                  decoration: InputDecoration(
                    hintText: 'e.g. Midterm 2024 - Math',
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
                      label: 'EXAM TYPE',
                      child: DropdownButtonHideUnderline(
                        child: DropdownButtonFormField<String>(
                          initialValue: _selectedType,
                          isExpanded: true,
                          hint: Text('Select Category',
                              style: TextStyle(
                                  fontSize: 13.sp,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.grey)),
                          decoration: InputDecoration(
                            border: InputBorder.none,
                            isDense: true,
                            contentPadding: EdgeInsets.zero,
                          ),
                          items: _examTypes.map((t) {
                            return DropdownMenuItem(
                              value: t['value'],
                              child: Text(t['label']!,
                                  style: TextStyle(
                                      fontSize: 13.sp,
                                      fontWeight: FontWeight.bold)),
                            );
                          }).toList(),
                          onChanged: (v) => setState(() => _selectedType = v),
                          validator: (v) => v == null ? 'Required' : null,
                        ),
                      ),
                    ),
                  ),
                  SizedBox(width: 16.w),
                  Expanded(
                    child: _buildField(
                      label: 'TOTAL MARKS',
                      child: TextFormField(
                        controller: _totalMarksCtrl,
                        keyboardType: TextInputType.number,
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
                label: 'CLASS / GRADE',
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
                          child: Text(
                            c['class_name']?.toString().toUpperCase() ?? 'CLASS',
                            style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.bold),
                          ),
                        );
                      }).toList();
                    }(),
                    onChanged: (v) {
                      setState(() {
                        _selectedClassId = v;
                        _selectedSectionId = null;
                      });
                    },
                    validator: (v) => v == null ? 'Required' : null,
                  ),
                ),
              ),
              SizedBox(height: 16.h),
              _buildField(
                label: 'SECTION',
                child: DropdownButtonHideUnderline(
                  child: DropdownButtonFormField<String>(
                    initialValue: _selectedSectionId,
                    isExpanded: true,
                    decoration: InputDecoration(
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                    items: _selectedClassId == null
                        ? []
                        : _classes.where((c) {
                            final id = c['classId']?.toString() ?? c['id']?.toString() ?? '';
                            return id == _selectedClassId;
                          }).expand<DropdownMenuItem<String>>((c) {
                            if (c.containsKey('Sections')) {
                              final sections = c['Sections'] as List<dynamic>? ?? [];
                              return sections.map((sec) {
                                final sectionName = sec['name']?.toString() ?? 'Sec';
                                return DropdownMenuItem<String>(
                                  value: sec['id'].toString(),
                                  child: Text(
                                    sectionName.toUpperCase(),
                                    style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.bold),
                                  ),
                                );
                              });
                            } else if (c.containsKey('sectionId')) {
                              final sectionName = c['section']?.toString() ?? 'Sec';
                              return [
                                DropdownMenuItem<String>(
                                  value: c['sectionId'].toString(),
                                  child: Text(
                                    sectionName.toUpperCase(),
                                    style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.bold),
                                  ),
                                )
                              ];
                            }
                            return [];
                          }).toList(),
                    onChanged: (v) => setState(() => _selectedSectionId = v),
                    validator: (v) => v == null ? 'Required' : null,
                  ),
                ),
              ),
              SizedBox(height: 16.h),
              _buildField(
                label: 'ACADEMIC TERM',
                child: DropdownButtonHideUnderline(
                  child: DropdownButtonFormField<String>(
                    initialValue: _selectedTermId,
                    isExpanded: true,
                    decoration: InputDecoration(
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                    items: _terms.map((t) {
                      return DropdownMenuItem(
                        value: t['id'].toString(),
                        child: Text(
                          t['name']?.toString().toUpperCase() ?? 'TERM',
                          style: TextStyle(
                              fontSize: 13.sp, fontWeight: FontWeight.bold),
                        ),
                      );
                    }).toList(),
                    onChanged: (v) => setState(() => _selectedTermId = v),
                    validator: (v) => v == null ? 'Required' : null,
                  ),
                ),
              ),
              SizedBox(height: 16.h),
              _buildField(
                label: 'EXAM DATE',
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
                      initialDate: DateTime.now(),
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2030),
                    );
                    if (picked != null) {
                      setState(() {
                        _dateCtrl.text =
                            DateFormat('yyyy-MM-dd').format(picked);
                      });
                    }
                  },
                  validator: (v) => v == null || v.isEmpty ? 'Taariikhda waa qasab' : null,
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
                        'SCHEDULE EXAM',
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

