import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../main.dart';
import 'package:go_router/go_router.dart';

class AcademicScreen extends StatelessWidget {
  const AcademicScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cards = [
      {
        'label': 'Classes',
        'href': '/classes',
        'icon': 'ðŸ«',
        'desc': 'Manage classes and sections'
      },
      {
        'label': 'Subjects',
        'href': '/subjects',
        'icon': '📚',
        'desc': 'Manage curriculum subjects'
      },
      {
        'label': 'Timetable',
        'href': '/timetable',
        'icon': '📅',
        'desc': 'Schedule classes and teachers'
      },
      {
        'label': 'Examinations',
        'href': '/exams',
        'icon': '📱',
        'desc': 'Manage exams and results'
      },
      {
        'label': 'Exam Scheduling',
        'href': '/exams/schedule',
        'icon': '📅',
        'desc': 'Set exam dates and times'
      },
      {
        'label': 'Marks / Grades',
        'href': '/marks',
        'icon': '📊',
        'desc': 'Record and view student marks'
      },
      {
        'label': 'Graduates',
        'href': '/alumni',
        'icon': '🎓',
        'desc': 'Manage alumni and graduated students'
      },
      {
        'label': 'Student Promotion',
        'href': '/promotion',
        'icon': '🚀',
        'desc': 'Promote students to next classes'
      },
      {
        'label': 'Academic Years',
        'href': '/academic-years',
        'icon': '📆',
        'desc': 'Manage school academic years'
      },
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
        title: Text(
          'Academic Management',
          style: TextStyle(
            color: AppTheme.textPrimary,
            fontWeight: FontWeight.w900,
            fontSize: 18.sp,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Academic Hub',
              style: TextStyle(
                fontSize: 24.sp,
                fontWeight: FontWeight.w900,
                color: AppTheme.textPrimary,
                letterSpacing: -0.5,
              ),
            ),
            SizedBox(height: 4.h),
            Text(
              'Manage your school\'s academic resources',
              style: TextStyle(
                fontSize: 13.sp,
                color: AppTheme.textSecondary,
              ),
            ),
            SizedBox(height: 20.h),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 0.85,
              ),
              itemCount: cards.length,
              itemBuilder: (context, index) {
                final c = cards[index];
                return InkWell(
                  onTap: () {
                    if (c['href'] != null) {
                      GoRouter.of(context).push(c['href'] as String);
                    }
                  },
                  borderRadius: BorderRadius.circular(16.r),
                  child: Container(
                    padding: EdgeInsets.all(16.w),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16.r),
                      border: Border.all(color: const Color(0xFFF1F5F9)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.02),
                          blurRadius: 10.r,
                          offset: const Offset(0, 4),
                        )
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          c['icon'] as String,
                          style: TextStyle(fontSize: 32.sp),
                        ),
                        const Spacer(),
                        Text(
                          c['label'] as String,
                          style: TextStyle(
                            fontSize: 15.sp,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        SizedBox(height: 4.h),
                        Text(
                          c['desc'] as String,
                          style: TextStyle(
                            fontSize: 11.sp,
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

