import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';

class SubjectsScreen extends StatefulWidget {
  const SubjectsScreen({super.key});
  @override
  State<SubjectsScreen> createState() => _SubjectsScreenState();
}

class _SubjectsScreenState extends State<SubjectsScreen> {
  final ApiService _api = ApiService();
  List<dynamic> _classes = [];
  List<dynamic> _subjects = [];
  bool _loading = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loading = true);
    try {
      final subRes = await _api.get(ApiConfig.subjects);
      final classRes = await _api.get(ApiConfig.classes);

      final subData = subRes.data;
      final subList = subData is List
          ? subData
          : subData['subjects'] ?? subData['data'] ?? [];

      final classData = classRes.data;
      final classList = classData is List
          ? classData
          : classData['classes'] ?? classData['data'] ?? [];

      if (mounted) {
        setState(() {
          _subjects = subList;
          _classes = classList;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _showAddDialog() async {
    final nameCtrl = TextEditingController();
    final codeCtrl = TextEditingController();
    List<String> selectedClassIds = [];

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            backgroundColor: Colors.white,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(24.r)),
            title: const Text('Add New Subject',
                style: TextStyle(fontWeight: FontWeight.w900)),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: nameCtrl,
                    decoration: InputDecoration(
                      labelText: 'Subject Name',
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.all(Radius.circular(12.r))),
                    ),
                    enabled: !_submitting,
                  ),
                  SizedBox(height: 16.h),
                  TextField(
                    controller: codeCtrl,
                    decoration: InputDecoration(
                      labelText: 'Subject Code (e.g. MATH101)',
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.all(Radius.circular(12.r))),
                    ),
                    enabled: !_submitting,
                  ),
                  SizedBox(height: 20.h),
                  Text('Assign to Classes',
                      style: TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 12.sp,
                          color: Colors.grey)),
                  SizedBox(height: 8.h),
                  Container(
                    height: 200.h,
                    width: double.maxFinite,
                    decoration: BoxDecoration(
                      color: Colors.grey[50],
                      borderRadius: BorderRadius.circular(12.r),
                      border: Border.all(color: Colors.grey[200]!),
                    ),
                    child: ListView.builder(
                      itemCount: _classes.length,
                      itemBuilder: (context, i) {
                        final c = _classes[i];
                        final id = c['id'].toString();
                        final isSelected = selectedClassIds.contains(id);
                        return CheckboxListTile(
                          title: Text(c['class_name'] ?? 'Class $i',
                              style: TextStyle(
                                  fontWeight: FontWeight.w700, fontSize: 14.sp)),
                          value: isSelected,
                          onChanged: (val) {
                            setDialogState(() {
                              if (val == true) {
                                selectedClassIds.add(id);
                              } else {
                                selectedClassIds.remove(id);
                              }
                            });
                          },
                          activeColor: const Color(0xFF8B5CF6),
                          controlAffinity: ListTileControlAffinity.leading,
                          visualDensity: VisualDensity.compact,
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: _submitting ? null : () => Navigator.pop(ctx, false),
                child: const Text('CANCEL'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF8B5CF6),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12.r)),
                ),
                onPressed: _submitting
                    ? null
                    : () async {
                        if (nameCtrl.text.isEmpty || codeCtrl.text.isEmpty) {
                          return;
                        }
                        setDialogState(() => _submitting = true);
                        final messenger = ScaffoldMessenger.of(context);
                        try {
                          await _api.post(ApiConfig.subjects, data: {
                            'name': nameCtrl.text.trim(),
                            'code': codeCtrl.text.trim(),
                            'classIds': selectedClassIds,
                          });
                          if (!ctx.mounted) return;
                          Navigator.pop(ctx, true);
                        } catch (e) {
                          messenger.showSnackBar(
                            SnackBar(
                              content: Text('Error: ${e.toString()}'),
                              backgroundColor: Colors.red,
                            ),
                          );
                        } finally {
                          if (mounted) {
                            setDialogState(() => _submitting = false);
                          }
                        }
                      },
                child: _submitting
                    ? SizedBox(
                        height: 16.h,
                        width: 16.w,
                        child: const CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Text('CREATE'),
              ),
            ],
          );
        },
      ),
    );

    if (ok == true) {
      _load();
    }
  }

  Future<void> _showEditDialog(dynamic subject) async {
    final nameCtrl = TextEditingController(text: subject['name']);
    final codeCtrl = TextEditingController(text: subject['code']);
    final id = subject['id'].toString();

    // Extract current assigned class IDs from Assignments
    List<dynamic> assignments = subject['Assignments'] ?? [];
    List<String> selectedClassIds = assignments
        .map((a) => a['section']?['classId']?.toString())
        .where((id) => id != null)
        .cast<String>()
        .toSet()
        .toList();

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            backgroundColor: Colors.white,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(24.r)),
            title: const Text('Edit Subject',
                style: TextStyle(fontWeight: FontWeight.w900)),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: nameCtrl,
                    decoration: InputDecoration(
                      labelText: 'Subject Name',
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.all(Radius.circular(12.r))),
                    ),
                    enabled: !_submitting,
                  ),
                  SizedBox(height: 16.h),
                  TextField(
                    controller: codeCtrl,
                    decoration: InputDecoration(
                      labelText: 'Subject Code',
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.all(Radius.circular(12.r))),
                    ),
                    enabled: !_submitting,
                  ),
                  SizedBox(height: 20.h),
                  Text('Manage Assignments',
                      style: TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 12.sp,
                          color: Colors.grey)),
                  SizedBox(height: 8.h),
                  Container(
                    height: 200.h,
                    width: double.maxFinite,
                    decoration: BoxDecoration(
                      color: Colors.grey[50],
                      borderRadius: BorderRadius.circular(12.r),
                      border: Border.all(color: Colors.grey[200]!),
                    ),
                    child: ListView.builder(
                      itemCount: _classes.length,
                      itemBuilder: (context, i) {
                        final c = _classes[i];
                        final cid = c['id'].toString();
                        final isSelected = selectedClassIds.contains(cid);
                        return CheckboxListTile(
                          title: Text(c['class_name'] ?? 'Class $i',
                              style: TextStyle(
                                  fontWeight: FontWeight.w700, fontSize: 14.sp)),
                          value: isSelected,
                          onChanged: (val) {
                            setDialogState(() {
                              if (val == true) {
                                selectedClassIds.add(cid);
                              } else {
                                selectedClassIds.remove(cid);
                              }
                            });
                          },
                          activeColor: const Color(0xFF8B5CF6),
                          controlAffinity: ListTileControlAffinity.leading,
                          visualDensity: VisualDensity.compact,
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: _submitting ? null : () => Navigator.pop(ctx, false),
                child: const Text('CANCEL'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF8B5CF6),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12.r)),
                ),
                onPressed: _submitting
                    ? null
                    : () async {
                        if (nameCtrl.text.isEmpty) return;
                        setDialogState(() => _submitting = true);
                        final messenger = ScaffoldMessenger.of(context);
                        try {
                          await _api.put('${ApiConfig.subjects}/$id', data: {
                            'name': nameCtrl.text.trim(),
                            'code': codeCtrl.text.trim(),
                            'classIds': selectedClassIds,
                          });
                          if (!ctx.mounted) return;
                          Navigator.pop(ctx, true);
                        } catch (e) {
                          messenger.showSnackBar(
                            SnackBar(
                              content: Text('Error: ${e.toString()}'),
                              backgroundColor: Colors.red,
                            ),
                          );
                        } finally {
                          if (mounted) {
                            setDialogState(() => _submitting = false);
                          }
                        }
                      },
                child: _submitting
                    ? SizedBox(
                        height: 16.h,
                        width: 16.w,
                        child: const CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Text('UPDATE'),
              ),
            ],
          );
        },
      ),
    );

    if (ok == true) {
      _load();
    }
  }

  Future<void> _confirmDelete(String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Subject?'),
        content: const Text(
            'Are you sure you want to remove this subject from the curriculum?'),
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

    if (ok == true) {
      if (!mounted) return;
      setState(() => _loading = true);
      final messenger = ScaffoldMessenger.of(context);
      try {
        await _api.delete('${ApiConfig.subjects}/$id');
        if (mounted) _load();
      } catch (e) {
        if (mounted) setState(() => _loading = false);
        messenger.showSnackBar(
          SnackBar(
              content: Text('Error: ${e.toString()}'),
              backgroundColor: Colors.red),
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
        title: Text(
          'Subjects Management',
          style: TextStyle(
            color: AppTheme.textPrimary,
            fontWeight: FontWeight.w900,
            fontSize: 18.sp,
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.all(16.w),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Subjects',
                              style: TextStyle(
                                fontSize: 24.sp,
                                fontWeight: FontWeight.w900,
                                color: AppTheme.textPrimary,
                                letterSpacing: -0.5,
                              ),
                            ),
                            SizedBox(height: 4.h),
                            Text(
                              'Manage curriculum and subjects',
                              style: TextStyle(
                                fontSize: 13.sp,
                                color: AppTheme.textSecondary,
                              ),
                            ),
                          ],
                        ),
                        GestureDetector(
                          onTap: _showAddDialog,
                          child: Container(
                            padding: EdgeInsets.symmetric(
                                horizontal: 14.w, vertical: 10.h),
                            decoration: BoxDecoration(
                              color: const Color(0xFF8B5CF6),
                              borderRadius: BorderRadius.circular(12.r),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF8B5CF6)
                                      .withValues(alpha: 0.2),
                                  blurRadius: 8.r,
                                  offset: const Offset(0, 4),
                                )
                              ],
                            ),
                            child: Text(
                              '+ NEW SUBJECT',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                                fontSize: 10.sp,
                                letterSpacing: 1,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 20.h),
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
                                _th('SUBJECT NAME', flex: 3),
                                _th('CODE', flex: 2),
                                _th('ACTIONS', flex: 2, alignEnd: true),
                              ],
                            ),
                          ),
                          if (_subjects.isEmpty)
                            Padding(
                              padding: EdgeInsets.all(40.w),
                              child: const Text(
                                'No subjects found.',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: AppTheme.textSecondary,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            )
                          else
                            ListView.separated(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: _subjects.length,
                              separatorBuilder: (_, __) => Divider(
                                  height: 1.h, color: Color(0xFFF1F5F9)),
                              itemBuilder: (ctx, i) {
                                final s = _subjects[i];
                                final name = s['name'] ?? 'N/A';
                                final code = s['code'] ?? '-';

                                // Get unique assigned classes
                                final List<dynamic> assignments =
                                    s['Assignments'] ?? [];
                                final Set<String> assignedClasses = assignments
                                    .map((a) => a['section']?['class']
                                            ?['class_name']
                                        ?.toString())
                                    .where((n) => n != null)
                                    .cast<String>()
                                    .toSet();

                                return Padding(
                                  padding: EdgeInsets.symmetric(
                                      horizontal: 16.w, vertical: 12.h),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(
                                            flex: 3,
                                            child: Text(
                                              name,
                                              style: TextStyle(
                                                fontWeight: FontWeight.w900,
                                                fontSize: 14.sp,
                                                color: AppTheme.textPrimary,
                                              ),
                                            ),
                                          ),
                                          Expanded(
                                            flex: 2,
                                            child: Text(
                                              code.toString(),
                                              style: TextStyle(
                                                fontSize: 12.sp,
                                                fontWeight: FontWeight.w800,
                                                color: AppTheme.textSecondary,
                                              ),
                                            ),
                                          ),
                                          Expanded(
                                            flex: 2,
                                            child: Row(
                                              mainAxisAlignment:
                                                  MainAxisAlignment.end,
                                              children: [
                                                GestureDetector(
                                                  onTap: () =>
                                                      _showEditDialog(s),
                                                  child: const Icon(
                                                      Icons.edit_note_rounded,
                                                      color: Color(0xFF64748B),
                                                      size: 20),
                                                ),
                                                SizedBox(width: 8.w),
                                                GestureDetector(
                                                  onTap: () => _confirmDelete(
                                                      s['id'].toString()),
                                                  child: const Icon(
                                                      Icons
                                                          .delete_outline_rounded,
                                                      color: Color(0xFFFCA5A5),
                                                      size: 20),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                      if (assignedClasses.isNotEmpty) ...[
                                        SizedBox(height: 8.h),
                                        Wrap(
                                          spacing: 4,
                                          runSpacing: 4,
                                          children: assignedClasses
                                              .map((c) => Container(
                                                    padding: EdgeInsets
                                                        .symmetric(
                                                        horizontal: 6.w,
                                                        vertical: 2.h),
                                                    decoration: BoxDecoration(
                                                      color: const Color(
                                                          0xFFF1F5F9),
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                              6.r),
                                                      border: Border.all(
                                                          color: const Color(
                                                              0xFFE2E8F0)),
                                                    ),
                                                    child: Text(
                                                      c,
                                                      style: TextStyle(
                                                        fontSize: 9.sp,
                                                        fontWeight:
                                                            FontWeight.bold,
                                                        color: const Color(
                                                            0xFF475569),
                                                      ),
                                                    ),
                                                  ))
                                              .toList(),
                                        ),
                                      ],
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
}

