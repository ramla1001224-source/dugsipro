class ApiConfig {
// For Android emulator: use 10.0.2.2 (maps to host machine localhost)
// For physical Android device on same WiFi: use your PC's local IP e.g. 192.168.1.x
// For iOS simulator: use 127.0.0.1
// For Windows/Web: use localhost
// For production: use your deployed API domain e.g. https://api.smartschool.so

  static const String baseUrl =
      'https://dugsipro-production.up.railway.app';
  // static const String baseUrl = 'http://10.0.2.2:4001';

  // Frontend web URL (for opening print pages in browser)
  static const String webBaseUrl = 'https://dugsi-pro-system.vercel.app';

  // API Endpoints
  static const String login = '/api/auth/login';
  static const String profile = '/api/auth/profile';
  static const String schoolInfo = '/api/auth/school-info';
  static const String dashboard = '/api/dashboard/stats';
  static const String superAdminDashboard = '/api/dashboard/superadmin';
  static const String studentStats = '/api/dashboard/student-stats';
  static const String teacherStats = '/api/dashboard/teacher-stats';
  static const String students = '/api/students';
  static const String alumni = '/api/students/alumni';
  static const String parents = '/api/parents';
  static const String myChildren = '/api/parents/my-children';
  static const String childAttendance = '/api/attendance/student';
  static const String childExams = '/api/exams/student';
  static const String childPaymentStatus = '/api/payments/student';
  static const String teachers = '/api/teachers';
  static const String attendance = '/api/attendance';
  static const String payments = '/api/payments';
  static const String monthlyRecords = '/api/payments/monthly-records';
  static const String grades = '/api/grades';
  static const String fees = '/api/fees';
  static const String classes = '/api/classes';
  static const String sections = '/api/sections';
  static const String subjects = '/api/subjects';
  static const String exams = '/api/exams';
  static const String sendBulkSms = '/api/exams/send-bulk-sms';
  static const String bulkSmsParents = '/api/sms/bulk-parents';
  static const String bulkSmsParentsCount = '/api/sms/bulk-send-count';
  static const String studentResults = '/api/exams/student-results';
  static const String announcements = '/api/announcements';
  static const String messages = '/api/messages';
  static const String notifications = '/api/notifications';
  static const String notificationsUnreadCount = '/api/notifications/unread-count';
  static const String staff = '/api/staff';
  static const String timetable = '/api/timetable';
  static const String homework = '/api/homework';
  static const String homeworkSubmissions =
      '/api/submissions/homework'; // + /:id
  static const String mySubmissions = '/api/submissions/my';
  static const String submitHomework = '/api/submissions/submit';
  static const String gradeSubmission = '/api/submissions'; // + /:id/grade
  static const String virtualClasses = '/api/virtual-classes';
  static const String expenses = '/api/expenses';
  static const String salary = '/api/salary';
  static const String events = '/api/events';
  static const String settings = '/api/settings';
  static const String lessons = '/api/lessons';
  static const String academicYears = '/api/academic-years';
  static const String promotePreview =
      '/api/academic-years/{id}/promote-preview';
  static const String promotePublish =
      '/api/academic-years/{id}/promote-publish';
  static const String yearEndSummary =
      '/api/academic-years/{id}/year-end-summary';

  // Owner specific
  static const String schools = '/api/schools';
  static const String schoolByCode = '/api/schools/by-code';
  static const String ownerAdmins = '/api/owner/super-admins';
  static const String ownerImpersonate = '/api/owner/impersonate-super';
  static const String schoolImpersonate = '/api/schools/impersonate';
  static const String schoolLogoUpload = '/api/schools/upload-logo';
  static const String smsSuperAdminStats = '/api/sms/superadmin-stats';
  static const String smsSuperAdminLogs = '/api/sms/superadmin-logs';
  static const String smsSettings = '/api/sms/settings';
  static const String smsUsageHistory = '/api/sms/usage-history';

  // Library & AI
  static const String libraryBooks = '/api/library/books';
  static const String libraryIssues = '/api/library/issues';
  static const String libraryStats = '/api/library/stats';
  static const String accountantStats = '/api/dashboard/accountant-stats';
  static const String librarianDashboardStats =
      '/api/dashboard/librarian-stats';
  static const String staffStats = '/api/dashboard/staff-stats';
  static const String aiGenerate = '/api/ai/generate-insight';
  static const String aiChat = '/api/ai/chat';

  // NEW: Scaling Features (Epic 1-6)
  static const String mobileMoneyPay = '/api/payment-gateways/initiate'; // POST
  static const String elearning = '/api/elearning';
  static const String myQuizzes = '/api/elearning/quizzes'; // GET
  static const String elearningTake = '/api/elearning/quizzes'; // + /:id/take
  static const String elearningSubmit =
      '/api/elearning/quizzes'; // + /:id/submit
  static const String qrGenerate = '/api/qr-codes/generate-all'; // POST (Admin)
  static const String qrScan = '/api/qr-codes/scan'; // POST (Attendance)
  static const String syncPull = '/api/sync/pull'; // GET
  static const String syncPush = '/api/sync/push'; // POST
  static const String customAd = '/api/ads/custom'; // GET
}
