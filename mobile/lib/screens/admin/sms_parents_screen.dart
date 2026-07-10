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

  @override
  void initState() {
    super.initState();
    _fetchClasses();
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
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Cillad ayaa dhacday intii SMS-ka la dirayay.'),
            backgroundColor: Colors.red,
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
      ],
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
                onChanged: _onClassChanged,
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
              color: (_selectedClassId == null || _selectedClassId == 'all') ? const Color(0xFFF8FAFC) : const Color(0xFFF1F5F9),
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
                onChanged: (_selectedClassId == null || _selectedClassId == 'all') ? null : (v) => setState(() => _selectedSectionId = v!),
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
            onChanged: (v) {
              // Enforce character limit based on content type
              final hasUnicode = v.runes.any((r) => r > 127);
              final limit = hasUnicode ? 70 : 160;
              if (v.length > limit) {
                _messageCtrl.text = v.substring(0, limit);
                _messageCtrl.selection = TextSelection.collapsed(offset: limit);
              }
              setState(() {});
            },
            decoration: InputDecoration(
              hintText: 'Halkan ku qor fariinta...',
              fillColor: const Color(0xFFF1F5F9),
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

          // Submit
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: (_sending || _selectedClassId == null || _messageCtrl.text.trim().isEmpty) ? null : _handleSendSMS,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
                padding: EdgeInsets.symmetric(vertical: 20.h),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20.r)),
                elevation: 0,
              ),
              child: _sending 
                ? SizedBox(width: 20.w, height: 20.h, child: const CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
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
}

