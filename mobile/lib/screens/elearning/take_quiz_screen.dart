import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';
import 'dart:convert';
import 'quiz_breakdown_screen.dart';

class TakeQuizScreen extends StatefulWidget {
  final dynamic quiz;
  const TakeQuizScreen({super.key, required this.quiz});

  @override
  State<TakeQuizScreen> createState() => _TakeQuizScreenState();
}

class _TakeQuizScreenState extends State<TakeQuizScreen> {
  final ApiService _api = ApiService();
  int _currentIndex = 0;
  final Map<String, int> _answers = {};
  bool _submitting = false;
  bool _loading = true;
  dynamic _quizDetails;
  late int _timeLeft;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timeLeft = (widget.quiz['duration'] ?? 10) * 60;
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api
          .get('${ApiConfig.elearningTake}/${widget.quiz['id']}/take');
      if (mounted) {
        setState(() {
          _quizDetails = res.data;
          _loading = false;
        });
        _startTimer();
      }
    } catch (e) {
      debugPrint('Error loading quiz questions: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Xogta imtixaanka lama soo dhoweyn karo')),
        );
        Navigator.pop(context);
      }
    }
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_timeLeft > 0) {
        if (mounted) setState(() => _timeLeft--);
      } else {
        _timer?.cancel();
        _submit();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    _timer?.cancel();

    try {
      final questions = _quizDetails['questions'] as List;
      final Map<String, String> mappedAnswers = {};

      for (var q in questions) {
        final qId = q['id'].toString();
        if (_answers.containsKey(qId)) {
          final options = q['options'] is String
              ? jsonDecode(q['options']) as List
              : q['options'] as List;
          final selectedIdx = _answers[qId]!;
          mappedAnswers[qId] = options[selectedIdx].toString();
        }
      }

      final payload = {
        'answers': mappedAnswers,
      };

      final res = await _api.post(
          '${ApiConfig.elearningSubmit}/${widget.quiz['id']}/submit',
          data: payload);

      if (mounted) {
        _showResult(res.data);
      }
    } catch (e) {
      debugPrint('Error submitting quiz: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Cillad ayaa dhacday submit-ka')),
        );
        setState(() => _submitting = false);
      }
    }
  }

  void _showResult(dynamic result) {
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) => QuizBreakdownScreen(resultData: result),
      ),
    );
  }

  String _formatTime(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: Text(widget.quiz['title'] ?? 'Exam')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final questions = _quizDetails['questions'] as List;
    if (questions.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: Text(widget.quiz['title'] ?? 'Exam')),
        body: const Center(child: Text('Su\'aalo lama helin')),
      );
    }

    final q = questions[_currentIndex];
    final options = q['options'] is String
        ? jsonDecode(q['options']) as List
        : q['options'] as List;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.quiz['title'] ?? 'Exam'),
        actions: [
          Center(
            child: Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Text(
                _formatTime(_timeLeft),
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 18.sp,
                  color: _timeLeft < 60 ? Colors.red : AppTheme.primary,
                ),
              ),
            ),
          ),
        ],
      ),
      body: Padding(
        padding: EdgeInsets.all(24.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            LinearProgressIndicator(
              value: (_currentIndex + 1) / questions.length,
              backgroundColor: Colors.grey[200],
              borderRadius: BorderRadius.circular(10.r),
            ),
            SizedBox(height: 30.h),
            Text('Su\'aasha ${_currentIndex + 1} ee ${questions.length}',
                style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textSecondary,
                    fontSize: 12.sp)),
            SizedBox(height: 10.h),
            Text(q['question'] ?? '',
                style:
                    TextStyle(fontWeight: FontWeight.w900, fontSize: 20.sp)),
            SizedBox(height: 30.h),
            Expanded(
              child: ListView.builder(
                itemCount: options.length,
                itemBuilder: (ctx, idx) {
                  final qId = q['id'].toString();
                  final isSelected = _answers[qId] == idx;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: InkWell(
                      onTap: () => setState(() => _answers[qId] = idx),
                      borderRadius: BorderRadius.circular(18.r),
                      child: Container(
                        padding: EdgeInsets.all(20.w),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? AppTheme.primary.withValues(alpha: 0.1)
                              : Colors.grey[50],
                          borderRadius: BorderRadius.circular(18.r),
                          border: Border.all(
                              color: isSelected
                                  ? AppTheme.primary
                                  : Colors.transparent,
                              width: 2.w),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 30.w,
                              height: 30.h,
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? AppTheme.primary
                                    : Colors.white,
                                shape: BoxShape.circle,
                                border: Border.all(
                                    color: isSelected
                                        ? AppTheme.primary
                                        : Colors.grey[300]!),
                              ),
                              child: Center(
                                child: Text(
                                  String.fromCharCode(65 + idx),
                                  style: TextStyle(
                                    color: isSelected
                                        ? Colors.white
                                        : Colors.black,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ),
                            SizedBox(width: 16.w),
                            Expanded(
                                child: Text(options[idx].toString(),
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold))),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            Row(
              children: [
                if (_currentIndex > 0)
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(15.r)),
                        padding: EdgeInsets.all(18.w),
                      ),
                      onPressed: () => setState(() => _currentIndex--),
                      child: const Text('Back'),
                    ),
                  ),
                if (_currentIndex > 0) SizedBox(width: 16.w),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(15.r)),
                      padding: EdgeInsets.all(18.w),
                    ),
                    onPressed: _currentIndex < questions.length - 1
                        ? () => setState(() => _currentIndex++)
                        : _submit,
                    child: _submitting
                        ? SizedBox(
                            height: 20.h,
                            width: 20.w,
                            child: const CircularProgressIndicator(
                                color: Colors.white, strokeWidth: 2))
                        : Text(_currentIndex < questions.length - 1
                            ? 'Su\'aasha Xigta'
                            : 'DHAMMAYSTIR'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

