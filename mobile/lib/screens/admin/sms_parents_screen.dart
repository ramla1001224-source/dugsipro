import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';
import '../../main.dart';

class SmsParentsScreen extends StatefulWidget {
  const SmsParentsScreen({super.key});

  @override
  State<SmsParentsScreen> createState() => _SmsParentsScreenState();
}

class _SmsParentsScreenState extends State<SmsParentsScreen> {
  final ApiService _api = ApiService();
  final TextEditingController _messageCtrl = TextEditingController();

  bool get _hasUnicode => _messageCtrl.text.runes.any((r) => r > 127);
  int get _smsLimit => _hasUnicode ? 70 : 160;

  List<dynamic> _classes = [];
  List<dynamic> _sections = [];
  String? _selectedClassId;
  String _selectedSectionId = 'all';

  bool _loading = true;
  bool _sending = false;

  // Monthly bulk send limit state
  int _bulkSendCount = 0;
  int _bulkSendLimit = 2;
  int _bulkSendRemaining = 2;
  bool _isLimitReached = false;

  @override
  void initState() {
    super.initState();
    _fetchClasses();
    _fetchBulkSendCount();
  }

  Future<void> _fetchBulkSendCount() async {
    try {
      final res = await _api.get(ApiConfig.bulkSmsParentsCount);
      final data = res.data;
      if (mounted && data is Map) {
        setState(() {
          _bulkSendCount = (data['count'] ?? 0) as int;
          _bulkSendLimit = (data['limit'] ?? 2) as int;
          _bulkSendRemaining = (data['remaining'] ?? 2) as int;
          _isLimitReached = (data['isLimitReached'] ?? false) as bool;
        });
      }
    } catch (_) {
      // silently fail — limit check is also enforced by backend
    }
  }

  Future<void> _fetchClasses() async {
    try {
      final res = await _api.get(ApiConfig.classes);
      final data = res.data;
      final list = data is List ? data : data['classes'] ?? data['data'] ?? [];
      if (mounted) {
        setState(() {
          _classes = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _onClassChanged(String? value) {
    setState(() {
      _selectedClassId = value;
      if (value != null && value != 'all') {
        final cls = _classes.firstWhere((c) => c['id'].toString() == value, orElse: () => null);
        _sections = cls?['Sections'] ?? [];
      } else {
        _sections = [];
      }
      _selectedSectionId = 'all';
    });
  }

  Future<void> _handleSendSMS() async {
    if (_selectedClassId == null || _messageCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Fadlan buuxi meelaha banaan!')),
      );
      return;
    }

    // Client-side limit check
    if (_isLimitReached) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Xaddidaadka bishii waa la gaadhy! Waxaad diri kartaa oo keliya $_bulkSendLimit fariin oo Bulk ah bil kasta.'),
          backgroundColor: Colors.red,
          duration: const Duration(seconds: 4),
        ),
      );
      return;
    }

    String confirmMsg = '';
    if (_selectedClassId == 'all') {
      confirmMsg = 'Ma hubtaa inaad rabto inaad fariintan u dirto dhammaan waalidiinta dugsiga (All Parents)?';
    } else {
      confirmMsg = 'Ma hubtaa inaad rabto inaad fariintan u dirto waalidiinta ${_selectedSectionId == 'all' ? 'dhammaan fasalka' : 'qaybta gaarka ah'}?';
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Ma hubtaa?', style: TextStyle(fontWeight: FontWeight.bold)),
        content: Text(confirmMsg),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('MAYA')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('HAA, DIR', style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _sending = true);
    try {
      final res = await _api.post(ApiConfig.bulkSmsParents, data: {
        'classId': _selectedClassId,
        'sectionId': _selectedSectionId,
        'message': _messageCtrl.text.trim(),
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res.data['message'] ?? 'SMS-ka waa la diray oo safka (queue) ayaa lagu daray.'),
            backgroundColor: Colors.green,
          ),
        );
        _messageCtrl.clear();
        // Refresh monthly counter after successful send
        _fetchBulkSendCount();
      }
    } catch (e) {
      if (mounted) {
        // Extract error message from response (handles 429 limit error)
        String errMsg = 'Cillad ayaa dhacday intii SMS-ka la dirayay.';
        try {
          final dynamic err = e;
          final resp = err?.response?.data;
          if (resp is Map && resp['message'] != null) {
            errMsg = resp['message'];
          }
        } catch (_) {}

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errMsg),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 5),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('U dir SMS Waalidiinta', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.white)),
        backgroundColor: const Color(0xFF0F172A),
        iconTheme: const IconThemeData(color: Colors.white),
        elevation: 0,
        actions: [
          // Monthly limit badge in AppBar
          Padding(
            padding: EdgeInsets.only(right: 16.w),
            child: Center(child: _buildLimitBadge()),
          ),
        ],
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator())
        : SingleChildScrollView(
            padding: EdgeInsets.all(24.w),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHeader(),
                SizedBox(height: 30.h),
                _buildForm(),
              ],
            ),
          ),
    );
  }

  /// Small badge shown in AppBar: e.g. "0/2" green, "1/2" amber, "2/2🔒" red
  Widget _buildLimitBadge() {
    final Color bgColor = _isLimitReached
        ? Colors.red.shade700
        : _bulkSendCount >= 1
            ? Colors.amber.shade700
            : Colors.green.shade700;

    return Container(
      padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20.r),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_isLimitReached)
            Icon(Icons.lock_rounded, size: 12.sp, color: Colors.white),
          if (_isLimitReached) SizedBox(width: 4.w),
          Text(
            '$_bulkSendCount/$_bulkSendLimit Bishii',
            style: TextStyle(
              color: Colors.white,
              fontSize: 10.sp,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'FARIIN CUSUB',
          style: TextStyle(
            fontSize: 12.sp,
            fontWeight: FontWeight.w900,
            color: AppTheme.primary,
            letterSpacing: 2,
          ),
        ),
        SizedBox(height: 8.h),
        Text(
          'Bulk SMS Parents',
          style: TextStyle(
            fontSize: 28.sp,
            fontWeight: FontWeight.w900,
            color: AppTheme.textPrimary,
            letterSpacing: -1,
          ),
        ),
        SizedBox(height: 8.h),
        Text(
          'U dir fariimo wadar ah waalidiinta adoo isticmaalaya Golis SMS',
          style: TextStyle(
            fontSize: 14.sp,
            color: AppTheme.textSecondary,
            height: 1.5.h,
          ),
        ),
        SizedBox(height: 16.h),
        // Full-width limit info card
        _buildLimitInfoCard(),
      ],
    );
  }

  /// Full-width card below header showing remaining sends
  Widget _buildLimitInfoCard() {
    final Color bgColor = _isLimitReached
        ? const Color(0xFFFEF2F2)
        : _bulkSendCount >= 1
            ? const Color(0xFFFFFBEB)
            : const Color(0xFFF0FDF4);

    final Color borderColor = _isLimitReached
        ? const Color(0xFFFECACA)
        : _bulkSendCount >= 1
            ? const Color(0xFFFDE68A)
            : const Color(0xFFBBF7D0);

    final Color textColor = _isLimitReached
        ? const Color(0xFFDC2626)
        : _bulkSendCount >= 1
            ? const Color(0xFFB45309)
            : const Color(0xFF16A34A);

    final IconData icon = _isLimitReached
        ? Icons.lock_rounded
        : Icons.sms_rounded;

    return Container(
      padding: EdgeInsets.all(16.w),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20.r),
        border: Border.all(color: borderColor, width: 1.5),
      ),
      child: Row(
        children: [
          Container(
            width: 44.w,
            height: 44.h,
            decoration: BoxDecoration(
              color: borderColor,
              borderRadius: BorderRadius.circular(12.r),
            ),
            child: Icon(icon, color: textColor, size: 22.sp),
          ),
          SizedBox(width: 14.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _isLimitReached
                      ? 'Xaddidaadka Bishii Waa La Gaadhy'
                      : 'Fariimaha Kuu Haray Bishii',
                  style: TextStyle(
                    fontSize: 13.sp,
                    fontWeight: FontWeight.w900,
                    color: textColor,
                  ),
                ),
                SizedBox(height: 2.h),
                Text(
                  _isLimitReached
                      ? 'Bisha soo socota ayaad dib u diri kartaa $_bulkSendLimit fariin oo bulk ah.'
                      : '$_bulkSendRemaining ka mid ah $_bulkSendLimit ayaad weli diri kartaa bisha.',
                  style: TextStyle(
                    fontSize: 11.sp,
                    color: textColor.withValues(alpha: 0.8),
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(width: 10.w),
          // Big counter
          Column(
            children: [
              Text(
                '$_bulkSendCount',
                style: TextStyle(
                  fontSize: 30.sp,
                  fontWeight: FontWeight.w900,
                  color: textColor,
                  height: 1,
                ),
              ),
              Text(
                '/ $_bulkSendLimit',
                style: TextStyle(
                  fontSize: 12.sp,
                  fontWeight: FontWeight.w700,
                  color: textColor.withValues(alpha: 0.6),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildForm() {
    return Container(
      padding: EdgeInsets.all(24.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(30.r),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 20.r, offset: const Offset(0, 10)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Class Selection
          Text('FASALKA (CLASS)', style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: AppTheme.textSecondary, letterSpacing: 1)),
          SizedBox(height: 10.h),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 16.w),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(16.r),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _selectedClassId,
                hint: Text('Dooro Fasalka', style: TextStyle(color: AppTheme.textSecondary, fontSize: 14.sp, fontWeight: FontWeight.bold)),
                isExpanded: true,
                icon: const Icon(Icons.keyboard_arrow_down_rounded, color: AppTheme.textSecondary),
                style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.bold),
                items: [
                  DropdownMenuItem(
                    value: 'all',
                    child: Text('Dhammaan Waalidiinta (All Parents)', style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w900)),
                  ),
                  ..._classes.map((cls) => DropdownMenuItem(
                    value: cls['id'].toString(),
                    child: Text(cls['class_name'] ?? 'N/A'),
                  )),
                ],
                onChanged: _isLimitReached ? null : _onClassChanged,
              ),
            ),
          ),

          SizedBox(height: 20.h),

          // Section Selection
          Text('QAYBTA (SECTION)', style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: AppTheme.textSecondary, letterSpacing: 1)),
          SizedBox(height: 10.h),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 16.w),
            decoration: BoxDecoration(
              color: (_selectedClassId == null || _selectedClassId == 'all' || _isLimitReached) ? const Color(0xFFF8FAFC) : const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(16.r),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _selectedSectionId,
                disabledHint: Text('All Sections', style: TextStyle(color: const Color(0xFFCBD5E1), fontSize: 14.sp, fontWeight: FontWeight.bold)),
                isExpanded: true,
                icon: const Icon(Icons.keyboard_arrow_down_rounded, color: AppTheme.textSecondary),
                style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.bold),
                items: [
                  DropdownMenuItem(value: 'all', child: Text('Dhammaan Qaybaha (All Sections)')),
                  ..._sections.map((sec) => DropdownMenuItem(
                    value: sec['id'].toString(),
                    child: Text('${sec['name']} (${sec['shift']})'),
                  )),
                ],
                onChanged: (_selectedClassId == null || _selectedClassId == 'all' || _isLimitReached) ? null : (v) => setState(() => _selectedSectionId = v!),
              ),
            ),
          ),

          SizedBox(height: 20.h),

          // Message
          Text('FARIINTA (MESSAGE)', style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: AppTheme.textSecondary, letterSpacing: 1)),
          SizedBox(height: 10.h),
          TextField(
            controller: _messageCtrl,
            maxLines: 6,
            enabled: !_isLimitReached,
            onChanged: (v) {
              final hasUnicode = v.runes.any((r) => r > 127);
              final limit = hasUnicode ? 70 : 160;
              if (v.length > limit) {
                _messageCtrl.text = v.substring(0, limit);
                _messageCtrl.selection = TextSelection.collapsed(offset: limit);
              }
              setState(() {});
            },
            decoration: InputDecoration(
              hintText: _isLimitReached ? 'Xaddidaadka waa la gaadhy — bisha soo socota dir...' : 'Halkan ku qor fariinta...',
              fillColor: _isLimitReached ? const Color(0xFFFEF2F2) : const Color(0xFFF1F5F9),
              filled: true,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(20.r), borderSide: BorderSide.none),
            ),
            style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w500),
          ),
          SizedBox(height: 10.h),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'STAAD: ${_messageCtrl.text.length}/$_smsLimit${_hasUnicode ? " (EMOJI)" : ""}',
                style: TextStyle(
                  fontSize: 9.sp,
                  fontWeight: FontWeight.w900,
                  color: _hasUnicode ? Colors.orange : AppTheme.textSecondary,
                ),
              ),
              Text('SMS: 1 CREDIT', style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.w900, color: AppTheme.textSecondary)),
            ],
          ),

          SizedBox(height: 30.h),

          // Submit Button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: (_sending || _selectedClassId == null || _messageCtrl.text.trim().isEmpty || _isLimitReached)
                  ? null
                  : _handleSendSMS,
              style: ElevatedButton.styleFrom(
                backgroundColor: _isLimitReached ? const Color(0xFFFECACA) : AppTheme.primary,
                foregroundColor: _isLimitReached ? const Color(0xFFDC2626) : Colors.white,
                disabledBackgroundColor: _isLimitReached ? const Color(0xFFFECACA) : const Color(0xFFE2E8F0),
                disabledForegroundColor: _isLimitReached ? const Color(0xFFDC2626) : const Color(0xFF94A3B8),
                padding: EdgeInsets.symmetric(vertical: 20.h),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20.r)),
                elevation: 0,
              ),
              child: _sending
                ? SizedBox(width: 20.w, height: 20.h, child: const CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : _isLimitReached
                    ? Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.lock_rounded, size: 16.sp),
                          SizedBox(width: 8.w),
                          Text(
                            'XADDIDAADKA WAA LA GAADHY — BISHA SOO SOCOTA',
                            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 10.sp, letterSpacing: 0.5),
                          ),
                        ],
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('DIRI FARIINTA (SEND SMS)', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12.sp, letterSpacing: 1)),
                          SizedBox(width: 10.w),
                          const Icon(Icons.send_rounded, size: 18),
                        ],
                      ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _messageCtrl.dispose();
    super.dispose();
  }
}
