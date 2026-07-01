import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../config/api_config.dart';

class AddQuizScreen extends StatefulWidget {
  final Map<String, dynamic>? quiz;
  const AddQuizScreen({super.key, this.quiz});

  @override
  State<AddQuizScreen> createState() => _AddQuizScreenState();
}

class _AddQuizScreenState extends State<AddQuizScreen> {
  final _formKey = GlobalKey<FormState>();
  final ApiService _api = ApiService();
  final AuthService _auth = AuthService();

  final TextEditingController _titleCtrl = TextEditingController();
  final TextEditingController _descCtrl = TextEditingController();
  double _duration = 30.0;

  String? _selectedClassId;
  String? _selectedSectionId;
  String? _selectedSubjectId;
  String? _myTeacherId;

  List<dynamic> _classes = [];
  List<dynamic> _subjects = [];
  final List<Map<String, dynamic>> _questions = [];
  bool _loading = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _addQuestion(); // Start with one question
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final results = await Future.wait([
        _api.get(ApiConfig.classes),
        _api.get(ApiConfig.subjects),
        _auth.getTeacherId(),
        if (widget.quiz != null) _api.get('${ApiConfig.elearning}/quizzes/${widget.quiz!['id']}'),
      ]);

      final resC = results[0] as dynamic;
      final resS = results[1] as dynamic;
      _myTeacherId = results[2] as String?;
      dynamic quizDetail;
      if (widget.quiz != null) {
        quizDetail = results[3] as dynamic;
      }

      if (mounted) {
        setState(() {
          _classes = resC.data is List ? resC.data : (resC.data['data'] ?? []);
          _subjects = resS.data is List ? resS.data : (resS.data['data'] ?? []);
          
          if (widget.quiz != null && quizDetail != null) {
            final q = quizDetail.data;
            _titleCtrl.text = q['title'] ?? '';
            _descCtrl.text = q['description'] ?? '';
            _duration = (q['duration'] ?? 30).toDouble();
            _selectedClassId = q['classId']?.toString();
            _selectedSectionId = q['sectionId']?.toString();
            _selectedSubjectId = q['subjectId']?.toString();
            
            _questions.clear();
            final questions = q['questions'] as List? ?? [];
            for (var item in questions) {
              final opts = item['options'] is String ? json.decode(item['options']) as List : (item['options'] as List? ?? []);
              _questions.add({
                'question': item['question'] ?? '',
                'options': List<String>.from(opts),
                'correctAnswer': opts.indexOf(item['answer']),
                'points': item['points'] ?? 1,
              });
            }
            if (_questions.isEmpty) _addQuestion();
          }
          
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _addQuestion() {
    setState(() {
      _questions.add({
        'question': '',
        'options': ['', '', '', ''],
        'correctAnswer': 0,
        'points': 1,
      });
    });
  }

  void _removeQuestion(int index) {
    if (_questions.length > 1) {
      setState(() => _questions.removeAt(index));
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_questions.isEmpty) {
      _showError('Fadlan ku dar ugu yaraan hal su\'aal');
      return;
    }

    // Validate that all questions/options are filled
    for (var i = 0; i < _questions.length; i++) {
        if (_questions[i]['question'].toString().trim().isEmpty) {
            _showError('Fadlan gali su\'aasha ${i+1}');
            return;
        }
        final options = _questions[i]['options'] as List;
        for (var j = 0; j < options.length; j++) {
            if (options[j].toString().trim().isEmpty) {
                _showError('Fadlan gali jawaabaha su\'aasha ${i+1}');
                return;
            }
        }
    }

    setState(() => _submitting = true);
    try {
      final payload = {
        'title': _titleCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
        'classId': _selectedClassId,
        'sectionId': _selectedSectionId == 'all' ? null : _selectedSectionId,
        'subjectId': _selectedSubjectId,
        'duration': _duration.toInt(),
        'isActive': true,
        'questions': _questions,
      };

      if (widget.quiz != null) {
        await _api.put('${ApiConfig.elearning}/quizzes/${widget.quiz!['id']}', data: payload);
      } else {
        await _api.post('${ApiConfig.elearning}/quizzes', data: payload);
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Quiz successfully created'), backgroundColor: Colors.green),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) _showError('Error: ${e.toString()}');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: Colors.red),
    );
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
        title: Text(widget.quiz != null ? 'Edit Quiz' : 'New Quiz', style: TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w900, fontSize: 18.sp)),
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: EdgeInsets.all(24.w),
          children: [
            _buildSectionHeader('BASIC INFO', 'Set quiz title and duration'),
            SizedBox(height: 16.h),
            _buildField(
              label: 'QUIZ TITLE',
              child: TextFormField(
                controller: _titleCtrl,
                style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.bold),
                decoration: InputDecoration(hintText: 'e.g. Mid-Term Maths Quiz', border: InputBorder.none, isDense: true, contentPadding: EdgeInsets.zero),
                validator: (v) => v == null || v.isEmpty ? 'Required' : null,
              ),
            ),
            SizedBox(height: 16.h),
            _buildField(
              label: 'DESCRIPTION (OPTIONAL)',
              child: TextFormField(
                controller: _descCtrl,
                style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.bold),
                decoration: InputDecoration(hintText: 'Add instructions for students...', border: InputBorder.none, isDense: true, contentPadding: EdgeInsets.zero),
              ),
            ),
            SizedBox(height: 16.h),
            _buildField(
              label: 'DURATION: ${_duration.toInt()} MINUTES',
              child: Slider(
                value: _duration,
                min: 5,
                max: 180,
                divisions: 35,
                activeColor: AppTheme.primary,
                onChanged: (v) => setState(() => _duration = v),
              ),
            ),
            SizedBox(height: 32.h),
            _buildSectionHeader('TARGET AUDIENCE', 'Select who will take this quiz'),
            SizedBox(height: 16.h),
            _buildDropdown(
              label: 'CLASS',
              value: _selectedClassId,
              items: _getUniqueClasses(),
              onChanged: (v) => setState(() {
                _selectedClassId = v;
                _selectedSectionId = null;
                _selectedSubjectId = null;
              }),
            ),
            SizedBox(height: 16.h),
            _buildDropdown(
              label: 'SECTION',
              value: _selectedSectionId,
              items: _getSectionsForClass(),
              onChanged: (v) => setState(() {
                _selectedSectionId = v;
                _selectedSubjectId = null;
              }),
            ),
            SizedBox(height: 16.h),
            _buildDropdown(
              label: 'SUBJECT',
              value: _selectedSubjectId,
              items: _getSubjectsForSection(),
              onChanged: (v) => setState(() => _selectedSubjectId = v),
            ),
            SizedBox(height: 32.h),
            _buildSectionHeader('QUESTIONS (${_questions.length})', 'Add multiple choice questions'),
            SizedBox(height: 16.h),
            ..._questions.asMap().entries.map((entry) => _buildQuestionCard(entry.key, entry.value)),
            SizedBox(height: 16.h),
            OutlinedButton.icon(
              onPressed: _addQuestion,
              icon: const Icon(Icons.add_circle_outline),
              label: const Text('ADD ANOTHER QUESTION', style: TextStyle(fontWeight: FontWeight.bold)),
              style: OutlinedButton.styleFrom(
                padding: EdgeInsets.symmetric(vertical: 16.h),
                side: BorderSide(color: AppTheme.primary.withValues(alpha: 0.5)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
              ),
            ),
            SizedBox(height: 48.h),
            ElevatedButton(
              onPressed: _submitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
                padding: EdgeInsets.symmetric(vertical: 18.h),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
                elevation: 0,
              ),
              child: _submitting
                  ? SizedBox(height: 20.h, width: 20.w, child: const CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : Text(widget.quiz != null ? 'UPDATE QUIZ' : 'PUBLISH QUIZ', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14.sp, letterSpacing: 1)),
            ),
            SizedBox(height: 64.h),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title, String subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w900, color: AppTheme.primary, letterSpacing: 1)),
        SizedBox(height: 2.h),
        Text(subtitle, style: TextStyle(fontSize: 11.sp, color: AppTheme.textSecondary)),
      ],
    );
  }

  List<DropdownMenuItem<String>> _getUniqueClasses() {
    final map = <String, String>{};
    for (final c in _classes) {
      final id = c['id']?.toString() ?? c['classId']?.toString() ?? '';
      final name = c['class_name']?.toString() ?? 'Class';
      if (id.isNotEmpty) map[id] = name;
    }
    return map.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value.toUpperCase(), style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.bold)))).toList();
  }

  List<DropdownMenuItem<String>> _getSectionsForClass() {
    if (_selectedClassId == null) return [];
    final items = <DropdownMenuItem<String>>[
      DropdownMenuItem(
        value: 'all',
        child: Text(
          'ALL SECTIONS (DHAMMAAN)',
          style: TextStyle(
              fontSize: 13.sp, fontWeight: FontWeight.w900, color: Colors.blue),
        ),
      ),
    ];
    for (final c in _classes) {
      final cid = c['id']?.toString() ?? c['classId']?.toString() ?? '';
      if (cid == _selectedClassId) {
        if (c['Sections'] != null) {
          for (final s in (c['Sections'] as List)) {
            items.add(DropdownMenuItem(value: s['id'].toString(), child: Text('${s['name']} (${s['shift']})'.toUpperCase(), style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.bold))));
          }
        }
      }
    }
    return items;
  }

  List<DropdownMenuItem<String>> _getSubjectsForSection() {
    if (_selectedSectionId == null) return [];
    return _subjects.where((s) {
      final assignments = s['Assignments'] as List? ?? [];
      if (_selectedSectionId == 'all') {
        final cls = _classes.firstWhere((c) => (c['id']?.toString() ?? c['classId']?.toString()) == _selectedClassId);
        final sectionIds = (cls['Sections'] as List? ?? []).map((sec) => sec['id'].toString()).toList();
        return assignments.any((a) => sectionIds.contains(a['sectionId']?.toString()) && a['teacherId']?.toString() == _myTeacherId);
      }
      return assignments.any((a) => a['sectionId']?.toString() == _selectedSectionId && a['teacherId']?.toString() == _myTeacherId);
    }).map((s) => DropdownMenuItem(value: s['id'].toString(), child: Text(s['name'].toString().toUpperCase(), style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.bold)))).toList();
  }

  Widget _buildDropdown({required String label, required String? value, required List<DropdownMenuItem<String>> items, required Function(String?) onChanged}) {
    return _buildField(
      label: label,
      child: DropdownButtonHideUnderline(
        child: DropdownButtonFormField<String>(
          initialValue: value,
          isExpanded: true,
          decoration: InputDecoration(border: InputBorder.none, isDense: true, contentPadding: EdgeInsets.zero),
          items: items,
          onChanged: onChanged,
          validator: (v) => v == null ? 'Required' : null,
        ),
      ),
    );
  }

  Widget _buildQuestionCard(int index, Map<String, dynamic> question) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: EdgeInsets.all(20.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20.r),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('QUESTION ${index + 1}', style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: AppTheme.textSecondary)),
              if (_questions.length > 1)
                IconButton(onPressed: () => _removeQuestion(index), icon: const Icon(Icons.delete_outline, color: Colors.red, size: 18), padding: EdgeInsets.zero, constraints: const BoxConstraints()),
            ],
          ),
          SizedBox(height: 12.h),
          TextFormField(
            initialValue: question['question'],
            onChanged: (v) => question['question'] = v,
            style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.bold),
            decoration: InputDecoration(hintText: 'Enter question text...', border: InputBorder.none),
          ),
          Divider(height: 24.h),
          Text('OPTIONS (SELECT THE CORRECT ONE)', style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.w900, color: AppTheme.textSecondary, letterSpacing: 1)),
          SizedBox(height: 12.h),
          Column(
            children: List.generate(4, (optIndex) {
              final isSelected = question['correctAnswer'] == optIndex;
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: InkWell(
                  onTap: () => setState(() => question['correctAnswer'] = optIndex),
                  borderRadius: BorderRadius.circular(16.r),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
                    decoration: BoxDecoration(
                      color: isSelected ? AppTheme.primary.withValues(alpha: 0.05) : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(16.r),
                      border: Border.all(color: isSelected ? AppTheme.primary : const Color(0xFFE2E8F0), width: isSelected ? 2 : 1),
                    ),
                    child: Row(
                      children: [
                        // Custom Radio Indicator
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          width: 20.w, height: 20.h,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: isSelected ? AppTheme.primary : AppTheme.textSecondary.withValues(alpha: 0.3), width: 2.w),
                            color: isSelected ? AppTheme.primary : Colors.transparent,
                          ),
                          child: isSelected ? const Icon(Icons.check, size: 12, color: Colors.white) : null,
                        ),
                        SizedBox(width: 16.w),
                        Expanded(
                          child: TextFormField(
                            initialValue: question['options'][optIndex],
                            onChanged: (v) => question['options'][optIndex] = v,
                            style: TextStyle(fontSize: 13.sp, fontWeight: isSelected ? FontWeight.w900 : FontWeight.w700, color: isSelected ? AppTheme.primary : AppTheme.textPrimary),
                            decoration: InputDecoration(hintText: 'Option ${optIndex + 1}', border: InputBorder.none, isDense: true, contentPadding: EdgeInsets.zero),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  Widget _buildField({required String label, required Widget child}) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 10.h),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12.r), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.w900, color: AppTheme.textSecondary, letterSpacing: 1)),
          SizedBox(height: 6.h),
          child,
        ],
      ),
    );
  }
}

