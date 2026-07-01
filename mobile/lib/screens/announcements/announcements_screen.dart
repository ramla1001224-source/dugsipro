import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';
import '../../services/auth_service.dart';

class AnnouncementsScreen extends StatefulWidget {
  const AnnouncementsScreen({super.key});
  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  final ApiService _api = ApiService();
  final AuthService _auth = AuthService();
  List<dynamic> _announcements = [];
  List<dynamic> _classes = [];
  bool _loading = true;
  String? _role;
  String _filterPriority = 'all';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.get(ApiConfig.announcements);
      final role = await _auth.getRole();
      if (mounted) {
        setState(() {
          _announcements = res.data is List ? res.data : (res.data['results'] ?? res.data['data'] ?? []);
          _role = role;
          _loading = false;
        });
      }
      // Also fetch classes for admin
      if (role == 'admin' || role == 'super_admin') {
        try {
          final cr = await _api.get('${ApiConfig.announcements}/targets');
          if (mounted) setState(() => _classes = cr.data['classes'] ?? []);
        } catch (_) {}
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _deleteAnnouncement(String id) async {
    final bool? confirm = await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20.r)),
        title: const Text('Tirtir Ogeysiiska', style: TextStyle(fontWeight: FontWeight.w900)),
        content: const Text('Ma hubtaa inaad tirtireyso ogeysiiskan?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('JOOJI')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('TIRTIR', style: TextStyle(color: Colors.red, fontWeight: FontWeight.w900)),
          ),
        ],
      ),
    );
    if (confirm == true) {
      try {
        await _api.delete('${ApiConfig.announcements}/$id');
        _load();
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Cillad: ma tirtirin karin')));
      }
    }
  }

  Future<void> _showAddDialog() async {
    final titleCtrl = TextEditingController();
    final contentCtrl = TextEditingController();
    String priority = 'normal';
    String targetType = 'all';
    String? selectedClassId;

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24.r)),
          insetPadding: EdgeInsets.all(16.w),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header
                Container(
                  padding: EdgeInsets.all(20.w),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [Color(0xFF0F172A), Color(0xFF1E293B)]),
                    borderRadius: BorderRadius.vertical(top: Radius.circular(24.r)),
                  ),
                  child: Row(
                    children: [
                      Text('📢', style: TextStyle(fontSize: 24.sp)),
                      SizedBox(width: 12.w),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('Ogeysiis Cusub', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16.sp)),
                          Text('Notification ayaa u diri doonta dadka la doortay', style: TextStyle(color: const Color(0xFF94A3B8), fontSize: 11.sp)),
                        ]),
                      ),
                      IconButton(icon: const Icon(Icons.close, color: Colors.white60), onPressed: () => Navigator.pop(ctx, false)),
                    ],
                  ),
                ),
                Padding(
                  padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Title
                      _label('Cinwaanka *'),
                      SizedBox(height: 6.h),
                      TextField(
                        controller: titleCtrl,
                        decoration: _inputDecoration('Tusaale: Imtixaanka Xiga...'),
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      SizedBox(height: 16.h),
                      // Content
                      _label('Farriin Buuxda *'),
                      SizedBox(height: 6.h),
                      TextField(
                        controller: contentCtrl,
                        decoration: _inputDecoration('Qor ogeysiiska oo dhamaystiran...'),
                        maxLines: 4,
                      ),
                      SizedBox(height: 16.h),
                      // Priority
                      _label('Darajo'),
                      SizedBox(height: 8.h),
                      Row(
                        children: [
                          ['low', 'âš«', 'Hoose'],
                          ['normal', '🔵', 'Caadi'],
                          ['high', '🟡', 'Muhiim'],
                          ['urgent', '🔍´', 'Deg-deg'],
                        ].map((p) => Expanded(
                          child: GestureDetector(
                            onTap: () => setDialogState(() => priority = p[0]),
                            child: Container(
                              margin: const EdgeInsets.only(right: 6),
                              padding: EdgeInsets.symmetric(vertical: 10.h),
                              decoration: BoxDecoration(
                                color: priority == p[0] ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(12.r),
                                border: Border.all(color: priority == p[0] ? const Color(0xFF0F172A) : const Color(0xFFE2E8F0)),
                              ),
                              child: Column(
                                children: [
                                  Text(p[1], style: TextStyle(fontSize: 16.sp)),
                                  SizedBox(height: 2.h),
                                  Text(p[2], style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.w800, color: priority == p[0] ? Colors.white : const Color(0xFF64748B))),
                                ],
                              ),
                            ),
                          ),
                        )).toList(),
                      ),
                      SizedBox(height: 16.h),
                      // Target Audience
                      _label('U dir Cidda'),
                      SizedBox(height: 8.h),
                      ...[
                        ['all',      'ðŸŒ', 'Dhammaan (Ardayda + Macalimiinta + Waalidinta)'],
                        ['students', '🎓', 'Ardayda Kaliya'],
                        ['teachers', 'ðŸ‘¨â€ðŸ«', 'Macalimiinta Kaliya'],
                        ['parents',  'ðŸ‘¨â€ðŸ‘©â€ðŸ‘§', 'Waalidinta Kaliya'],
                        ['class',    'ðŸ«', 'Fasal Gaar ah...'],
                      ].map((opt) => GestureDetector(
                        onTap: () => setDialogState(() { targetType = opt[0]; if (opt[0] != 'class') selectedClassId = null; }),
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 6),
                          padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h),
                          decoration: BoxDecoration(
                            color: targetType == opt[0] ? const Color(0xFFEFF6FF) : const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(12.r),
                            border: Border.all(color: targetType == opt[0] ? const Color(0xFF3B82F6) : const Color(0xFFE2E8F0), width: targetType == opt[0] ? 2 : 1),
                          ),
                          child: Row(children: [
                            Text(opt[1], style: TextStyle(fontSize: 18.sp)),
                            SizedBox(width: 10.w),
                            Expanded(child: Text(opt[2], style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600, color: const Color(0xFF334155)))),
                            if (targetType == opt[0]) const Icon(Icons.check_circle_rounded, color: Color(0xFF3B82F6), size: 18),
                          ]),
                        ),
                      )),
                      // Class dropdown
                      if (targetType == 'class' && _classes.isNotEmpty) ...[
                        SizedBox(height: 8.h),
                        DropdownButtonFormField<String>(
                          initialValue: selectedClassId,
                          decoration: _inputDecoration('-- Dooro Fasalka --'),
                          items: _classes.map<DropdownMenuItem<String>>((c) => DropdownMenuItem(value: c['id'].toString(), child: Text(c['class_name']?.toString() ?? ''))).toList(),
                          onChanged: (v) => setDialogState(() => selectedClassId = v),
                        ),
                      ],
                      SizedBox(height: 20.h),
                      // Submit
                      ElevatedButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFE11D48),
                          foregroundColor: Colors.white,
                          padding: EdgeInsets.symmetric(vertical: 16.h),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14.r)),
                          elevation: 0,
                        ),
                        child: Text('📱¤ Dir Ogeysiiska + Notification', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15.sp)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    if (ok == true && titleCtrl.text.trim().isNotEmpty) {
      setState(() => _loading = true);
      try {
        List<Map<String, dynamic>> targets = [];
        if (targetType == 'all') {
          targets = [{'targetType': 'all'}];
        } else if (targetType == 'class' && selectedClassId != null) {
          targets = [{'targetType': 'class', 'classId': selectedClassId}];
        } else {
          targets = [{'targetType': targetType}];
        }

        await _api.post(ApiConfig.announcements, data: {
          'title': titleCtrl.text.trim(),
          'content': contentCtrl.text.trim(),
          'priority': priority,
          'targets': targets,
        });
        _load();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('✅ Ogeysiiska waa la diray + Notification'), backgroundColor: Color(0xFF16A34A)),
          );
        }
      } catch (e) {
        if (mounted) {
          setState(() => _loading = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Cillad: ${e.toString()}'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  Widget _label(String text) => Text(text, style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w800, color: const Color(0xFF64748B), letterSpacing: 0.5));

  InputDecoration _inputDecoration(String hint) => InputDecoration(
    hintText: hint,
    hintStyle: TextStyle(color: const Color(0xFFCBD5E1), fontSize: 13.sp),
    contentPadding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r), borderSide: BorderSide(color: const Color(0xFF3B82F6), width: 2.w)),
    filled: true,
    fillColor: const Color(0xFFF8FAFC),
  );

  Color _getPriorityColor(String? priority) {
    switch (priority?.toLowerCase()) {
      case 'urgent': return const Color(0xFFEF4444);
      case 'high':   return const Color(0xFFF59E0B);
      case 'normal': return const Color(0xFF3B82F6);
      case 'low':    return const Color(0xFF64748B);
      default:       return const Color(0xFF3B82F6);
    }
  }

  String _getPriorityLabel(String? priority) {
    switch (priority?.toLowerCase()) {
      case 'urgent': return 'Deg-deg';
      case 'high':   return 'Muhiim';
      case 'normal': return 'Caadi';
      case 'low':    return 'Hoose';
      default:       return 'Caadi';
    }
  }


  List<dynamic> get _filtered {
    if (_filterPriority == 'all') return _announcements;
    return _announcements.where((a) => a['priority'] == _filterPriority).toList();
  }

  @override
  Widget build(BuildContext context) {
    final canManage = _role == 'admin' || _role == 'super_admin';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('📢 Ogeysiisyada', style: TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w900, fontSize: 17.sp)),
            Text('Ogeysiisyada Dugsiga', style: TextStyle(color: AppTheme.textSecondary, fontSize: 11.sp)),
          ],
        ),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _load),
        ],
      ),
      body: Column(
        children: [
          // Filter tabs
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  ['all', 'ðŸŒ Dhammaan'],
                  ['urgent', '🔍´ Deg-deg'],
                  ['high', '🟡 Muhiim'],
                  ['normal', '🔵 Caadi'],
                  ['low', 'âš« Hoose'],
                ].map((f) => GestureDetector(
                  onTap: () => setState(() => _filterPriority = f[0]),
                  child: Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 7.h),
                    decoration: BoxDecoration(
                      color: _filterPriority == f[0] ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(20.r),
                    ),
                    child: Text(f[1], style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w800, color: _filterPriority == f[0] ? Colors.white : const Color(0xFF64748B))),
                  ),
                )).toList(),
              ),
            ),
          ),
          // List
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: _filtered.isEmpty
                        ? ListView(children: [
                            SizedBox(
                              height: MediaQuery.of(context).size.height * 0.5,
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text('📢', style: TextStyle(fontSize: 56.sp)),
                                  SizedBox(height: 12.h),
                                  Text('Ma jiraan ogeysiisyo', style: TextStyle(color: AppTheme.textPrimary, fontSize: 16.sp, fontWeight: FontWeight.w800)),
                                  SizedBox(height: 4.h),
                                  Text(canManage ? 'Riix + si aad u dirtid ogeysiis cusub' : 'Wali ogeysiis lama soo dirin', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12.sp)),
                                ],
                              ),
                            )
                          ])
                        : ListView.builder(
                            padding: EdgeInsets.all(16.w),
                            itemCount: _filtered.length,
                            itemBuilder: (context, index) {
                              final a = _filtered[index];
                              final priority = a['priority']?.toString().toLowerCase() ?? 'normal';
                              final pColor = _getPriorityColor(priority);
                              final dateStr = a['created_at']?.toString() ?? '';

                              return Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(20.r),
                                  border: Border(left: BorderSide(color: pColor, width: 4.w)),
                                  boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8.r, offset: const Offset(0, 2))],
                                ),
                                child: Padding(
                                  padding: EdgeInsets.all(16.w),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Container(
                                            padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
                                            decoration: BoxDecoration(color: pColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8.r)),
                                            child: Text(_getPriorityLabel(priority), style: TextStyle(color: pColor, fontSize: 9.sp, fontWeight: FontWeight.w900, letterSpacing: 0.5)),
                                          ),
                                          SizedBox(width: 6.w),
                                          Container(
                                            padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
                                            decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(8.r)),
                                            child: Text('URGENT', style: TextStyle(color: const Color(0xFFB91C1C), fontSize: 7.sp, fontWeight: FontWeight.w900)),
                                          ),
                                          const Spacer(),
                                          Text(
                                            dateStr.length >= 10 ? dateStr.substring(0, 10).replaceAll('-', '/') : dateStr,
                                            style: TextStyle(fontSize: 10.sp, color: AppTheme.textSecondary),
                                          ),
                                          if (canManage)
                                            GestureDetector(
                                              onTap: () => _deleteAnnouncement(a['id'].toString()),
                                              child: const Padding(
                                                padding: EdgeInsets.only(left: 8),
                                                child: Icon(Icons.close_rounded, size: 16, color: Color(0xFFCBD5E1)),
                                              ),
                                            ),
                                        ],
                                      ),
                                      SizedBox(height: 10.h),
                                      Text(a['title'] ?? 'Ogeysiis', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15.sp, color: AppTheme.textPrimary, letterSpacing: -0.2)),
                                      SizedBox(height: 8.h),
                                      Text(a['content'] ?? '', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13.sp, height: 1.5.h)),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                  ),
          ),
        ],
      ),
      floatingActionButton: canManage
          ? FloatingActionButton.extended(
              onPressed: _showAddDialog,
              backgroundColor: const Color(0xFFE11D48),
              icon: const Icon(Icons.add, color: Colors.white),
              label: const Text('Ogeysiis Cusub', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
            )
          : null,
    );
  }
}

