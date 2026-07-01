import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../main.dart';
import 'package:go_router/go_router.dart';

class ExamHubScreen extends StatelessWidget {
  const ExamHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final modules = [
      {
        'title': 'Maamulka Imtixaanka',
        'subtitle': 'Exams Management',
        'icon': '📱',
        'desc': 'Diiwaan-geli imtixaanada cusub iyo kuwa hadda socda.',
        'link': '/exams',
        'color': const Color(0xFF8B5CF6), // Purple
      },
      {
        'title': 'Jadwalka Imtixaanka',
        'subtitle': 'Exam Scheduling',
        'icon': 'ðŸ—“ï¸',
        'desc': 'Habeey waqtiyada iyo goobaha ay imtixaanadu dhacayaan.',
        'link': '/exams/schedule',
        'color': const Color(0xFFD946EF), // Fuchsia
      },
      {
        'title': 'Natiijada & Marks',
        'subtitle': 'Marks & Results',
        'icon': '📊',
        'desc': 'Geli dhibcaha ardayda oo hubi natiijooyinka dhamaadka.',
        'link': '/marks',
        'color': const Color(0xFF3B82F6), // Blue
      },
      {
        'title': 'Mark Sheet',
        'subtitle': 'Xaanshida Natiijada',
        'icon': '📄',
        'desc': 'Daabac xaanshida natiijada iyo dhibcaha ee ardayda.',
        'link': '/mark-sheet',
        'color': const Color(0xFF10B981), // Emerald
      },
      {
        'title': 'Results SMS',
        'subtitle': 'Natiijada via SMS',
        'icon': 'ðŸ’¬',
        'desc': 'U dir natiijada imtixaanka waalidiinta si toos ah oo SMS ah.',
        'link': '/results-sms',
        'color': const Color(0xFFF97316), // Orange
      },
      {
        'title': 'Top 10 Rankings',
        'subtitle': 'Xiddigaha Dugsiga',
        'icon': 'ðŸ†',
        'desc': 'Arag 10-ka arday ee fasal kasta ugu sareeya dhibco ahaan.',
        'link': '/exams/rankings',
        'color': const Color(0xFFEAB308), // Yellow/Gold
      },
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
        title: Text(
          'Xarunta Imtixaanada',
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
              'Smart School',
              style: TextStyle(
                fontSize: 12.sp,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF8B5CF6),
                letterSpacing: 2,
              ),
            ),
            SizedBox(height: 4.h),
            Text(
              'Xarunta Imtixaanada',
              style: TextStyle(
                fontSize: 28.sp,
                fontWeight: FontWeight.w900,
                color: AppTheme.textPrimary,
                letterSpacing: -1,
              ),
            ),
            SizedBox(height: 8.h),
            Text(
              'Hal meel ka maamul wax kasta oo khuseeya imtixaanada, natiijooyinka, iyo jadwalka dugsiga.',
              style: TextStyle(
                fontSize: 14.sp,
                color: AppTheme.textSecondary,
                height: 1.5.h,
              ),
            ),
            SizedBox(height: 30.h),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 16,
                mainAxisSpacing: 16,
                childAspectRatio: 0.75,
              ),
              itemCount: modules.length,
              itemBuilder: (context, index) {
                final mod = modules[index];
                return InkWell(
                  onTap: () => GoRouter.of(context).push(mod['link'] as String),
                  borderRadius: BorderRadius.circular(24.r),
                  child: Container(
                    padding: EdgeInsets.all(20.w),
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
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 48.w,
                          height: 48.h,
                          decoration: BoxDecoration(
                            color: (mod['color'] as Color).withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(14.r),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            mod['icon'] as String,
                            style: TextStyle(fontSize: 24.sp),
                          ),
                        ),
                        const Spacer(),
                        Text(
                          (mod['subtitle'] as String).toUpperCase(),
                          style: TextStyle(
                            fontSize: 9.sp,
                            fontWeight: FontWeight.w900,
                            color: mod['color'] as Color,
                            letterSpacing: 0.5,
                          ),
                        ),
                        SizedBox(height: 4.h),
                        Text(
                          mod['title'] as String,
                          style: TextStyle(
                            fontSize: 15.sp,
                            fontWeight: FontWeight.w900,
                            color: AppTheme.textPrimary,
                            height: 1.2.h,
                          ),
                        ),
                        SizedBox(height: 6.h),
                        Text(
                          mod['desc'] as String,
                          style: TextStyle(
                            fontSize: 10.sp,
                            color: AppTheme.textSecondary,
                            height: 1.3.h,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
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

