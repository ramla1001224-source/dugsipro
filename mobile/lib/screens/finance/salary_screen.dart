import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../config/api_config.dart';

class SalaryScreen extends StatefulWidget {
  const SalaryScreen({super.key});
  @override
  State<SalaryScreen> createState() => _SalaryScreenState();
}

class _SalaryScreenState extends State<SalaryScreen> {
  final ApiService _api = ApiService();
  List<dynamic> _records = [];
  bool _loading = true;

  int _month = DateTime.now().month;
  int _year = DateTime.now().year;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final auth = AuthService();
      final role = (await auth.getRole() ?? '').toLowerCase();
      if (role == 'accountant') {
        final permitted = await auth.hasPermission('perm_acc_view_salary');
        if (!permitted) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                content: Text('Fasax uma lihid inaad aragto mushaarka.'),
                backgroundColor: Colors.red));
            Navigator.pop(context);
          }
          return;
        }
      }

      final period = '$_year-${_month.toString().padLeft(2, '0')}';
      final res = await _api.get('${ApiConfig.salary}?month=$period');
      final data = res.data;
      if (mounted) {
        setState(() {
          _records = data is List ? data : (data['data'] ?? []);
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _generateAll() async {
    setState(() => _loading = true);
    try {
      final period = '$_year-${_month.toString().padLeft(2, '0')}';
      await _api.post('${ApiConfig.salary}/generate', data: {'month': period});
      _load();
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Error: ${e.toString()}'),
              backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _paySalary(String id) async {
    setState(() => _loading = true);
    try {
      await _api.patch('${ApiConfig.salary}/$id/pay', data: {});
      _load();
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Error: ${e.toString()}'),
              backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    double totalPending = 0;
    double totalPaid = 0;

    for (var r in _records) {
      final n = r['netSalary'] ?? 0;
      if (r['status'] == 'pending') {
        totalPending += n;
      } else if (r['status'] == 'paid') {
        totalPaid += n;
      }
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
        title: Text(
          'Payroll',
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
                    Text(
                      'Salary & Payroll',
                      style: TextStyle(
                        fontSize: 22.sp,
                        fontWeight: FontWeight.w900,
                        color: AppTheme.textPrimary,
                        letterSpacing: -0.5,
                      ),
                    ),
                    SizedBox(height: 4.h),
                    Text(
                      'Manage and review historical payroll records',
                      style: TextStyle(
                        fontSize: 13.sp,
                        color: AppTheme.textSecondary,
                      ),
                    ),
                    SizedBox(height: 20.h),

                    // Time Filters
                    Container(
                      padding: EdgeInsets.all(12.w),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16.r),
                        border: Border.all(color: const Color(0xFFF1F5F9)),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: DropdownButtonHideUnderline(
                              child: DropdownButton<int>(
                                isExpanded: true,
                                value: _month,
                                items: List.generate(12, (i) {
                                  final m = i + 1;
                                  return DropdownMenuItem(
                                      value: m,
                                      child: Text(_monthName(m),
                                          style: TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 13.sp)));
                                }),
                                onChanged: (v) {
                                  if (v != null) {
                                    setState(() => _month = v);
                                    _load();
                                  }
                                },
                              ),
                            ),
                          ),
                          SizedBox(width: 8.w),
                          Expanded(
                            child: DropdownButtonHideUnderline(
                              child: DropdownButton<int>(
                                isExpanded: true,
                                value: _year,
                                items: List.generate(5, (i) {
                                  final y = DateTime.now().year - i;
                                  return DropdownMenuItem(
                                      value: y,
                                      child: Text('$y',
                                          style: TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 13.sp)));
                                }),
                                onChanged: (v) {
                                  if (v != null) {
                                    setState(() => _year = v);
                                    _load();
                                  }
                                },
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: 12.h),
                    ElevatedButton.icon(
                      onPressed: _generateAll,
                      icon: const Icon(Icons.rocket_launch,
                          color: Colors.white, size: 18),
                      label: const Text('GENERATE ALL',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF10B981),
                        padding: EdgeInsets.symmetric(vertical: 14.h),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12.r)),
                        elevation: 0,
                      ),
                    ),
                    SizedBox(height: 24.h),

                    // Stats row
                    Row(
                      children: [
                        Expanded(
                          child: Container(
                            padding: EdgeInsets.all(16.w),
                            decoration: BoxDecoration(
                                color: const Color(0xFFFFFBEB),
                                borderRadius: BorderRadius.circular(20.r),
                                border:
                                    Border.all(color: const Color(0xFFFEF3C7))),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('PENDING',
                                    style: TextStyle(
                                        color: const Color(0xFFD97706),
                                        fontSize: 9.sp,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 1)),
                                SizedBox(height: 4.h),
                                Text('\$${totalPending.toStringAsFixed(0)}',
                                    style: TextStyle(
                                        color: const Color(0xFFB45309),
                                        fontSize: 20.sp,
                                        fontWeight: FontWeight.w900)),
                              ],
                            ),
                          ),
                        ),
                        SizedBox(width: 12.w),
                        Expanded(
                          child: Container(
                            padding: EdgeInsets.all(16.w),
                            decoration: BoxDecoration(
                                color: const Color(0xFFECFDF5),
                                borderRadius: BorderRadius.circular(20.r),
                                border:
                                    Border.all(color: const Color(0xFFD1FAE5))),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('PAID',
                                    style: TextStyle(
                                        color: const Color(0xFF059669),
                                        fontSize: 9.sp,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 1)),
                                SizedBox(height: 4.h),
                                Text('\$${totalPaid.toStringAsFixed(0)}',
                                    style: TextStyle(
                                        color: const Color(0xFF047857),
                                        fontSize: 20.sp,
                                        fontWeight: FontWeight.w900)),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 24.h),

                    // List
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16.r),
                        border: Border.all(color: const Color(0xFFF1F5F9)),
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
                                _th('STAFF', flex: 3),
                                _th('NET SALARY', flex: 2, alignEnd: true),
                              ],
                            ),
                          ),
                          if (_records.isEmpty)
                            Padding(
                              padding: EdgeInsets.all(40.w),
                              child: const Text(
                                'No salary records found.',
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
                              itemCount: _records.length,
                              separatorBuilder: (_, __) => Divider(
                                  height: 1.h, color: Color(0xFFF1F5F9)),
                              itemBuilder: (ctx, i) {
                                final r = _records[i];
                                final isTeacher = r['teacher'] != null;
                                final userT = r['teacher'] != null
                                    ? r['teacher']['user']
                                    : null;
                                final userS = r['staff'] != null
                                    ? r['staff']['user']
                                    : null;
                                final name = isTeacher
                                    ? (userT != null ? userT['name'] : null)
                                    : (userS != null ? userS['name'] : null);
                                final position = isTeacher
                                    ? 'Teacher'
                                    : (r['staff'] != null
                                        ? r['staff']['position'] ?? 'Staff'
                                        : 'Staff');
                                final netSalary = r['netSalary'] ?? 0;
                                final isPaid = r['status'] == 'paid';

                                return Padding(
                                  padding: EdgeInsets.symmetric(
                                      horizontal: 16.w, vertical: 12.h),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        flex: 3,
                                        child: Row(
                                          children: [
                                            Container(
                                              width: 36.w,
                                              height: 36.h,
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFF1F5F9),
                                                borderRadius:
                                                    BorderRadius.circular(10.r),
                                              ),
                                              alignment: Alignment.center,
                                              child: Text(
                                                (name?.toString().isNotEmpty ??
                                                        false)
                                                    ? name
                                                        .toString()[0]
                                                        .toUpperCase()
                                                    : '?',
                                                style: TextStyle(
                                                    fontWeight: FontWeight.w900,
                                                    color:
                                                        AppTheme.textSecondary,
                                                    fontSize: 16.sp),
                                              ),
                                            ),
                                            SizedBox(width: 12.w),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    name ?? '-',
                                                    style: TextStyle(
                                                        fontWeight:
                                                            FontWeight.w900,
                                                        fontSize: 13.sp,
                                                        color: AppTheme
                                                            .textPrimary),
                                                  ),
                                                  SizedBox(height: 2.h),
                                                  Text(
                                                    position
                                                        .toString()
                                                        .toUpperCase(),
                                                    style: TextStyle(
                                                        fontSize: 9.sp,
                                                        fontWeight:
                                                            FontWeight.bold,
                                                        color: AppTheme
                                                            .textSecondary,
                                                        letterSpacing: 1),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Expanded(
                                        flex: 2,
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.end,
                                          children: [
                                            Text(
                                              '\$${netSalary.toString()}',
                                              style: TextStyle(
                                                  fontWeight: FontWeight.w900,
                                                  color: AppTheme.textPrimary,
                                                  fontSize: 15.sp),
                                            ),
                                            SizedBox(height: 4.h),
                                            GestureDetector(
                                              onTap: isPaid
                                                  ? null
                                                  : () => _paySalary(
                                                      r['id'].toString()),
                                              child: Container(
                                                padding:
                                                    EdgeInsets.symmetric(
                                                        horizontal: 6.w,
                                                        vertical: 2.h),
                                                decoration: BoxDecoration(
                                                    color: isPaid
                                                        ? const Color(
                                                            0xFFD1FAE5)
                                                        : const Color(
                                                            0xFFFEF3C7),
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                            6.r)),
                                                child: Text(
                                                  isPaid ? 'PAID' : 'PAY NOW',
                                                  style: TextStyle(
                                                      fontSize: 8.sp,
                                                      fontWeight:
                                                          FontWeight.w900,
                                                      color: isPaid
                                                          ? const Color(
                                                              0xFF059669)
                                                          : const Color(
                                                              0xFFD97706),
                                                      letterSpacing: 1),
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
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  String _monthName(int m) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    return months[m - 1];
  }

  Widget _th(String label,
      {int flex = 1, bool alignCenter = false, bool alignEnd = false}) {
    return Expanded(
      flex: flex,
      child: Text(
        label,
        textAlign: alignCenter
            ? TextAlign.center
            : (alignEnd ? TextAlign.right : TextAlign.left),
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

