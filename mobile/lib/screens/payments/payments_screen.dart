import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:dio/dio.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:url_launcher/url_launcher.dart';

class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key});
  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen> {
  final ApiService _api = ApiService();
  List<dynamic> _payments = [];
  bool _loading = true;

  double get _totalBalance {
    double total = 0;
    for (var p in _payments) {
      total += (p['remainingAmount'] ?? 0).toDouble();
    }
    return total;
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api.get(ApiConfig.monthlyRecords);
      final data = res.data;
      final list = data is List ? data : data['payments'] ?? data['data'] ?? [];
      if (mounted) {
        setState(() {
          _payments = list;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        if (e is DioException && 
              (e.type == DioExceptionType.connectionTimeout || 
               e.type == DioExceptionType.receiveTimeout || 
               e.type == DioExceptionType.sendTimeout ||
               e.type == DioExceptionType.connectionError ||
               e.type == DioExceptionType.unknown)) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Khadka Internet-ka ayaa kaa go\'an. Fadlan hubi.')),
          );
        }
      }
    }
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'paid':
      case 'completed':
        return AppTheme.success;
      case 'partial':
        return Colors.blue;
      case 'pending':
      case 'unpaid':
        return AppTheme.warning;
      case 'overdue':
        return AppTheme.danger;
      default:
        return AppTheme.textSecondary;
    }
  }

  Future<void> _showPayDialog(dynamic p, {bool isAll = false}) async {
    final TextEditingController phoneController = TextEditingController();
    final TextEditingController nameController = TextEditingController();
    final maxAmount = p['amount'] ?? 0;
    final TextEditingController amountController = TextEditingController(text: '$maxAmount');
    
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28.r)),
        title: Text(isAll ? 'Bixi Wadarta Guud' : 'Bixi Biilka', style: const TextStyle(fontWeight: FontWeight.w900)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: EdgeInsets.all(16.w),
                decoration: BoxDecoration(
                  color: AppTheme.success.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(15.r),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Wadarta Dhiman:', style: TextStyle(fontWeight: FontWeight.bold)),
                    Text('\$$maxAmount', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20.sp, color: AppTheme.success)),
                  ],
                ),
              ),
              SizedBox(height: 20.h),
              Text('Lacagta la bixinayo:', style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.bold)),
              SizedBox(height: 8.h),
              TextField(
                controller: amountController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                  hintText: 'Gali lacagta',
                  filled: true,
                  fillColor: Colors.grey[100],
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(15.r), borderSide: BorderSide.none),
                ),
              ),
              SizedBox(height: 20.h),
              Text('Magacaaga:', style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.bold)),
              SizedBox(height: 8.h),
              TextField(
                controller: nameController,
                decoration: InputDecoration(
                  hintText: 'Gali magacaaga',
                  filled: true,
                  fillColor: Colors.grey[100],
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(15.r), borderSide: BorderSide.none),
                ),
              ),
              SizedBox(height: 16.h),
              Text('Mobile Money Number:', style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.bold)),
              SizedBox(height: 8.h),
              TextField(
                controller: phoneController,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  hintText: 'E.g. 61xxxxxxx ama 63xxxxxxx',
                  filled: true,
                  fillColor: Colors.grey[100],
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(15.r), borderSide: BorderSide.none),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Iska dhaaf')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15.r)),
              padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 12.h),
            ),
            onPressed: () async {
              final phone = phoneController.text.trim();
              final name = nameController.text.trim();
              final double? enteredAmount = double.tryParse(amountController.text.trim());

              if (phone.isEmpty || name.isEmpty || enteredAmount == null) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Fadlan buuxi meelaha banaan')));
                return;
              }
              if (enteredAmount <= 0 || enteredAmount > maxAmount) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Lacagtu waa inaysan ka badnaan \$$maxAmount')));
                return;
              }
              Navigator.pop(ctx);
              _processPayment(
                p['studentId'] ?? p['id'], 
                enteredAmount, 
                phone, 
                name, 
                month: p['month'], 
                year: p['year'],
                desc: isAll ? "Wadarta dhamaan biilasha dhiman" : null
              );
            },
            child: const Text('BIXI HADDA'),
          ),
        ],
      ),
    );
  }

  Future<void> _processPayment(String studentId, dynamic amount, String phone, String name, {int? month, int? year, String? desc}) async {
    setState(() => _loading = true);
    try {
      final res = await _api.post(ApiConfig.mobileMoneyPay, data: {
        'studentId': studentId,
        'amount': amount,
        'phoneNumber': phone,
        'name': name,
        'month': month,
        'year': year,
        'description': desc ?? (month != null ? "Tuition Fee for $month/$year" : "Mobile Money Payment"),
      });
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res.data['message'] ?? 'Fadlan ka aqbal Mobile-kaaga (Enter PIN)'),
            backgroundColor: AppTheme.success,
          ),
        );
        _load();
      }
    } catch (e) {
      if (mounted) {
        String msg = 'Cillad ayaa dhacday. Hubi mobile-kaaga ama API-ga';
        if (e is DioException && 
              (e.type == DioExceptionType.connectionTimeout || 
               e.type == DioExceptionType.receiveTimeout || 
               e.type == DioExceptionType.sendTimeout ||
               e.type == DioExceptionType.connectionError ||
               e.type == DioExceptionType.unknown)) {
          msg = 'Khadka Internet-ka ayaa kaa go\'an. Fadlan hubi.';
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg), backgroundColor: AppTheme.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _downloadReceipt(String paymentId) async {
    try {
      final token = await const FlutterSecureStorage().read(key: 'token');
      final path = '/payments/$paymentId/receipt?token=$token';
      
      final cleanPath = path.startsWith('/') ? path : '/$path';
      final cleanBaseUrl = ApiConfig.baseUrl.endsWith('/') 
          ? ApiConfig.baseUrl.substring(0, ApiConfig.baseUrl.length - 1) 
          : ApiConfig.baseUrl;
      
      final fullUrl = '$cleanBaseUrl$cleanPath';
      final url = Uri.parse(fullUrl);

      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Ma furi karo PDF-ka: $fullUrl')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        String msg = 'Cillad: $e';
        if (e is DioException && 
              (e.type == DioExceptionType.connectionTimeout || 
               e.type == DioExceptionType.receiveTimeout || 
               e.type == DioExceptionType.sendTimeout ||
               e.type == DioExceptionType.connectionError ||
               e.type == DioExceptionType.unknown)) {
          msg = 'Khadka Internet-ka ayaa kaa go\'an. Fadlan hubi.';
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg)),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: FutureBuilder<String?>(
          future: const FlutterSecureStorage().read(key: 'schoolLogo'),
          builder: (context, snapshot) {
            final logo = snapshot.data;
            return Row(
              children: [
                if (logo != null)
                  Container(
                    width: 30.w,
                    height: 30.h,
                    margin: const EdgeInsets.only(right: 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8.r),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.1),
                          blurRadius: 4.r,
                        )
                      ],
                    ),
                    padding: EdgeInsets.all(4.w),
                    child: Image.network(
                      logo.startsWith('http')
                          ? logo
                          : '${ApiConfig.baseUrl.endsWith('/') ? ApiConfig.baseUrl.substring(0, ApiConfig.baseUrl.length - 1) : ApiConfig.baseUrl}${logo.startsWith('/') ? logo : '/$logo'}',
                      fit: BoxFit.contain,
                      errorBuilder: (ctx, err, stack) => const Icon(
                        Icons.school_rounded,
                        color: AppTheme.primary,
                        size: 16,
                      ),
                    ),
                  ),
                const Text('Payments'),
              ],
            );
          }
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: CustomScrollView(
                slivers: [
                  if (_totalBalance > 0)
                  SliverToBoxAdapter(
                    child: Container(
                      margin: EdgeInsets.all(16.w),
                      padding: EdgeInsets.all(24.w),
                      decoration: BoxDecoration(
                        color: AppTheme.primary,
                        borderRadius: BorderRadius.circular(24.r),
                        boxShadow: [
                          BoxShadow(color: AppTheme.primary.withValues(alpha: 0.2), blurRadius: 15.r, offset: const Offset(0, 8))
                        ]
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Wadarta Guud ee Dhiman', style: TextStyle(color: Colors.white70, fontSize: 12.sp, fontWeight: FontWeight.bold, letterSpacing: 1)),
                          SizedBox(height: 4.h),
                          Text('\$${_totalBalance.toStringAsFixed(0)}', style: TextStyle(color: Colors.white, fontSize: 36.sp, fontWeight: FontWeight.w900)),
                          SizedBox(height: 20.h),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: () => _showPayDialog({'amount': _totalBalance, 'studentId': _payments[0]['studentId']}, isAll: true),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.white,
                                foregroundColor: AppTheme.primary,
                                padding: EdgeInsets.symmetric(vertical: 14.h),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14.r)),
                              ),
                              child: Text('BIXI WADARTA GUUD', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12.sp, letterSpacing: 1)),
                            ),
                          )
                        ],
                      ),
                    ),
                  ),
                  _payments.isEmpty
                  ? const SliverFillRemaining(
                      child: Center(
                        child: Text(
                          'Lacag bixin lama helin',
                          style: TextStyle(color: AppTheme.textSecondary),
                        ),
                      ),
                    )
                  : SliverPadding(
                      padding: EdgeInsets.symmetric(horizontal: 16.w),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (ctx, i) {
                            final p = _payments[i];
                            final student =
                                p['student']?['user']?['name'] ??
                                p['studentName'] ??
                                'Unknown';
                            
                            final expectedAmount = p['expectedAmount'] ?? p['amount'] ?? 0;
                            final amountPaid = p['amountPaid'] ?? 0;
                            final remainingAmount = p['remainingAmount'] ?? expectedAmount;
                            
                            String rawStatus = p['status'] ?? 'pending';
                            if (rawStatus.toLowerCase() != 'paid' && amountPaid > 0) {
                              rawStatus = 'partial';
                            }
                            
                            final status = rawStatus;
                            final isNotPaid = remainingAmount > 0;
                            
                            final date = "${p['month'] ?? ''}/${p['year'] ?? ''}";

                            return Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: InkWell(
                                onTap: isNotPaid ? () => _showPayDialog({...p, 'amount': remainingAmount}) : null,
                                borderRadius: BorderRadius.circular(18.r),
                                child: Container(
                                  padding: EdgeInsets.all(16.w),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(18.r),
                                    border: Border.all(
                                      color: isNotPaid ? AppTheme.warning.withValues(alpha: 0.1) : const Color(0xFFE2E8F0),
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 44.w,
                                        height: 44.h,
                                        decoration: BoxDecoration(
                                          color: _statusColor(status).withValues(alpha: 0.1),
                                          borderRadius: BorderRadius.circular(14.r),
                                        ),
                                        child: Icon(
                                          Icons.payments_rounded,
                                          color: _statusColor(status),
                                          size: 22,
                                        ),
                                      ),
                                      SizedBox(width: 14.w),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              student,
                                              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.sp),
                                            ),
                                            Text(
                                              date,
                                              style: TextStyle(fontSize: 11.sp, color: AppTheme.textSecondary),
                                            ),
                                          ],
                                        ),
                                      ),
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.end,
                                          children: [
                                            Text(
                                              '\$$expectedAmount',
                                              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16.sp, color: AppTheme.textPrimary),
                                            ),
                                            if (isNotPaid) ...[
                                              Text(
                                                'Haraa: \$$remainingAmount',
                                                style: TextStyle(fontSize: 10.sp, color: Colors.redAccent, fontWeight: FontWeight.bold),
                                              ),
                                              SizedBox(height: 4.h),
                                              Container(
                                                padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                                                decoration: BoxDecoration(color: AppTheme.warning.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8.r)),
                                                child: Text('BIXI', style: TextStyle(fontSize: 8.sp, fontWeight: FontWeight.w900, color: AppTheme.warning, letterSpacing: 0.5)),
                                              )
                                            ] else ...[
                                              Container(
                                                padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 2.h),
                                                decoration: BoxDecoration(color: AppTheme.success.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6.r)),
                                                child: Text('PAID', style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.w900, color: AppTheme.success, letterSpacing: 0.5)),
                                              ),
                                              if (p['paymentId'] != null) ...[
                                                SizedBox(height: 4.h),
                                                GestureDetector(
                                                  onTap: () => _downloadReceipt(p['paymentId']),
                                                  child: Container(
                                                    padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 4.h),
                                                    decoration: BoxDecoration(
                                                      color: AppTheme.primary.withValues(alpha: 0.1),
                                                      borderRadius: BorderRadius.circular(6.r),
                                                    ),
                                                    child: Row(
                                                      mainAxisSize: MainAxisSize.min,
                                                      children: [
                                                        const Icon(Icons.download_rounded, size: 10, color: AppTheme.primary),
                                                        SizedBox(width: 4.w),
                                                        Text('RECEIPT', style: TextStyle(fontSize: 8.sp, fontWeight: FontWeight.w900, color: AppTheme.primary)),
                                                      ],
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ],
                                        ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                          childCount: _payments.length,
                        ),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}


