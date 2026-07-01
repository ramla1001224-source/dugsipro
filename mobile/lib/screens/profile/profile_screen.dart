import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';

import '../../services/api_service.dart';
import '../../services/auth_service.dart';


class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final ApiService _api = ApiService();
  final AuthService _auth = AuthService();
  Map<String, dynamic>? _profile;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api.get('/api/auth/profile');
      if (mounted) {
        setState(() {
          _profile = res.data;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final p = _profile ?? {};
    final name = p['name'] ?? 'User';
    final role = p['role'] ?? '';
    final username = p['username'] ?? '';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('My Profile'),
        actions: [
          IconButton(
            onPressed: () async {
              await _auth.logout();
              if (context.mounted) GoRouter.of(context).go('/login');
            },
            icon: const Icon(Icons.logout_rounded, color: Colors.red),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 32.h),
        child: Column(
          children: [
            // Premium Header Profile Card
            Container(
              width: double.infinity,
              padding: EdgeInsets.all(32.w),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(40.r),
                border: Border.all(color: Colors.grey[100]!),
                boxShadow: [
                  BoxShadow(
                    color: Colors.blue[900]!.withValues(alpha: 0.04),
                    blurRadius: 30.r,
                    offset: const Offset(0, 15),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Stack(
                    alignment: Alignment.bottomRight,
                    children: [
                      Container(
                        width: 130.w,
                        height: 130.h,
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F172A),
                          borderRadius: BorderRadius.circular(44.r),
                          border: Border.all(color: Colors.white, width: 6.w),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF0F172A).withValues(alpha: 0.2),
                              blurRadius: 20.r,
                              offset: const Offset(0, 10),
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(38.r),
                          child: _buildAvatarImage(p['avatar']),
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 24.h),
                  Text(
                    name,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 32.sp,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF1E293B),
                      letterSpacing: -1,
                      height: 1.1.h,
                    ),
                  ),
                  SizedBox(height: 12.h),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: EdgeInsets.symmetric(
                            horizontal: 16.w, vertical: 8.h),
                        decoration: BoxDecoration(
                          color: Colors.blue[600],
                          borderRadius: BorderRadius.circular(14.r),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.blue[600]!.withValues(alpha: 0.3),
                              blurRadius: 12.r,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: Text(
                          _getRoleLabel(role),
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10.sp,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 2,
                          ),
                        ),
                      ),
                      SizedBox(width: 10.w),
                      Container(
                        padding: EdgeInsets.symmetric(
                            horizontal: 16.w, vertical: 8.h),
                        decoration: BoxDecoration(
                          color: Colors.green[50],
                          borderRadius: BorderRadius.circular(14.r),
                        ),
                        child: Text(
                          'ACTIVE STATUS',
                          style: TextStyle(
                            color: const Color(0xFF059669),
                            fontSize: 10.sp,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.5,
                          ),
                        ),
                      ),
                    ],
                  ),

                ],
              ),
            ),
            SizedBox(height: 24.h),

            // Personal Details Card
            Container(
              width: double.infinity,
              padding: EdgeInsets.all(32.w),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(32.r),
                border: Border.all(color: Colors.grey[100]!),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'PERSONAL DETAILS',
                    style: TextStyle(
                      fontSize: 10.sp,
                      fontWeight: FontWeight.w900,
                      color: Colors.grey,
                      letterSpacing: 2.5,
                    ),
                  ),
                  SizedBox(height: 24.h),
                  _row(Icons.person_outline_rounded, 'Full Name', name),
                  _row(Icons.phone_iphone_rounded, 'Phone Number',
                      p['phone'] ?? 'Not set'),
                  _row(Icons.school_outlined, 'Dugsiga (School)', 
                      p['School']?['name'] ?? 'Not set'),
                  _row(
                      Icons.shield_outlined, 'Role Access', role.toUpperCase()),
                ],
              ),
            ),

            SizedBox(height: 16.h),

            // Dark Mode Account Access Card
            Container(
              width: double.infinity,
              padding: EdgeInsets.all(32.w),
              decoration: BoxDecoration(
                color: const Color(0xFF0A1120),
                borderRadius: BorderRadius.circular(32.r),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.1),
                    blurRadius: 20.r,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'ACCOUNT ACCESS',
                    style: TextStyle(
                      fontSize: 10.sp,
                      fontWeight: FontWeight.w900,
                      color: Colors.white38,
                      letterSpacing: 2.5,
                    ),
                  ),
                  SizedBox(height: 24.h),
                  Text(
                    'Username',
                    style: TextStyle(
                        color: Colors.white54,
                        fontSize: 10.sp,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.5),
                  ),
                  SizedBox(height: 4.h),
                  Text(
                    '@$username',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 24.sp,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.5),
                  ),
                  SizedBox(height: 24.h),
                  Text(
                    'User ID',
                    style: TextStyle(
                        color: Colors.white54,
                        fontSize: 10.sp,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.5),
                  ),
                  SizedBox(height: 8.h),
                  Container(
                    padding: EdgeInsets.all(12.w),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(12.r),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
                    ),
                    child: Text(
                      p['id'] != null ? p['id'].toString() : 'N/A',
                      style: TextStyle(
                          color: Colors.white38,
                          fontSize: 10.sp,
                          fontFamily: 'monospace'),
                    ),
                  ),
                  SizedBox(height: 32.h),
                  const Divider(color: Colors.white10),
                  SizedBox(height: 16.h),
                  InkWell(
                    onTap: () {}, // Navigate to Change Password
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Ã°Å¸â€Â SECURITY SETTINGS',
                          style: TextStyle(
                            color: Colors.blue,
                            fontSize: 10.sp,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.5,
                          ),
                        ),
                        const Icon(Icons.arrow_forward_rounded,
                            color: Colors.blue, size: 16),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(
        children: [
          Container(
            padding: EdgeInsets.all(8.w),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(10.r),
            ),
            child: Icon(icon, size: 18, color: const Color(0xFF64748B)),
          ),
          SizedBox(width: 16.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 9.sp,
                    color: Colors.grey,
                    letterSpacing: 1,
                  ),
                ),
                Text(
                  value,
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 15.sp,
                    color: const Color(0xFF1E293B),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatarImage(String? avatarPath) {
    return const Icon(
      Icons.person_rounded,
      size: 60,
      color: Colors.white,
    );
  }

  String _getRoleLabel(String r) {
    switch (r.toLowerCase()) {
      case 'owner':
        return 'MULKIILAHA';
      case 'super_admin':
        return 'MAAMULAHA GUUD';
      case 'admin':
        return 'MAAMULAHA';
      case 'teacher':
        return 'MACALIN';
      case 'student':
        return 'ARDAY';
      case 'parent':
        return 'WAALID';
      case 'accountant':
        return 'XISAABIYE';
      default:
        return r.toUpperCase();
    }
  }
}


