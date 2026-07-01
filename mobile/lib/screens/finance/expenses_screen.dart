import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';

class ExpensesScreen extends StatefulWidget {
  const ExpensesScreen({super.key});
  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends State<ExpensesScreen> {
  final ApiService _api = ApiService();
  List<dynamic> _expenses = [];
  bool _loading = true;
  bool _submitting = false;

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
      final res =
          await _api.get('${ApiConfig.expenses}?month=$_month&year=$_year');
      final data = res.data;
      if (mounted) {
        setState(() {
          _expenses = data is List ? data : (data['data'] ?? []);
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _showAddDialog() async {
    final titleCtrl = TextEditingController();
    final amountCtrl = TextEditingController();
    final categoryCtrl = TextEditingController();

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            title: const Text('Add Expense'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: titleCtrl,
                  decoration: InputDecoration(labelText: 'Title'),
                  enabled: !_submitting,
                ),
                TextField(
                  controller: amountCtrl,
                  decoration: InputDecoration(labelText: 'Amount (\$)'),
                  keyboardType: TextInputType.number,
                  enabled: !_submitting,
                ),
                TextField(
                  controller: categoryCtrl,
                  decoration: InputDecoration(labelText: 'Category'),
                  enabled: !_submitting,
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: _submitting ? null : () => Navigator.pop(ctx, false),
                child: const Text('CANCEL'),
              ),
              TextButton(
                onPressed: _submitting
                    ? null
                    : () async {
                        if (titleCtrl.text.isEmpty) return;
                        final messenger = ScaffoldMessenger.of(context);
                        setDialogState(() => _submitting = true);
                        try {
                          await _api.post('${ApiConfig.expenses}/create', data: {
                            'title': titleCtrl.text.trim(),
                            'amount': double.tryParse(amountCtrl.text) ?? 0,
                            'category': categoryCtrl.text.trim(),
                            'date': DateTime.now().toIso8601String(),
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
                          if (mounted) setDialogState(() => _submitting = false);
                        }
                      },
                child: _submitting
                    ? SizedBox(
                        height: 16.h,
                        width: 16.w,
                        child: const CircularProgressIndicator(strokeWidth: 2),
                      )
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

  Future<void> _delete(String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Expense?'),
        content:
            const Text('Are you sure you want to remove this expense record?'),
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
        await _api.delete('${ApiConfig.expenses}/$id');
        _load();
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
          'School Expenses',
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
                    // Header Area
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Expense Tracker',
                                style: TextStyle(
                                  fontSize: 22.sp,
                                  fontWeight: FontWeight.w900,
                                  color: AppTheme.textPrimary,
                                  letterSpacing: -0.5,
                                ),
                              ),
                              SizedBox(height: 4.h),
                              Text(
                                'Monitor school expenditures',
                                style: TextStyle(
                                  fontSize: 13.sp,
                                  color: AppTheme.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 20.h),

                    // Filters & Action
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
                      onPressed: _showAddDialog,
                      icon:
                          const Icon(Icons.add, color: Colors.white, size: 18),
                      label: const Text('Add Expense',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFDC2626),
                        padding: EdgeInsets.symmetric(vertical: 14.h),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12.r)),
                        elevation: 0,
                      ),
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
                                _th('TITLE/CATEGORY', flex: 3),
                                _th('AMOUNT', flex: 2, alignCenter: true),
                                _th('DATE', flex: 1, alignEnd: true),
                                SizedBox(width: 24.w), // For delete icon
                              ],
                            ),
                          ),
                          if (_expenses.isEmpty)
                            Padding(
                              padding: EdgeInsets.all(40.w),
                              child: const Text(
                                'No expenses found.',
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
                              itemCount: _expenses.length,
                              separatorBuilder: (_, __) => Divider(
                                  height: 1.h, color: Color(0xFFF1F5F9)),
                              itemBuilder: (ctx, i) {
                                final exp = _expenses[i];
                                final title = exp['title'] ?? '';
                                final cat = exp['category'] ?? '';
                                final amount = exp['amount'] ?? 0;
                                final dateStr = exp['date'] != null
                                    ? exp['date'].toString().split('T').first
                                    : '';

                                return Padding(
                                  padding: EdgeInsets.symmetric(
                                      horizontal: 16.w, vertical: 12.h),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        flex: 3,
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              title,
                                              style: TextStyle(
                                                  fontWeight: FontWeight.w900,
                                                  fontSize: 13.sp,
                                                  color: AppTheme.textPrimary),
                                            ),
                                            SizedBox(height: 2.h),
                                            Text(
                                              cat.toString().toUpperCase(),
                                              style: TextStyle(
                                                  fontSize: 9.sp,
                                                  fontWeight: FontWeight.bold,
                                                  color: AppTheme.textSecondary,
                                                  letterSpacing: 1),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Expanded(
                                        flex: 2,
                                        child: Text(
                                          '-\$${amount.toString()}',
                                          textAlign: TextAlign.center,
                                          style: TextStyle(
                                              fontWeight: FontWeight.w900,
                                              color: const Color(0xFFDC2626),
                                              fontSize: 13.sp),
                                        ),
                                      ),
                                      Expanded(
                                        flex: 1,
                                        child: Text(
                                          dateStr,
                                          textAlign: TextAlign.right,
                                          style: TextStyle(
                                              fontSize: 11.sp,
                                              color: AppTheme.textSecondary,
                                              fontWeight: FontWeight.bold),
                                        ),
                                      ),
                                      SizedBox(width: 8.w),
                                      GestureDetector(
                                        onTap: () =>
                                            _delete(exp['id'].toString()),
                                        child: const Icon(
                                          Icons.delete_outline_rounded,
                                          color: Color(0xFFFCA5A5),
                                          size: 18,
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

