import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../../services/auth_service.dart';
import '../../router/auth_state.dart';
import '../../config/api_config.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../services/locale_service.dart';
import 'package:provider/provider.dart';
import '../../providers/notification_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with TickerProviderStateMixin {
  // Controllers
  final _shortCodeCtrl = TextEditingController();
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  final _authService = AuthService();

  // State
  bool _onPortal = true; // true = portal screen, false = login screen
  bool _isOwnerMode = false;
  bool _loading = false;
  bool _showPassword = false;
  String? _error;
  String? _schoolName; // Set after shortcode is verified
  String? _schoolLogo; // Set after shortcode is verified
  String? _selectedSchoolId; // Set if multiple schools exist
  bool? _isActive;

  // For inline multi-school picker (matches web index.js)
  List _schools = [];
  Map<String, dynamic>? _superAdminInfo;

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Helper: Build correct logo URL
  // DB stores logos as "public/uploads/logos/file.png"
  // But the server serves them at "/uploads/logos/file.png"
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  String _buildLogoUrl(String logo) {
    if (logo.startsWith('http')) return logo;
    // Strip leading "public/" if present
    final cleanPath = logo.startsWith('public/')
        ? logo.substring('public/'.length)
        : logo;
    // Ensure path starts with /
    final slash = cleanPath.startsWith('/') ? '' : '/';
    return '${ApiConfig.baseUrl}$slash$cleanPath';
  }

  Widget _buildSchoolLogoFallback({double size = 24}) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF3B82F6).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12.r),
      ),
      child: Center(
        child: Icon(
          Icons.school_rounded,
          color: const Color(0xFF60A5FA),
          size: size,
        ),
      ),
    );
  }

  // Animations
  late final AnimationController _fadeCtrl;
  late final Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    )..forward();
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
  }

  @override
  void dispose() {
    _shortCodeCtrl.dispose();
    _usernameCtrl.dispose();
    _passwordCtrl.dispose();
    _fadeCtrl.dispose();
    super.dispose();
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Step 1: Verify short code and go to login
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Future<void> _continueToLogin() async {
    final code = _shortCodeCtrl.text.trim().toUpperCase();
    if (code.isEmpty) {
      setState(() => _error = 'Koodka dugsiga gali');
      return;
    }

    // Hidden backdoor for owner access
    if (code == 'OWNER_ACCESS') {
      setState(() {
        _isOwnerMode = true;
        _shortCodeCtrl.clear();
        _schoolName = null;
        _schoolLogo = null;
        _error = null;
        _loading = false;
      });
      _transition(false);
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final info = await _authService.getSchoolByCode(code);

      if (info?['type'] == 'super_admin' && info?['schools'] != null) {
        final schools = info!['schools'] as List;
        if (schools.isNotEmpty) {
          // Show inline like web â€” do NOT use bottom sheet
          setState(() {
            _schools = schools;
            _superAdminInfo = info;
            _loading = false;
          });
          return;
        } else if (schools.length == 1) {
          // BUG FIX: If only 1 school, use THAT school's ID, not the superAdmin user ID
          _selectedSchoolId = schools[0]['id']?.toString();
          _schoolName = schools[0]['name'] as String? ?? code;
          _schoolLogo = schools[0]['logo'] as String?;
          _isActive = schools[0]['isActive'] as bool?;
        } else {
          // No schools at all
          _schoolName = info['name'] as String? ?? code;
          _schoolLogo = info['logo'] as String?;
          _selectedSchoolId = info['id']?.toString();
          _isActive = info['isActive'] as bool?;
        }
      } else {
        _schoolName = info?['name'] as String? ?? code;
        _schoolLogo = info?['logo'] as String?;
        _selectedSchoolId = info?['id']?.toString();
        _isActive = info?['isActive'] as bool?;
      }
      _transition(false);
    } catch (e) {
      setState(() {
        if (e is DioException &&
            (e.type == DioExceptionType.connectionTimeout ||
                e.type == DioExceptionType.receiveTimeout ||
                e.type == DioExceptionType.sendTimeout ||
                e.type == DioExceptionType.connectionError ||
                e.type == DioExceptionType.unknown)) {
          _error = 'Khadka Internet-ka ayaa kaa go\'an. Fadlan hubi.';
        } else {
          _error = 'Koodkan lama helin. Fadlan hubi.';
        }
        _loading = false;
      });
    }
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Step 2: Login
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      String? fcmToken;
      try {
        fcmToken = await FirebaseMessaging.instance.getToken();
      } catch (e) {
        debugPrint('FCM Token Fetch Failed: $e');
      }

      final data = await _authService.login(
        username: _usernameCtrl.text.trim(),
        password: _passwordCtrl.text, // DO NOT TRIM PASSWORDS
        schoolCode: _isOwnerMode ? null : _shortCodeCtrl.text.trim(),
        schoolId: _isOwnerMode ? null : _selectedSchoolId,
        fcmToken: fcmToken,
      );
      if (mounted) {
        final role = data['role'];
        await _authService.saveSchoolConfig(_schoolName, _schoolLogo);
        if (!mounted) return;
        AuthState().update(true, role);
        // Immediately refresh notification badge after login
        context.read<NotificationProvider>().refreshAfterLogin();
        if (role == 'owner' || role == 'super_admin') {
          GoRouter.of(context).go('/owner-dashboard');
        } else {
          GoRouter.of(context).go('/dashboard');
        }
      }
    } catch (e) {
      String msg = 'Xiriirka server-ka wuu fashilmay. Hubi internet-kaaga.';
      String rawError = e.toString();

      // Try to extract backend message if available (assuming Dio error)
      try {
        if (e is DioException && e.response?.data != null) {
          final data = e.response!.data;
          if (data is Map && data['message'] != null) {
            msg = data['message'];
          }
        } else if (rawError.contains('401')) {
          msg = 'Username ama Password aad gelisay waa khaldan yihiin.';
        } else if (rawError.contains('404')) {
          msg =
              'Dugsiga lama helin. Hubi: ID=${_selectedSchoolId ?? 'null'}\nCode=${_shortCodeCtrl.text.trim()}';
        } else if (rawError.contains('403')) {
          // Check if this is a 'locked' error from the server
          if (e is DioException &&
              e.response?.data != null &&
              e.response!.data is Map &&
              e.response!.data['locked'] == true) {
            msg = e.response!.data['message'] ??
                'Nidaamku waa xiran yahay. Fadlan bixi biilka system-ka.';
            setState(
                () => _isActive = false); // This triggers the Lock Screen UI
          } else {
            msg = 'Ma haysatid ogolaansho aad ku gasho qaybtan.';
          }
        } else if (e is DioException &&
            (e.type == DioExceptionType.connectionTimeout ||
                e.type == DioExceptionType.receiveTimeout ||
                e.type == DioExceptionType.sendTimeout ||
                e.type == DioExceptionType.connectionError ||
                e.type == DioExceptionType.unknown)) {
          msg = 'Khadka Internet-ka ayaa kaa go\'an. Fadlan hubi.';
        } else {
          msg =
              'Khalad farsamo: ${rawError.replaceAll('DioException', '').trim()}';
        }
      } catch (_) {
        msg = 'Khalad farsamo ayaa dhacay.';
      }
      setState(() => _error = msg);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loginAsOwner() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _authService.login(
        username: _usernameCtrl.text.trim(),
        password: _passwordCtrl.text.trim(),
        schoolCode: null,
      );
      if (mounted) {
        await _authService.saveSchoolConfig(_schoolName, _schoolLogo);
        if (!mounted) return;
        AuthState().update(true, 'owner');
        // Immediately refresh notification badge after login
        context.read<NotificationProvider>().refreshAfterLogin();
        GoRouter.of(context).go('/owner-dashboard');
      }
    } catch (e) {
      String msg = 'Xiriirku wuu fashilmay.';
      if (e.toString().contains('401')) msg = 'Username ama password khaldan';
      setState(() => _error = msg);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _transition(bool toPortal) {
    _fadeCtrl.reverse().then((_) {
      setState(() {
        _onPortal = toPortal;
        _error = null;
        _loading = false;
        _isOwnerMode = !toPortal ? _isOwnerMode : false;
        if (toPortal) {
          _selectedSchoolId = null;
          _isActive = null;
          _schools = [];
          _superAdminInfo = null;
        }
      });
      _fadeCtrl.forward();
    });
  }



  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Build
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  @override
  Widget build(BuildContext context) {
    final localeProvider = Provider.of<LocaleProvider>(context);
    final t = localeProvider.t;
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      resizeToAvoidBottomInset: true,
      body: Stack(
        children: [
          // Glow orbs
          Positioned(
            top: -100,
            right: -80,
            child: _glow(const Color(0xFF2563EB), 350),
          ),
          Positioned(
            bottom: -100,
            left: -80,
            child: _glow(const Color(0xFF7C3AED), 320),
          ),

          SafeArea(
            child: FadeTransition(
              opacity: _fadeAnim,
              child: _onPortal ? _buildPortal(t) : _buildLogin(t),
            ),
          ),
        ],
      ),
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PORTAL SCREEN (matches web index.js exactly)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Widget _buildPortal(String Function(String) t) {
    final hasSchools = _schools.isNotEmpty;
    final groupName = _superAdminInfo?['schoolName'] as String? ??
        _superAdminInfo?['name'] as String? ??
        _shortCodeCtrl.text.toUpperCase();

    return Center(
      child: SingleChildScrollView(
        padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 40.h),
        child: Column(
          children: [
            // â”€â”€ App header (always visible) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            Image.asset(
              'assets/images/app_icon.png',
              width: 100.w,
              height: 100.h,
              fit: BoxFit.contain,
            ),
            SizedBox(height: 16.h),
            Text(
              'Dugsi Pro',
              style: TextStyle(
                color: Colors.white,
                fontSize: 38.sp,
                fontWeight: FontWeight.w900,
                letterSpacing: -1,
              ),
            ),
            Text(
              'System',
              style: TextStyle(
                color: const Color(0xFF3B82F6),
                fontSize: 38.sp,
                fontWeight: FontWeight.w900,
                letterSpacing: -1,
                height: 0.9.h,
              ),
            ),
            SizedBox(height: 10.h),
            Text(
              'Digitalizing Education Across Somalia',
              style: TextStyle(
                color: const Color(0xFF94A3B8),
                fontSize: 13.sp,
                fontWeight: FontWeight.w500,
              ),
            ),
            SizedBox(height: 40.h),

            // â”€â”€ Glass card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            Container(
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(42.r),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.10),
                  width: 1.5.w,
                ),
              ),
              padding: EdgeInsets.all(32.w),
              child: hasSchools
                  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                  // MULTI-SCHOOL VIEW  (same as web when
                  //   schools.length > 0)
                  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                  ? Column(
                      children: [




                        // School group name
                        Text(
                          groupName,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 22.sp,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.5,
                          ),
                        ),
                        SizedBox(height: 6.h),

                        // Code badge
                        Container(
                          padding: EdgeInsets.symmetric(
                              horizontal: 12.w, vertical: 4.h),
                          decoration: BoxDecoration(
                            color: const Color(0xFF3B82F6).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(20.r),
                          ),
                          child: Text(
                            'CODE: ${_shortCodeCtrl.text.toUpperCase()}',
                            style: TextStyle(
                              color: const Color(0xFF60A5FA),
                              fontSize: 11.sp,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 3,
                            ),
                          ),
                        ),
                        SizedBox(height: 6.h),

                        Text(
                          'Dhowr qaybood ayaa loo helay $groupName:',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              color: const Color(0xFF94A3B8), fontSize: 12.sp),
                        ),
                        SizedBox(height: 24.h),

                        // Branch list
                        ..._schools.map((school) {
                          final logo = school['logo'] as String?;
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: InkWell(
                              onTap: () {
                                setState(() {
                                  _schoolName = school['name'];
                                  _schoolLogo = logo;
                                  _selectedSchoolId = school['id']?.toString();
                                  _isActive = school['isActive'] as bool?;
                                  _schools = [];
                                  _superAdminInfo = null;
                                });
                                _transition(false);
                              },
                              borderRadius: BorderRadius.circular(20.r),
                              child: Container(
                                padding: EdgeInsets.all(16.w),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.05),
                                  borderRadius: BorderRadius.circular(20.r),
                                  border: Border.all(
                                    color: Colors.white.withValues(alpha: 0.1),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    // Branch logo
                                    Container(
                                      width: 72.w,
                                      height: 72.h,
                                      decoration: BoxDecoration(
                                        gradient: LinearGradient(
                                          begin: Alignment.topLeft,
                                          end: Alignment.bottomRight,
                                          colors: [
                                            Colors.white.withValues(alpha: 0.18),
                                            Colors.white.withValues(alpha: 0.05),
                                          ],
                                        ),
                                        borderRadius: BorderRadius.circular(18.r),
                                        border: Border.all(
                                          color: Colors.white.withValues(alpha: 0.18),
                                          width: 1.5.w,
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: const Color(0xFF3B82F6)
                                                .withValues(alpha: 0.15),
                                            blurRadius: 16.r,
                                            spreadRadius: 2,
                                          ),
                                        ],
                                      ),
                                      child: logo != null
                                          ? ClipRRect(
                                              borderRadius:
                                                  BorderRadius.circular(17.r),
                                              child: Padding(
                                                padding: EdgeInsets.all(6.w),
                                                child: CachedNetworkImage(
                                                  imageUrl: _buildLogoUrl(logo),
                                                  fit: BoxFit.contain,
                                                  placeholder: (context, url) =>
                                                      Center(
                                                    child: SizedBox(
                                                      width: 24.w,
                                                      height: 24.h,
                                                      child:
                                                          const CircularProgressIndicator(
                                                        strokeWidth: 2,
                                                        color: Color(0xFF3B82F6),
                                                      ),
                                                    ),
                                                  ),
                                                  errorWidget: (context, url,
                                                          error) =>
                                                      _buildSchoolLogoFallback(
                                                          size: 32),
                                                ),
                                              ),
                                            )
                                          : _buildSchoolLogoFallback(size: 32),
                                    ),
                                    SizedBox(width: 16.w),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            school['name'] ?? 'School Name',
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontWeight: FontWeight.bold,
                                              fontSize: 16.sp,
                                            ),
                                          ),
                                          SizedBox(height: 2.h),
                                          Text(
                                            school['shortCode'] ?? 'ID: ${(school['id'] ?? '').toString().split('-').first}',
                                            style: TextStyle(
                                              color: const Color(0xFF64748B),
                                              fontSize: 11.sp,
                                              fontWeight: FontWeight.w600,
                                              letterSpacing: 1,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const Icon(Icons.chevron_right_rounded,
                                        color: Color(0xFF3B82F6)),
                                  ],
                                ),
                              ),
                            ),
                          );
                        }),

                        // â”€â”€ Use different code â”€â”€
                        TextButton(
                          onPressed: () {
                            setState(() {
                              _schools = [];
                              _superAdminInfo = null;
                              _error = null;
                            });
                          },
                          child: Text(
                            'â† USE A DIFFERENT CODE',
                            style: TextStyle(
                              color: const Color(0xFF475569),
                              fontSize: 10.sp,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 2,
                            ),
                          ),
                        ),

                        Divider(color: Colors.white.withValues(alpha: 0.07)),
                        SizedBox(height: 16.h),
                        Center(
                          child: Text(
                            'RESTRICTED MASTER ACCESS',
                            style: TextStyle(
                              color: const Color(0xFF475569),
                              fontSize: 9.sp,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.5,
                            ),
                          ),
                        ),
                        SizedBox(height: 12.h),
                        Center(
                          child: ElevatedButton(
                            onPressed: () {
                              setState(() {
                                _isOwnerMode = false;
                                _schoolName = _superAdminInfo?['schoolName'] ??
                                    _superAdminInfo?['name'];
                                _schoolLogo = _superAdminInfo?['logo'];
                                _selectedSchoolId = null;
                                _schools = [];
                                _superAdminInfo = null;
                                _error = null;
                              });
                              _transition(false);
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF3B82F6).withValues(alpha: 0.1),
                              foregroundColor: const Color(0xFF60A5FA),
                              elevation: 0,
                              padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 12.h),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12.r),
                                side: BorderSide(
                                  color: const Color(0xFF3B82F6).withValues(alpha: 0.2),
                                  width: 1.w,
                                ),
                              ),
                            ),
                            child: Text(
                              'SUPER ADMIN LOGIN',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 11.sp,
                                letterSpacing: 1.5,
                              ),
                            ),
                          ),
                        ),
                        SizedBox(height: 8.h),
                      ],
                    )
                  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                  // SHORTCODE INPUT VIEW  (default)
                  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          t('student_hub'),
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 22.sp,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        SizedBox(height: 6.h),
                        Text(
                          t('shortcode_subtitle'),
                          style: TextStyle(
                            color: const Color(0xFF64748B),
                            fontSize: 13.sp,
                          ),
                        ),
                        SizedBox(height: 28.h),

                        Text(
                          'UNIQUE SHORTCODE',
                          style: TextStyle(
                            color: const Color(0xFF64748B),
                            fontSize: 9.sp,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 2,
                          ),
                        ),
                        SizedBox(height: 10.h),

                        TextField(
                          controller: _shortCodeCtrl,
                          textCapitalization: TextCapitalization.characters,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 22.sp,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 6,
                          ),
                          decoration: InputDecoration(
                            hintText: 'HAMAR, SOOL...',
                            hintStyle: TextStyle(
                              color: Colors.white.withValues(alpha: 0.18),
                              fontSize: 16.sp,
                              letterSpacing: 2,
                            ),
                            filled: true,
                            fillColor: Colors.white.withValues(alpha: 0.05),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(20.r),
                              borderSide: BorderSide(
                                color: Colors.white.withValues(alpha: 0.10),
                                width: 1.5.w,
                              ),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(20.r),
                              borderSide: BorderSide(
                                color: Colors.white.withValues(alpha: 0.10),
                                width: 1.5.w,
                              ),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(20.r),
                              borderSide: BorderSide(
                                color: Color(0xFF3B82F6),
                                width: 2.w,
                              ),
                            ),
                            contentPadding: EdgeInsets.symmetric(
                                horizontal: 24.w, vertical: 20.h),
                          ),
                          onSubmitted: (_) => _continueToLogin(),
                        ),

                        if (_error != null) ...[
                          SizedBox(height: 14.h),
                          _errorBox(_error!),
                        ],

                        SizedBox(height: 22.h),

                        SizedBox(
                          width: double.infinity,
                          height: 56.h,
                          child: ElevatedButton(
                            onPressed: _loading ? null : _continueToLogin,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF2563EB),
                              disabledBackgroundColor: const Color(0xFF1E293B),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(18.r),
                              ),
                            ),
                            child: _loading
                                ? SizedBox(
                                    width: 20.w,
                                    height: 20.h,
                                    child: const CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 2,
                                    ),
                                  )
                                : Text(
                                    'CONTINUE TO LOGIN',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 12.sp,
                                      letterSpacing: 1.5,
                                    ),
                                  ),
                          ),
                        ),

                        SizedBox(height: 28.h),
                      ],
                    ),
            ),

            SizedBox(height: 36.h),
            Text(
              'Â© SCHOOL SYSTEMS',
              style: TextStyle(
                fontSize: 9.sp,
                fontWeight: FontWeight.w800,
                color: Colors.white.withValues(alpha: 0.18),
                letterSpacing: 3,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // LOGIN SCREEN (matches web login.js)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Widget _buildLogin(String Function(String) t) {
    return Center(
      child: SingleChildScrollView(
        padding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 32.h),
        child: Column(
          children: [
            // White card
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(36.r),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.35),
                    blurRadius: 60.r,
                    offset: const Offset(0, 20),
                  ),
                ],
              ),
              child: Column(
                children: [
                  // Header
                  Padding(
                    padding: const EdgeInsets.fromLTRB(32, 40, 32, 28),
                    child: Column(
                      children: [




                        // School name or app title
                        Text(
                          _isOwnerMode
                              ? 'Dugsi Pro System'
                              : (_schoolName ?? 'Dugsi Pro System'),
                          style: TextStyle(
                            color: const Color(0xFF0F172A),
                            fontSize: 22.sp,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.3,
                          ),
                        ),
                        SizedBox(height: 6.h),
                        Text(
                          _isOwnerMode
                              ? 'MULKIILAHA GELITAANKA'
                              : (_schoolName != null &&
                                      _selectedSchoolId == null
                                  ? 'SUPER ADMIN LOGIN'
                                  : 'XARUNTA ARDAYDA IYO SHAQAALAHA'),
                          style: TextStyle(
                            color: const Color(0xFF94A3B8),
                            fontSize: 8.5.sp,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.8,
                          ),
                        ),
                      ],
                    ),
                  ), // Form or Locked Screen
                  if (_isActive == false && !_isOwnerMode)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(32, 0, 32, 40),
                      child: Container(
                        padding: EdgeInsets.all(28.w),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF1F2),
                          borderRadius: BorderRadius.circular(28.r),
                          border: Border.all(
                              color: const Color(0xFFFFE4E6), width: 2.w),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFE11D48)
                                  .withValues(alpha: 0.08),
                              blurRadius: 24.r,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Column(
                          children: [
                            Container(
                              width: 72.w,
                              height: 72.h,
                              decoration: const BoxDecoration(
                                color: Color(0xFFFFE4E6),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.lock_rounded,
                                  color: Color(0xFFE11D48), size: 36),
                            ),
                            SizedBox(height: 20.h),
                            Text('NIDAAMKU WAA XIRAN YAHAY',
                                style: TextStyle(
                                    color: const Color(0xFFBE123C),
                                    fontSize: 13.sp,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 1.5),
                                textAlign: TextAlign.center),
                            SizedBox(height: 12.h),
                            Text(
                                'Fadlan bixi biilka system-ka si dib loogu furo. Kala xiriir shirkada wixii faahfaahin ah.',
                                style: TextStyle(
                                    color: const Color(0xFFE11D48),
                                    fontSize: 12.sp,
                                    fontWeight: FontWeight.bold,
                                    height: 1.5.h),
                                textAlign: TextAlign.center),
                            SizedBox(height: 28.h),
                            Container(
                              width: double.infinity,
                              padding: EdgeInsets.symmetric(
                                  horizontal: 16.w, vertical: 16.h),
                              decoration: BoxDecoration(
                                  color: const Color(0xFFFDA4AF)
                                      .withValues(alpha: 0.3),
                                  borderRadius: BorderRadius.circular(16.r)),
                              child: Column(
                                children: [
                                  Text('KALA XIRIIR SHIRKADA',
                                      style: TextStyle(
                                          color: const Color(0xFFBE123C),
                                          fontSize: 9.sp,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: 1.5)),
                                  SizedBox(height: 6.h),
                                  Text('+252 0907525970',
                                      style: TextStyle(
                                          color: const Color(0xFF9F1239),
                                          fontSize: 18.sp,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: 1)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  else

                    // Form
                    Padding(
                      padding: const EdgeInsets.fromLTRB(32, 0, 32, 40),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Error
                            if (_error != null) ...[
                              Container(
                                padding: EdgeInsets.symmetric(
                                    horizontal: 16.w, vertical: 14.h),
                                margin: const EdgeInsets.only(bottom: 20),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFFF1F2),
                                  borderRadius: BorderRadius.circular(16.r),
                                  border: Border.all(
                                      color: const Color(0xFFFFCDD2)),
                                ),
                                child: Text(
                                  _error!,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: const Color(0xFFDC2626),
                                    fontWeight: FontWeight.w700,
                                    fontSize: 11.sp,
                                  ),
                                ),
                              ),
                            ],

                            // Username label
                            _label('USERNAME / ID'),
                            SizedBox(height: 8.h),
                            TextFormField(
                              controller: _usernameCtrl,
                              autocorrect: false,
                              enableSuggestions: false,
                              textCapitalization: TextCapitalization.none,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF334155),
                              ),
                              decoration: _inputDec('Username-kaaga gali'),
                              validator: (v) => (v == null || v.isEmpty)
                                  ? 'Gali username-kaaga'
                                  : null,
                            ),
                            SizedBox(height: 18.h),

                            // Password label
                            _label('PASSWORD'),
                            SizedBox(height: 8.h),
                            TextFormField(
                              controller: _passwordCtrl,
                              obscureText: !_showPassword,
                              autocorrect: false,
                              enableSuggestions: false,
                              textCapitalization: TextCapitalization.none,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF334155),
                              ),
                              decoration: InputDecoration(
                                hintText: '••••••••',
                                hintStyle:
                                    const TextStyle(color: Color(0xFFCBD5E1)),
                                filled: true,
                                fillColor: const Color(0xFFF8FAFC),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(18.r),
                                  borderSide: BorderSide(
                                      color: Color(0xFFF1F5F9), width: 2.w),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(18.r),
                                  borderSide: BorderSide(
                                      color: Color(0xFFF1F5F9), width: 2.w),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(18.r),
                                  borderSide: BorderSide(
                                      color: Color(0xFF2563EB), width: 2.w),
                                ),
                                contentPadding: EdgeInsets.symmetric(
                                    horizontal: 20.w, vertical: 18.h),
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _showPassword
                                        ? Icons.visibility_off_rounded
                                        : Icons.visibility_rounded,
                                    color: const Color(0xFF94A3B8),
                                    size: 20,
                                  ),
                                  onPressed: () => setState(
                                      () => _showPassword = !_showPassword),
                                ),
                              ),
                              validator: (v) => (v == null || v.length < 4)
                                  ? 'Password gali'
                                  : null,
                            ),
                            SizedBox(height: 28.h),

                            // Login button
                            SizedBox(
                              width: double.infinity,
                              height: 56.h,
                              child: ElevatedButton(
                                onPressed: _loading
                                    ? null
                                    : (_isOwnerMode ? _loginAsOwner : _login),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF2563EB),
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(18.r),
                                  ),
                                ),
                                child: _loading
                                    ? SizedBox(
                                        width: 20.w,
                                        height: 20.h,
                                        child: const CircularProgressIndicator(
                                          color: Colors.white,
                                          strokeWidth: 2.5,
                                        ),
                                      )
                                    : Text(
                                        'SIGN IN NOW',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w900,
                                          fontSize: 12.sp,
                                          letterSpacing: 2,
                                        ),
                                      ),
                              ),
                            ),

                            // Back + version row
                            SizedBox(height: 20.h),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                TextButton(
                                  style: TextButton.styleFrom(
                                    padding: EdgeInsets.zero,
                                    minimumSize: Size.zero,
                                    tapTargetSize:
                                        MaterialTapTargetSize.shrinkWrap,
                                  ),
                                  onPressed: () => _isOwnerMode
                                      ? _transition(true)
                                      : _transition(true),
                                  child: Text(
                                    'â† Dib u noqo',
                                    style: TextStyle(
                                      color: const Color(0xFF94A3B8),
                                      fontSize: 10.sp,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ),
                                Text(
                                  'v2.0 Premium',
                                  style: TextStyle(
                                    color: const Color(0xFFCBD5E1),
                                    fontSize: 10.sp,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),

            SizedBox(height: 32.h),
            Text(
              'DESIGNED FOR EXCELLENCE',
              style: TextStyle(
                fontSize: 9.sp,
                fontWeight: FontWeight.w800,
                color: Colors.white.withValues(alpha: 0.22),
                letterSpacing: 3,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Helpers
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Widget _glow(Color color, double size) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [
              color.withValues(alpha: 0.18),
              color.withValues(alpha: 0.0),
            ],
          ),
        ),
      );

  Widget _errorBox(String msg) => Container(
        padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
        decoration: BoxDecoration(
          color: const Color(0x1AEF4444),
          borderRadius: BorderRadius.circular(14.r),
          border: Border.all(color: const Color(0x33EF4444)),
        ),
        child: Row(
          children: [
            const Icon(Icons.error_outline_rounded,
                color: Color(0xFFEF4444), size: 15),
            SizedBox(width: 8.w),
            Expanded(
              child: Text(
                msg,
                style: TextStyle(
                  color: const Color(0xFFEF4444),
                  fontWeight: FontWeight.w700,
                  fontSize: 12.sp,
                ),
              ),
            ),
          ],
        ),
      );

  Widget _label(String text) => Text(
        text,
        style: TextStyle(
          color: const Color(0xFF94A3B8),
          fontSize: 10.sp,
          fontWeight: FontWeight.w900,
          letterSpacing: 1.5,
        ),
      );

  InputDecoration _inputDec(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFFCBD5E1)),
        filled: true,
        fillColor: const Color(0xFFF8FAFC),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18.r),
          borderSide: BorderSide(color: Color(0xFFF1F5F9), width: 2.w),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18.r),
          borderSide: BorderSide(color: Color(0xFFF1F5F9), width: 2.w),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18.r),
          borderSide: BorderSide(color: Color(0xFF2563EB), width: 2.w),
        ),
        contentPadding:
            EdgeInsets.symmetric(horizontal: 20.w, vertical: 18.h),
      );
}

