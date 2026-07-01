import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';

class QuizResultsScreen extends StatefulWidget {
  final String quizId;
  final String quizTitle;
  const QuizResultsScreen({super.key, required this.quizId, required this.quizTitle});

  @override
  State<QuizResultsScreen> createState() => _QuizResultsScreenState();
}

class _QuizResultsScreenState extends State<QuizResultsScreen> {
  final ApiService _api = ApiService();
  Map<String, dynamic>? _quiz;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchResults();
  }

  Future<void> _fetchResults() async {
    try {
      final res = await _api.get('${ApiConfig.myQuizzes}/${widget.quizId}');
      if (mounted) {
        setState(() {
          _quiz = res.data;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final results = _quiz?['results'] as List? ?? [];

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(widget.quizTitle.toUpperCase()),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Container(
                  width: double.infinity,
                  padding: EdgeInsets.all(24.w),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildStatItem('Submissions', '${results.length}'),
                      _buildStatItem('Questions', '${_quiz?['questions']?.length ?? 0}'),
                    ],
                  ),
                ),
                Expanded(
                  child: results.isEmpty
                      ? const Center(child: Text('Ma jiraan natiijooyin hadda.', style: TextStyle(color: Colors.grey)))
                      : ListView.builder(
                          padding: EdgeInsets.all(16.w),
                          itemCount: results.length,
                          itemBuilder: (ctx, i) {
                            final r = results[i];
                            final percentage = ((r['score'] ?? 0) / (r['totalQuestions'] ?? 1)) * 100;
                            final studentName = r['student']?['user']?['name'] ?? 'Unknown Student';

                            return Card(
                              margin: const EdgeInsets.only(bottom: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20.r)),
                              child: ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: AppTheme.primary.withValues(alpha: 0.1),
                                  child: Text(studentName[0].toUpperCase(), style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold)),
                                ),
                                title: Text(studentName, style: const TextStyle(fontWeight: FontWeight.bold)),
                                subtitle: Text('Score: ${r['score']} / ${r['totalQuestions']}'),
                                trailing: Container(
                                  padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
                                  decoration: BoxDecoration(
                                    color: (percentage >= 50 ? Colors.green : Colors.red).withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(12.r),
                                  ),
                                  child: Text(
                                    '${percentage.toStringAsFixed(0)}%',
                                    style: TextStyle(
                                      color: percentage >= 50 ? Colors.green : Colors.red,
                                      fontWeight: FontWeight.w900,
                                      fontSize: 12.sp,
                                    ),
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }

  Widget _buildStatItem(String label, String value) {
    return Column(
      children: [
        Text(label.toUpperCase(), style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: Colors.grey, letterSpacing: 1)),
        SizedBox(height: 4.h),
        Text(value, style: TextStyle(fontSize: 24.sp, fontWeight: FontWeight.w900, color: AppTheme.textPrimary)),
      ],
    );
  }
}

