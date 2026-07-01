import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:url_launcher/url_launcher.dart';

class StudentDetailScreen extends StatefulWidget {
  final String studentId;
  const StudentDetailScreen({super.key, required this.studentId});
  @override
  State<StudentDetailScreen> createState() => _StudentDetailScreenState();
}

class _StudentDetailScreenState extends State<StudentDetailScreen> {
  final ApiService _api = ApiService();
  Map<String, dynamic>? _student;
  bool _loading = true;
  bool _refreshingAI = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api.get('${ApiConfig.students}/${widget.studentId}');
      if (mounted) {
        setState(() {
          _student = res.data;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _refreshAI() async {
    setState(() => _refreshingAI = true);
    try {
      final res = await _api.post('${ApiConfig.aiGenerate}/${widget.studentId}', data: {});
      if (mounted) {
        setState(() {
          _student?['aiInsights'] = res.data['insight'];
          _refreshingAI = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _refreshingAI = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error generating AI insights')),
        );
      }
    }
  }

  Future<void> _downloadArchive() async {
    try {
      final token = await const FlutterSecureStorage().read(key: 'token');
      final urlStr = '${ApiConfig.baseUrl}/api/reports/student-report/${widget.studentId}?token=$token';
      final url = Uri.parse(urlStr);
      
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Ma furi karo PDF-ka')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error downloading report')),
        );
      }
    }
  }

  Future<void> _confirmDelete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Student?'),
        content: const Text('This action cannot be undone. Are you sure?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('CANCEL')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('DELETE', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (ok == true) _delete();
  }

  Future<void> _delete() async {
    setState(() => _loading = true);
    try {
      await _api.delete('${ApiConfig.students}/${widget.studentId}');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Student deleted'), backgroundColor: Colors.green),
        );
        context.pop(true);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Error: ${e.toString()}'),
              backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final s = _student ?? {};
    final name = s['name'] ?? 'Unknown';

    return Scaffold(
      appBar: AppBar(
        title: Text(name),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_note_rounded),
            onPressed: () async {
              final res =
                  await context.push('/students/edit/${widget.studentId}');
              if (res == true) _load();
            },
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline_rounded, color: Colors.red),
            onPressed: () => _confirmDelete(),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(20.w),
        child: Column(
          children: [
            // Avatar
            Center(
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 40,
                    backgroundColor: AppTheme.primary.withValues(alpha: 0.1),
                    child: Text(
                      name[0].toUpperCase(),
                      style: TextStyle(
                        fontSize: 32.sp,
                        fontWeight: FontWeight.w900,
                        color: AppTheme.primary,
                      ),
                    ),
                  ),
                  SizedBox(height: 12.h),
                  Text(
                    name,
                    style: TextStyle(
                      fontSize: 22.sp,
                      fontWeight: FontWeight.w900,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  Text(
                    s['student_id'] ?? s['studentId'] ?? '',
                    style: const TextStyle(
                      color: AppTheme.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(height: 24.h),

            // Info card
            _infoCard('Personal Info', [
              _infoRow(Icons.wc_rounded, 'Gender', s['gender'] ?? 'N/A'),
              _infoRow(Icons.cake_rounded, 'Date of Birth',
                  s['dob']?.toString().substring(0, 10) ?? 'N/A'),
              _infoRow(Icons.phone_rounded, 'Phone', s['phone'] ?? 'N/A'),
              _infoRow(
                  Icons.location_on_rounded, 'Address', s['address'] ?? 'N/A'),
              _infoRow(
                Icons.class_rounded,
                'Class',
                '${s['class_name'] ?? 'N/A'}${s['section_name'] != null && s['section_name'] != 'N/A' ? ' (${s['section_name']})' : ''}',
              ),
              _infoRow(Icons.card_membership_rounded, 'Scholarship',
                  s['scholarship']?.toString().toUpperCase() ?? 'NONE'),
              _infoRow(
                Icons.calendar_month_rounded,
                'Enrolled',
                s['createdAt']?.toString().substring(0, 10) ?? 'N/A',
              ),
            ]),
            SizedBox(height: 16.h),
            _infoCard('Parent / Guardian', [
              _infoRow(
                Icons.person_rounded,
                'Name',
                s['parent']?['name'] ?? 'N/A',
              ),
              _infoRow(
                Icons.phone_rounded,
                'Phone',
                s['parent']?['phone'] ?? s['parentPhone'] ?? 'N/A',
              ),
            ]),
            SizedBox(height: 16.h),

            // AI Insights
            _infoCard('AI Insights ðŸ¤–', [
              Text(
                s['aiInsights'] ?? 'No insights generated yet.',
                style: TextStyle(
                  fontSize: 13.sp,
                  fontStyle: FontStyle.italic,
                  color: AppTheme.textPrimary,
                ),
              ),
              SizedBox(height: 12.h),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _refreshingAI ? null : _refreshAI,
                  icon: _refreshingAI
                      ? SizedBox(width: 14.w, height: 14.h, child: const CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.refresh_rounded, size: 16),
                  label: Text(_refreshingAI ? 'REFRESHING...' : 'REFRESH AI INSIGHTS'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF1F5F9),
                    foregroundColor: AppTheme.primary,
                    elevation: 0,
                    padding: EdgeInsets.symmetric(vertical: 12.h),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
                  ),
                ),
              ),
            ]),
            SizedBox(height: 16.h),

            // Archive
            Container(
              width: double.infinity,
              padding: EdgeInsets.all(20.w),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF0F172A), Color(0xFF1E293B)]),
                borderRadius: BorderRadius.circular(20.r),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'STUDENT ARCHIVE',
                    style: TextStyle(color: Colors.white60, fontSize: 10.sp, fontWeight: FontWeight.bold, letterSpacing: 1.5),
                  ),
                  SizedBox(height: 12.h),
                  Text(
                    'Soo deji warbixin dhamaystiran oo PDF ah.',
                    style: TextStyle(color: Colors.white, fontSize: 13.sp, fontWeight: FontWeight.w500),
                  ),
                  SizedBox(height: 16.h),
                  ElevatedButton.icon(
                    onPressed: _downloadArchive,
                    icon: const Icon(Icons.picture_as_pdf_rounded, size: 18),
                    label: const Text('DEJI ARCHIVE-KA'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: const Color(0xFF0F172A),
                      elevation: 0,
                      minimumSize: const Size(double.infinity, 44),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10.r)),
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(height: 40.h),
          ],
        ),
      ),
    );
  }

  Widget _infoCard(String title, List<Widget> rows) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(20.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20.r),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title.toUpperCase(),
            style: TextStyle(
              fontSize: 10.sp,
              fontWeight: FontWeight.w900,
              color: AppTheme.textSecondary,
              letterSpacing: 1.5,
            ),
          ),
          SizedBox(height: 14.h),
          ...rows,
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppTheme.primary),
          SizedBox(width: 10.w),
          Text(
            '$label: ',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 13.sp,
              color: AppTheme.textSecondary,
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 13.sp,
                color: AppTheme.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}


