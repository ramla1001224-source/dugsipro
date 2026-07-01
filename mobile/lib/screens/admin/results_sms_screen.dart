import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';
import '../../main.dart';

class ResultsSmsScreen extends StatefulWidget {
  const ResultsSmsScreen({super.key});

  @override
  State<ResultsSmsScreen> createState() => _ResultsSmsScreenState();
}

class _ResultsSmsScreenState extends State<ResultsSmsScreen> {
  final ApiService _api = ApiService();
  List<dynamic> _exams = [];
  List<dynamic> _academicYears = [];
  String? _selectedTermId;
  bool _isFinal = false;
  bool _loading = true;
  final Map<String, bool> _sending = {};
  Map<String, dynamic> _smsStatus = {};

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    try {
      final responses = await Future.wait([
        _api.get(ApiConfig.exams),
        _api.get(ApiConfig.academicYears),
      ]);

      if (mounted) {
        setState(() {
          _exams = responses[0].data is List
              ? responses[0].data
              : (responses[0].data['data'] ?? []);
          _academicYears = responses[1].data is List
              ? responses[1].data
              : (responses[1].data['data'] ?? []);
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _fetchSmsStatus() async {
    if (_selectedTermId == null) return;
    try {
      String? academicYearId;
      for (var year in _academicYears) {
        final terms = year['Terms'] as List? ?? [];
        if (terms.any((t) => t['id']?.toString() == _selectedTermId)) {
          academicYearId = year['id']?.toString();
          break;
        }
      }

      final res = await _api.get('${ApiConfig.exams}/bulk-sms-status', params: {
        'termId': _selectedTermId,
        'academicYearId': academicYearId,
        'isFinal': _isFinal.toString(),
      });

      if (mounted) {
        setState(() {
          _smsStatus = res.data;
        });
      }
    } catch (e) {
      debugPrint('Error fetching SMS status: $e');
    }
  }

  Future<void> _handleSendBulkSMS(Map<String, dynamic> group) async {
    if (group['allPublished'] != true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Dhammaystir imtixaanka ka hor intaan la dirin!')),
      );
      return;
    }

    String? academicYearId;
    for (var year in _academicYears) {
      final terms = year['Terms'] as List? ?? [];
      if (terms.any((t) => t['id']?.toString() == _selectedTermId)) {
        academicYearId = year['id']?.toString();
        break;
      }
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Ma hubtaa?', style: TextStyle(fontWeight: FontWeight.bold)),
        content: Text(_isFinal 
          ? 'Ma hubtaa inaad rabto in SMS loo diro fasalka "${group['className']}" iyadoo la isku darayo SANNADKA OO DHAN (100%)?'
          : 'Ma hubtaa inaad rabto in SMS wadar ah loo diro fasalka "${group['className']}"?'),
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

    final classId = group['classId'].toString();
    setState(() => _sending[classId] = true);

    try {
      final examIds = (group['exams'] as List).map((e) => e['id']).toList();
      final res = await _api.post(ApiConfig.sendBulkSms, data: {
        'examIds': examIds,
        'isFinal': _isFinal,
        'academicYearId': academicYearId,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res.data['message'] ?? 'SMS dirista wadar ahaaneed waa la dhameeyay')),
        );
      }
      _fetchSmsStatus();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Cillad ayaa ku timid diridda SMS-ka')),
        );
      }
    } finally {
      if (mounted) setState(() => _sending[classId] = false);
    }
  }

  List<Map<String, dynamic>> get _classGroups {
    if (_selectedTermId == null) return [];
    
    final filtered = _exams.where((ex) => ex['termId']?.toString() == _selectedTermId).toList();
    final Map<String, Map<String, dynamic>> groups = {};

    for (var ex in filtered) {
      final cid = (ex['classId'] ?? 'unassigned').toString();
      if (!groups.containsKey(cid)) {
        groups[cid] = {
          'classId': cid,
          'className': ex['class']?['class_name'] ?? 'Aan la geyn Fasal',
          'exams': [],
          'allPublished': true,
          'draftExams': <String>[],
        };
      }
      groups[cid]!['exams'].add(ex);
      if (ex['status']?.toString() == 'draft') {
        groups[cid]!['allPublished'] = false;
        groups[cid]!['draftExams'].add(ex['subject']?['name'] ?? ex['name'] ?? 'N/A');
      }
    }

    final list = groups.values.toList();
    list.sort((a, b) => a['className'].toString().compareTo(b['className'].toString()));
    return list;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Karnayga / SMS', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.white)),
        backgroundColor: const Color(0xFF0F172A),
        iconTheme: const IconThemeData(color: Colors.white),
        elevation: 0,
      ),
      body: Column(
        children: [
          _buildFilterHeader(),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _selectedTermId == null
                    ? _buildInitialState()
                    : _classGroups.isEmpty
                        ? _buildEmptyState()
                        : ListView.builder(
                            padding: EdgeInsets.all(20.w),
                            itemCount: _classGroups.length,
                            itemBuilder: (ctx, i) => _buildClassCard(_classGroups[i]),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterHeader() {
    return Container(
      padding: EdgeInsets.all(20.w),
      color: const Color(0xFF0F172A),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: InkWell(
                  onTap: () => setState(() => _isFinal = !_isFinal),
                  child: Container(
                    padding: EdgeInsets.all(12.w),
                    decoration: BoxDecoration(
                      color: _isFinal ? AppTheme.primary.withValues(alpha: 0.2) : Colors.white.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(16.r),
                      border: Border.all(color: _isFinal ? AppTheme.primary.withValues(alpha: 0.4) : Colors.white12),
                    ),
                    child: Row(
                      children: [
                        Icon(_isFinal ? Icons.check_box : Icons.check_box_outline_blank, color: _isFinal ? Colors.white : Colors.white38),
                        SizedBox(width: 12.w),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('FINAL RESULT', style: TextStyle(color: Colors.white, fontSize: 10.sp, fontWeight: FontWeight.w900, letterSpacing: 0.5)),
                            Text('Aggregate 100%', style: TextStyle(color: Colors.white60, fontSize: 9.sp, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              SizedBox(width: 12.w),
              Expanded(
                flex: 2,
                child: Container(
                  padding: EdgeInsets.symmetric(horizontal: 16.w),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(16.r),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedTermId,
                      hint: Text('Dooro Term', style: TextStyle(color: Colors.white70, fontSize: 13.sp, fontWeight: FontWeight.bold)),
                      dropdownColor: const Color(0xFF1E293B),
                      isExpanded: true,
                      icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Colors.white),
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      items: [
                        ..._academicYears.expand((year) {
                          final terms = (year['Terms'] as List? ?? []);
                          return terms.map((term) => DropdownMenuItem(
                                value: term['id'].toString(),
                                child: Text('${year['name']} - ${term['name']}'),
                              ));
                        }),
                      ],
                        onChanged: (v) {
                          setState(() {
                            _selectedTermId = v;
                            _smsStatus = {}; // Clear status until fetched
                          });
                          _fetchSmsStatus();
                        },
                      ),
                    ),
                  ),
                ),
              ],
            ),
            if (_selectedTermId != null) ...[
              SizedBox(height: 12.h),
              InkWell(
                onTap: () {
                  setState(() => _isFinal = !_isFinal);
                  _fetchSmsStatus();
                },
                child: Container(
                  padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
                  decoration: BoxDecoration(
                    color: _isFinal ? AppTheme.primary.withValues(alpha: 0.2) : Colors.white.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(12.r),
                    border: Border.all(color: _isFinal ? AppTheme.primary.withValues(alpha: 0.4) : Colors.white12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(_isFinal ? Icons.check_box : Icons.check_box_outline_blank, size: 16, color: _isFinal ? Colors.white : Colors.white38),
                      SizedBox(width: 8.w),
                      Text('FINAL RESULT (100%)', style: TextStyle(color: Colors.white, fontSize: 10.sp, fontWeight: FontWeight.w900, letterSpacing: 0.5)),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      );
    }

  Widget _buildClassCard(Map<String, dynamic> group) {
    final bool allPublished = group['allPublished'] == true;
    final bool isSending = _sending[group['classId'].toString()] ?? false;
    final List<String> draftExams = List<String>.from(group['draftExams']);

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                width: 50.w,
                height: 50.h,
                decoration: BoxDecoration(
                  color: allPublished ? Colors.green.withValues(alpha: 0.1) : Colors.red.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20.r),
                ),
                child: Icon(
                  allPublished ? Icons.verified_user_rounded : Icons.pending_actions_rounded,
                  color: allPublished ? Colors.green : Colors.red,
                ),
              ),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 6.h),
                decoration: BoxDecoration(
                  color: allPublished ? Colors.green.withValues(alpha: 0.1) : Colors.red.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20.r),
                ),
                child: Text(
                  allPublished ? 'READY' : 'INCOMPLETE',
                  style: TextStyle(
                    color: allPublished ? Colors.green : Colors.red,
                    fontSize: 10.sp,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: 12.h),
          Row(
            children: [
              Container(
                width: 8.w,
                height: 8.h,
                decoration: BoxDecoration(
                  color: (_smsStatus[group['classId']]?['sentCount'] ?? 0) == 0
                      ? const Color(0xFFCBD5E1)
                      : (_smsStatus[group['classId']]?['sentCount'] ?? 0) >= (_smsStatus[group['classId']]?['totalCount'] ?? 0)
                          ? Colors.green
                          : Colors.orange,
                  shape: BoxShape.circle,
                ),
              ),
              SizedBox(width: 8.w),
              Text(
                (_smsStatus[group['classId']]?['sentCount'] ?? 0) == 0
                    ? 'SMS NOT SENT'
                    : (_smsStatus[group['classId']]?['sentCount'] ?? 0) >= (_smsStatus[group['classId']]?['totalCount'] ?? 0)
                        ? 'SMS COMPLETED'
                        : 'SMS PARTIAL (${_smsStatus[group['classId']]?['sentCount']}/${_smsStatus[group['classId']]?['totalCount']})',
                style: TextStyle(
                  color: const Color(0xFF64748B),
                  fontSize: 10.sp,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          SizedBox(height: 12.h),
          Text(
            'FASALKA: ${group['className']}',
            style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.w900, color: const Color(0xFF0F172A), letterSpacing: -0.5),
          ),
          SizedBox(height: 8.h),
          Text(
            'Maaddooyinka: ${group['exams'].length}',
            style: TextStyle(color: const Color(0xFF64748B), fontWeight: FontWeight.w700, fontSize: 13.sp),
          ),
          if (!allPublished) ...[
            SizedBox(height: 16.h),
            Container(
              width: double.infinity,
              padding: EdgeInsets.all(16.w),
              decoration: BoxDecoration(
                color: Colors.red.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(20.r),
                border: Border.all(color: Colors.red.withValues(alpha: 0.05)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('DRAFT (AAN LA PUBLISH-GARAYN):', style: TextStyle(color: Colors.red, fontSize: 9.sp, fontWeight: FontWeight.w900)),
                  SizedBox(height: 4.h),
                  Text(draftExams.join(', '), style: TextStyle(color: Colors.redAccent, fontSize: 11.sp, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ],
          SizedBox(height: 24.h),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: (!isSending && allPublished) ? () => _handleSendBulkSMS(group) : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
                disabledBackgroundColor: const Color(0xFFF1F5F9),
                disabledForegroundColor: const Color(0xFF94A3B8),
                padding: EdgeInsets.symmetric(vertical: 18.h),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20.r)),
                elevation: 0,
              ),
              child: isSending
                  ? SizedBox(width: 20.w, height: 20.h, child: const CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          (_smsStatus[group['classId']]?['sentCount'] ?? 0) > 0 &&
                                  (_smsStatus[group['classId']]?['sentCount'] ?? 0) < (_smsStatus[group['classId']]?['totalCount'] ?? 0)
                              ? 'DIR INTA KU DHIMAN'
                              : (_smsStatus[group['classId']]?['sentCount'] ?? 0) >= (_smsStatus[group['classId']]?['totalCount'] ?? 0)
                                  ? 'WAA LA WADA DIRAY'
                                  : _isFinal
                                      ? 'DIR NATIIJADA FINALKA'
                                      : 'DIR NATIIJADA WADAR AH',
                          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11.sp),
                        ),
                        SizedBox(width: 10.w),
                        const Icon(Icons.send_rounded, size: 16),
                      ],
                    ),
            ),
          ),
          if (allPublished && (_smsStatus[group['classId']]?['sentCount'] ?? 0) >= (_smsStatus[group['classId']]?['totalCount'] ?? 1))
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Center(
                child: Text(
                  'âœ“ DHAMMAAN WAALIDKA WAA LOO DIRAY!',
                  style: TextStyle(color: Colors.green, fontSize: 9.sp, fontWeight: FontWeight.w900, fontStyle: FontStyle.italic),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildInitialState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: EdgeInsets.all(32.w),
            decoration: BoxDecoration(color: Colors.indigo.withValues(alpha: 0.05), shape: BoxShape.circle),
            child: const Icon(Icons.calendar_month_rounded, size: 80, color: Colors.indigo),
          ),
          SizedBox(height: 24.h),
          Text('Dooro Term si aad u aragto Fasalada', style: TextStyle(fontWeight: FontWeight.w900, color: const Color(0xFF0F172A), fontSize: 18.sp)),
          SizedBox(height: 8.h),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 40.w),
            child: Text('Waa inaad soo xulataa term-ka (Sida Term 1, Term 2) ka hor inta aadan dirin.', textAlign: TextAlign.center, style: TextStyle(color: const Color(0xFF64748B), fontWeight: FontWeight.w600, fontSize: 13.sp)),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.search_off_rounded, size: 80, color: Color(0xFFE2E8F0)),
          SizedBox(height: 16.h),
          Text('Imtixaanno Lama Helin', style: TextStyle(fontWeight: FontWeight.w900, color: const Color(0xFF1E293B), fontSize: 20.sp)),
        ],
      ),
    );
  }
}

