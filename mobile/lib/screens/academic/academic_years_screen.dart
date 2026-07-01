import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';
import 'promotion_screen.dart';

class AcademicYearsScreen extends StatefulWidget {
  const AcademicYearsScreen({super.key});

  @override
  State<AcademicYearsScreen> createState() => _AcademicYearsScreenState();
}

class _AcademicYearsScreenState extends State<AcademicYearsScreen> {
  final ApiService _api = ApiService();
  bool _loading = true;
  List<dynamic> _years = [];

  @override
  void initState() {
    super.initState();
    _fetchYears();
  }

  Future<void> _fetchYears() async {
    setState(() => _loading = true);
    try {
      final res = await _api.get(ApiConfig.academicYears);
      if (mounted) {
        setState(() {
          _years = res.data is List ? res.data : (res.data['data'] ?? []);
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _fmtDate(String? raw) {
    if (raw == null) return 'â€”';
    try {
      final d = DateTime.parse(raw);
      return '${d.day.toString().padLeft(2, '0')} ${_month(d.month)} ${d.year}';
    } catch (_) {
      return raw.split('T')[0];
    }
  }

  String _month(int m) => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1];

  bool _isExpired(dynamic year) {
    if (year['isCurrent'] != true) return false;
    try {
      return DateTime.parse(year['endDate']).isBefore(DateTime.now());
    } catch (_) {
      return false;
    }
  }

  Future<void> _addYear() async {
    final nameCtrl = TextEditingController();
    final startCtrl = TextEditingController();
    final endCtrl = TextEditingController();
    bool isCurrent = false;

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (__, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20.r)),
          title: const Text('Sanad Waxbarasho Cusub', style: TextStyle(fontWeight: FontWeight.w900)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _field(nameCtrl, 'Magaca Sanadka', hint: 'tusaale: 2025-2026'),
                SizedBox(height: 12.h),
                _field(startCtrl, 'Taariikhda Bilowga', hint: 'YYYY-MM-DD'),
                SizedBox(height: 12.h),
                _field(endCtrl, 'Taariikhda Dhammaadka', hint: 'YYYY-MM-DD'),
                SizedBox(height: 12.h),
                // REMOVED: Manual isCurrent checkbox to enforce promotion workflow

              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Jooji')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
              ),
              onPressed: () async {
                final messenger = ScaffoldMessenger.of(context);
                try {
                  await _api.post(ApiConfig.academicYears, data: {
                    'name': nameCtrl.text.trim(),
                    'startDate': startCtrl.text.trim(),
                    'endDate': endCtrl.text.trim(),
                    'isCurrent': isCurrent,
                  });
                  if (!ctx.mounted) return;
                  Navigator.pop(ctx);
                  _fetchYears();
                } catch (e) {
                  messenger.showSnackBar(
                    SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
                  );
                }
              },
              child: const Text('Abuur', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _setCurrent(String id) async {
    try {
      await _api.patch('${ApiConfig.academicYears}/$id/set-current', data: {});
      _fetchYears();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sanadka waa la cusboonaysiiyay âœ“'), backgroundColor: Colors.green, behavior: SnackBarBehavior.floating),
        );
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: Colors.red));
    }
  }

  Future<void> _deleteYear(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20.r)),
        title: const Text('Tirtir Sanadka?', style: TextStyle(fontWeight: FontWeight.w900)),
        content: const Text('Ficilkan dib looma celin karo. Terms-ka iyo xogta sanadkan waa la tirtiri doonaa.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Jooji')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r))),
            child: const Text('Tirtir', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirm == true) {
      await _api.delete('${ApiConfig.academicYears}/$id');
      _fetchYears();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text('Sanadaha Waxbarashada', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18.sp)),
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
        bottom: PreferredSize(preferredSize: const Size.fromHeight(1), child: Container(height: 1.h, color: const Color(0xFFF1F5F9))),
        actions: [
          // Quick Promote Button in AppBar
          TextButton.icon(
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const PromotionScreen())).then((_) => _fetchYears()),
            icon: Text('🎓', style: TextStyle(fontSize: 16.sp)),
            label: Text('Promote', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13.sp, color: AppTheme.primary)),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchYears,
              child: _years.isEmpty
                  ? _buildEmpty()
                  : ListView.builder(
                      padding: EdgeInsets.all(16.w),
                      itemCount: _years.length,
                      itemBuilder: (context, index) => _buildYearCard(_years[index]),
                    ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addYear,
        backgroundColor: AppTheme.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Sanad Cusub', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _buildYearCard(dynamic year) {
    final bool active = year['isCurrent'] == true;
    final bool expired = _isExpired(year);
    final String id = year['id'].toString();
    final terms = year['Terms'] as List? ?? [];

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18.r),
        border: Border.all(
          color: expired
              ? Colors.amber.shade300
              : active
                  ? AppTheme.primary.withValues(alpha: 0.4)
                  : const Color(0xFFF1F5F9),
          width: (active || expired) ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 12.r, offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        children: [
          // â”€â”€ Year Header â”€â”€
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: expired
                    ? [Colors.amber.shade600, Colors.amber.shade500]
                    : active
                        ? [const Color(0xFF6366F1), const Color(0xFF4F46E5)]
                        : [const Color(0xFF334155), const Color(0xFF1E293B)],
              ),
              borderRadius: BorderRadius.vertical(top: Radius.circular(17.r)),
            ),
            padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 14.h),
            child: Row(
              children: [
                Container(
                  width: 40.w, height: 40.h,
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12.r)),
                  child: const Icon(Icons.calendar_today_rounded, color: Colors.white, size: 20),
                ),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(year['name'] ?? 'Year', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16.sp, color: Colors.white)),
                          SizedBox(width: 8.w),
                          if (active && !expired)
                            Container(
                              padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 2.h),
                              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.25), borderRadius: BorderRadius.circular(8.r)),
                              child: Text('âœ“ Hadda Socda', style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.w900, color: Colors.white)),
                            ),
                          if (expired)
                            Container(
                              padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 2.h),
                              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.25), borderRadius: BorderRadius.circular(8.r)),
                              child: Text('âš  Dhammaday', style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.w900, color: Colors.white)),
                            ),
                        ],
                      ),
                      SizedBox(height: 3.h),
                      Text(
                        '${_fmtDate(year['startDate']?.toString())} â†’ ${_fmtDate(year['endDate']?.toString())}',
                        style: TextStyle(fontSize: 11.sp, color: Colors.white.withValues(alpha: 0.7), fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_vert_rounded, color: Colors.white),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14.r)),
                  onSelected: (val) {
                    if (val == 'current') _setCurrent(id);
                    if (val == 'delete') _deleteYear(id);
                    if (val == 'promote') {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const PromotionScreen()))
                          .then((_) => _fetchYears());
                    }
                  },
                  itemBuilder: (_) => [
                    // REMOVED: Manual Set as Current option

                    PopupMenuItem(value: 'promote', child: Row(children: [
                      Text('🎓', style: TextStyle(fontSize: 16.sp)),
                      SizedBox(width: 10.w),
                      Text('Arday Promote', style: TextStyle(fontWeight: FontWeight.w700, color: AppTheme.primary)),
                    ])),
                    PopupMenuItem(value: 'delete', child: Row(children: [
                      const Icon(Icons.delete_outline, color: Colors.red, size: 20),
                      SizedBox(width: 10.w),
                      Text('Tirtir', style: TextStyle(fontWeight: FontWeight.w700, color: Colors.red)),
                    ])),
                  ],
                ),
              ],
            ),
          ),

          // â”€â”€ Expired Banner â”€â”€
          if (expired)
            Container(
              padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 10.h),
              color: Colors.amber.shade50,
              child: Row(
                children: [
                  Text('âš ï¸', style: TextStyle(fontSize: 18.sp)),
                  SizedBox(width: 10.w),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Sanadkani wuu dhammaday laakiin weli active yahay!', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12.sp, color: const Color(0xFF92400E))),
                        Text('Dhammaadkii: ${_fmtDate(year['endDate']?.toString())}', style: TextStyle(fontSize: 11.sp, color: const Color(0xFFB45309), fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const PromotionScreen())).then((_) => _fetchYears()),
                    child: Container(
                      padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 7.h),
                      decoration: BoxDecoration(
                        color: AppTheme.primary,
                        borderRadius: BorderRadius.circular(10.r),
                      ),
                      child: Text('🎓 Promote', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 11.sp)),
                    ),
                  ),
                ],
              ),
            ),

          // â”€â”€ Terms List â”€â”€
          Padding(
            padding: EdgeInsets.all(14.w),
            child: terms.isEmpty
                ? Container(
                    padding: EdgeInsets.symmetric(vertical: 14.h),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12.r),
                      border: Border.all(color: const Color(0xFFE2E8F0), style: BorderStyle.solid),
                    ),
                    child: Center(
                      child: Text('Term la\'aan â€” Abuur term marka hore', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12.sp, fontWeight: FontWeight.w600)),
                    ),
                  )
                : Column(
                    children: terms.map<Widget>((t) => Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 10.h),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(12.r),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 28.w, height: 28.h,
                            decoration: BoxDecoration(color: AppTheme.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8.r)),
                            child: const Icon(Icons.bookmark_rounded, size: 14, color: AppTheme.primary),
                          ),
                          SizedBox(width: 10.w),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(t['name'] ?? 'Term', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.sp)),
                                Text('${_fmtDate(t['startDate']?.toString())} â†’ ${_fmtDate(t['endDate']?.toString())}', style: TextStyle(fontSize: 10.sp, color: AppTheme.textSecondary, fontWeight: FontWeight.w600)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    )).toList(),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('📅', style: TextStyle(fontSize: 60.sp)),
          SizedBox(height: 16.h),
          Text('Sanad waxbarasho ma jiro', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18.sp, color: AppTheme.textPrimary)),
          SizedBox(height: 8.h),
          Text('Abuur sanad cusub si aad u bilowdo', style: TextStyle(color: AppTheme.textSecondary, fontSize: 14.sp)),
          SizedBox(height: 24.h),
          ElevatedButton.icon(
            onPressed: _addYear,
            icon: const Icon(Icons.add, color: Colors.white),
            label: const Text('Abuur Sanad', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary, padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 14.h), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14.r))),
          ),
        ],
      ),
    );
  }

  Widget _field(TextEditingController ctrl, String label, {String? hint}) => TextField(
        controller: ctrl,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r)),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r), borderSide: BorderSide(color: AppTheme.primary, width: 2.w)),
          contentPadding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 14.h),
        ),
      );
}

