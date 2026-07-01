import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../main.dart';
import 'package:go_router/go_router.dart';
import '../../services/locale_service.dart';
import 'package:provider/provider.dart';

class StudentHubScreen extends StatelessWidget {
  const StudentHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = Provider.of<LocaleProvider>(context).t;

    final modules = [
      {
        'title': t('students_manage'),
        'subtitle': t('management'),
        'icon': 'ðŸ‘¨â€🎓',
        'desc': t('students_manage_desc'),
        'link': '/students',
        'color': const Color(0xFF3B82F6), // Blue
      },
      {
        'title': t('attendance'),
        'subtitle': t('academic'),
        'icon': '📅',
        'desc': t('attendance_desc'),
        'link': '/attendance',
        'color': const Color(0xFF10B981), // Emerald
      },
      {
        'title': t('fees'),
        'subtitle': t('finance'),
        'icon': '💰',
        'desc': t('fees_desc'),
        'link': '/fees',
        'color': const Color(0xFFF59E0B), // Amber
      },
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
        title: Text(
          t('student_hub'),
          style: TextStyle(
            color: AppTheme.textPrimary,
            fontWeight: FontWeight.w900,
            fontSize: 18.sp,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(20.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'DUGSI PRO SYSTEM',
              style: TextStyle(
                fontSize: 12.sp,
                fontWeight: FontWeight.w900,
                color: AppTheme.primary,
                letterSpacing: 2,
              ),
            ),
            SizedBox(height: 4.h),
            Text(
              t('student_hub'),
              style: TextStyle(
                fontSize: 28.sp,
                fontWeight: FontWeight.w900,
                color: AppTheme.textPrimary,
                letterSpacing: -1,
              ),
            ),
            SizedBox(height: 8.h),
            Text(
              t('choose_module'),
              style: TextStyle(
                fontSize: 14.sp,
                color: AppTheme.textSecondary,
                height: 1.5.h,
              ),
            ),
// ... rest of the build method ...
            SizedBox(height: 30.h),
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: modules.length,
              separatorBuilder: (context, index) => SizedBox(height: 16.h),
              itemBuilder: (context, index) {
                final mod = modules[index];
                return InkWell(
                  onTap: () => GoRouter.of(context).push(mod['link'] as String),
                  borderRadius: BorderRadius.circular(24.r),
                  child: Container(
                    padding: EdgeInsets.all(24.w),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24.r),
                      border: Border.all(color: const Color(0xFFF1F5F9)),
                      boxShadow: [
                        BoxShadow(
                          color: (mod['color'] as Color).withValues(alpha: 0.1),
                          blurRadius: 20.r,
                          offset: const Offset(0, 8),
                        )
                      ],
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 60.w,
                          height: 60.h,
                          decoration: BoxDecoration(
                            color: (mod['color'] as Color).withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(18.r),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            mod['icon'] as String,
                            style: TextStyle(fontSize: 30.sp),
                          ),
                        ),
                        SizedBox(width: 20.w),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                (mod['subtitle'] as String).toUpperCase(),
                                style: TextStyle(
                                  fontSize: 10.sp,
                                  fontWeight: FontWeight.w900,
                                  color: mod['color'] as Color,
                                  letterSpacing: 1,
                                ),
                              ),
                              SizedBox(height: 4.h),
                              Text(
                                mod['title'] as String,
                                style: TextStyle(
                                  fontSize: 18.sp,
                                  fontWeight: FontWeight.w900,
                                  color: AppTheme.textPrimary,
                                ),
                              ),
                              SizedBox(height: 6.h),
                              Text(
                                mod['desc'] as String,
                                style: TextStyle(
                                  fontSize: 12.sp,
                                  color: AppTheme.textSecondary,
                                  height: 1.4.h,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Icon(
                          Icons.arrow_forward_ios_rounded,
                          size: 16,
                          color: Color(0xFFCBD5E1),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

