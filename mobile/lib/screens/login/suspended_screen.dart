import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../services/auth_service.dart';
import '../../router/auth_state.dart';
import 'package:url_launcher/url_launcher.dart';

class SuspendedScreen extends StatelessWidget {
  const SuspendedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A), // Slate-900
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.all(32.0.w),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Spacer(),
              // Lock Icon
              Container(
                width: 100.w,
                height: 100.h,
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(30.r),
                ),
                child: Center(
                  child: Text(
                    '🔒',
                    style: TextStyle(fontSize: 50.sp),
                  ),
                ),
              ),
              SizedBox(height: 40.h),
              // Title
              Text(
                'Nidaamka waa xiran yahay',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 28.sp,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                ),
              ),
              SizedBox(height: 24.h),
              // Message Box
              Container(
                padding: EdgeInsets.all(24.w),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(24.r),
                  border:
                      Border.all(color: Colors.white.withValues(alpha: 0.1)),
                ),
                child: Column(
                  children: [
                    Text(
                      'Fadlan bixi biilka Bisha',
                      style: TextStyle(
                        color: Colors.redAccent,
                        fontSize: 18.sp,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(height: 12.h),
                    Text(
                      'Access to the management dashboard has been temporarily suspended due to outstanding payments. Please contact the system administrator to restore access.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.6),
                        fontSize: 14.sp,
                        height: 1.5.h,
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: 24.h),
              // Phone Number Section (Matching Web)
              Container(
                width: double.infinity,
                padding: EdgeInsets.symmetric(vertical: 20.h),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(24.r),
                ),
                child: Column(
                  children: [
                    Text(
                      'KALA XIRIIR MAAMULKA shirkada',
                      style: TextStyle(
                        color: Colors.red.withValues(alpha: 0.5),
                        fontSize: 10.sp,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 2,
                      ),
                    ),
                    SizedBox(height: 8.h),
                    GestureDetector(
                      onTap: () async {
                        final Uri url = Uri.parse('tel:+2520907525970');
                        if (await canLaunchUrl(url)) {
                          await launchUrl(url);
                        }
                      },
                      child: Text(
                        '+252 0907525970',
                        style: TextStyle(
                          color: Colors.redAccent,
                          fontSize: 24.sp,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              // Buttons
              ElevatedButton(
                onPressed: () {
                  // Reload check / Reset
                  AuthState().setSuspended(false);
                  context.go('/login');
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: const Color(0xFF0F172A),
                  minimumSize: const Size(double.infinity, 60),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16.r),
                  ),
                ),
                child: const Text('CHECK STATUS & REFRESH'),
              ),
              SizedBox(height: 12.h),
              TextButton(
                onPressed: () async {
                  await AuthService().logout();
                  AuthState().update(false, null);
                  if (context.mounted) context.go('/login');
                },
                style: TextButton.styleFrom(
                  foregroundColor: Colors.white.withValues(alpha: 0.5),
                  minimumSize: const Size(double.infinity, 50),
                ),
                child: const Text('LOGOUT'),
              ),
              SizedBox(height: 20.h),
              // Footer
              Text(
                'DUGSI PRO • ENTERPRISE SECURITY',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.2),
                  fontSize: 10.sp,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

