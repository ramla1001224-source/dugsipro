import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../main.dart';

class QuizBreakdownScreen extends StatelessWidget {
  final Map<String, dynamic> resultData;

  const QuizBreakdownScreen({super.key, required this.resultData});

  @override
  Widget build(BuildContext context) {
    final int score = resultData['score'] ?? 0;
    final int totalQuestions = resultData['totalQuestions'] ?? 0;
    final double percentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
    final List<dynamic> grades = resultData['grades'] ?? [];

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('NATIIJADA IMTIXAANKA'),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(20.w),
        child: Column(
          children: [
            // Score Card
            Container(
              width: double.infinity,
              padding: EdgeInsets.all(30.w),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(30.r),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 20.r,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Container(
                    width: 100.w,
                    height: 100.h,
                    decoration: BoxDecoration(
                      color: (percentage >= 50 ? AppTheme.success : AppTheme.danger).withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        percentage >= 50 ? 'ðŸŽ‰' : '📱‰',
                        style: TextStyle(fontSize: 40.sp),
                      ),
                    ),
                  ),
                  SizedBox(height: 20.h),
                  Text(
                    'Quiz Wuu Dhamaaday!',
                    style: TextStyle(
                      fontSize: 22.sp,
                      fontWeight: FontWeight.w900,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  SizedBox(height: 10.h),
                  Text(
                    'Natiijadaada kama dambaysta ah',
                    style: TextStyle(
                      fontSize: 12.sp,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textSecondary,
                      letterSpacing: 1,
                    ),
                  ),
                  SizedBox(height: 30.h),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _buildStatTile('Dhibcaha', '$score / $totalQuestions'),
                      _buildStatTile('Boqolkiiba', '${percentage.toStringAsFixed(0)}%'),
                    ],
                  ),
                ],
              ),
            ),
            SizedBox(height: 10.h),
            
            // Helpful Note
            Container(
              padding: EdgeInsets.all(16.w),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20.r),
                border: Border.all(color: Colors.blue.withValues(alpha: 0.1)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline_rounded, color: Colors.blue, size: 20),
                  SizedBox(width: 12.w),
                  Expanded(
                    child: Text(
                      'Halkan waxaad ku arki kartaa su\'aalaha aad khalday iyo jawaabaha saxda ah ee loo baahnaa.',
                      style: TextStyle(
                        fontSize: 12.sp,
                        color: Colors.blue.shade900,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(height: 30.h),
            
            // Detailed Breakdown List
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'FAAHFAAHINTA JAWAABAHA',
                style: TextStyle(
                  fontSize: 12.sp,
                  fontWeight: FontWeight.w900,
                  color: AppTheme.textSecondary,
                  letterSpacing: 1,
                ),
              ),
            ),
            SizedBox(height: 15.h),
            
            if (grades.isEmpty)
              Padding(
                padding: EdgeInsets.symmetric(vertical: 40.h),
                child: const Center(
                  child: Text('Breakdown lama helin.', style: TextStyle(color: Colors.grey)),
                ),
              )
            else
              ...grades.asMap().entries.map((entry) {
                final int idx = entry.key;
                final dynamic g = entry.value;
                final bool isCorrect = g['isCorrect'] ?? false;

                return Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: EdgeInsets.all(20.w),
                  decoration: BoxDecoration(
                    color: isCorrect ? const Color(0xFFF0FDF4) : const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(24.r),
                    border: Border.all(
                      color: (isCorrect ? AppTheme.success : AppTheme.danger).withValues(alpha: 0.1),
                      width: 2.w,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              '${idx + 1}. ${g['question']}',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16.sp,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                          ),
                          SizedBox(width: 10.w),
                          Container(
                            padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                            decoration: BoxDecoration(
                              color: (isCorrect ? AppTheme.success : AppTheme.danger).withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(10.r),
                            ),
                            child: Text(
                              isCorrect ? '${g['points']} Pts' : '0 Pts',
                              style: TextStyle(
                                fontSize: 10.sp,
                                fontWeight: FontWeight.w900,
                                color: isCorrect ? AppTheme.success : AppTheme.danger,
                              ),
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 15.h),
                      Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: 'Jawaabtaada: ',
                              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13.sp),
                            ),
                            TextSpan(
                              text: '${g['studentAnswer']} ',
                              style: TextStyle(fontWeight: FontWeight.w500, fontSize: 13.sp),
                            ),
                            TextSpan(
                              text: isCorrect ? '✅' : 'âŒ',
                            ),
                          ],
                        ),
                      ),
                      if (!isCorrect)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text.rich(
                            TextSpan(
                              children: [
                                TextSpan(
                                  text: 'Jawaabta Saxda ah: ',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w900,
                                    fontSize: 13.sp,
                                    color: AppTheme.success,
                                  ),
                                ),
                                TextSpan(
                                  text: '${g['answer']}',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w500,
                                    fontSize: 13.sp,
                                    color: AppTheme.success,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                );
              }),
            
            SizedBox(height: 20.h),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context); // Go back to quiz list
              },
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(double.infinity, 60),
                backgroundColor: AppTheme.primary,
              ),
              child: const Text('DHAMMAYSTIR'),
            ),
            SizedBox(height: 40.h),
          ],
        ),
      ),
    );
  }

  Widget _buildStatTile(String label, String value) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 24.sp,
            fontWeight: FontWeight.w900,
            color: AppTheme.textPrimary,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 11.sp,
            fontWeight: FontWeight.bold,
            color: AppTheme.textSecondary,
          ),
        ),
      ],
    );
  }
}

