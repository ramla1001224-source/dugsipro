import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import 'package:provider/provider.dart';
import '../../services/locale_service.dart';
import '../../config/api_config.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});
  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  final ApiService _api = ApiService();
  bool _loading = true;

  List<dynamic> _academicYears = [];
  String? _selectedYearId;
  String? _selectedSession;
  Map<String, dynamic> _data = {};

  @override
  void initState() {
    super.initState();
    _initData();
  }

  Future<void> _initData() async {
    await _fetchAcademicYears();
    await _load();
  }

  Future<void> _fetchAcademicYears() async {
    try {
      final res = await _api.get(ApiConfig.academicYears);
      if (mounted && res.data != null) {
        setState(() {
          _academicYears = res.data;
          final current = _academicYears.firstWhere(
              (y) => y['isCurrent'] == true,
              orElse: () => _academicYears.isNotEmpty ? _academicYears[0] : null);
          if (current != null) {
            _selectedYearId = current['id'].toString();
            _selectedSession = current['name'];
          }
        });
      }
    } catch (_) {}
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      String url = '${ApiConfig.dashboard}/charts';
      if (_selectedSession != null) {
        url += '?academicYear=$_selectedSession';
      }
      final res = await ApiService().get(url);
      if (mounted) {
        setState(() {
          _data = res.data ?? {};
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Provider.of<LocaleProvider>(context).t;
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
        title: Text(
          t('financial_reports'),
          style: TextStyle(
            color: AppTheme.textPrimary,
            fontWeight: FontWeight.w900,
            fontSize: 18.sp,
          ),
        ),
        actions: [
          if (_academicYears.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(
                child: Container(
                  height: 32.h,
                  padding: EdgeInsets.symmetric(horizontal: 12.w),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(8.r),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedYearId,
                      icon: const Icon(Icons.keyboard_arrow_down_rounded,
                          size: 16),
                      style: TextStyle(
                          fontSize: 11.sp,
                          fontWeight: FontWeight.w800,
                          color: AppTheme.textPrimary),
                      onChanged: (val) {
                        if (val != null) {
                          final year = _academicYears.firstWhere(
                              (y) => y['id'].toString() == val);
                          setState(() {
                            _selectedYearId = val;
                            _selectedSession = year['name'];
                          });
                          _load();
                        }
                      },
                      items: _academicYears
                          .map((y) => DropdownMenuItem<String>(
                                value: y['id'].toString(),
                                child: Text((y['name'] ?? '').toUpperCase(),
                                    style: TextStyle(fontSize: 11.sp)),
                              ))
                          .toList(),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: EdgeInsets.all(16.w),
                children: [
                   Text(
                    t('financial_analytics'),
                    style: TextStyle(
                      fontSize: 22.sp,
                      fontWeight: FontWeight.w900,
                      color: AppTheme.textPrimary,
                      letterSpacing: -0.5,
                    ),
                  ),
                  SizedBox(height: 4.h),
                   Text(
                    t('financial_analytics_desc'),
                    style: TextStyle(
                      fontSize: 13.sp,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  SizedBox(height: 24.h),

                  // In Flutter without Recharts, we can build simple progress bars or lists for exactly what the charts show,
                  // or we can use a library. Since we're replicating UI in standard widgets, we'll build simple visual lists.

                  _buildSection(t('income_by_class'), _data['incomeByClass'] ?? [],
                      Colors.blue, t),
                  SizedBox(height: 24.h),
                  _buildSection(t('expense_breakdown'),
                      _data['expenseByCategory'] ?? [], Colors.red, t),
                  SizedBox(height: 24.h),
                  // Financial Trend
                  Container(
                    padding: EdgeInsets.all(20.w),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24.r),
                      border: Border.all(color: const Color(0xFFF1F5F9)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                         Text(
                          t('financial_trend'),
                          style: TextStyle(
                            fontSize: 14.sp,
                            fontWeight: FontWeight.w900,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        SizedBox(height: 16.h),
                        ...(_data['trends'] as List? ?? []).map((t) {
                          final name = t['name'] ?? '';
                          final inc = (t['income'] ?? 0).toDouble();
                          final exp = (t['expense'] ?? 0).toDouble();
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Row(
                              children: [
                                SizedBox(
                                    width: 40.w,
                                    child: Text(name,
                                        style: TextStyle(
                                            fontSize: 10.sp,
                                            fontWeight: FontWeight.bold,
                                            color: AppTheme.textSecondary))),
                                SizedBox(width: 8.w),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Container(
                                            height: 6.h,
                                            width: inc == 0 ? 0 : 40,
                                            decoration: BoxDecoration(
                                                color: const Color(0xFF10B981),
                                                borderRadius:
                                                    BorderRadius.circular(3.r)),
                                          ),
                                          SizedBox(width: 4.w),
                                          Text('\$${inc.toInt()}',
                                              style: TextStyle(
                                                  fontSize: 9.sp,
                                                  fontWeight: FontWeight.w900,
                                                  color: const Color(0xFF047857))),
                                        ],
                                      ),
                                      SizedBox(height: 4.h),
                                      Row(
                                        children: [
                                          Container(
                                            height: 6.h,
                                            width: exp == 0 ? 0 : 30,
                                            decoration: BoxDecoration(
                                                color: const Color(0xFFEF4444),
                                                borderRadius:
                                                    BorderRadius.circular(3.r)),
                                          ),
                                          SizedBox(width: 4.w),
                                          Text('\$${exp.toInt()}',
                                              style: TextStyle(
                                                  fontSize: 9.sp,
                                                  fontWeight: FontWeight.w900,
                                                  color: const Color(0xFFB91C1C))),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        }),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildSection(String title, List items, Color color, String Function(String) t) {
    if (items.isEmpty) {
      return Container(
        padding: EdgeInsets.all(20.w),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24.r),
          border: Border.all(color: const Color(0xFFF1F5F9)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: TextStyle(
                    fontSize: 14.sp,
                    fontWeight: FontWeight.w900,
                    color: AppTheme.textPrimary)),
            SizedBox(height: 16.h),
             Text(t('no_data'),
                style: TextStyle(
                    color: AppTheme.textSecondary,
                    fontSize: 13.sp,
                    fontWeight: FontWeight.bold)),
          ],
        ),
      );
    }

    double maxVal = 0;
    for (var i in items) {
      final v = (i['value'] ?? 0).toDouble();
      if (v > maxVal) maxVal = v;
    }

    return Container(
      padding: EdgeInsets.all(20.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24.r),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title,
              style: TextStyle(
                  fontSize: 14.sp,
                  fontWeight: FontWeight.w900,
                  color: AppTheme.textPrimary)),
          SizedBox(height: 20.h),
          ...items.map((i) {
            final name = i['name'] ?? '';
            final val = (i['value'] ?? 0).toDouble();
            final pct = maxVal > 0 ? val / maxVal : 0.0;
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: Text(name.toString().toUpperCase(),
                        style: TextStyle(
                            fontSize: 10.sp,
                            fontWeight: FontWeight.w900,
                            color: AppTheme.textSecondary,
                            letterSpacing: 0.5)),
                  ),
                  Expanded(
                    flex: 3,
                    child: Stack(
                      children: [
                        Container(
                          height: 8.h,
                          decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(4.r)),
                        ),
                        FractionallySizedBox(
                          widthFactor: pct,
                          child: Container(
                            height: 8.h,
                            decoration: BoxDecoration(
                                color: color,
                                borderRadius: BorderRadius.circular(4.r)),
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(width: 8.w),
                  SizedBox(
                    width: 50.w,
                    child: Text('\$${val.toInt()}',
                        textAlign: TextAlign.right,
                        style: TextStyle(
                            fontSize: 11.sp,
                            fontWeight: FontWeight.w900,
                            color: AppTheme.textPrimary)),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

