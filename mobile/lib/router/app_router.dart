import 'package:go_router/go_router.dart';
import 'package:flutter/material.dart';
import 'auth_state.dart';
import '../services/auth_service.dart';
import '../screens/login/login_screen.dart';
import '../screens/dashboard/dashboard_screen.dart';
import '../screens/students/students_screen.dart';
import '../screens/students/student_detail_screen.dart';
import '../screens/attendance/attendance_screen.dart';
import '../screens/exams/exams_screen.dart';
import '../screens/profile/profile_screen.dart';
import '../services/ad_service.dart';
import '../screens/students/add_student_screen.dart';
import '../screens/students/import_students_screen.dart';
import '../screens/students/edit_student_screen.dart';
import '../screens/teachers/add_teacher_screen.dart';
import '../screens/teachers/edit_teacher_screen.dart';
import '../screens/exams/create_exam_screen.dart';
import '../screens/exams/exam_schedule_screen.dart';
import '../screens/exams/exam_rankings_screen.dart';
import '../screens/parents/add_parent_screen.dart';
import '../screens/parents/edit_parent_screen.dart';
import '../screens/attendance/student_attendance_history_screen.dart';
import '../screens/attendance/parent_attendance_history_screen.dart';

import '../screens/owner/owner_dashboard_screen.dart';
import '../screens/owner/owner_admins_screen.dart';
import '../screens/teachers/teachers_screen.dart';
import '../screens/parents/parents_screen.dart';
import '../screens/staff/staff_screen.dart';
import '../screens/staff/add_staff_screen.dart';
import '../screens/staff/edit_staff_screen.dart';
import '../screens/academic/academic_screen.dart';
import '../screens/timetable/timetable_screen.dart';
import '../screens/homework/homework_screen.dart';
import '../screens/homework/add_homework_screen.dart';
import '../screens/homework/homework_submissions_screen.dart';
import '../screens/zoom/zoom_live_screen.dart';
import '../screens/marks/marks_screen.dart';
import '../screens/marks/mark_sheet_screen.dart';
import '../screens/marks/student_results_screen.dart';
import '../screens/finance/expenses_screen.dart';
import '../screens/finance/payments_screen.dart';
import '../screens/finance/reports_screen.dart';
import '../screens/finance/salary_screen.dart';
// WhatsApp related import removed
import '../screens/communications/notifications_screen.dart';
import '../screens/communications/events_screen.dart';
import '../screens/settings/settings_screen.dart';
import '../screens/academic/classes_screen.dart';
import '../screens/academic/subjects_screen.dart';
import '../screens/academic/alumni_screen.dart';
import '../screens/library/library_screen.dart';
import '../screens/admin/results_sms_screen.dart';
import '../screens/elearning/student_quizzes_screen.dart';
import '../screens/elearning/video_lessons_screen.dart';
import '../screens/academic/promotion_screen.dart';
import '../screens/academic/academic_years_screen.dart';
import '../screens/login/suspended_screen.dart';
import '../screens/hubs/student_hub_screen.dart';
import '../screens/hubs/exam_hub_screen.dart';
import '../screens/announcements/announcements_screen.dart';
import '../screens/admin/sms_parents_screen.dart';
import '../widgets/main_layout.dart';

class AppRouter {
  static final AuthService _auth = AuthService();
  static final AuthState _authState = AuthState();

  static Future<void> init() async {
    await _authState.initialize(_auth);
  }

  static final GoRouter router = GoRouter(
    initialLocation: '/login',
    refreshListenable: _authState,
    observers: [AdNavigationObserver()],
    redirect: (context, state) {
      if (!_authState.initialized) {
        return null; // Wait for initialization (shows initial location or splash if added)
      }

      final isLoggedIn = _authState.isLoggedIn;
      final isSuspended = _authState.isSuspended;
      final role = _authState.role;
      final isLoginRoute = state.matchedLocation == '/login';
      final isSuspendedRoute = state.matchedLocation == '/suspended';
      final isOnOwnerRoute = state.matchedLocation.startsWith('/owner-');

      // 🛑 EMERGENCY: If account is suspended and we are not on the suspended screen, force redirect
      if (isLoggedIn && isSuspended && !isSuspendedRoute) {
        // Only suspend for admin/super_admin as per system requirement
        if (role == 'admin' || role == 'super_admin') {
          return '/suspended';
        }
      }

      if (!isLoggedIn) {
        return isLoginRoute ? null : '/login';
      }

      if (role == 'owner' || role == 'super_admin') {
        if (isLoginRoute) return role == 'owner' ? '/owner-dashboard' : '/dashboard';
        return null;
      }

      if (isLoginRoute || isOnOwnerRoute) {
        return '/dashboard';
      }

      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(path: '/suspended', builder: (context, state) => const SuspendedScreen()),
      ShellRoute(
        builder: (context, state, child) => MainLayout(child: child),
        routes: [
          GoRoute(
            path: '/owner-dashboard',
            builder: (context, state) => OwnerDashboardScreen(
              key: ValueKey(state.uri.queryParameters['t'] ?? 'default'),
            ),
          ),
          GoRoute(path: '/dashboard', builder: (context, state) => const DashboardScreen()),
          GoRoute(path: '/profile', builder: (context, state) => const ProfileScreen()),
          GoRoute(path: '/settings', builder: (context, state) => const SettingsScreen()),
          GoRoute(
            path: '/owner-admins',
            builder: (context, state) => OwnerAdminsScreen(
              key: ValueKey(state.uri.queryParameters['t'] ?? 'default'),
            ),
          ),
          GoRoute(path: '/student-hub', builder: (context, state) => const StudentHubScreen()),
          GoRoute(path: '/exam-hub', builder: (context, state) => const ExamHubScreen()),
          GoRoute(
            path: '/students',
            builder: (context, state) => const StudentsScreen(),
            routes: [
              GoRoute(path: 'add', builder: (context, state) => const AddStudentScreen()),
              GoRoute(path: 'import', builder: (context, state) => const ImportStudentsScreen()),
              GoRoute(
                path: 'edit/:id',
                builder: (context, state) => EditStudentScreen(studentId: state.pathParameters['id']!),
              ),
              GoRoute(
                path: ':id',
                builder: (context, state) => StudentDetailScreen(studentId: state.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(path: '/attendance', builder: (context, state) => const AttendanceScreen()),
          GoRoute(path: '/student-attendance-history', builder: (context, state) => const StudentAttendanceHistoryScreen()),
          GoRoute(
            path: '/parent-attendance-history',
            builder: (context, state) => ParentAttendanceHistoryScreen(
              studentId: state.uri.queryParameters['studentId'] ?? '',
              studentName: state.uri.queryParameters['studentName'] ?? 'Student',
            ),
          ),
          GoRoute(path: '/payments', builder: (context, state) => const PaymentsScreen()),
          GoRoute(path: '/fees', builder: (context, state) => const PaymentsScreen()),
          GoRoute(path: '/payroll', builder: (context, state) => const SalaryScreen()),
          GoRoute(path: '/expenses', builder: (context, state) => const ExpensesScreen()),
          GoRoute(path: '/reports', builder: (context, state) => const ReportsScreen()),
          GoRoute(
            path: '/exams',
            builder: (context, state) => const ExamsScreen(),
            routes: [
              GoRoute(path: 'create', builder: (context, state) => const CreateExamScreen()),
              GoRoute(path: 'schedule', builder: (context, state) => const ExamScheduleScreen()),
              GoRoute(path: 'rankings', builder: (context, state) => const ExamRankingsScreen()),
            ],
          ),
          GoRoute(
            path: '/marks',
            builder: (context, state) => MarksScreen(
              examId: state.uri.queryParameters['examId'],
              classId: state.uri.queryParameters['classId'],
              sectionId: state.uri.queryParameters['sectionId'],
            ),
          ),
          GoRoute(
            path: '/mark-sheet',
            builder: (context, state) => MarkSheetScreen(
              classId: state.uri.queryParameters['classId'] ?? '',
              sectionId: state.uri.queryParameters['sectionId'],
            ),
          ),
          GoRoute(
            path: '/student-results',
            builder: (context, state) => StudentResultsScreen(
              studentId: state.uri.queryParameters['studentId'],
            ),
          ),
          GoRoute(
            path: '/parents',
            builder: (context, state) => const ParentsScreen(),
            routes: [
              GoRoute(path: 'add', builder: (context, state) => const AddParentScreen()),
              GoRoute(
                path: 'edit/:id',
                builder: (context, state) => EditParentScreen(parentId: state.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(
            path: '/teachers',
            builder: (context, state) => const TeachersScreen(),
            routes: [
              GoRoute(path: 'add', builder: (context, state) => const AddTeacherScreen()),
              GoRoute(
                path: 'edit/:id',
                builder: (context, state) => EditTeacherScreen(teacherId: state.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(
            path: '/staff',
            builder: (context, state) => const StaffScreen(),
            routes: [
              GoRoute(path: 'add', builder: (context, state) => const AddStaffScreen()),
              GoRoute(
                path: 'edit/:id',
                builder: (context, state) => EditStaffScreen(staffId: state.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(path: '/academic', builder: (context, state) => const AcademicScreen()),
          GoRoute(path: '/classes', builder: (context, state) => const ClassesScreen()),
          GoRoute(path: '/subjects', builder: (context, state) => const SubjectsScreen()),
          GoRoute(path: '/alumni', builder: (context, state) => const AlumniScreen()),
          GoRoute(path: '/promotion', builder: (context, state) => const PromotionScreen()),
          GoRoute(path: '/academic-years', builder: (context, state) => const AcademicYearsScreen()),
          GoRoute(path: '/timetable', builder: (context, state) => const TimetableScreen()),
          GoRoute(
            path: '/homework',
            builder: (context, state) => const HomeworkScreen(),
            routes: [
              GoRoute(path: 'add', builder: (context, state) => const AddHomeworkScreen()),
              GoRoute(
                path: 'submissions/:id',
                builder: (context, state) => HomeworkSubmissionsScreen(homeworkId: state.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(path: '/zoom', builder: (context, state) => const ZoomLiveScreen()),
          GoRoute(path: '/notifications', builder: (context, state) => const NotificationsScreen()),
          GoRoute(path: '/events', builder: (context, state) => const EventsScreen()),
          GoRoute(path: '/library', builder: (context, state) => const LibraryScreen()),
          GoRoute(path: '/results-sms', builder: (context, state) => const ResultsSmsScreen()),
          GoRoute(path: '/sms-parents', builder: (context, state) => const SmsParentsScreen()),
          GoRoute(path: '/student-quizzes', builder: (context, state) => const StudentQuizzesScreen()),
          GoRoute(path: '/lessons', builder: (context, state) => const VideoLessonsScreen()),
          GoRoute(path: '/announcements', builder: (context, state) => const AnnouncementsScreen()),
        ],
      ),
    ],
    errorBuilder: (context, state) =>
        Scaffold(body: Center(child: Text('Page not found: ${state.error}'))),
  );
}
