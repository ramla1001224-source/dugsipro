import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';
import 'take_quiz_screen.dart';
import 'quiz_results_screen.dart';
import 'add_quiz_screen.dart';
import '../../services/auth_service.dart';

class StudentQuizzesScreen extends StatefulWidget {
  const StudentQuizzesScreen({super.key});

  @override
  State<StudentQuizzesScreen> createState() => _StudentQuizzesScreenState();
}

class _StudentQuizzesScreenState extends State<StudentQuizzesScreen> {
  final ApiService _api = ApiService();
  final AuthService _auth = AuthService();
  List<dynamic> _quizzes = [];
  bool _loading = true;
  String _activeTab = 'active'; // 'active' or 'history'
  String _role = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final role = await _auth.getRole();
      final res = await _api.get(ApiConfig.myQuizzes);
      if (mounted) {
        setState(() {
          _quizzes = res.data;
          _role = role ?? '';
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _deleteQuiz(String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Ma hubtaa?',
            style: TextStyle(fontWeight: FontWeight.w900)),
        content: const Text(
            'Inaad tirtirto imtixaankan? Tani waxay tirtiri doontaa dhammaan natiijooyinka ardayda!'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Maya')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Haa')),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await _api.delete('${ApiConfig.myQuizzes}/$id');
        _load();
      } catch (e) {
        debugPrint('Error deleting quiz: $e');
      }
    }
  }

  Future<void> _toggleQuizStatus(String id, bool currentStatus) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Ma hubtaa?',
            style: TextStyle(fontWeight: FontWeight.w900)),
        content: Text(
            'Inaad ka dhigto imtixaankan ${currentStatus ? "History (Ended)" : "Active"}?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Maya')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Haa')),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await _api.put('${ApiConfig.myQuizzes}/$id/toggle-active',
            data: {'isActive': !currentStatus});
        _load();
      } catch (e) {
        debugPrint('Error toggling quiz: $e');
      }
    }
  }

  Widget _buildTabSelector() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Container(
        height: 50.h,
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(16.r),
        ),
        child: Row(
          children: [
            Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _activeTab = 'active'),
                child: Container(
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: _activeTab == 'active'
                        ? AppTheme.primary
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(16.r),
                    boxShadow: _activeTab == 'active'
                        ? [
                            BoxShadow(
                                color: AppTheme.primary.withValues(alpha: 0.3),
                                blurRadius: 8.r,
                                offset: const Offset(0, 4))
                          ]
                        : null,
                  ),
                  child: Text(
                    'Active',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14.sp,
                      color: _activeTab == 'active'
                          ? Colors.white
                          : Colors.grey.shade600,
                    ),
                  ),
                ),
              ),
            ),
            Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _activeTab = 'history'),
                child: Container(
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: _activeTab == 'history'
                        ? AppTheme.textPrimary
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(16.r),
                    boxShadow: _activeTab == 'history'
                        ? [
                            BoxShadow(
                                color:
                                    AppTheme.textPrimary.withValues(alpha: 0.3),
                                blurRadius: 8.r,
                                offset: const Offset(0, 4))
                          ]
                        : null,
                  ),
                  child: Text(
                    'History',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14.sp,
                      color: _activeTab == 'history'
                          ? Colors.white
                          : Colors.grey.shade600,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    List<dynamic> activeQuizzes;
    List<dynamic> historyQuizzes;

    if (_role == 'teacher' || _role == 'admin' || _role == 'owner') {
      activeQuizzes = _quizzes.where((q) => q['isActive'] != false).toList();
      historyQuizzes = _quizzes.where((q) => q['isActive'] == false).toList();
    } else {
      activeQuizzes = _quizzes.where((q) {
        final results = q['results'] as List?;
        final hasTaken = results != null && results.isNotEmpty;
        return (q['isActive'] != false) && !hasTaken;
      }).toList();

      historyQuizzes = _quizzes.where((q) {
        final results = q['results'] as List?;
        final hasTaken = results != null && results.isNotEmpty;
        return (q['isActive'] == false) || hasTaken;
      }).toList();
    }

    final displayQuizzes =
        _activeTab == 'active' ? activeQuizzes : historyQuizzes;

    return Scaffold(
      appBar: AppBar(title: const Text('E-Learning Quizzes')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                _buildTabSelector(),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _load,
                    child: displayQuizzes.isEmpty
                        ? ListView(
                            children: [
                              SizedBox(
                                  height:
                                      MediaQuery.of(context).size.height * 0.3),
                              Center(
                                  child: Text(
                                      _activeTab == 'active'
                                          ? 'Imtixaanno firfircoon lama helin'
                                          : 'Wax history ah ma jiro',
                                      style: const TextStyle(
                                          color: AppTheme.textSecondary))),
                            ],
                          )
                        : ListView.builder(
                            padding: EdgeInsets.all(16.w),
                            itemCount: displayQuizzes.length,
                            itemBuilder: (ctx, i) {
                              final q = displayQuizzes[i];
                              final results = q['results'] as List?;
                              final hasTaken =
                                  results != null && results.isNotEmpty;

                              return Card(
                                margin: const EdgeInsets.only(bottom: 12),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(20.r)),
                                child: InkWell(
                                  onTap: (hasTaken ||
                                          _role == 'teacher' ||
                                          _role == 'admin')
                                      ? null
                                      : () => Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                                builder: (_) =>
                                                    TakeQuizScreen(quiz: q)),
                                          ).then((_) => _load()),
                                  borderRadius: BorderRadius.circular(20.r),
                                  child: Padding(
                                    padding: EdgeInsets.all(20.w),
                                    child: Column(
                                      children: [
                                        Row(
                                          children: [
                                            Container(
                                              width: 50.w,
                                              height: 50.h,
                                              decoration: BoxDecoration(
                                                color: AppTheme.primary
                                                    .withValues(alpha: 0.1),
                                                borderRadius:
                                                    BorderRadius.circular(15.r),
                                              ),
                                              child: const Icon(
                                                  Icons.quiz_rounded,
                                                  color: AppTheme.primary),
                                            ),
                                            SizedBox(width: 16.w),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(q['title'] ?? '',
                                                      style: TextStyle(
                                                          fontWeight:
                                                              FontWeight.bold,
                                                          fontSize: 16.sp)),
                                                  Text(
                                                      () {
                                                        final subject = q['subject']?['name'] ?? 'All Subject';
                                                        final teacher = q['teacher']?['user']?['name'] ?? 'Admin';
                                                        final className = q['clss']?['class_name'] ?? q['section']?['class']?['class_name'] ?? 'N/A';
                                                        final sectionName = q['section']?['name'] ?? 'Dhammaan Qaybaha';
                                                        return '$subject • $teacher • $className ($sectionName) • ${q['duration']} mins';
                                                      }(),
                                                      style: TextStyle(
                                                          fontSize: 12.sp,
                                                          color: AppTheme
                                                              .textSecondary)),
                                                ],
                                              ),
                                            ),
                                            if (hasTaken && _role == 'student')
                                              Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.end,
                                                children: [
                                                  Text('DHAMMAAD',
                                                      style: TextStyle(
                                                          fontSize: 10.sp,
                                                          fontWeight:
                                                              FontWeight.bold,
                                                          color: AppTheme
                                                              .success)),
                                                  Text(
                                                      '${((results[0]['score'] / (q['_count']?['questions'] ?? 1)) * 100).toStringAsFixed(0)}%',
                                                      style: TextStyle(
                                                          fontWeight:
                                                              FontWeight.w900,
                                                          fontSize: 18.sp)),
                                                ],
                                              )
                                            else if (_role == 'teacher' ||
                                                _role == 'admin')
                                              Row(
                                                children: [
                                                  IconButton(
                                                    icon: const Icon(
                                                        Icons
                                                            .analytics_outlined,
                                                        color: Colors.blue),
                                                    onPressed: () =>
                                                        Navigator.push(
                                                      context,
                                                      MaterialPageRoute(
                                                          builder: (_) =>
                                                              QuizResultsScreen(
                                                                  quizId: q[
                                                                          'id']
                                                                      .toString(),
                                                                  quizTitle:
                                                                      q['title'] ??
                                                                          '')),
                                                    ),
                                                  ),
                                                  IconButton(
                                                    icon: const Icon(
                                                        Icons.edit_outlined,
                                                        color: Colors.indigo),
                                                    onPressed: () =>
                                                        Navigator.push(
                                                      context,
                                                      MaterialPageRoute(
                                                          builder: (_) =>
                                                              AddQuizScreen(
                                                                  quiz: q)),
                                                    ).then((_) => _load()),
                                                  ),
                                                  IconButton(
                                                    icon: Icon(
                                                        q['isActive'] != false
                                                            ? Icons
                                                                .lock_clock_rounded
                                                            : Icons
                                                                .lock_open_rounded,
                                                        color: q['isActive'] !=
                                                                false
                                                            ? Colors.orange
                                                            : Colors.green),
                                                    onPressed: () =>
                                                        _toggleQuizStatus(
                                                            q['id'].toString(),
                                                            q['isActive'] !=
                                                                false),
                                                  ),
                                                  IconButton(
                                                    icon: const Icon(
                                                        Icons
                                                            .delete_outline_rounded,
                                                        color: Colors.red),
                                                    onPressed: () =>
                                                        _deleteQuiz(
                                                            q['id'].toString()),
                                                  ),
                                                ],
                                              )
                                            else
                                              const Icon(Icons.chevron_right,
                                                  color:
                                                      AppTheme.textSecondary),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                  ),
                ),
              ],
            ),
      floatingActionButton: (_role == 'teacher' || _role == 'admin')
          ? FloatingActionButton.extended(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const AddQuizScreen()),
              ).then((_) => _load()),
              label: const Text('Add Quiz'),
              icon: const Icon(Icons.add),
              backgroundColor: AppTheme.primary,
            )
          : null,
    );
  }
}

