import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:file_picker/file_picker.dart';
import 'package:dio/dio.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../config/api_config.dart';

class HomeworkScreen extends StatefulWidget {
  const HomeworkScreen({super.key});
  @override
  State<HomeworkScreen> createState() => _HomeworkScreenState();
}

class _HomeworkScreenState extends State<HomeworkScreen> {
  final ApiService _api = ApiService();

  List<dynamic> _homeworks = [];
  List<dynamic> _submissions = [];
  List<dynamic> _classes = [];
  List<dynamic> _subjects = [];
  String? _selectedClassId;
  String? _selectedSubjectId;
  String? _role;
  bool _loading = true;
  final AuthService _auth = AuthService();

  @override
  void initState() {
    super.initState();
    _loadFilters();
  }

  Future<void> _loadFilters() async {
    try {
      final role = await _auth.getRole();
      final profile = await _auth.getProfile();

      if (mounted) {
        setState(() {
          _role = role;
        });
      }

      if (role == 'student') {
        final enrollment = await _auth.getCurrentEnrollment();
        if (enrollment != null) {
          _selectedClassId = enrollment['classId']?.toString();
        } else if (profile != null) {
          final student = profile['student'] ?? profile['Student'];
          if (student != null && student['classId'] != null) {
            _selectedClassId = student['classId'].toString();
          }
        }
      } else {
        final resC = await _api.get(ApiConfig.classes);
        final resS = await _api.get(ApiConfig.subjects);

        final cData = resC.data;
        final sData = resS.data;

        if (mounted) {
          setState(() {
            _classes = cData is List ? cData : (cData['data'] ?? []);
            _subjects = sData is List ? sData : (sData['data'] ?? []);
          });
        }
      }
      _loadData();
    } catch (_) {
      if (mounted) _loadData();
    }
  }

  Future<void> _confirmDelete(String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Homework?'),
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

    if (ok == true) _delete(id);
  }

  Future<void> _delete(String id) async {
    setState(() => _loading = true);
    try {
      await _api.delete('${ApiConfig.homework}/$id');
      if (mounted) {
        if (mounted && context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Homework deleted'), backgroundColor: Colors.green),
        );
        }
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        if (mounted && context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Error: ${e.toString()}'),
              backgroundColor: Colors.red),
        );
        }
      }
    }
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      String url = ApiConfig.homework;
      final queryParams = <String>[];
      if (_selectedClassId != null && _selectedClassId!.isNotEmpty) {
        queryParams.add('classId=$_selectedClassId');
      }
      if (_selectedSubjectId != null && _selectedSubjectId!.isNotEmpty) {
        queryParams.add('subjectId=$_selectedSubjectId');
      }
      if (queryParams.isNotEmpty) {
        url += '?${queryParams.join('&')}';
      }

      final res = await _api.get(url);
      final data = res.data;

      // Also load my submissions if student
      if (_role == 'student') {
        try {
          final subRes = await _api.get(ApiConfig.mySubmissions);
          _submissions = subRes.data is List ? subRes.data : [];
        } catch (_) {}
      }

      if (mounted) {
        setState(() {
          _homeworks = data is List ? data : (data['data'] ?? []);
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Map<String, dynamic>? _getMySubmission(String hwId) {
    try {
      return _submissions.firstWhere((s) => s['homeworkId'].toString() == hwId,
          orElse: () => null);
    } catch (_) {
      return null;
    }
  }

  Future<void> _showSubmitDialog(Map<String, dynamic> hw) async {
    final sub = _getMySubmission(hw['id'].toString());
    final contentCtrl = TextEditingController(text: sub?['content'] ?? '');
    PlatformFile? submitFile;
    bool submitting = false;

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title:
              Text(sub == null ? 'Gudbi Shaqo-Guri' : 'Cusboonaysii Shaqada'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                hw['title'] ?? '',
                style:
                    TextStyle(fontWeight: FontWeight.bold, fontSize: 14.sp),
              ),
              SizedBox(height: 12.h),
              TextField(
                controller: contentCtrl,
                maxLines: 4,
                decoration: InputDecoration(
                  hintText: 'Halkan ku qor jawaabtaada...',
                  border: OutlineInputBorder(),
                ),
              ),
              SizedBox(height: 12.h),
              if (sub != null && sub['attachmentUrl'] != null && submitFile == null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8.0),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle, color: Colors.green, size: 16),
                      SizedBox(width: 4.w),
                      Expanded(
                        child: Text(
                          'Hadda: Lifaaq hore u gudbisay',
                          style: TextStyle(fontSize: 12.sp, color: Colors.green, fontWeight: FontWeight.bold),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      submitFile == null
                          ? 'Lifaaq cusub (Optional)'
                          : submitFile!.name,
                      style: TextStyle(
                          fontSize: 12.sp, color: AppTheme.textSecondary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  TextButton.icon(
                    onPressed: () async {
                      final result = await FilePicker.platform.pickFiles(
                        type: FileType.custom,
                        allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
                      );
                      if (result != null && result.files.isNotEmpty) {
                        setDialogState(() => submitFile = result.files.first);
                      }
                    },
                    icon: const Icon(Icons.attach_file, size: 18),
                    label: const Text('ADD',
                        style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('JOOJI')),
            ElevatedButton(
              onPressed: submitting
                  ? null
                  : () async {
                      setDialogState(() => submitting = true);
                      try {
                        FormData data = FormData.fromMap({
                          'homeworkId': hw['id'],
                          'content': contentCtrl.text.trim(),
                        });
                        final submitFilePath = submitFile?.path;
                        if (submitFilePath != null) {
                          data.files.add(MapEntry(
                            'attachment',
                            await MultipartFile.fromFile(submitFilePath,
                                filename: submitFile!.name),
                          ));
                        }
                        await _api.post(ApiConfig.submitHomework, data: data);
                        if (mounted) {
                          if (ctx.mounted) Navigator.pop(ctx);
                          _loadData();
                          if (mounted && context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content: Text('Haddaad si guul ah u gudbisay'),
                                backgroundColor: Colors.green),
                          );
                          }
                        }
                      } catch (e) {
                        if (mounted) {
                          if (mounted && context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                                content: Text('Cillad ayaan jirin: $e'),
                                backgroundColor: Colors.red),
                          );
                          }
                        }
                      } finally {
                        if (mounted) setDialogState(() => submitting = false);
                      }
                    },
              style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white),
              child: Text(submitting ? 'DAWEYNAYA...' : 'DIR'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _launchUrl(String url) async {
    if (url.isEmpty) return;
    
    // Ensure the URL starts with a slash if it doesn't already
    final cleanPath = url.startsWith('/') ? url : '/$url';
    // Ensure baseUrl doesn't end with a slash to avoid double slashes
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
          SnackBar(
            content: Text('Could not open $fullUrl'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_role == null) {
      return const Scaffold(
        backgroundColor: Color(0xFFF8FAFC),
        body: Center(
          child: CircularProgressIndicator(color: AppTheme.primary),
        ),
      );
    }
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
        title: Text(
          _role == 'student' ? 'My Homework' : 'Homework Management',
          style: TextStyle(
            color: AppTheme.textPrimary,
            fontWeight: FontWeight.w900,
            fontSize: 18.sp,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header Content
            Text(
              _role == 'student' ? 'Assignments' : 'Homework Management',
              style: TextStyle(
                fontSize: 24.sp,
                fontWeight: FontWeight.w900,
                color: AppTheme.textPrimary,
                letterSpacing: -0.5,
              ),
            ),
            SizedBox(height: 4.h),
            Text(
              _role == 'student'
                  ? 'Complete and submit your assignments'
                  : 'Review and manage all assigned homework',
              style: TextStyle(
                fontSize: 13.sp,
                color: AppTheme.textSecondary,
              ),
            ),
            SizedBox(height: 16.h),
            if (_role != 'student')
              GestureDetector(
                onTap: () async {
                  final res = await context.push('/homework/add');
                  if (res == true) _loadData();
                },
                child: Container(
                  padding:
                      EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
                  decoration: BoxDecoration(
                    color: AppTheme.primary,
                    borderRadius: BorderRadius.circular(12.r),
                    boxShadow: [
                      BoxShadow(
                          color: AppTheme.primary.withValues(alpha: 0.3),
                          blurRadius: 8.r,
                          offset: const Offset(0, 4))
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.add_circle_outline,
                          color: Colors.white, size: 18),
                      SizedBox(width: 8.w),
                      Text(
                        'POST NEW HOMEWORK',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 12.sp,
                          letterSpacing: 1,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            if (_role != 'student') ...[
              SizedBox(height: 20.h),
            ],

            if (_role != 'student')
              // Filters
              Container(
                padding: EdgeInsets.all(16.w),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16.r),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('CLASS',
                              style: TextStyle(
                                  fontSize: 10.sp,
                                  fontWeight: FontWeight.w900,
                                  color: AppTheme.textSecondary,
                                  letterSpacing: 1.5)),
                          SizedBox(height: 4.h),
                          Container(
                            padding: EdgeInsets.symmetric(horizontal: 12.w),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(10.r),
                            ),
                            child: DropdownButtonHideUnderline(
                              child: DropdownButton<String>(
                                isExpanded: true,
                                value: _selectedClassId,
                                hint: Text('All Classes',
                                    style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13.sp)),
                                onChanged: (v) {
                                  setState(() => _selectedClassId = v);
                                  _loadData();
                                },
                                items: [
                                  DropdownMenuItem(
                                      value: '',
                                      child: Text('All Classes',
                                          style: TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 13.sp))),
                                  ..._classes.map((c) => DropdownMenuItem(
                                      value: c['id'].toString(),
                                      child: Text(c['class_name'] ?? '',
                                          style: TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 13.sp))))
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(width: 12.w),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('SUBJECT',
                              style: TextStyle(
                                  fontSize: 10.sp,
                                  fontWeight: FontWeight.w900,
                                  color: AppTheme.textSecondary,
                                  letterSpacing: 1.5)),
                          SizedBox(height: 4.h),
                          Container(
                            padding: EdgeInsets.symmetric(horizontal: 12.w),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(10.r),
                            ),
                            child: DropdownButtonHideUnderline(
                              child: DropdownButton<String>(
                                isExpanded: true,
                                value: _selectedSubjectId,
                                hint: Text('All Subjects',
                                    style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13.sp)),
                                onChanged: (v) {
                                  setState(() => _selectedSubjectId = v);
                                  _loadData();
                                },
                                items: [
                                  DropdownMenuItem(
                                      value: '',
                                      child: Text('All Subjects',
                                          style: TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 13.sp))),
                                  ..._subjects.map((s) => DropdownMenuItem(
                                      value: s['id'].toString(),
                                      child: Text(s['name'] ?? '',
                                          style: TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 13.sp))))
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            SizedBox(height: 20.h),

            // Table Card
            if (_loading)
              Center(
                  child: Padding(
                      padding: EdgeInsets.all(40.w),
                      child: const CircularProgressIndicator()))
            else
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16.r),
                  border: Border.all(color: const Color(0xFFF1F5F9)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 10.r,
                      offset: const Offset(0, 4),
                    )
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      padding: EdgeInsets.symmetric(
                          horizontal: 16.w, vertical: 12.h),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.only(
                          topLeft: Radius.circular(16.r),
                          topRight: Radius.circular(16.r),
                        ),
                      ),
                      child: Row(
                        children: [
                          _th('HOMEWORK DETAILS', flex: 3),
                          _th('DUE DATE', flex: 2),
                          _th('ACTIONS', flex: 1, alignEnd: true),
                        ],
                      ),
                    ),
                    if (_homeworks.isEmpty)
                      Padding(
                        padding: EdgeInsets.all(40.w),
                        child: const Text(
                          'No homework assignments found.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: AppTheme.textSecondary,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.5,
                          ),
                        ),
                      )
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _homeworks.length,
                        separatorBuilder: (_, __) =>
                            Divider(height: 1.h, color: Color(0xFFF1F5F9)),
                        itemBuilder: (ctx, i) {
                          final hw = _homeworks[i];
                          final title = hw['title'] ?? 'Untitled';
                          final subjectName = hw['subject']?['name'] ?? '';
                          final teacherName =
                              hw['teacher']?['user']?['name'] ?? '';
                          final className = hw['clss']?['class_name'] ?? hw['section']?['class']?['class_name'] ?? hw['class_name'] ?? 'N/A';
                          final sectionName = hw['section']?['name'] ?? 'Dhammaan Qaybaha';
                          final classDisplayName = '$className - $sectionName';

                          String dueDateStr = '';
                          if (hw['dueDate'] != null) {
                            try {
                              final d = DateTime.parse(hw['dueDate']);
                              dueDateStr = '${d.day}/${d.month}/${d.year}';
                            } catch (_) {}
                          }

                          return Padding(
                            padding: EdgeInsets.symmetric(
                                horizontal: 16.w, vertical: 12.h),
                            child: Row(
                              children: [
                                Expanded(
                                  flex: 3,
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        title.toString().toUpperCase(),
                                        style: TextStyle(
                                          fontWeight: FontWeight.w900,
                                          fontSize: 13.sp,
                                          color: AppTheme.textPrimary,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      SizedBox(height: 2.h),
                                      Row(
                                        children: [
                                          Text(
                                            subjectName
                                                .toString()
                                                .toUpperCase(),
                                            style: TextStyle(
                                              fontSize: 9.sp,
                                              fontWeight: FontWeight.w800,
                                              color: AppTheme.textSecondary,
                                              letterSpacing: 1,
                                            ),
                                          ),
                                          if (_role == 'student') ...[
                                            SizedBox(width: 8.w),
                                            _buildStatusBadge(_getMySubmission(
                                                hw['id'].toString())),
                                          ],
                                        ],
                                      ),
                                      SizedBox(height: 4.h),
                                      Row(
                                        children: [
                                          Text(
                                            teacherName,
                                            style: TextStyle(
                                                fontSize: 11.sp,
                                                fontWeight: FontWeight.bold,
                                                color: AppTheme.textPrimary),
                                          ),
                                          SizedBox(width: 8.w),
                                          Container(
                                            padding: EdgeInsets.symmetric(
                                                horizontal: 4.w, vertical: 1.h),
                                            decoration: BoxDecoration(
                                                color: const Color(0xFFEFF6FF),
                                                borderRadius:
                                                    BorderRadius.circular(4.r)),
                                            child: Text(
                                              classDisplayName
                                                  .toString()
                                                  .toUpperCase(),
                                              style: TextStyle(
                                                  color: const Color(0xFF2563EB),
                                                  fontSize: 8.sp,
                                                  fontWeight: FontWeight.w900,
                                                  letterSpacing: 0.5),
                                            ),
                                          )
                                        ],
                                      ),
                                      if (_role == 'student') ...[
                                        Builder(builder: (context) {
                                          final mySub = _getMySubmission(
                                              hw['id'].toString());
                                          if (mySub != null &&
                                              mySub['feedback'] != null &&
                                              mySub['feedback']
                                                  .toString()
                                                  .isNotEmpty) {
                                            return Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                SizedBox(height: 8.h),
                                                Container(
                                                  padding:
                                                      EdgeInsets.all(8.w),
                                                  decoration: BoxDecoration(
                                                    color:
                                                        const Color(0xFFF0FDF4),
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                            8.r),
                                                    border: Border.all(
                                                        color: const Color(
                                                            0xFFDCFCE7)),
                                                  ),
                                                  child: Text(
                                                    'FAALLO: ${mySub['feedback']}',
                                                    style: TextStyle(
                                                        fontSize: 10.sp,
                                                        color:
                                                            const Color(0xFF166534),
                                                        fontWeight:
                                                            FontWeight.bold),
                                                  ),
                                                ),
                                              ],
                                            );
                                          }
                                          return const SizedBox.shrink();
                                        }),
                                      ],
                                      if (_role == 'student' && hw['attachmentUrl'] != null) ...[
                                        SizedBox(height: 8.h),
                                        GestureDetector(
                                          onTap: () => _launchUrl(hw['attachmentUrl']),
                                          child: Row(
                                            children: [
                                              const Icon(Icons.description_rounded,
                                                  size: 16, color: Colors.blue),
                                              SizedBox(width: 4.w),
                                              Text('Eeg Lifaaqa Macalinka',
                                                  style: TextStyle(
                                                      color: Colors.blue,
                                                      fontWeight: FontWeight.bold,
                                                      fontSize: 12.sp,
                                                      decoration: TextDecoration.underline)),
                                            ],
                                          ),
                                        ),
                                      ],
                                      if (_role == 'student') ...[
                                        Builder(builder: (context) {
                                          final mySub = _getMySubmission(hw['id'].toString());
                                          if (mySub != null && mySub['attachmentUrl'] != null) {
                                            return Padding(
                                              padding: const EdgeInsets.only(top: 8.0),
                                              child: GestureDetector(
                                                onTap: () => _launchUrl(mySub['attachmentUrl']),
                                                child: Row(
                                                  children: [
                                                    const Icon(Icons.attachment_rounded,
                                                        size: 16, color: Colors.green),
                                                    SizedBox(width: 4.w),
                                                    Text('Jawaabtaada (Lifaaq)',
                                                        style: TextStyle(
                                                            color: Colors.green,
                                                            fontWeight: FontWeight.bold,
                                                            fontSize: 12.sp,
                                                            decoration: TextDecoration.underline)),
                                                  ],
                                                ),
                                              ),
                                            );
                                          }
                                          return const SizedBox.shrink();
                                        }),
                                      ],
                                    ],
                                  ),
                                ),
                                // Due Date
                                Expanded(
                                  flex: 2,
                                  child: Row(
                                    children: [
                                      Container(
                                        padding: EdgeInsets.symmetric(
                                            horizontal: 8.w, vertical: 4.h),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFF1F5F9),
                                          borderRadius:
                                              BorderRadius.circular(6.r),
                                        ),
                                        child: Text(
                                          dueDateStr.toUpperCase(),
                                          style: TextStyle(
                                              fontSize: 9.sp,
                                              fontWeight: FontWeight.w900,
                                              color: AppTheme.textSecondary,
                                              letterSpacing: 1),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                // Action
                                Expanded(
                                    flex: 1,
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.end,
                                      children: [
                                        if (_role == 'student')
                                          GestureDetector(
                                            onTap: () => _showSubmitDialog(hw),
                                            child: Container(
                                              padding: EdgeInsets.all(6.w),
                                              decoration: BoxDecoration(
                                                  color:
                                                      const Color(0xFFF1F5F9),
                                                  borderRadius:
                                                      BorderRadius.circular(8.r)),
                                              child: const Icon(
                                                Icons.upload_file_rounded,
                                                color: AppTheme.primary,
                                                size: 16,
                                              ),
                                            ),
                                          )
                                        else ...[
                                          GestureDetector(
                                            onTap: () => context.push(
                                                '/homework/submissions/${hw['id']}'),
                                            child: Container(
                                              padding: EdgeInsets.all(6.w),
                                              decoration: BoxDecoration(
                                                  color:
                                                      const Color(0xFFEFF6FF),
                                                  borderRadius:
                                                      BorderRadius.circular(8.r)),
                                              child: const Icon(
                                                Icons.move_to_inbox_rounded,
                                                color: Color(0xFF2563EB),
                                                size: 16,
                                              ),
                                            ),
                                          ),
                                          SizedBox(width: 8.w),
                                          GestureDetector(
                                            onTap: () => _confirmDelete(
                                                hw['id'].toString()),
                                            child: Container(
                                              padding: EdgeInsets.all(6.w),
                                              decoration: BoxDecoration(
                                                  color:
                                                      const Color(0xFFFEF2F2),
                                                  borderRadius:
                                                      BorderRadius.circular(8.r)),
                                              child: const Icon(
                                                Icons.delete_outline,
                                                color: Color(0xFFEF4444),
                                                size: 16,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ],
                                    ))
                              ],
                            ),
                          );
                        },
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _th(String label, {int flex = 1, bool alignEnd = false}) {
    return Expanded(
      flex: flex,
      child: Text(
        label,
        textAlign: alignEnd ? TextAlign.right : TextAlign.left,
        style: TextStyle(
          fontSize: 9.sp,
          fontWeight: FontWeight.w900,
          color: AppTheme.textSecondary,
          letterSpacing: 1.5,
        ),
      ),
    );
  }

  Widget _buildStatusBadge(Map<String, dynamic>? sub) {
    if (sub == null) {
      return Text('MA GUDBSAN',
          style: TextStyle(
              fontSize: 8.sp,
              fontWeight: FontWeight.w900,
              color: Colors.grey,
              letterSpacing: 0.5));
    }
    final status = sub['status'] ?? 'pending';
    final colors = {
      'pending': const Color(0xFFD97706),
      'graded': const Color(0xFF059669),
      'returned': const Color(0xFFDC2626),
    };
    final label = status == 'graded' ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ GRADE: ${sub['grade']}' : status;

    return Container(
      padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 2.h),
      decoration: BoxDecoration(
        color: (colors[status] ?? Colors.grey).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4.r),
      ),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
            fontSize: 7.sp,
            fontWeight: FontWeight.w900,
            color: colors[status] ?? Colors.grey,
            letterSpacing: 0.5),
      ),
    );
  }
}



