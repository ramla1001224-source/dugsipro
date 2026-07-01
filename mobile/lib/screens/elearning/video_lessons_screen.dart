import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../config/api_config.dart';
import '../../main.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:intl/intl.dart';

class VideoLessonsScreen extends StatefulWidget {
  const VideoLessonsScreen({super.key});

  @override
  State<VideoLessonsScreen> createState() => _VideoLessonsScreenState();
}

class _VideoLessonsScreenState extends State<VideoLessonsScreen> {
  final ApiService _api = ApiService();
  final AuthService _auth = AuthService();
  
  List<dynamic> _lessons = [];
  List<dynamic> _classes = [];
  List<dynamic> _subjects = [];
  bool _loading = true;
  String _role = '';
  String _myTeacherId = '';
  String _activeTab = 'active'; // 'active' or 'history'
  
  final _formKey = GlobalKey<FormState>();
  String _title = '';
  String _videoUrl = '';
  String _description = '';
  String? _selectedClassId;
  String? _selectedSectionId;
  String? _selectedSubjectId;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    _role = await _auth.getRole() ?? '';
    _myTeacherId = await _auth.getTeacherId() ?? '';
    await _fetchLessons();
    if (_role == 'teacher' || _role == 'admin') {
      await Future.wait([
        _fetchClasses(),
        _fetchSubjects(),
      ]);
    }
  }

  Future<void> _fetchLessons() async {
    setState(() => _loading = true);
    try {
      final res = await _api.get(ApiConfig.lessons);
      if (mounted) {
        setState(() {
          _lessons = res.data is List ? res.data : (res.data['data'] ?? []);
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _fetchClasses() async {
    try {
      final res = await _api.get(ApiConfig.classes);
      if (mounted) {
        setState(() {
          _classes = res.data is List ? res.data : (res.data['data'] ?? []);
        });
      }
    } catch (e) {
      debugPrint('Error fetching classes: $e');
    }
  }

  Future<void> _fetchSubjects() async {
    try {
      final res = await _api.get(ApiConfig.subjects);
      if (mounted) {
        setState(() {
          _subjects = res.data is List ? res.data : (res.data['data'] ?? []);
        });
      }
    } catch (e) {
      debugPrint('Error fetching subjects: $e');
    }
  }

  List<dynamic> _getSectionsForSelectedClass() {
    if (_selectedClassId == null) return [];
    final cls = _classes.firstWhere(
      (c) => (c['id']?.toString() ?? c['classId']?.toString()) == _selectedClassId,
      orElse: () => null,
    );
    if (cls != null && cls['Sections'] != null) {
      final List<dynamic> sections = List.from(cls['Sections']);
      return [
        {'id': 'all', 'name': 'ALL SECTIONS', 'shift': 'DHAMMAAN'},
        ...sections
      ];
    }
    return [];
  }

  List<dynamic> _getSubjectsForSelectedSection() {
    if (_selectedSectionId == null) return [];
    return _subjects.where((s) {
      final assignments = s['Assignments'] as List? ?? [];
      if (_selectedSectionId == 'all') {
        final cls = _classes.firstWhere((c) => (c['id']?.toString() ?? c['classId']?.toString()) == _selectedClassId);
        final sectionIds = (cls['Sections'] as List? ?? []).map((sec) => sec['id'].toString()).toList();
        return assignments.any((a) => sectionIds.contains(a['sectionId']?.toString()) && (_role == 'admin' || a['teacherId']?.toString() == _myTeacherId));
      }
      return assignments.any((a) => a['sectionId']?.toString() == _selectedSectionId && (_role == 'admin' || a['teacherId']?.toString() == _myTeacherId));
    }).toList();
  }

  Future<void> _saveLesson() async {
    if (!_formKey.currentState!.validate()) return;
    _formKey.currentState!.save();
    
    setState(() => _isSaving = true);
    try {
      await _api.post(ApiConfig.lessons, data: {
        'title': _title,
        'videoUrl': _videoUrl,
        'description': _description,
        'classId': _selectedClassId,
        'sectionId': _selectedSectionId == 'all' ? null : _selectedSectionId,
        'subjectId': _selectedSubjectId,
        'teacherId': _myTeacherId,
      });
      if (mounted) {
        Navigator.pop(context);
        _fetchLessons();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Casharka waa la guuleystay!'), backgroundColor: AppTheme.success)
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Cillad ayaa dhacday: $e'), backgroundColor: AppTheme.danger)
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _deleteLesson(String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Ma hubtaa?', style: TextStyle(fontWeight: FontWeight.w900)),
        content: const Text('Inaad tirtirto casharkan?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Maya')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Haa', style: TextStyle(color: Colors.red))),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await _api.delete('${ApiConfig.lessons}/$id');
        _fetchLessons();
      } catch (e) {
        debugPrint('Error deleting lesson: $e');
      }
    }
  }

  Future<void> _toggleLessonStatus(String id, bool currentStatus) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Ma hubtaa?', style: TextStyle(fontWeight: FontWeight.w900)),
        content: Text('Inaad ka dhigto casharkan ${currentStatus ? "History (Ended)" : "Active"}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Maya')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Haa')),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await _api.put('${ApiConfig.lessons}/$id/toggle-active', data: {
          'isActive': !currentStatus
        });
        _fetchLessons();
      } catch (e) {
        debugPrint('Error toggling lesson: $e');
      }
    }
  }

  void _showAddDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => Container(
          padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(30.r)),
          ),
          child: SingleChildScrollView(
            padding: EdgeInsets.all(24.w),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('POST NEW LESSON', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w900, letterSpacing: 1)),
                      IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
                    ],
                  ),
                  SizedBox(height: 20.h),
                  TextFormField(
                    decoration: InputDecoration(labelText: 'Lesson Title', hintText: 'e.g. Intro to Biology'),
                    validator: (v) => v == null || v.isEmpty ? 'Gali cinwaanka' : null,
                    onSaved: (v) => _title = v!,
                  ),
                  SizedBox(height: 16.h),
                  TextFormField(
                    decoration: InputDecoration(labelText: 'Video URL', hintText: 'YouTube link or similar'),
                    validator: (v) => v == null || v.isEmpty ? 'Gali link-ga' : null,
                    onSaved: (v) => _videoUrl = v!,
                  ),
                  SizedBox(height: 16.h),
                  DropdownButtonFormField<String>(
                    decoration: InputDecoration(labelText: 'Class'),
                    initialValue: _selectedClassId,
                    items: () {
                        final map = <String, String>{};
                        for (final c in _classes) {
                          final id = c['id']?.toString() ?? c['classId']?.toString() ?? '';
                          if (id.isNotEmpty) map[id] = c['class_name'] ?? 'Class';
                        }
                        return map.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList();
                    }(),
                    onChanged: (v) {
                      setModalState(() {
                        _selectedClassId = v;
                        _selectedSectionId = null;
                        _selectedSubjectId = null;
                      });
                    },
                    validator: (v) => v == null ? 'Dooro fasalka' : null,
                  ),
                  SizedBox(height: 16.h),
                  DropdownButtonFormField<String>(
                    key: ValueKey(_selectedClassId),
                    decoration: InputDecoration(labelText: 'Section'),
                    initialValue: _selectedSectionId,
                    items: _getSectionsForSelectedClass().map((s) => DropdownMenuItem(value: s['id'].toString(), child: Text('${s['name']} (${s['shift']})', style: TextStyle(color: s['id'] == 'all' ? Colors.blue : null, fontWeight: s['id'] == 'all' ? FontWeight.w900 : null)))).toList(),
                    onChanged: (v) {
                       setModalState(() {
                         _selectedSectionId = v;
                         _selectedSubjectId = null;
                       });
                    },
                    validator: (v) => v == null ? 'Dooro qaybta' : null,
                  ),
                  SizedBox(height: 16.h),
                  DropdownButtonFormField<String>(
                    key: ValueKey(_selectedSectionId),
                    decoration: InputDecoration(labelText: 'Subject'),
                    initialValue: _selectedSubjectId,
                    items: _getSubjectsForSelectedSection().map((s) => DropdownMenuItem(value: s['id'].toString(), child: Text(s['name']))).toList(),
                    onChanged: (v) => setModalState(() => _selectedSubjectId = v),
                    validator: (v) => v == null ? 'Dooro maadada' : null,
                  ),
                  SizedBox(height: 16.h),
                  TextFormField(
                    maxLines: 3,
                    decoration: InputDecoration(labelText: 'Description'),
                    onSaved: (v) => _description = v ?? '',
                  ),
                  SizedBox(height: 24.h),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _isSaving ? null : _saveLesson,
                      style: ElevatedButton.styleFrom(backgroundColor: AppTheme.textPrimary, padding: EdgeInsets.symmetric(vertical: 18.h)),
                      child: _isSaving ? const CircularProgressIndicator(color: Colors.white) : const Text('PUBLISH LESSON', style: TextStyle(fontWeight: FontWeight.w900)),
                    ),
                  ),
                  SizedBox(height: 20.h),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    List<dynamic> activeLessons = _lessons.where((l) => l['isActive'] != false).toList();
    List<dynamic> activeHistory = _lessons.where((l) => l['isActive'] == false).toList();
    List<dynamic> displayLessons = _activeTab == 'active' ? activeLessons : activeHistory;

    return Scaffold(
      backgroundColor: AppTheme.surface,
      appBar: AppBar(
        title: Text('Video Lessons', style: TextStyle(fontSize: 22.sp, fontWeight: FontWeight.bold)),
        elevation: 0,
        backgroundColor: Colors.transparent,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: EdgeInsets.symmetric(horizontal: 16.0.w),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'SHARE EDUCATIONAL VIDEOS WITH YOUR STUDENTS',
                    style: TextStyle(fontSize: 11.sp, color: Colors.grey, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                  ),
                  SizedBox(height: 16.h),
                  if (_role == 'teacher' || _role == 'admin')
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _showAddDialog,
                        icon: const Icon(Icons.add, size: 18),
                        label: const Text('+ ADD VIDEO LESSON'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
                          padding: EdgeInsets.symmetric(vertical: 14.h),
                          elevation: 0,
                        ),
                      ),
                    ),
                  SizedBox(height: 20.h),
                  _buildTabSelector(activeLessons.length, activeHistory.length),
                  SizedBox(height: 16.h),
                  Expanded(
                    child: displayLessons.isEmpty
                        ? Center(
                            child: Text(
                              'No ${_activeTab == 'active' ? 'active' : 'history'} videos found.',
                              style: TextStyle(color: Colors.grey, fontSize: 16.sp),
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.only(bottom: 24),
                            itemCount: displayLessons.length,
                            itemBuilder: (ctx, i) {
                              final l = displayLessons[i];
                              return _buildVideoCard(l);
                            },
                          ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildTabSelector(int activeCount, int historyCount) {
    return Row(
      children: [
        _buildTab('ACTIVE VIDEOS ($activeCount)', 'active'),
        SizedBox(width: 8.w),
        _buildTab('VIDEO HISTORY ($historyCount)', 'history'),
      ],
    );
  }

  Widget _buildTab(String label, String key) {
    bool active = _activeTab == key;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _activeTab = key),
        child: Container(
          padding: EdgeInsets.symmetric(vertical: 12.h),
          decoration: BoxDecoration(
            color: active ? AppTheme.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(12.r),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: active ? Colors.white : Colors.grey.shade500,
              fontWeight: FontWeight.w800,
              fontSize: 12.sp,
            ),
          ),
        ),
      ),
    );
  }

  String? _extractYoutubeId(String url) {
    final regExp = RegExp(
        r'(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})',
        caseSensitive: false,
        multiLine: false);
    final match = regExp.firstMatch(url);
    if (match != null && match.groupCount >= 1) return match.group(1);
    return null;
  }

  Widget _buildVideoCard(dynamic l) {
    final bool isActive = l['isActive'] != false;
    final className = l['clss']?['class_name'] ?? l['section']?['class']?['class_name'] ?? 'N/A';
    final sectionName = l['section']?['name'] ?? 'Dhammaan Qaybaha';
    final subjectName = l['subject']?['name'] ?? 'ALL SUBJECTS';
    
    String formattedDate = 'N/A';
    final rawDate = l['createdAt'] ?? l['created_at'];
    if (rawDate != null) {
      try {
        final dt = DateTime.parse(rawDate);
        formattedDate = DateFormat('MMM d, yyyy • h:mm a').format(dt);
      } catch (_) {
        formattedDate = rawDate.toString().split('T')[0];
      }
    }
    
    final title = l['title']?.toString().toUpperCase() ?? 'UNTITLED LESSON';
    final ytId = _extractYoutubeId(l['videoUrl'] ?? '');

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20.r),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 20.r,
            offset: const Offset(0, 8),
          ),
        ],
        border: Border.all(color: Colors.grey.shade100, width: 1.5.w),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 160.h,
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.vertical(top: Radius.circular(20.r)),
              image: ytId != null
                  ? DecorationImage(
                      image: CachedNetworkImageProvider(
                        'https://img.youtube.com/vi/$ytId/hqdefault.jpg',
                      ),
                      fit: BoxFit.cover,
                    )
                  : null,
            ),
            child: Stack(
              children: [
                if (ytId != null)
                  Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.vertical(top: Radius.circular(20.r)),
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.black.withValues(alpha: 0.3),
                          Colors.transparent,
                          Colors.black.withValues(alpha: 0.5),
                        ],
                      ),
                    ),
                  ),
                Center(
                  child: ytId != null
                      ? Container(
                          padding: EdgeInsets.all(12.w),
                          decoration: BoxDecoration(
                            color: Colors.red.withValues(alpha: 0.9),
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: Colors.red.withValues(alpha: 0.4),
                                blurRadius: 12.r,
                                spreadRadius: 2,
                              ),
                            ],
                          ),
                          child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 36),
                        )
                      : const Icon(Icons.ondemand_video_rounded, size: 54, color: Color(0xFF94A3B8)),
                ),
                Positioned(
                  top: 12,
                  right: 12,
                  child: Container(
                    padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
                    decoration: BoxDecoration(
                      color: isActive ? const Color(0xFF10B981) : const Color(0xFF64748B),
                      borderRadius: BorderRadius.circular(20.r),
                      boxShadow: [
                        BoxShadow(
                          color: (isActive ? const Color(0xFF10B981) : const Color(0xFF64748B)).withValues(alpha: 0.3),
                          blurRadius: 8.r,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Text(
                      isActive ? 'ACTIVE' : 'ENDED',
                      style: TextStyle(color: Colors.white, fontSize: 10.sp, fontWeight: FontWeight.w900, letterSpacing: 1),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.all(20.w),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.w900, color: const Color(0xFF0F172A), letterSpacing: -0.3),
                ),
                if (l['description'] != null && l['description'].toString().trim().isNotEmpty) ...[
                  SizedBox(height: 8.h),
                  Text(
                    l['description'].toString(),
                    style: TextStyle(fontSize: 14.sp, color: const Color(0xFF475569), height: 1.5.h),
                  ),
                ],
                SizedBox(height: 16.h),
                _buildDetailRow(Icons.menu_book_rounded, subjectName, color: const Color(0xFF3B82F6)),
                SizedBox(height: 10.h),
                _buildDetailRow(Icons.group_rounded, '$className ($sectionName)', color: const Color(0xFFF59E0B)),
                SizedBox(height: 10.h),
                _buildDetailRow(Icons.schedule_rounded, formattedDate, color: const Color(0xFF8B5CF6)),
                SizedBox(height: 24.h),
                Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () async {
                          final url = Uri.parse(l['videoUrl'] ?? '');
                          if (await canLaunchUrl(url)) await launchUrl(url);
                        },
                        borderRadius: BorderRadius.circular(14.r),
                        child: Container(
                          padding: EdgeInsets.symmetric(vertical: 14.h),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(14.r),
                            border: Border.all(color: const Color(0xFFBFDBFE)),
                          ),
                          alignment: Alignment.center,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.play_circle_filled_rounded, color: Color(0xFF2563EB), size: 18),
                              SizedBox(width: 8.w),
                              Text(
                                'WATCH VIDEO',
                                style: TextStyle(color: const Color(0xFF2563EB), fontWeight: FontWeight.w900, fontSize: 13.sp, letterSpacing: 0.5),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    if (_role == 'teacher' || _role == 'admin') ...[
                      SizedBox(width: 12.w),
                      InkWell(
                        onTap: () => _deleteLesson(l['id'].toString()),
                        borderRadius: BorderRadius.circular(14.r),
                        child: Container(
                          padding: EdgeInsets.all(14.w),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF2F2),
                            borderRadius: BorderRadius.circular(14.r),
                            border: Border.all(color: const Color(0xFFFECACA)),
                          ),
                          child: const Icon(Icons.delete_outline_rounded, size: 20, color: Color(0xFFE11D48)),
                        ),
                      ),
                    ],
                  ],
                ),
                if (_role == 'teacher' || _role == 'admin') ...[
                  SizedBox(height: 12.h),
                  InkWell(
                    onTap: () => _toggleLessonStatus(l['id'].toString(), isActive),
                    borderRadius: BorderRadius.circular(14.r),
                    child: Container(
                      width: double.infinity,
                      padding: EdgeInsets.symmetric(vertical: 14.h),
                      decoration: BoxDecoration(
                        color: isActive ? const Color(0xFFFFF7ED) : const Color(0xFFF0FDF4),
                        borderRadius: BorderRadius.circular(14.r),
                        border: Border.all(color: isActive ? const Color(0xFFFFEDD5) : const Color(0xFFDCFCE7)),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        isActive ? 'MARK AS ENDED' : 'MARK AS ACTIVE',
                        style: TextStyle(color: isActive ? const Color(0xFFEA580C) : const Color(0xFF16A34A), fontWeight: FontWeight.w900, fontSize: 13.sp, letterSpacing: 0.5),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String text, {Color? color}) {
    return Row(
      children: [
        Container(
          padding: EdgeInsets.all(6.w),
          decoration: BoxDecoration(
            color: (color ?? const Color(0xFF64748B)).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8.r),
          ),
          child: Icon(icon, size: 14, color: color ?? const Color(0xFF64748B)),
        ),
        SizedBox(width: 12.w),
        Expanded(
          child: Text(
            text,
            style: TextStyle(fontSize: 13.sp, color: const Color(0xFF475569), fontWeight: FontWeight.w700),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

