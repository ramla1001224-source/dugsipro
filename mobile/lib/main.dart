import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'router/app_router.dart';
import 'services/locale_service.dart';
import 'package:provider/provider.dart';
import 'providers/notification_provider.dart';
import 'providers/connectivity_provider.dart';
import 'services/push_notification_service.dart';
import 'services/sync_service.dart';
import 'services/ad_service.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Global Flutter error handler - prevents crash from showing red screen
  FlutterError.onError = (FlutterErrorDetails details) {
    debugPrint('🔴 FlutterError: ${details.exceptionAsString()}');
    // Don't rethrow - let the app continue
  };

  // Firebase init
  try {
    await Firebase.initializeApp();
    await PushNotificationService().init();
  } catch (e) {
    debugPrint('⚠️ Firebase initialization failed (app will continue): $e');
  }

  // Router init
  try {
    await AppRouter.init();
  } catch (e) {
    debugPrint('⚠️ Router init failed: $e');
  }

  // Google Mobile Ads init
  try {
    await AdService.instance.initialize();
  } catch (e) {
    debugPrint('⚠️ AdService init failed (ads disabled): $e');
  }

  // Offline sync count
  try {
    await SyncService().refreshPendingCount();
  } catch (e) {
    debugPrint('⚠️ SyncService init failed: $e');
  }

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => LocaleProvider()),
        ChangeNotifierProvider(create: (_) => NotificationProvider()),
        // Offline mode providers
        ChangeNotifierProvider(create: (_) => ConnectivityProvider()),
        ChangeNotifierProvider(create: (_) => SyncService()),
      ],
      child: const DugsiProApp(),
    ),
  );
}

// (Removed old inline FCM init)

class DugsiProApp extends StatefulWidget {
  const DugsiProApp({super.key});

  @override
  State<DugsiProApp> createState() => _DugsiProAppState();
}

class _DugsiProAppState extends State<DugsiProApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // App came to foreground - refresh notifications
      Provider.of<NotificationProvider>(context, listen: false).fetchUnreadCount();
    }
  }

  @override
  Widget build(BuildContext context) {
    final localeProvider = Provider.of<LocaleProvider>(context);
    
    return ScreenUtilInit(
      designSize: const Size(375, 812), // Standard iPhone X/11 design size
      minTextAdapt: true,
      splitScreenMode: true,
      builder: (context, child) {
        return MaterialApp.router(
          title: 'Dugsi Pro System',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          routerConfig: AppRouter.router,
          locale: localeProvider.locale,
        );
      },
    );
  }
}

class AppTheme {
  static const Color primary = Color(0xFF2563EB); // Blue-600
  static const Color primaryDark = Color(0xFF1D4ED8); // Blue-700
  static const Color accent = Color(0xFF7C3AED); // Violet-600
  static const Color success = Color(0xFF10B981); // Emerald-500 (Vibrant Green)
  static const Color warning = Color(0xFFF59E0B); // Amber-500
  static const Color danger = Color(0xFFDC2626); // Red-600
  static const Color surface = Color(0xFFF8FAFC); // Slate-50
  static const Color card = Colors.white;
  static const Color textPrimary = Color(0xFF0F172A); // Slate-900
  static const Color textSecondary = Color(0xFF64748B); // Slate-500

  static ThemeData get light => ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: primary,
          brightness: Brightness.light,
          surface: surface,
        ),
        scaffoldBackgroundColor: surface,
        fontFamily: 'Roboto',
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: textPrimary,
          elevation: 0,
          centerTitle: false,
          surfaceTintColor: Colors.transparent,
          titleTextStyle: TextStyle(
            color: textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.5,
          ),
        ),
        cardTheme: CardThemeData(
          color: card,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: Color(0xFFE2E8F0)),
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: primary,
            foregroundColor: Colors.white,
            elevation: 0,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            textStyle:
                const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFFF1F5F9),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide.none,
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: primary, width: 2),
          ),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
          labelStyle: const TextStyle(
            color: textSecondary,
            fontWeight: FontWeight.w600,
          ),
          hintStyle: const TextStyle(color: Color(0xFFCBD5E1)),
        ),
      );
}
