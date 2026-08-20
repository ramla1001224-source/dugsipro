import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../config/api_config.dart';

class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key});
  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen> {
  final ApiService _api = ApiService();
  final AuthService _auth = AuthService();

  bool _loading = true;
  String _userRole = '';
  bool _canDeletePayment = true;
  String _viewMode = 'status'; // 'status' or 'history'

  List<dynamic> _classes = [];
  List<dynamic> _sections = [];
  String _selectedClassId = '';
  String? _selectedSectionId;

  int _month = DateTime.now().month;
  int _year = DateTime.now().year;
  Map<String, dynamic>? _activeYear; // active academic year

  List<dynamic> _payments = [];
  List<dynamic> _students = []; // for history view - all students
  List<dynamic> _monthlyStatus = [];
  final Map<String, String> _localStatuses = {}; // studentId: 'paid' | 'partial' | 'unpaid'
  final Map<String, double> _partialAmounts = {}; // studentId: amountPaid

  String _bulkMethod = 'Cash';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadInitial();
  }

  Future<void> _loadInitial() async {
    setState(() => _loading = true);
    try {
      _userRole = await _auth.getRole() ?? '';
      if (_userRole == 'accountant') {
        _canDeletePayment = await _auth.hasPermission('perm_acc_delete_payment');
      } else {
        _canDeletePayment = true;
      }

      // Fetch academic year to restrict month/year dropdowns
      try {
        final ayRes = await _api.get(ApiConfig.academicYears);
        final ayList = ayRes.data is List ? ayRes.data : (ayRes.data['data'] ?? []);
        final current = ayList.firstWhere((y) => y['isCurrent'] == true, orElse: () => null);
        if (current != null) {
          _activeYear = current;
          final startDate = DateTime.parse(current['startDate']);
          final endDate = DateTime.parse(current['endDate']);
          final now = DateTime.now();
          // Set year/month to current if within range, else start of academic year
          final inRange = !now.isBefore(startDate) && !now.isAfter(endDate);
          _year = inRange ? now.year : startDate.year;
          _month = inRange ? now.month : startDate.month;
        }
      } catch (_) {}

      final res = await _api.get(ApiConfig.classes);
      final data = res.data;
      _classes = data is List ? data : (data['data'] ?? []);

      if (_userRole == 'student') {
        _viewMode = 'history';
        final profile = await _auth.getProfile();
        if (profile != null && profile['Student'] != null) {
          _selectedClassId = profile['Student']['classId']?.toString() ?? '';
        }
      } else {
        if (_classes.isNotEmpty) {
          _selectedClassId = _classes[0]['id']?.toString() ?? '';
        }
      }

      if (mounted) {
        if (_selectedClassId.isNotEmpty) {
          await _loadSections(_selectedClassId);
        } else {
          setState(() => _loading = false);
        }
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadSections(String cid) async {
    try {
      final res = await _api.get('${ApiConfig.sections}?classId=$cid');
      if (mounted) {
        setState(() {
          _sections = res.data is List ? res.data : (res.data['data'] ?? []);
          _selectedSectionId = null; // Default to "All Sections"
        });
        await _loadData();
      }
    } catch (_) {
      if (mounted) setState(() => _sections = []);
    }
  }

  Future<void> _loadData() async {
    if (_selectedClassId.isEmpty) return;
    setState(() => _loading = true);

    try {
      final secParam = _selectedSectionId != null ? '&sectionId=$_selectedSectionId' : '';
      if (_viewMode == 'status') {
        final res = await _api.get(
            '${ApiConfig.payments}/monthly-status?classId=$_selectedClassId$secParam&month=$_month&year=$_year');
        if (mounted) {
          setState(() {
            _monthlyStatus =
                res.data is List ? res.data : (res.data['data'] ?? []);
            _localStatuses.clear();
            _partialAmounts.clear();
            _loading = false;
          });
        }
      } else {
        // Fetch both payments AND students to show unpaid students too
        final results = await Future.wait([
          _api.get('${ApiConfig.payments}?classId=$_selectedClassId$secParam&month=$_month&year=$_year'),
          _api.get('${ApiConfig.students}?classId=$_selectedClassId$secParam'),
        ]);
        if (mounted) {
          setState(() {
            _payments = results[0].data is List ? results[0].data : (results[0].data['data'] ?? []);
            _students = results[1].data is List ? results[1].data : (results[1].data['data'] ?? []);
            _loading = false;
          });
        }
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleStatus(String studentId, String currentStatus, double classFee) async {
    final eff = _localStatuses[studentId] ?? currentStatus;
    if (!_canDeletePayment && (eff == 'paid' || eff == 'partial')) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Fasax uma lihid inaad bedesho lacag bixinta.'),
          backgroundColor: Colors.red));
      return;
    }

    String newStatus = 'unpaid';
    if (eff == 'unpaid') newStatus = 'paid';
    else if (eff == 'paid') newStatus = 'partial';

    if (newStatus == 'partial') {
      final TextEditingController amountCtrl = TextEditingController();
      final bool? confirmed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Lacagta Qaybta ah (Partial)'),
          content: TextField(
            controller: amountCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              hintText: 'Gali lacagta (Max: \$${classFee.toStringAsFixed(2)})',
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Kansal'),
            ),
            ElevatedButton(
              onPressed: () {
                final amt = double.tryParse(amountCtrl.text) ?? 0;
                if (amt <= 0 || (classFee > 0 && amt > classFee)) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                    content: Text('Lacagtu waa inay u dhexaysaa 0 ilaa max'),
                  ));
                  return;
                }
                _partialAmounts[studentId] = amt;
                Navigator.pop(ctx, true);
              },
              child: const Text('Xaqiiji'),
            ),
          ],
        ),
      );
      if (confirmed != true) return; // User cancelled
    }

    setState(() {
      _localStatuses[studentId] = newStatus;
      if (newStatus != 'partial') {
        _partialAmounts.remove(studentId);
      }
    });
  }

  Future<void> _saveBulk() async {
    if (_saving) return;
    if (_localStatuses.isEmpty) return;
    setState(() => _saving = true);
    try {
      final updates = _localStatuses.entries
          .map((e) => {
                'studentId': e.key,
                'status': e.value,
                if (e.value == 'partial' && _partialAmounts.containsKey(e.key))
                  'amountPaid': _partialAmounts[e.key],
              })
          .toList();

      await _api.post('${ApiConfig.payments}/bulk', data: {
        'updates': updates,
        'month': _month,
        'year': _year,
        'payment_method': _bulkMethod,
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Payments synced successfully!')));
        _localStatuses.clear();
        _partialAmounts.clear();
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // ──────────── PDF Download ────────────
  Future<void> _downloadPdf() async {
    try {
      const storage = FlutterSecureStorage();
      final token = await storage.read(key: 'token');
      final secParam = _selectedSectionId != null ? '&sectionId=$_selectedSectionId' : '';
      final url = '${ApiConfig.baseUrl}${ApiConfig.payments}/monthly-status/pdf'
          '?classId=$_selectedClassId$secParam&month=$_month&year=$_year';

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('📄 PDF la soo dagsanayaa...')),
        );
      }

      final dio = Dio();
      final response = await dio.get(
        url,
        options: Options(
          headers: {'Authorization': 'Bearer $token'},
          responseType: ResponseType.bytes,
        ),
      );

      final dir = await getTemporaryDirectory();
      final months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      final fileName = 'Fee_Report_${months[_month - 1]}_$_year.pdf';
      final file = File('${dir.path}/$fileName');
      await file.writeAsBytes(response.data as List<int>);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('✅ PDF la keydsaday: $fileName'),
            action: SnackBarAction(
              label: 'Fur',
              onPressed: () async {
                final uri = Uri.file(file.path);
                if (await canLaunchUrl(uri)) await launchUrl(uri);
              },
            ),
            duration: const Duration(seconds: 6),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('PDF khalad: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  // ──────────── CSV/Excel Export ────────────
  Future<void> _exportCsv() async {
    try {
      final rows = <List<String>>[
        ['Magaca Ardayga', 'ID', 'Xaalad', 'Bixiyay', 'Fee-ga', 'Hadhay']
      ];

      for (final s in _monthlyStatus) {
        final status = _localStatuses[s['studentId']] ?? s['status'] ?? 'unpaid';
        final classFee = (s['classFee'] ?? 0).toDouble();
        double amountPaid = (s['amountPaid'] ?? 0).toDouble();
        if (status == 'paid') amountPaid = classFee;
        final remaining = (classFee - amountPaid).clamp(0, double.infinity);
        rows.add([
          s['name'] ?? '',
          s['student_id'] ?? '',
          status == 'paid' ? 'Paid' : status == 'partial' ? 'Partial' : 'Unpaid',
          '\$${amountPaid.toStringAsFixed(2)}',
          '\$${classFee.toStringAsFixed(2)}',
          '\$${remaining.toStringAsFixed(2)}',
        ]);
      }

      final csvContent = rows.map((r) => r.map((c) => '"$c"').join(',')).join('\n');
      final dir = await getTemporaryDirectory();
      final months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      final fileName = 'Fee_Report_${months[_month - 1]}_$_year.csv';
      final file = File('${dir.path}/$fileName');
      await file.writeAsString(csvContent);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('✅ Excel la keydsaday: $fileName'),
            action: SnackBarAction(
              label: 'Fur',
              onPressed: () async {
                final uri = Uri.file(file.path);
                if (await canLaunchUrl(uri)) await launchUrl(uri);
              },
            ),
            duration: const Duration(seconds: 6),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Excel khalad: $e'), backgroundColor: Colors.red),
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
          'Finance Management',
          style: TextStyle(
            color: AppTheme.textPrimary,
            fontWeight: FontWeight.w900,
            fontSize: 18.sp,
          ),
        ),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header & Mode Toggle
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Student Fees',
                          style: TextStyle(
                              fontSize: 24.sp,
                              fontWeight: FontWeight.w900,
                              color: AppTheme.textPrimary,
                              letterSpacing: -0.5),
                        ),
                        SizedBox(height: 2.h),
                        Text(
                          _viewMode == 'status'
                              ? 'Mark monthly fee status'
                              : 'View payment transactions',
                          style: TextStyle(
                              fontSize: 12.sp, color: AppTheme.textSecondary),
                        ),
                      ],
                    ),
                    if (_userRole != 'student') _buildModeToggle(),
                  ],
                ),
                // ── Download buttons for admin/accountant ──
                if (_viewMode == 'status' &&
                    (_userRole == 'admin' || _userRole == 'accountant' ||
                     _userRole == 'owner' || _userRole == 'super_admin')) ...[
                  SizedBox(height: 12.h),
                  Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: _downloadPdf,
                          child: Container(
                            padding: EdgeInsets.symmetric(vertical: 10.h),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF2F2),
                              borderRadius: BorderRadius.circular(10.r),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Text('📄', style: TextStyle(fontSize: 14)),
                                SizedBox(width: 6.w),
                                Text('DAGSO PDF',
                                    style: TextStyle(
                                      fontSize: 9.sp,
                                      fontWeight: FontWeight.w900,
                                      color: const Color(0xFFDC2626),
                                      letterSpacing: 0.8,
                                    )),
                              ],
                            ),
                          ),
                        ),
                      ),
                      SizedBox(width: 8.w),
                      Expanded(
                        child: GestureDetector(
                          onTap: _exportCsv,
                          child: Container(
                            padding: EdgeInsets.symmetric(vertical: 10.h),
                            decoration: BoxDecoration(
                              color: const Color(0xFFECFDF5),
                              borderRadius: BorderRadius.circular(10.r),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Text('📊', style: TextStyle(fontSize: 14)),
                                SizedBox(width: 6.w),
                                Text('DAGSO EXCEL',
                                    style: TextStyle(
                                      fontSize: 9.sp,
                                      fontWeight: FontWeight.w900,
                                      color: const Color(0xFF059669),
                                      letterSpacing: 0.8,
                                    )),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),

          // Filters Section
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: _buildFilterBox(
                        label: 'CLASS',
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            isExpanded: true,
                            value: _classes.any((c) =>
                                    c['id']?.toString() == _selectedClassId)
                                ? _selectedClassId
                                : null,
                            icon:
                                const Icon(Icons.keyboard_arrow_down, size: 16),
                            items: _classes
                                .map((c) => DropdownMenuItem(
                                      value: c['id']?.toString() ?? '',
                                      child: Text(
                                          c['class_name']
                                                  ?.toString()
                                                  .toUpperCase() ??
                                              '',
                                          style: TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 10.sp)),
                                    ))
                                .toList(),
                            onChanged: _userRole == 'student'
                                ? null
                                : (v) {
                                    if (v != null) {
                                      setState(() => _selectedClassId = v);
                                      _loadSections(v);
                                    }
                                  },
                          ),
                        ),
                      ),
                    ),
                    SizedBox(width: 8.w),
                    Expanded(
                      flex: 2,
                      child: _buildFilterBox(
                        label: 'SECTION',
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            isExpanded: true,
                            value: _selectedSectionId,
                            icon: const Icon(Icons.keyboard_arrow_down, size: 16),
                            items: [
                              DropdownMenuItem<String>(
                                value: null,
                                child: Text('ALL',
                                    style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 10.sp,
                                        color: AppTheme.primary)),
                              ),
                              ..._sections.map((s) => DropdownMenuItem(
                                    value: s['id']?.toString() ?? '',
                                    child: Text(
                                        (s['name'] ?? s['section_name'] ?? '')
                                                .toString()
                                                .toUpperCase(),
                                        style: TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 10.sp)),
                                  )),
                            ],
                            onChanged: _userRole == 'student'
                                ? null
                                : (v) {
                                    setState(() => _selectedSectionId = v);
                                    _loadData();
                                  },
                          ),
                        ),
                      ),
                    ),
                    SizedBox(width: 8.w),
                    Expanded(
                      flex: 1,
                      child: _buildFilterBox(
                        label: 'YEAR',
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<int>(
                            isExpanded: true,
                            value: _year,
                            icon: const Icon(Icons.keyboard_arrow_down, size: 16),
                            items: _validYears().map((y) => DropdownMenuItem(
                                value: y,
                                child: Text('$y', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 10.sp)))).toList(),
                            onChanged: (v) {
                              if (v != null) {
                                setState(() {
                                  _year = v;
                                  // Reset month to first valid month for this year
                                  final vMonths = _validMonths(v);
                                  if (!vMonths.contains(_month)) _month = vMonths.isNotEmpty ? vMonths.first : 1;
                                });
                                _loadData();
                              }
                            },
                          ),
                        ),
                      ),
                    ),
                    SizedBox(width: 8.w),
                    Expanded(
                      flex: 1,
                      child: _buildFilterBox(
                        label: 'MONTH',
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<int>(
                            isExpanded: true,
                            value: _validMonths(_year).contains(_month) ? _month : _validMonths(_year).first,
                            icon: const Icon(Icons.keyboard_arrow_down, size: 16),
                            items: _validMonths(_year).map((m) => DropdownMenuItem(
                                value: m,
                                child: Text(_monthName(m).toUpperCase(), style: TextStyle(fontWeight: FontWeight.bold, fontSize: 10.sp)))).toList(),
                            onChanged: (v) {
                              if (v != null) {
                                setState(() => _month = v);
                                _loadData();
                              }
                            },
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                if (_viewMode == 'status') ...[
                  SizedBox(height: 12.h),
                  Row(
                    children: [
                      Expanded(
                        child: _buildFilterBox(
                          label: 'PAYMENT METHOD',
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              isExpanded: true,
                              value: _bulkMethod,
                              icon: const Icon(Icons.keyboard_arrow_down,
                                  size: 16, color: Color(0xFF059669)),
                              items:
                                  ['Cash', 'Sahal (Golis)', 'E-Dahab (Somtel)']
                                      .map((m) => DropdownMenuItem(
                                            value: m,
                                            child: Text(m.toUpperCase(),
                                                style: TextStyle(
                                                    fontWeight: FontWeight.w900,
                                                    fontSize: 10.sp,
                                                    color: const Color(0xFF059669))),
                                          ))
                                      .toList(),
                              onChanged: (v) {
                                if (v != null) setState(() => _bulkMethod = v);
                              },
                            ),
                          ),
                        ),
                      ),
                      SizedBox(width: 8.w),
                      _actionBtn(
                        _saving ? 'SAVING...' : 'SAVE CHANGES',
                        _localStatuses.isEmpty || _saving
                            ? const Color(0xFFF1F5F9)
                            : const Color(0xFF10B981),
                        _localStatuses.isEmpty || _saving
                            ? const Color(0xFF94A3B8)
                            : Colors.white,
                        onTap: _localStatuses.isEmpty || _saving
                            ? null
                            : _saveBulk,
                        isSolid: _localStatuses.isNotEmpty,
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),

          // Content Area
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _loadData,
                    child: _viewMode == 'status'
                        ? _buildStatusList()
                        : _buildHistoryList(),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildModeToggle() {
    return Container(
      padding: EdgeInsets.all(4.w),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(10.r),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _toggleBtn('STATUS', 'status'),
          _toggleBtn('HISTORY', 'history'),
        ],
      ),
    );
  }

  Widget _toggleBtn(String label, String mode) {
    bool active = _viewMode == mode;
    return GestureDetector(
      onTap: () {
        if (!active) {
          setState(() => _viewMode = mode);
          _loadData();
        }
      },
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 8.h),
        decoration: BoxDecoration(
          color: active ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(8.r),
          boxShadow: active
              ? [
                  BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 4.r,
                      offset: const Offset(0, 2)),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 10.sp,
            fontWeight: FontWeight.w900,
            color: active ? AppTheme.primary : AppTheme.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildStatusList() {
    if (_monthlyStatus.isEmpty) {
      return Center(
        child: Padding(
          padding: EdgeInsets.all(40.w),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('🔍', style: TextStyle(fontSize: 48.sp)),
              SizedBox(height: 16.h),
              Text('No students found in this class.',
                  style: TextStyle(
                      color: AppTheme.textSecondary,
                      fontWeight: FontWeight.bold,
                      fontSize: 13.sp)),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: EdgeInsets.all(16.w),
      itemCount: _monthlyStatus.length,
      itemBuilder: (ctx, i) {
        final s = _monthlyStatus[i];
        final sId = s['studentId']?.toString() ?? '';
        final name = s['name'] ?? '';
        final currentStatus = _localStatuses[sId] ?? s['status'] ?? 'unpaid';
        final isPaid = currentStatus == 'paid';
        final isPartial = currentStatus == 'partial';
        
        final classFee = (s['classFee'] ?? 0).toDouble();
        final amountPaid = isPaid ? classFee : isPartial ? (_partialAmounts[sId] ?? s['amountPaid'] ?? 0) : 0;

        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: EdgeInsets.all(12.w),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12.r),
            border: Border.all(
                color:
                    isPaid ? const Color(0xFFDCFCE7) : isPartial ? Colors.orange.shade200 : const Color(0xFFFEE2E2)),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: const Color(0xFFF1F5F9),
                child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
                    style: TextStyle(
                        fontWeight: FontWeight.w900,
                        color: AppTheme.textSecondary,
                        fontSize: 14.sp)),
              ),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name,
                        style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 13.sp,
                            color: AppTheme.textPrimary)),
                    SizedBox(height: 2.h),
                    Row(
                      children: [
                        Text(s['student_id'] ?? '',
                            style: TextStyle(
                                fontSize: 10.sp,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.textSecondary)),
                        if (classFee > 0) ...[
                          SizedBox(width: 8.w),
                          Text('\$${amountPaid.toStringAsFixed(2)} / \$${classFee.toStringAsFixed(2)}',
                            style: TextStyle(
                              fontSize: 10.sp, 
                              fontWeight: FontWeight.w900, 
                              color: isPaid ? const Color(0xFF10B981) : isPartial ? Colors.orange : AppTheme.textSecondary
                            )
                          ),
                        ]
                      ],
                    ),
                  ],
                ),
              ),
              GestureDetector(
                onTap: () => _toggleStatus(sId, s['status'] ?? 'unpaid', classFee),
                child: Container(
                  padding:
                      EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
                  decoration: BoxDecoration(
                    color: isPaid
                        ? const Color(0xFF10B981)
                        : isPartial ? Colors.orange : const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(8.r),
                  ),
                  child: Text(
                    isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'UNPAID',
                    style: TextStyle(
                      fontSize: 10.sp,
                      fontWeight: FontWeight.w900,
                      color: (isPaid || isPartial) ? Colors.white : const Color(0xFFDC2626),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildHistoryList() {
    if (_students.isEmpty && _payments.isEmpty) {
      return Center(
        child: Padding(
          padding: EdgeInsets.all(40.w),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('ðŸ’¸', style: TextStyle(fontSize: 48.sp)),
              SizedBox(height: 16.h),
              Text('No students found in this class.',
                  style: TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.bold, fontSize: 13.sp)),
            ],
          ),
        ),
      );
    }

    // Use students list if available; otherwise fall back to payments
    final displayList = _students.isNotEmpty ? _students : _payments;

    return ListView.builder(
      padding: EdgeInsets.all(16.w),
      itemCount: displayList.length,
      itemBuilder: (ctx, i) {
        final s = displayList[i];
        final sId = s['id']?.toString() ?? '';
        // Find matching payment for this student
        final payment = _payments.cast<Map?>().firstWhere(
          (p) => p?['studentId']?.toString() == sId,
          orElse: () => null,
        );

        final name = s['user']?['name'] ?? s['student']?['user']?['name'] ?? '';
        final studentCode = s['student_id'] ?? '';
        final isPaid = payment != null;
        final amount = payment?['amount'] ?? 0;
        final method = payment?['payment_method'] ?? '';
        final date = payment?['date']?.toString().split('T').first ?? '';

        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: EdgeInsets.all(16.w),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12.r),
            border: Border.all(color: isPaid ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2)),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: isPaid ? const Color(0xFFDCFCE7) : const Color(0xFFFEF2F2),
                child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
                    style: TextStyle(fontWeight: FontWeight.w900, color: isPaid ? const Color(0xFF166534) : const Color(0xFFDC2626), fontSize: 14.sp)),
              ),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13.sp, color: AppTheme.textPrimary)),
                    SizedBox(height: 2.h),
                    Text(studentCode, style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.bold, color: AppTheme.textSecondary)),
                    if (isPaid) ...[
                      SizedBox(height: 4.h),
                      Row(children: [
                        Container(
                          padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 2.h),
                          decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(4.r)),
                          child: Text(method.toString().toUpperCase(), style: TextStyle(fontSize: 8.sp, fontWeight: FontWeight.w900, color: const Color(0xFF166534))),
                        ),
                        SizedBox(width: 6.w),
                        Text(date, style: TextStyle(fontSize: 10.sp, color: AppTheme.textSecondary)),
                      ]),
                    ],
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    isPaid ? '\$${amount.toString()}' : 'UNPAID',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: isPaid ? 16 : 12,
                      color: isPaid ? AppTheme.textPrimary : const Color(0xFFDC2626),
                    ),
                  ),
                  SizedBox(height: 4.h),
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
                    decoration: BoxDecoration(
                      color: isPaid ? const Color(0xFFDCFCE7) : const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(6.r),
                    ),
                    child: Text(isPaid ? 'PAID' : 'PENDING',
                        style: TextStyle(fontSize: 8.sp, fontWeight: FontWeight.w900, color: isPaid ? const Color(0xFF166534) : const Color(0xFFDC2626))),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildFilterBox({required String label, required Widget child}) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 6.h),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(10.r),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: TextStyle(
                  fontSize: 8.sp,
                  fontWeight: FontWeight.w900,
                  color: AppTheme.textSecondary,
                  letterSpacing: 0.5)),
          SizedBox(height: 2.h),
          child,
        ],
      ),
    );
  }

  Widget _actionBtn(String label, Color bg, Color fg,
      {VoidCallback? onTap, bool isSolid = false}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(10.r),
          boxShadow: isSolid
              ? [
                  BoxShadow(
                      color: bg.withValues(alpha: 0.2),
                      blurRadius: 4.r,
                      offset: const Offset(0, 2))
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (label == 'SAVING...') ...[
              SizedBox(
                width: 12.w,
                height: 12.h,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(fg),
                ),
              ),
              SizedBox(width: 8.w),
            ],
            Text(
              label,
              style:
                  TextStyle(color: fg, fontWeight: FontWeight.w900, fontSize: 11.sp),
            ),
          ],
        ),
      ),
    );
  }

  String _monthName(int m) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[m - 1];
  }

  List<int> _validYears() {
    if (_activeYear == null) return [DateTime.now().year];
    final start = DateTime.parse(_activeYear!['startDate']);
    final end = DateTime.parse(_activeYear!['endDate']);
    final years = <int>[];
    for (int y = start.year; y <= end.year; y++) {
      years.add(y);
    }
    return years;
  }

  List<int> _validMonths(int year) {
    if (_activeYear == null) return List.generate(12, (i) => i + 1);
    final start = DateTime.parse(_activeYear!['startDate']);
    final end = DateTime.parse(_activeYear!['endDate']);
    final months = <int>[];
    for (int m = 1; m <= 12; m++) {
      final afterStart = year > start.year || (year == start.year && m >= start.month);
      final beforeEnd = year < end.year || (year == end.year && m <= end.month);
      if (afterStart && beforeEnd) months.add(m);
    }
    return months.isNotEmpty ? months : [1];
  }
}

