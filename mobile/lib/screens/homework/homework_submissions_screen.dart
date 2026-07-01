import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';

class HomeworkSubmissionsScreen extends StatefulWidget {
  final String homeworkId;
  const HomeworkSubmissionsScreen({super.key, required this.homeworkId});

  @override
  State<HomeworkSubmissionsScreen> createState() =>
      _HomeworkSubmissionsScreenState();
}

class _HomeworkSubmissionsScreenState extends State<HomeworkSubmissionsScreen> {
  final ApiService _api = ApiService();
  bool _loading = true;
  List<dynamic> _submissions = [];
  String? _gradingId;
  final TextEditingController _gradeCtrl = TextEditingController();
  final TextEditingController _feedbackCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api
          .get('${ApiConfig.homeworkSubmissions}/${widget.homeworkId}');
      if (mounted) {
        setState(() {
          _submissions = res.data is List ? res.data : (res.data['data'] ?? []);
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submitGrade(String subId) async {
    try {
      await _api.put('${ApiConfig.gradeSubmission}/$subId/grade', data: {
        'grade': _gradeCtrl.text.trim(),
        'feedback': _feedbackCtrl.text.trim(),
        'status': 'graded',
      });
      if (mounted) {
        setState(() => _gradingId = null);
        _load();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Qiimayntii waa la kaydiyay'),
              backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Cillad: ${e.toString()}'),
              backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _launchUrl(String url) async {
    if (url.isEmpty) return;
    final cleanPath = url.startsWith('/') ? url : '/$url';
    final cleanBaseUrl = ApiConfig.baseUrl.endsWith('/') 
        ? ApiConfig.baseUrl.substring(0, ApiConfig.baseUrl.length - 1) 
        : ApiConfig.baseUrl;
    final fullUrl = '$cleanBaseUrl$cleanPath';
    final uri = Uri.parse(fullUrl);
    
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open $fullUrl'), backgroundColor: Colors.red),
        );
      }
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
        title: Text('Jawaabaha Ardayda',
            style: TextStyle(
                color: AppTheme.textPrimary,
                fontWeight: FontWeight.w900,
                fontSize: 18.sp)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView.separated(
                padding: EdgeInsets.all(16.w),
                itemCount: _submissions.length,
                separatorBuilder: (_, __) => SizedBox(height: 12.h),
                itemBuilder: (ctx, i) {
                  final sub = _submissions[i];
                  final isGrading = _gradingId == sub['id'].toString();
                  final graded = sub['status'] == 'graded';

                  return Container(
                    padding: EdgeInsets.all(20.w),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24.r),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                      sub['student']?['user']?['name'] ??
                                          'Arday',
                                      style: TextStyle(
                                          fontWeight: FontWeight.w900,
                                          fontSize: 16.sp)),
                                  Text(
                                      'La soo gudbiyay: ${sub['submittedAt']?.toString().split('T')[0] ?? ''}',
                                      style: TextStyle(
                                          color: AppTheme.textSecondary,
                                          fontSize: 11.sp)),
                                ],
                              ),
                            ),
                            Container(
                              padding: EdgeInsets.symmetric(
                                  horizontal: 10.w, vertical: 4.h),
                              decoration: BoxDecoration(
                                color: graded
                                    ? const Color(0xFFD1FAE5)
                                    : const Color(0xFFFEF3C7),
                                borderRadius: BorderRadius.circular(10.r),
                              ),
                              child: Text(
                                graded ? 'GRADED: ${sub['grade']}' : 'PENDING',
                                style: TextStyle(
                                  fontSize: 9.sp,
                                  fontWeight: FontWeight.w900,
                                  color: graded
                                      ? const Color(0xFF059669)
                                      : const Color(0xFFD97706),
                                ),
                              ),
                            ),
                          ],
                        ),
                        if (sub['content'] != null &&
                            sub['content'].toString().isNotEmpty) ...[
                          SizedBox(height: 12.h),
                          Text(sub['content'],
                              style: TextStyle(
                                  fontSize: 13.sp, color: AppTheme.textPrimary)),
                        ],
                        if (sub['attachmentUrl'] != null) ...[
                          SizedBox(height: 12.h),
                          GestureDetector(
                            onTap: () => _launchUrl(sub['attachmentUrl']),
                            child: Row(
                              children: [
                                const Icon(Icons.description_rounded,
                                    size: 16, color: Colors.blue),
                                SizedBox(width: 4.w),
                                Text('Eeg Lifaaqa (Attachment)',
                                    style: TextStyle(
                                        color: Colors.blue,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 12.sp,
                                        decoration: TextDecoration.underline)),
                              ],
                            ),
                          ),
                        ],
                        if (sub['feedback'] != null && !isGrading) ...[
                          SizedBox(height: 12.h),
                          Container(
                            padding: EdgeInsets.all(12.w),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(12.r),
                            ),
                            child: Text('Feedback: ${sub['feedback']}',
                                style: TextStyle(
                                    fontSize: 11.sp,
                                    fontStyle: FontStyle.italic,
                                    color: AppTheme.textSecondary)),
                          ),
                        ],
                        SizedBox(height: 20.h),
                        if (isGrading) ...[
                          TextField(
                            controller: _gradeCtrl,
                            decoration: InputDecoration(
                                labelText: 'Dhibcaha (Grade)',
                                hintText: 'tusaale: 90/100'),
                          ),
                          SizedBox(height: 10.h),
                          TextField(
                            controller: _feedbackCtrl,
                            decoration: InputDecoration(
                                labelText: 'Faallo (Feedback)'),
                            maxLines: 2,
                          ),
                          SizedBox(height: 16.h),
                          Row(
                            children: [
                              Expanded(
                                child: ElevatedButton(
                                  onPressed: () =>
                                      _submitGrade(sub['id'].toString()),
                                  style: ElevatedButton.styleFrom(
                                      backgroundColor: AppTheme.success,
                                      foregroundColor: Colors.white),
                                  child: const Text('KAYDI',
                                      style: TextStyle(
                                          fontWeight: FontWeight.bold)),
                                ),
                              ),
                              SizedBox(width: 10.w),
                              TextButton(
                                onPressed: () =>
                                    setState(() => _gradingId = null),
                                child: const Text('JOOJI'),
                              ),
                            ],
                          ),
                        ] else ...[
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: () {
                                setState(() {
                                  _gradingId = sub['id'].toString();
                                  _gradeCtrl.text = sub['grade'] ?? '';
                                  _feedbackCtrl.text = sub['feedback'] ?? '';
                                });
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFF1F5F9),
                                foregroundColor: AppTheme.primary,
                                elevation: 0,
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12.r)),
                              ),
                              child: Text('QIIMEE (GRADE)',
                                  style: TextStyle(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 11.sp)),
                            ),
                          ),
                        ],
                      ],
                    ),
                  );
                },
              ),
            ),
    );
  }
}

