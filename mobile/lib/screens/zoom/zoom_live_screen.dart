import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../config/api_config.dart';

class ZoomLiveScreen extends StatefulWidget {
  const ZoomLiveScreen({super.key});
  @override
  State<ZoomLiveScreen> createState() => _ZoomLiveScreenState();
}

class _ZoomLiveScreenState extends State<ZoomLiveScreen> {
  final ApiService _api = ApiService();
  final AuthService _auth = AuthService();
  List<dynamic> _meetings = [];
  bool _loading = true;
  String? _userRole;
  String? _myTeacherId;
  int _activeTab = 0; // 0 for Active, 1 for History

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final role = await _auth.getRole();
      final myId = await _auth.getTeacherId();
      final res = await _api.get(ApiConfig.virtualClasses);
      final data = res.data;
      if (mounted) {
        setState(() {
          _userRole = role;
          _myTeacherId = myId;
          _meetings = data is List ? data : (data['data'] ?? []);
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<dynamic> get _filteredMeetings {
    return _meetings.where((m) {
      final status = (m['status'] ?? '').toString().toLowerCase();
      if (_activeTab == 0) {
        return status == 'live';
      } else {
        return status == 'ended';
      }
    }).toList();
  }

  Future<void> _joinMeeting(String url) async {
    if (url.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Kulkan ma leh Link')));
      return;
    }
    final uri = Uri.tryParse(url);
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Ma furi karo Zoom URL-ka')),
        );
      }
    }
  }

  Future<void> _endMeeting(String id) async {
    final bool? confirm = await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('So Afjar Kulan'),
        content:
            const Text('Ma hubtaa inaad rabto inaad soo afjarto kulankan?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('CANCEL')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('END',
                  style: TextStyle(
                      color: Colors.red, fontWeight: FontWeight.bold))),
        ],
      ),
    );

    if (confirm == true) {
      setState(() => _loading = true);
      try {
        await _api.put('${ApiConfig.virtualClasses}/$id/status',
            data: {'status': 'ended'});
        _load();
      } catch (_) {
        if (mounted) setState(() => _loading = false);
      }
    }
  }

  Future<void> _showAddDialog() async {
    final titleCtrl = TextEditingController();
    final urlCtrl = TextEditingController();
    String? selectedClassId;
    String? selectedSectionId;
    String? selectedSubjectId;
    List<dynamic> classes = [];
    List<dynamic> subjects = [];
    final startTimeCtrl = TextEditingController();

    try {
      final results = await Future.wait([
        _api.get(ApiConfig.classes),
        _api.get(ApiConfig.subjects),
      ]);
      final resC = results[0];
      final resS = results[1];
      classes = resC.data is List ? resC.data : (resC.data['data'] ?? []);
      subjects = resS.data is List ? resS.data : (resS.data['data'] ?? []);
    } catch (_) {}

    if (!mounted) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Add Zoom Meeting'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                    controller: titleCtrl,
                    decoration: InputDecoration(
                        labelText: 'Topic / Title',
                        hintText: 'e.g. Maths Chapter 1')),
                SizedBox(height: 12.h),
                TextField(
                  controller: urlCtrl,
                  decoration: InputDecoration(
                    labelText: 'Zoom/Meet Link (Optional)',
                    hintText: 'Paste link here or leave for Jitsi',
                    labelStyle: TextStyle(fontSize: 12.sp),
                  ),
                ),
                SizedBox(height: 12.h),
                DropdownButtonFormField<String>(
                  initialValue: selectedClassId,
                  decoration: InputDecoration(labelText: 'Class'),
                  items: () {
                    final uniqueClasses = <String, Map<String, dynamic>>{};
                    for (final c in classes) {
                      final id = c['classId']?.toString() ?? c['id']?.toString() ?? '';
                      if (id.isNotEmpty && !uniqueClasses.containsKey(id)) {
                        uniqueClasses[id] = c;
                      }
                    }
                    return uniqueClasses.values.map((c) {
                      final className = c['class_name']?.toString() ?? 'Class';
                      final id = c['classId']?.toString() ?? c['id']?.toString() ?? '';
                      return DropdownMenuItem<String>(
                        value: id,
                        child: Text(className),
                      );
                    }).toList();
                  }(),
                  onChanged: (v) {
                    if (v != null) {
                      setDialogState(() {
                        selectedClassId = v;
                        selectedSectionId = null;
                        selectedSubjectId = null;
                      });
                    }
                  },
                ),
                SizedBox(height: 12.h),
                DropdownButtonFormField<String>(
                  initialValue: selectedSectionId,
                  decoration: InputDecoration(labelText: 'Section'),
                  items: selectedClassId == null ? [] : [
                    DropdownMenuItem<String>(
                      value: 'all',
                      child: Text('ALL SECTIONS (DHAMMAAN)', style: TextStyle(color: Colors.blue, fontWeight: FontWeight.bold)),
                    ),
                    ...selectedClassId == null ? [] : classes.where((c) {
                      final id = c['classId']?.toString() ?? c['id']?.toString() ?? '';
                      return id == selectedClassId;
                    }).expand<DropdownMenuItem<String>>((c) {
                      if (c.containsKey('Sections')) {
                        final sections = c['Sections'] as List<dynamic>? ?? [];
                        return sections.map((sec) {
                          final sectionName = sec['name']?.toString() ?? 'Sec';
                          return DropdownMenuItem<String>(
                            value: sec['id'].toString(),
                            child: Text(sectionName),
                          );
                        });
                      } else if (c.containsKey('sectionId')) {
                        final sectionName = c['section']?.toString() ?? 'Sec';
                        return [
                          DropdownMenuItem<String>(
                            value: c['sectionId'].toString(),
                            child: Text(sectionName),
                          )
                        ];
                      }
                      return [];
                    }),
                  ],
                  onChanged: (v) {
                    if (v != null) {
                      setDialogState(() {
                        selectedSectionId = v;
                        selectedSubjectId = null;
                      });
                    }
                  },
                ),
                SizedBox(height: 12.h),
                DropdownButtonFormField<String>(
                  initialValue: selectedSubjectId,
                  decoration: InputDecoration(labelText: 'Subject'),
                  items: selectedSectionId == null ? [] : subjects
                      .where((s) {
                        final assignments = s['Assignments'] as List? ?? [];
                        if (selectedSectionId == 'all') {
                          final cls = classes.firstWhere((c) => (c['id']?.toString() ?? c['classId']?.toString()) == selectedClassId);
                          final sectionIds = (cls['Sections'] as List? ?? []).map((sec) => sec['id'].toString()).toList();
                          return assignments.any((a) => 
                            sectionIds.contains(a['sectionId']?.toString()) &&
                            (_userRole == 'admin' || a['teacherId']?.toString() == _myTeacherId)
                          );
                        }
                        return assignments.any((a) => 
                          a['sectionId']?.toString() == selectedSectionId &&
                          (_userRole == 'admin' || a['teacherId']?.toString() == _myTeacherId)
                        );
                      })
                      .map((s) => DropdownMenuItem(
                          value: s['id'].toString(),
                          child: Text(s['name'] ?? 'Subject')))
                      .toList(),
                  onChanged: (v) {
                    if (v != null) setDialogState(() => selectedSubjectId = v);
                  },
                ),
                SizedBox(height: 12.h),
                TextField(
                  controller: startTimeCtrl,
                  decoration: InputDecoration(labelText: 'Start Time'),
                  onTap: () async {
                    FocusScope.of(context).requestFocus(FocusNode());
                    final date = await showDatePicker(
                        context: context,
                        initialDate: DateTime.now(),
                        firstDate: DateTime.now(),
                        lastDate: DateTime(2030));
                    if (date != null) {
                      if (!mounted) return;
                    if (!mounted || !context.mounted) return; final time = await showTimePicker(
                          context: context, initialTime: TimeOfDay.now());
                      if (time != null) {
                        final dt = DateTime(date.year, date.month, date.day,
                            time.hour, time.minute);
                        startTimeCtrl.text = dt.toIso8601String();
                      }
                    }
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('CANCEL')),
            TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('CREATE')),
          ],
        ),
      ),
    );

    if (ok == true &&
        titleCtrl.text.isNotEmpty &&
        selectedSectionId != null &&
        selectedSubjectId != null &&
        startTimeCtrl.text.isNotEmpty) {
      setState(() => _loading = true);
      try {
        // Send a single request â€” backend handles 'all' by setting sectionId=null
        await _api.post('${ApiConfig.virtualClasses}/create', data: {
          'title': titleCtrl.text.trim(),
          'meetingUrl': urlCtrl.text.trim(),
          'sectionId': selectedSectionId, // 'all' or specific sectionId
          'classId': selectedClassId,
          'subjectId': selectedSubjectId,
          'startTime': startTimeCtrl.text,
          'status': 'live',
        });
        _load();
      } catch (e) {
        if (mounted) setState(() => _loading = false);
      }
    }
  }

  Future<void> _deleteMeeting(String id) async {
    final bool? confirm = await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Delete'),
        content: const Text('Are you sure you want to delete this meeting?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('CANCEL')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('DELETE', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirm == true) {
      setState(() => _loading = true);
      try {
        await _api.delete('${ApiConfig.virtualClasses}/$id');
        _load();
      } catch (_) {
        if (mounted) setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    bool canManage = _userRole == 'teacher' ||
        _userRole == 'admin' ||
        _userRole == 'staff' ||
        _userRole == 'owner' ||
        _userRole == 'super_admin';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
        title: Text('Fasallada Online',
            style: TextStyle(
                color: AppTheme.textPrimary,
                fontWeight: FontWeight.w900,
                fontSize: 18.sp)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.all(16.w),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Zoom Live',
                                style: TextStyle(
                                    fontSize: 22.sp,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: -0.5)),
                            Text('Kala soco oo maamul fasallada online-ka ah',
                                style: TextStyle(
                                    fontSize: 13.sp,
                                    color: AppTheme.textSecondary)),
                          ],
                        ),
                        if (canManage)
                          FloatingActionButton.small(
                            onPressed: _showAddDialog,
                            backgroundColor: AppTheme.primary,
                            elevation: 0,
                            child: const Icon(Icons.add, color: Colors.white),
                          ),
                      ],
                    ),
                    SizedBox(height: 24.h),
                    Container(
                      padding: EdgeInsets.all(4.w),
                      decoration: BoxDecoration(
                          color: const Color(0xFFE2E8F0),
                          borderRadius: BorderRadius.circular(12.r)),
                      child: Row(
                        children: [
                          _tabButton(
                              0, 'Kulannada Socda', Icons.video_call_rounded),
                          _tabButton(
                              1, 'Taariikhda (History)', Icons.history_rounded),
                        ],
                      ),
                    ),
                    SizedBox(height: 16.h),
                    if (_filteredMeetings.isEmpty)
                      Padding(
                        padding: EdgeInsets.all(40.w),
                        child: const Center(
                            child: Text('Lama helin wax kulan ah.',
                                style: TextStyle(
                                    color: AppTheme.textSecondary,
                                    fontWeight: FontWeight.bold))),
                      )
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _filteredMeetings.length,
                        separatorBuilder: (_, __) => SizedBox(height: 12.h),
                        itemBuilder: (ctx, i) {
                          final m = _filteredMeetings[i];
                          final title = m['title'] ?? 'Untitled';
                          final sectionData = m['section'] as Map<String, dynamic>?;
                          final clssData = m['clss'] as Map<String, dynamic>?;
                          final className = sectionData?['class']?['class_name'] ?? clssData?['class_name'] ?? 'N/A';
                          final sectionName = sectionData?['name'] ?? 'Dhammaan Qaybaha';
                          final classDisplayName = '$className - $sectionName';
                          final subject = m['subject']?['name'] ?? 'N/A';
                          final startTimeStr =
                              m['startTime'] ?? m['start_time'] ?? '';
                          final startTime = DateTime.tryParse(startTimeStr);
                          final formattedDate = startTime != null
                              ? DateFormat('MMM dd, hh:mm a').format(startTime)
                              : 'N/A';
                          final meetingUrl =
                              m['meetingUrl'] ?? m['meeting_url'] ?? '';
                          final status =
                              (m['status'] ?? '').toString().toLowerCase();

                          return Container(
                            padding: EdgeInsets.all(16.w),
                            decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(20.r),
                                border:
                                    Border.all(color: const Color(0xFFE2E8F0))),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Container(
                                      padding: EdgeInsets.symmetric(
                                          horizontal: 10.w, vertical: 4.h),
                                      decoration: BoxDecoration(
                                          color: const Color(0xFFF1F5F9),
                                          borderRadius:
                                              BorderRadius.circular(8.r)),
                                      child: Text(subject.toUpperCase(),
                                          style: TextStyle(
                                              fontSize: 9.sp,
                                              fontWeight: FontWeight.w900,
                                              color: AppTheme.primary,
                                              letterSpacing: 0.5)),
                                    ),
                                    if (canManage)
                                      Container(
                                        padding: EdgeInsets.symmetric(
                                            horizontal: 10.w, vertical: 4.h),
                                        decoration: BoxDecoration(
                                            color: AppTheme.primary,
                                            borderRadius:
                                                BorderRadius.circular(8.r)),
                                        child: Text('HOST / DOMINATOR',
                                            style: TextStyle(
                                                fontSize: 9.sp,
                                                fontWeight: FontWeight.w900,
                                                color: Colors.white,
                                                letterSpacing: 0.5)),
                                      ),
                                    Text(formattedDate,
                                        style: TextStyle(
                                            fontSize: 11.sp,
                                            color: AppTheme.textSecondary,
                                            fontWeight: FontWeight.bold)),
                                  ],
                                ),
                                SizedBox(height: 12.h),
                                Text(title,
                                    style: TextStyle(
                                        fontWeight: FontWeight.w900,
                                        fontSize: 16.sp)),
                                Text('Class: $classDisplayName',
                                    style: TextStyle(
                                        fontSize: 12.sp,
                                        color: AppTheme.textSecondary)),
                                SizedBox(height: 20.h),
                                if (status == 'live')
                                  Row(
                                    children: [
                                      if (meetingUrl.isNotEmpty)
                                        Expanded(
                                          child: Column(
                                            children: [
                                              ElevatedButton.icon(
                                                onPressed: () =>
                                                    _joinMeeting(meetingUrl),
                                                icon: const Icon(
                                                    Icons.rocket_launch_rounded,
                                                    size: 18),
                                                label: Text(canManage ? 'BILOOW FASALKA (START)' : 'KU BIIR FASALKA (JOIN)',
                                                    style: TextStyle(
                                                        fontWeight:
                                                            FontWeight.w900, fontSize: 11.sp)),
                                                style: ElevatedButton.styleFrom(
                                                  backgroundColor:
                                                      AppTheme.primary,
                                                  foregroundColor: Colors.white,
                                                  padding:
                                                      EdgeInsets.symmetric(
                                                          vertical: 14.h),
                                                  shape: RoundedRectangleBorder(
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                              16.r)),
                                                ),
                                              ),
                                              SizedBox(height: 4.h),
                                              if (canManage)
                                                Text(
                                                  "* Macalin, adiga ayaa Dominator-ka ah.",
                                                  style: TextStyle(
                                                      fontSize: 9.sp,
                                                      color: Colors.grey,
                                                      fontStyle: FontStyle.italic),
                                                ),
                                            ],
                                          ),
                                        ),
                                      if (canManage) ...[
                                        SizedBox(width: 8.w),
                                        GestureDetector(
                                          onTap: () =>
                                              _endMeeting(m['id'].toString()),
                                          child: Container(
                                            padding: EdgeInsets.all(12.w),
                                            decoration: BoxDecoration(
                                                color: const Color(0xFFFFF7ED),
                                                borderRadius:
                                                    BorderRadius.circular(12.r)),
                                            child: const Icon(
                                                Icons.stop_circle_outlined,
                                                color: Color(0xFFEA580C),
                                                size: 20),
                                          ),
                                        ),
                                        SizedBox(width: 8.w),
                                        GestureDetector(
                                          onTap: () => _deleteMeeting(
                                              m['id'].toString()),
                                          child: Container(
                                            padding: EdgeInsets.all(12.w),
                                            decoration: BoxDecoration(
                                                color: const Color(0xFFFEF2F2),
                                                borderRadius:
                                                    BorderRadius.circular(12.r)),
                                            child: const Icon(
                                                Icons.delete_outline_rounded,
                                                color: Color(0xFFEF4444),
                                                size: 20),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                              ],
                            ),
                          );
                        },
                      ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _tabButton(int index, String label, IconData icon) {
    final active = _activeTab == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _activeTab = index),
        child: Container(
          padding: EdgeInsets.symmetric(vertical: 8.h),
          decoration: BoxDecoration(
            color: active ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(10.r),
            boxShadow: active
                ? [
                    BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 4.r,
                        offset: const Offset(0, 2))
                  ]
                : [],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon,
                  size: 16,
                  color: active ? AppTheme.primary : AppTheme.textSecondary),
              SizedBox(width: 6.w),
              Text(label,
                  style: TextStyle(
                      fontSize: 12.sp,
                      fontWeight: active ? FontWeight.w900 : FontWeight.bold,
                      color: active
                          ? AppTheme.textPrimary
                          : AppTheme.textSecondary)),
            ],
          ),
        ),
      ),
    );
  }
}


