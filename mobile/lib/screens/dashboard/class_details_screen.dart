import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';
import '../../theme/app_theme.dart';
import '../../providers/locale_provider.dart';

class ClassDetailsScreen extends StatefulWidget {
  final String className;
  final String status;
  final String session;
  final String shift;
  final bool isPayment;

  const ClassDetailsScreen({
    Key? key,
    required this.className,
    required this.status,
    required this.session,
    required this.shift,
    required this.isPayment,
  }) : super(key: key);

  @override
  State<ClassDetailsScreen> createState() => _ClassDetailsScreenState();
}

class _ClassDetailsScreenState extends State<ClassDetailsScreen> {
  final ApiService _api = ApiService();
  bool _loading = true;
  List<dynamic> _details = [];

  @override
  void initState() {
    super.initState();
    _fetchDetails();
  }

  Future<void> _fetchDetails() async {
    setState(() => _loading = true);
    try {
      final baseDashboard = ApiConfig.dashboard.replaceAll('/stats', '');
      final endpoint = widget.isPayment ? 'payment-details' : 'attendance-details';
      
      String query = widget.isPayment
          ? 'status=${widget.status}&shift=${Uri.encodeComponent(widget.shift)}'
          : 'status=${widget.status}&session=${Uri.encodeComponent(widget.session)}&shift=${Uri.encodeComponent(widget.shift)}';
      
      final res = await _api.get('$baseDashboard/$endpoint?$query');
      if (mounted) {
        final data = res.data;
        final list = data is List ? data : (data is Map ? (data['data'] ?? []) : []);
        
        // Filter by class name
        final filteredList = list.where((item) {
          final c = (item as Map<String, dynamic>)['class']?.toString() ?? 'N/A';
          return c == widget.className;
        }).toList();

        setState(() {
          _details = filteredList;
        });
      }
    } catch (e) {
      debugPrint("Error fetching details: $e");
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final localeProvider = Provider.of<LocaleProvider>(context);
    final t = localeProvider.t;

    final isPaid = widget.status == 'paid';
    final isUnpaid = widget.status == 'unpaid';
    final isPresent = widget.status == 'Present';
    final isAbsent = widget.status == 'Absent';
    final isPending = widget.status == 'Pending';

    Color headerColor;
    if (isPresent || isPaid) {
      headerColor = const Color(0xFF059669);
    } else if (isAbsent || isUnpaid) {
      headerColor = const Color(0xFFE11D48);
    } else if (isPending) {
      headerColor = const Color(0xFF475569);
    } else {
      headerColor = const Color(0xFFD97706);
    }

    String subtitle;
    if (isPaid) {
      subtitle = t('this_month_paid');
    } else if (isUnpaid) {
      subtitle = t('this_month_unpaid');
    } else if (isPending) {
      subtitle = t('pending_classes_label');
    } else {
      subtitle = t('today_students').replaceAll('{status}', t(widget.status.toLowerCase()));
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.className.toUpperCase(),
              style: TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 16.sp,
                color: Colors.white,
                letterSpacing: 1,
              ),
            ),
            if (!_loading)
              Text(
                '$subtitle • ${t('found_records').replaceAll('{count}', _details.length.toString())}',
                style: TextStyle(
                  fontSize: 10.sp,
                  fontWeight: FontWeight.w700,
                  color: Colors.white.withValues(alpha: 0.8),
                ),
              ),
          ],
        ),
        backgroundColor: headerColor,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _details.isEmpty
              ? Center(
                  child: Text(
                    t('no_records_found').toUpperCase(),
                    style: TextStyle(
                      color: AppTheme.textSecondary,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2,
                      fontSize: 12.sp,
                    ),
                  ),
                )
              : ListView.builder(
                  padding: EdgeInsets.all(16.w),
                  itemCount: _details.length,
                  itemBuilder: (context, index) {
                    final s = _details[index];
                    final initials = (s['name'] ?? '??')
                        .toString()
                        .substring(0, (s['name'] ?? '??').toString().length >= 2 ? 2 : 1)
                        .toUpperCase();
                    return Container(
                      margin: EdgeInsets.only(bottom: 12.h),
                      padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16.r),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.02),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          )
                        ]
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 20,
                            backgroundColor: headerColor.withValues(alpha: 0.1),
                            child: Text(
                              initials,
                              style: TextStyle(
                                color: headerColor,
                                fontWeight: FontWeight.w900,
                                fontSize: 12.sp,
                              ),
                            ),
                          ),
                          SizedBox(width: 16.w),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  s['name'] ?? '',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w900,
                                    color: AppTheme.textPrimary,
                                    fontSize: 14.sp,
                                  ),
                                ),
                                if (s['parent_name'] != null && s['parent_name'] != 'N/A')
                                  Padding(
                                    padding: EdgeInsets.only(top: 2.h),
                                    child: Text(
                                      '${t('parent_label')}: ${s['parent_name']} (${s['parent_phone']})',
                                      style: TextStyle(
                                        fontSize: 11.sp,
                                        color: Colors.blueGrey,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                Padding(
                                  padding: EdgeInsets.only(top: 2.h),
                                  child: Text(
                                    s['student_id'] ?? '',
                                    style: TextStyle(
                                      fontSize: 11.sp,
                                      color: AppTheme.textSecondary,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
    );
  }
}
