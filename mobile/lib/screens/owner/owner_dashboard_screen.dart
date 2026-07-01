import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../config/api_config.dart';
import '../../widgets/nav_drawer.dart';
import '../../router/auth_state.dart';
import 'package:intl/intl.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import 'package:dio/dio.dart' as dio;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:provider/provider.dart';
import '../../providers/notification_provider.dart';

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
// OwnerDashboardScreen ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â mirrors the web /owner/dashboard design
// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
class OwnerDashboardScreen extends StatefulWidget {
  const OwnerDashboardScreen({super.key});

  @override
  State<OwnerDashboardScreen> createState() => _OwnerDashboardScreenState();
}

class _OwnerDashboardScreenState extends State<OwnerDashboardScreen> {
  final ApiService _api = ApiService();
  final AuthService _auth = AuthService();

  List<dynamic> _schools = [];
  String _role = '';
  bool _loading = true;

  // Global Enterprise Stats (Mirroring Web)
  Map<String, dynamic>? _globalStats;

  // SMS Network Stats
  Map<String, dynamic>? _smsNetworkStats;

  // Search & Filtering
  final TextEditingController _searchCtrl = TextEditingController();

  // Add/Edit school modal
  Map<String, dynamic>? _editingSchool;
  bool _showAddSchool = false;
  bool _saving = false;
  XFile? _selectedLogo;
  final _picker = ImagePicker();
  final _nameCtrl = TextEditingController();
  final _codeCtrl = TextEditingController(); // NEW: Mandatory shortCode
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _codeCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    final role = await _auth.getRole();
    if (mounted) {
      setState(() => _role = role ?? 'super_admin');
      await Future.wait([
        _fetchGlobalStats(),
        _fetchSmsNetworkStats(),
        _fetchSchools(),
      ]);
    }
  }


  Future<void> _fetchGlobalStats() async {
    try {
      const url = ApiConfig.superAdminDashboard;
      final res = await _api.get(url);
      if (mounted) {
        setState(() {
          _globalStats = res.data is Map ? res.data as Map<String, dynamic> : null;
        });
      }
    } catch (e) {
      // Ignore
    }
  }

  Future<void> _fetchSmsNetworkStats() async {
    try {
      final res = await _api.get(ApiConfig.smsSuperAdminStats);
      if (mounted) {
        setState(() {
          _smsNetworkStats = res.data is Map ? res.data as Map<String, dynamic> : null;
        });
      }
    } catch (e) {
      // Ignore
    }
  }

  Future<void> _fetchSchools() async {
    try {
      setState(() => _loading = true);
      String url = ApiConfig.schools;
      final res = await _api.get(url);
      if (mounted) {
        setState(() {
          // Robust extraction: handles both [{...}] and {"data": [{...}]}
          if (res.data is List) {
            _schools = res.data;
          } else if (res.data is Map && res.data['data'] is List) {
            _schools = res.data['data'];
          } else {
            _schools = [];
          }
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _filterSchools(String query) {
    // UI logic uses _schools directly, so no-op or we should filter _schools
  }

  // Detailed stats for a specific school (Real-time)
  Map<String, dynamic>? _selectedSchoolStats;
  List<dynamic> _schoolAdmins = [];
  bool _fetchingStats = false;
  bool _fetchingAdmins = false;

  // SMS data for selected school
  Map<String, dynamic>? _selectedSmsStatus;

  // Global SMS Archive State
  List<dynamic> _globalSmsLogs = [];
  bool _fetchingGlobalSms = false;
  String _smsLogMonth = DateTime.now().month.toString();
  String _smsLogYear = DateTime.now().year.toString();

  Future<void> _fetchDetailedStats(String schoolId) async {
    try {
      setState(() {
        _fetchingStats = true;
        _selectedSchoolStats = null;
      });
      final res = await _api.get('${ApiConfig.schools}/$schoolId/stats');
      if (mounted) {
        setState(() {
          _selectedSchoolStats = res.data as Map<String, dynamic>;
          _fetchingStats = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _fetchingStats = false);
    }
  }

  Future<void> _fetchSchoolAdmins(String schoolId) async {
    try {
      setState(() {
        _fetchingAdmins = true;
        _schoolAdmins = [];
      });
      final res = await _api.get('${ApiConfig.schools}/$schoolId/admins');
      if (mounted) {
        setState(() {
          _schoolAdmins = res.data is List
              ? res.data
              : (res.data['admins'] ?? res.data['data'] ?? []);
          _fetchingAdmins = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _fetchingAdmins = false);
    }
  }

  Future<void> _fetchSmsData(String schoolId) async {
    try {
      setState(() {
        _selectedSmsStatus = null;
      });
      final results = await Future.wait([
        _api.get('${ApiConfig.smsSettings}?schoolId=$schoolId')
      ]);
      if (mounted) {
        setState(() {
          _selectedSmsStatus = results[0].data is Map ? Map<String, dynamic>.from(results[0].data) : null;
        });
      }
    } catch (e) {
      // Ignore
    }
  }

  Future<void> _fetchGlobalSmsLogs() async {
    if (!mounted) return;
    setState(() => _fetchingGlobalSms = true);
    try {
      final res = await _api.get('${ApiConfig.smsSuperAdminLogs}?month=$_smsLogMonth&year=$_smsLogYear');
      if (mounted) {
        setState(() {
          _globalSmsLogs = res.data is List ? res.data : [];
          _fetchingGlobalSms = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _fetchingGlobalSms = false);
    }
  }

  Future<void> _deleteSchoolAdmin(String schoolId, String userId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20.r)),
        title: const Text('Hubi Tirtirista', style: TextStyle(fontWeight: FontWeight.w900)),
        content: const Text('Ma hubtaa inaad tirtirto admin-kan?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Jooji')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Haa, Tirtir', style: TextStyle(color: Colors.red, fontWeight: FontWeight.w900)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _api.delete('${ApiConfig.schools}/$schoolId/admin/$userId');
        await _fetchSchoolAdmins(schoolId);
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Cillad: $e')),
          );
        }
      }
    }
  }

  Future<void> _showAddAdminDialog(String schoolId) async {
    final nameCtrl = TextEditingController();
    final userCtrl = TextEditingController();
    final passCtrl = TextEditingController();

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24.r)),
        title: const Text('Admin Cusub', style: TextStyle(fontWeight: FontWeight.w900)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              decoration: InputDecoration(
                labelText: 'Magaca Admin-ka',
                filled: true,
                fillColor: Colors.grey[100],
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r), borderSide: BorderSide.none),
              ),
            ),
            SizedBox(height: 12.h),
            TextField(
              controller: userCtrl,
              decoration: InputDecoration(
                labelText: 'Username',
                filled: true,
                fillColor: Colors.grey[100],
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r), borderSide: BorderSide.none),
              ),
            ),
            SizedBox(height: 12.h),
            TextField(
              controller: passCtrl,
              obscureText: true,
              decoration: InputDecoration(
                labelText: 'Password',
                filled: true,
                fillColor: Colors.grey[100],
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r), borderSide: BorderSide.none),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Jooji')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
            ),
            onPressed: () async {
              if (nameCtrl.text.isEmpty || userCtrl.text.isEmpty || passCtrl.text.isEmpty) return;
              try {
                await _api.post('${ApiConfig.schools}/$schoolId/admin', data: {
                  'name': nameCtrl.text.trim(),
                  'username': userCtrl.text.trim(),
                  'password': passCtrl.text,
                });
                if (ctx.mounted) Navigator.pop(ctx);
                await _fetchSchoolAdmins(schoolId);
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Cillad: $e')));
                }
              }
            },
            child: const Text('Kaydi Admin-ka'),
          ),
        ],
      ),
    );
  }

  Future<void> _addSchool() async {
    // Only owner can create new institutions
    if (_editingSchool == null && _role == 'super_admin') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Kaliya Owner-ku ayaa dugsi cusub samayn kara')),
      );
      return;
    }
    if (_nameCtrl.text.trim().isEmpty || _codeCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Fadlan buuxi Magaca iyo ShortCode-ka (Waa Qasab)')),
      );
      return;
    }
    
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _saving = true);
    
    try {
      String? logoUrl = _editingSchool?['logo'];

      if (_selectedLogo != null) {
        final formData = dio.FormData.fromMap({
          'logo': await dio.MultipartFile.fromFile(_selectedLogo!.path),
        });
        final uploadRes = await _api.post(ApiConfig.schoolLogoUpload, data: formData);
        logoUrl = uploadRes.data['logoUrl'];
      }

      final data = {
        'name': _nameCtrl.text.trim(),
        'shortCode': _codeCtrl.text.trim().toUpperCase(),
        'phone': _phoneCtrl.text.trim(),
        'email': _emailCtrl.text.trim(),
        'address': _addressCtrl.text.trim(),
        'logo': logoUrl,
      };

      if (_editingSchool != null) {
        await _api.put('${ApiConfig.schools}/${_editingSchool!['id']}', data: data);
      } else {
        await _api.post(ApiConfig.schools, data: data);
      }

      _nameCtrl.clear();
      _codeCtrl.clear();
      _phoneCtrl.clear();
      _emailCtrl.clear();
      _addressCtrl.clear();
      _selectedLogo = null;
      
      setState(() {
        _showAddSchool = false;
        _editingSchool = null;
      });
      
      await _fetchSchools();
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(content: Text('Cillad: $e')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _toggleSchoolLock(Map<String, dynamic> school) async {
    final bool newStatus = !(school['isActive'] ?? true);
    try {
      await _api.put('${ApiConfig.schools}/${school['id']}', data: {
        'isActive': newStatus,
      });
      if (!mounted) return;
      Navigator.pop(context); // Close detail sheet
      await _fetchSchools();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(newStatus
                  ? 'Si guul leh ayaa loo furay dugsiga'
                  : 'Si guul leh ayaa loo xidhay dugsiga')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Waa lagu fashilmay: $e')),
        );
      }
    }
  }

  void _openEdit(Map<String, dynamic> school) {
    setState(() {
      _editingSchool = school;
      _nameCtrl.text = school['name'] ?? '';
      _codeCtrl.text = school['shortCode'] ?? '';
      _phoneCtrl.text = school['phone'] ?? '';
      _emailCtrl.text = school['email'] ?? '';
      _addressCtrl.text = school['address'] ?? '';
      _selectedLogo = null;
      _showAddSchool = true;
    });
  }

  Future<void> _pickLogo() async {
    final XFile? image = await _picker.pickImage(source: ImageSource.gallery);
    if (image != null) {
      setState(() => _selectedLogo = image);
    }
  }

  Future<void> _deleteSchool(dynamic id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20.r)),
        title: const Text('Hubi Tirtirista',
            style: TextStyle(fontWeight: FontWeight.w900)),
        content: const Text(
            'Ma hubtaa inaad tirtirto dugsigan? Dhamaan xogta waa la tirtiri doonaa!'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Jooji')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red, foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Tirtir'),
          ),
        ],
      ),
    );
    if (confirm == true) {
      try {
        await _api.delete('${ApiConfig.schools}/$id');
        _fetchSchools();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Error deleting school')),
          );
        }
      }
    }
  }

  int get activeCount => _schools.where((s) => s['isActive'] == true).length;
  int get lockedCount => _schools.where((s) => s['isActive'] == false).length;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Scaffold(
          backgroundColor: const Color(0xFFF8FAFC),
          drawer: NavDrawer(role: _role),
          extendBodyBehindAppBar: false,
          appBar: AppBar(
            backgroundColor: const Color(0xFF0F172A),
            elevation: 0,
            surfaceTintColor: Colors.transparent,
            iconTheme: const IconThemeData(color: Colors.white),
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      _role == 'super_admin' ? 'SUPER ADMIN' : 'SYSTEM OWNER',
                      style: TextStyle(
                        fontSize: 9.sp,
                        fontWeight: FontWeight.w900,
                        color: Colors.blue.shade400,
                        letterSpacing: 2,
                      ),
                    ),
                    SizedBox(width: 8.w),
                    Container(
                      padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 2.h),
                      decoration: BoxDecoration(
                        color: Colors.blue.shade500.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(4.r),
                      ),
                      child: Text(
                        'XARUNTA MAAMULKA',
                        style: TextStyle(color: Colors.blue, fontSize: 7.sp, fontWeight: FontWeight.w900, letterSpacing: 1),
                      ),
                    ),
                  ],
                ),
                Text(
                  'Nidaamka Dugsiyada',
                  style: TextStyle(
                    fontSize: 20.sp,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: -0.5,
                  ),
                ),
              ],
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.refresh_rounded, color: Colors.white70),
                onPressed: _loadData,
              ),
              Consumer<NotificationProvider>(
                builder: (context, notificationProvider, _) {
                  return Stack(
                    clipBehavior: Clip.none,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.notifications_active_outlined,
                            color: Colors.white70),
                        onPressed: () => GoRouter.of(context).push('/notifications'),
                      ),
                      if (notificationProvider.unreadCount > 0)
                        Positioned(
                          right: 8,
                          top: 8,
                          child: Container(
                            padding: EdgeInsets.all(4.w),
                            decoration: const BoxDecoration(
                              color: Color(0xFFF43F5E), // rose-500
                              shape: BoxShape.circle,
                            ),
                            constraints: const BoxConstraints(
                              minWidth: 16,
                              minHeight: 16,
                            ),
                            child: Text(
                              '${notificationProvider.unreadCount}',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 8.sp,
                                fontWeight: FontWeight.w900,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
            ],
          ),
          body: _loading
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _fetchSchools,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: EdgeInsets.all(20.w),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // â”€â”€ Header stats (matches web cards style) â”€â”€â”€â”€
                        _buildHeaderStats(),
                        SizedBox(height: 24.h),

                        // â”€â”€ Search Bar (Matches Web's intelligence node search) â”€â”€
                        Container(
                          margin: const EdgeInsets.only(bottom: 24),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20.r),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.05),
                                blurRadius: 15.r,
                                offset: const Offset(0, 5),
                              ),
                            ],
                          ),
                          child: TextField(
                            controller: _searchCtrl,
                            onChanged: _filterSchools,
                            decoration: InputDecoration(
                              hintText: 'Raadi dugsiyada magac ama kood...',
                              hintStyle: TextStyle(color: Colors.grey[400], fontSize: 13.sp, fontWeight: FontWeight.w600),
                              prefixIcon: const Icon(Icons.search_rounded, color: AppTheme.primary, size: 20),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(20.r),
                                borderSide: BorderSide.none,
                              ),
                              contentPadding: EdgeInsets.all(20.w),
                            ),
                          ),
                        ),

                        // â”€â”€ Schools list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'DUGSIYADA NIDAAMKA',
                              style: TextStyle(
                                fontSize: 10.sp,
                                fontWeight: FontWeight.w900,
                                color: AppTheme.textSecondary,
                                letterSpacing: 2,
                              ),
                            ),
                            Text(
                              '${_schools.length} Wadarta',
                              style: TextStyle(
                                fontSize: 11.sp,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.primary,
                              ),
                            ),
                          ],
                        ),
                        SizedBox(height: 12.h),

                        _schools.isEmpty
                            ? _buildEmptyState()
                            : ListView.builder(
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                itemCount: _schools.length,
                                itemBuilder: (context, i) =>
                                    _buildSchoolCard(_schools[i]),
                              ),
                      ],
                    ),
                  ),
                ),
        ),

        // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Add-school modal overlay ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
        if (_showAddSchool) _buildAddSchoolOverlay(),
      ],
    );
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Header stats ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â matches web card layout ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  Widget _buildHeaderStats() {
    final stats = _globalStats?['counts'] ?? {};
    final rev = _globalStats?['financials'] ?? {};
    
    return Column(
      children: [
        // Premium SMS Gateway Banner (High Visibility)
        _buildSmsGatewayBanner(),
        SizedBox(height: 20.h),

        Row(
          children: [
            Expanded(
              child: _statCard(
                'WADARTA DAKHLIGA',
                '\$${NumberFormat("#,##0").format(rev['totalRevenue'] ?? 0)}',
                const Color(0xFF10B981),
                const Color(0xFFECFDF5),
                Icons.account_balance_wallet_rounded,
                isCurrency: true,
                trend: '+12.5%',
              ),
            ),
            SizedBox(width: 12.w),
            Expanded(
              child: _statCard(
                'WADARTA DUGSIYADA',
                stats['totalSchools']?.toString() ?? '0',
                const Color(0xFF6366F1),
                const Color(0xFFEEF2FF),
                Icons.domain_rounded,
                trend: 'Nidaamyada',
              ),
            ),
          ],
        ),
        SizedBox(height: 12.h),
        Row(
          children: [
            Expanded(
              child: _statCard(
                'ARDAYDA',
                stats['totalStudents']?.toString() ?? '0',
                const Color(0xFFF59E0B),
                const Color(0xFFFFFBEB),
                Icons.people_alt_rounded,
                trend: 'Firfircoon',
              ),
            ),
            SizedBox(width: 12.w),
            Expanded(
              child: _statCard(
                'MACALLIMIINTA',
                stats['totalTeachers']?.toString() ?? '0',
                const Color(0xFF8B5CF6),
                const Color(0xFFF5F3FF),
                Icons.school_rounded,
                trend: 'Guud',
              ),
            ),
          ],
        ),
        SizedBox(height: 20.h),

        // Revenue Trend Chart (Matches Web)
        _buildRevenueTrendChart(),
        SizedBox(height: 20.h),

        // Live Data Sync Pulse
        Container(
          padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 10.h),
          decoration: BoxDecoration(
            color: const Color(0xFF10B981).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(100.r),
            border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.2)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 6.w,
                height: 6.h,
                decoration: const BoxDecoration(
                  color: Color(0xFF10B981),
                  shape: BoxShape.circle,
                ),
              ),
              SizedBox(width: 8.w),
              Text(
                'ISKU-XIDHKA XOGTA WAA LIVE',
                style: TextStyle(
                  color: const Color(0xFF10B981),
                  fontSize: 8.sp,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.5,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSmsGatewayBanner() {
    final smsStats = _smsNetworkStats ?? {};
    final bool isEnabled = smsStats['isSmsEnabled'] ?? true;
    
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(24.w),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(28.r),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.2),
            blurRadius: 30.r,
            offset: const Offset(0, 15),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 40.w,
                    height: 40.h,
                    decoration: BoxDecoration(
                      color: isEnabled ? const Color(0xFF10B981) : const Color(0xFFF43F5E),
                      borderRadius: BorderRadius.circular(12.r),
                    ),
                    child: Icon(isEnabled ? Icons.sensors_rounded : Icons.sensors_off_rounded, color: Colors.white, size: 20),
                  ),
                  SizedBox(width: 12.w),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'GABALKA SMS-KA',
                        style: TextStyle(color: Colors.white, fontSize: 13.sp, fontWeight: FontWeight.w900, letterSpacing: -0.5),
                      ),
                      Text(
                        isEnabled ? 'NIDAAMKU WAADIID' : 'NIDAAMKA WAA LA XADIDAY',
                        style: TextStyle(
                          color: isEnabled ? const Color(0xFF10B981) : const Color(0xFFF43F5E),
                          fontSize: 8.sp,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              InkWell(
                onTap: () {
                  _fetchGlobalSmsLogs();
                  _showGlobalSmsModal();
                },
                child: Container(
                  padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 8.h),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(10.r),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                  ),
                  child: Row(
                    children: [
                      Text(
                        'KAYDKA',
                        style: TextStyle(color: Colors.white, fontSize: 9.sp, fontWeight: FontWeight.w900, letterSpacing: 1),
                      ),
                      SizedBox(width: 4.w),
                      const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white54, size: 8),
                    ],
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: 24.h),
          Row(
            children: [
              _smsStatCompact('TRAFFIC-KA BISHAN', smsStats['totalThisMonth']?.toString() ?? '0', const Color(0xFF3B82F6)),
              Container(width: 1.w, height: 30.h, color: Colors.white.withValues(alpha: 0.1), margin: EdgeInsets.symmetric(horizontal: 16.w)),
              _smsStatCompact('GUUD AHAAN XOGTA', smsStats['totalAllTime']?.toString() ?? '0', const Color(0xFF8B5CF6)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _smsStatCompact(String label, String value, Color color) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(color: const Color(0xFF64748B), fontSize: 8.sp, fontWeight: FontWeight.w900, letterSpacing: 1),
          ),
          SizedBox(height: 4.h),
          Text(
            value,
            style: TextStyle(color: Colors.white, fontSize: 18.sp, fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }



  Widget _buildRevenueTrendChart() {
    final trends = (_globalStats?['monthlyTrends'] as List?) ?? [];
    if (trends.isEmpty) return const SizedBox();

    return Container(
      padding: EdgeInsets.all(24.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(32.r),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'KOOBKA MAALIYADDA',
                    style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: const Color(0xFF64748B), letterSpacing: 1.5),
                  ),
                  SizedBox(height: 2.h),
                  Text(
                    'Isku-darka Bilaha',
                    style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w900, color: const Color(0xFF1E293B)),
                  ),
                ],
              ),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 6.h),
                decoration: BoxDecoration(
                  color: const Color(0xFF6366F1).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10.r),
                ),
                child: Row(
                  children: [
                    const CircleAvatar(radius: 3, backgroundColor: Color(0xFF6366F1)),
                    SizedBox(width: 6.w),
                    Text(
                      'Dakhliga',
                      style: TextStyle(color: const Color(0xFF6366F1), fontSize: 9.sp, fontWeight: FontWeight.w900, letterSpacing: 1),
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 32.h),
          SizedBox(
            height: 200.h,
            child: LineChart(
              LineChartData(
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (value) => const FlLine(color: Color(0xFFF1F5F9), strokeWidth: 1, dashArray: [5, 5]),
                ),
                titlesData: FlTitlesData(
                  show: true,
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 30,
                      interval: 1,
                      getTitlesWidget: (value, meta) {
                        final i = value.toInt();
                        if (i >= 0 && i < trends.length) {
                          return Padding(
                            padding: const EdgeInsets.only(top: 8.0),
                            child: Text(
                              trends[i]['month'] ?? '',
                              style: TextStyle(color: const Color(0xFF94A3B8), fontSize: 10.sp, fontWeight: FontWeight.w800),
                            ),
                          );
                        }
                        return const SizedBox();
                      },
                    ),
                  ),
                ),
                borderData: FlBorderData(show: false),
                lineBarsData: [
                  LineChartBarData(
                    spots: trends.asMap().entries.map((e) {
                      final val = (e.value['revenue'] as num?)?.toDouble() ?? 0.0;
                      return FlSpot(e.key.toDouble(), val);
                    }).toList(),
                    isCurved: true,
                    curveSmoothness: 0.35,
                    color: const Color(0xFF6366F1),
                    barWidth: 5,
                    isStrokeCapRound: true,
                    dotData: FlDotData(
                      show: true,
                      getDotPainter: (spot, percent, barData, index) => FlDotCirclePainter(
                        radius: 5,
                        color: Colors.white,
                        strokeWidth: 4,
                        strokeColor: const Color(0xFF6366F1),
                      ),
                    ),
                    belowBarData: BarAreaData(
                      show: true,
                      gradient: LinearGradient(
                        colors: [
                          const Color(0xFF6366F1).withValues(alpha: 0.15),
                          const Color(0xFF6366F1).withValues(alpha: 0.0),
                        ],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _statCard(
      String label, String value, Color color, Color bgColor, IconData icon, {bool isCurrency = false, String? trend}) {
    return Container(
      padding: EdgeInsets.all(16.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24.r),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: EdgeInsets.all(12.w),
                decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(16.r)),
                child: Icon(icon, color: color, size: 24),
              ),
              const Spacer(),
              if (trend != null)
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
                  decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(8.r)),
                  child: Text(trend, style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w800, color: const Color(0xFF64748B))),
                ),
            ],
          ),
          SizedBox(height: 16.h),
          Text(label, style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w800, color: const Color(0xFF64748B), letterSpacing: 0.5)),
          SizedBox(height: 4.h),
          Text(value, style: TextStyle(fontSize: 22.sp, fontWeight: FontWeight.w900, color: const Color(0xFF1E293B))),
        ],
      ),
    );
  }

  Widget _buildSchoolCard(Map<String, dynamic> school) {
    final bool isActive = school['isActive'] ?? true;
    final revenue = school['revenue'] as num? ?? 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(32.r),
        border: Border.all(color: const Color(0xFFF1F5F9), width: 2.w),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 20.r,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: InkWell(
        onTap: () {
          _fetchDetailedStats(school['id']);
          _fetchSchoolAdmins(school['id']);
          _fetchSmsData(school['id']);
          _showSchoolDetail(school);
        },
        borderRadius: BorderRadius.circular(32.r),
        child: Padding(
          padding: EdgeInsets.all(24.w),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // School header
              Row(
                children: [
                  Container(
                    width: 64.w,
                    height: 64.h,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(20.r),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: school['logo'] != null
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(20.r),
                            child: CachedNetworkImage(
                                imageUrl: school['logo'],
                                fit: BoxFit.cover,
                                placeholder: (context, url) => const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                                errorWidget: (context, url, err) => const Icon(Icons.school_rounded, color: Colors.grey)),
                          )
                        : Center(child: Text('ðŸ«', style: TextStyle(fontSize: 32.sp))),
                  ),
                  SizedBox(width: 16.w),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          school['name'] ?? 'Dugsi Aan La Garan',
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 18.sp,
                            color: const Color(0xFF0F172A),
                            letterSpacing: -0.5,
                          ),
                        ),
                        SizedBox(height: 4.h),
                        Row(
                          children: [
                            Container(
                              padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 2.h),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(6.r),
                              ),
                              child: Text(
                                school['shortCode']?.toString().toUpperCase() ?? 'NO CODE',
                                style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.w900, color: const Color(0xFF64748B), letterSpacing: 1),
                              ),
                            ),
                            SizedBox(width: 10.w),
                            Container(
                              width: 6.w,
                              height: 6.h,
                              decoration: BoxDecoration(
                                color: isActive ? const Color(0xFF10B981) : const Color(0xFFF43F5E),
                                shape: BoxShape.circle,
                              ),
                            ),
                            SizedBox(width: 6.w),
                            Text(
                              isActive ? 'NODE FIRFIRCOON' : 'WAA LA XADIDAY',
                              style: TextStyle(
                                fontSize: 9.sp,
                                fontWeight: FontWeight.w900,
                                color: isActive ? const Color(0xFF10B981) : const Color(0xFFF43F5E),
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              SizedBox(height: 24.h),

              // Stats row â€” matches web's 3-column grid
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 3,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 1.5,
                children: [
                  _miniStatBox('ARDAYDA', '${school['students'] ?? 0}', const Color(0xFF3B82F6)),
                  _miniStatBox('KALAASADA', '${school['classes'] ?? 0}', const Color(0xFFF59E0B)),
                  _miniStatBox('DAKHLIGA', '\$${NumberFormat.compact().format(revenue)}', const Color(0xFF10B981)),
                ],
              ),
              SizedBox(height: 20.h),

              // Action button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F172A),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
                    padding: EdgeInsets.symmetric(vertical: 16.h),
                  ),
                  onPressed: () => _impersonateSchool(school),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text('GAL PORTAL-KA', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11.sp, letterSpacing: 1)),
                      SizedBox(width: 8.w),
                      const Icon(Icons.rocket_launch_rounded, size: 14),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }


  Widget _miniStatBox(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: EdgeInsets.symmetric(vertical: 10.h, horizontal: 12.w),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(14.r),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 15.sp,
                fontWeight: FontWeight.w900,
                color: color,
              ),
            ),
            SizedBox(height: 2.h),
            Text(
              label,
              style: TextStyle(
                fontSize: 8.sp,
                fontWeight: FontWeight.w800,
                color: AppTheme.textSecondary,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 60.h),
        child: Column(
          children: [
            Container(
              width: 80.w,
              height: 80.h,
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(24.r),
              ),
              child: const Icon(Icons.school_rounded,
                  size: 40, color: AppTheme.primary),
            ),
            SizedBox(height: 16.h),
            const Text(
              'MA JIRTO DUGSIYO',
              style: TextStyle(
                fontWeight: FontWeight.w900,
                color: AppTheme.textPrimary,
                letterSpacing: 2,
              ),
            ),
            SizedBox(height: 6.h),
            Text(
              'Ku bilow dugsigii ugu horreeyay',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 12.sp),
            ),
          ],
        ),
      ),
    );
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ School detail bottom sheet ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  // â”€â”€ Global SMS Logs Bottom Sheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  void _showGlobalSmsModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Container(
              height: MediaQuery.of(context).size.height * 0.9,
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.vertical(top: Radius.circular(30.r)),
              ),
              child: Column(
                children: [
                  SizedBox(height: 12.h),
                  Container(
                    width: 40.w,
                    height: 4.h,
                    decoration: BoxDecoration(
                      color: Colors.grey[300],
                      borderRadius: BorderRadius.circular(2.r),
                    ),
                  ),
                  // Header
                  Container(
                    padding: EdgeInsets.all(24.w),
                    decoration: const BoxDecoration(
                      color: Color(0xFF0F172A),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 50.w,
                          height: 50.h,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(16.r),
                          ),
                          child: const Icon(Icons.mark_email_read_rounded, color: Colors.white, size: 26),
                        ),
                        SizedBox(width: 16.w),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Kaydka SMS-ka Guud',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 20.sp,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: -0.5,
                                ),
                              ),
                              Text(
                                'XOGTA SMS-KA EE NIDAAMKA',
                                style: TextStyle(color: Colors.white54, fontSize: 10.sp, fontWeight: FontWeight.w800, letterSpacing: 1),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  
                  // Filter
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 12.h),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border(bottom: BorderSide(color: Colors.grey[200]!)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Container(
                            padding: EdgeInsets.symmetric(horizontal: 16.w),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(12.r),
                            ),
                            child: DropdownButtonHideUnderline(
                              child: DropdownButton<String>(
                                isExpanded: true,
                                value: _smsLogMonth == 'all' ? 'all' : '$_smsLogYear-$_smsLogMonth',
                                icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Colors.grey),
                                style: TextStyle(fontWeight: FontWeight.w800, color: const Color(0xFF0F172A), fontSize: 13.sp),
                                items: [
                                  DropdownMenuItem(value: '${DateTime.now().year}-${DateTime.now().month}', child: const Text('30-KII MAALMOOD EE U DAMBEEYEY')),
                                  DropdownMenuItem(value: '${DateTime.now().year}-${DateTime.now().month == 1 ? 12 : DateTime.now().month - 1}', child: const Text('BISHII HORE')),
                                  DropdownMenuItem(value: 'all', child: Text('DHAMAAN KAYDKA (MAX 1000)')),
                                ],
                                onChanged: (val) {
                                  if (val != null) {
                                    if (val == 'all') {
                                      _smsLogMonth = 'all';
                                      _smsLogYear = 'all';
                                    } else {
                                      final pts = val.split('-');
                                      _smsLogYear = pts[0];
                                      _smsLogMonth = pts[1];
                                    }
                                    setSheetState(() => _fetchingGlobalSms = true);
                                    _fetchGlobalSmsLogs().then((_) {
                                      if (mounted) setSheetState(() {});
                                    });
                                  }
                                },
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  
                  // List
                  Expanded(
                    child: _fetchingGlobalSms
                        ? const Center(child: CircularProgressIndicator())
                        : _globalSmsLogs.isEmpty
                            ? Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.inbox_rounded, size: 60, color: Colors.grey[300]),
                                    SizedBox(height: 16.h),
                                    const Text('Ma jiraan wax xog ah oo la helay', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
                                  ],
                                ),
                              )
                            : ListView.builder(
                                padding: EdgeInsets.all(20.w),
                                itemCount: _globalSmsLogs.length,
                                itemBuilder: (context, idx) {
                                  final log = _globalSmsLogs[idx];
                                  final isAtt = log['type'] == 'attendance';
                                  return Container(
                                    margin: const EdgeInsets.only(bottom: 12),
                                    padding: EdgeInsets.all(16.w),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(16.r),
                                      border: Border.all(color: Colors.grey[200]!),
                                      boxShadow: [
                                        BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 10.r, offset: const Offset(0, 2)),
                                      ],
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Container(
                                              padding: EdgeInsets.all(8.w),
                                              decoration: BoxDecoration(
                                                color: isAtt ? Colors.orange.withValues(alpha: 0.1) : Colors.blue.withValues(alpha: 0.1),
                                                borderRadius: BorderRadius.circular(10.r),
                                              ),
                                              child: Icon(isAtt ? Icons.alarm_rounded : Icons.article_rounded, 
                                                size: 16, color: isAtt ? Colors.orange : Colors.blue),
                                            ),
                                            SizedBox(width: 12.w),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Text(log['schoolName'] ?? 'Unknown', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13.sp)),
                                                  SizedBox(height: 2.h),
                                                  Text(DateTime.tryParse(log['created_at'])?.toLocal().toString() ?? '', 
                                                    style: TextStyle(fontSize: 10.sp, color: Colors.grey, fontWeight: FontWeight.bold)),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                        SizedBox(height: 12.h),
                                        Container(
                                          width: double.infinity,
                                          padding: EdgeInsets.all(12.w),
                                          decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(10.r)),
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Container(
                                                    padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
                                                    decoration: BoxDecoration(color: Colors.grey[200], borderRadius: BorderRadius.circular(6.r)),
                                                    child: Text(log['phoneNumber'] ?? '', style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.bold, color: Colors.black87)),
                                                  ),
                                                  SizedBox(width: 8.w),
                                                  Container(
                                                    padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
                                                    decoration: BoxDecoration(
                                                      color: log['status'] == 'sent' ? Colors.green.withValues(alpha: 0.1) : Colors.red.withValues(alpha: 0.1),
                                                      borderRadius: BorderRadius.circular(6.r),
                                                    ),
                                                    child: Text((log['status'] ?? '').toUpperCase(), 
                                                      style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.bold, color: log['status'] == 'sent' ? Colors.green : Colors.red)),
                                                  ),
                                                ],
                                              ),
                                              SizedBox(height: 8.h),
                                              Text(log['message'] ?? '', style: TextStyle(fontSize: 12.sp, height: 1.4.h, color: Colors.black87)),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showSchoolDetail(Map<String, dynamic> school) {
    final bool isActive = school['isActive'] ?? true;
    final revenue = school['revenue'] as num? ?? 0;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Container(
              height: MediaQuery.of(context).size.height * 0.9,
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.vertical(top: Radius.circular(40.r)),
              ),
              child: Column(
                children: [
                  SizedBox(height: 12.h),
                  Container(
                    width: 50.w,
                    height: 5.h,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE2E8F0),
                      borderRadius: BorderRadius.circular(10.r),
                    ),
                  ),
                  // Header â€” Premium High-Contrast
                  Container(
                    padding: EdgeInsets.all(32.w),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(40.r)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 72.w,
                          height: 72.h,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(24.r),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                          ),
                          child: const Icon(Icons.hub_rounded, size: 36, color: Colors.blue),
                        ),
                        SizedBox(width: 20.w),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                school['name'] ?? 'Dugsi Aan La Garan',
                                style: TextStyle(color: Colors.white, fontSize: 24.sp, fontWeight: FontWeight.w900, letterSpacing: -1),
                              ),
                              SizedBox(height: 4.h),
                              Text(
                                'NODE-KA XOGTA • INTELLIGENCE',
                                style: TextStyle(color: Colors.blue, fontSize: 10.sp, fontWeight: FontWeight.w900, letterSpacing: 2),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
                          decoration: BoxDecoration(
                            color: isActive ? const Color(0xFF10B981) : const Color(0xFFF43F5E),
                            borderRadius: BorderRadius.circular(12.r),
                          ),
                          child: Text(
                            isActive ? 'FIRFIRCOON' : 'XIDHAN',
                            style: TextStyle(color: Colors.white, fontSize: 10.sp, fontWeight: FontWeight.w900, letterSpacing: 1),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Intelligence Content
                  Expanded(
                    child: ListView(
                      padding: EdgeInsets.all(32.w),
                      children: [
                        // Stats Cloud
                        Text(
                          'XOGTA ANALYTIKA',
                          style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: const Color(0xFF94A3B8), letterSpacing: 2),
                        ),
                        SizedBox(height: 16.h),
                        if (_fetchingStats)
                          const Center(child: LinearProgressIndicator())
                        else
                          Row(
                            children: [
                              _intelligenceStat('DAKHLIGA', '\$${NumberFormat.compact().format(_selectedSchoolStats?['revenue'] ?? revenue)}', const Color(0xFF10B981)),
                              SizedBox(width: 12.w),
                              _intelligenceStat('SMS-KA NODE-KA', '${_selectedSmsStatus?['monthlyCount'] ?? 0}', Colors.blue),
                            ],
                          ),
                        SizedBox(height: 32.h),

                        // Institutional Hierarchy Stats
                        Row(
                          children: [
                            _miniIntelligenceStat('Ardayda', '${_selectedSchoolStats?['students'] ?? school['students'] ?? 0}', const Color(0xFF6366F1)),
                            SizedBox(width: 8.w),
                            _miniIntelligenceStat('Macallimiinta', '${_selectedSchoolStats?['teachers'] ?? school['teachers'] ?? 0}', const Color(0xFFF59E0B)),
                            SizedBox(width: 8.w),
                            _miniIntelligenceStat('Staff', '${_selectedSchoolStats?['staff'] ?? school['staff'] ?? 0}', const Color(0xFF8B5CF6)),
                          ],
                        ),
                        SizedBox(height: 32.h),

                        // Administrative Layer
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'MAAMULAYAASHA NODE-KA',
                              style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: const Color(0xFF94A3B8), letterSpacing: 2),
                            ),
                            TextButton.icon(
                              onPressed: () => _showAddAdminDialog(school['id']),
                              style: TextButton.styleFrom(foregroundColor: Colors.blue),
                              icon: const Icon(Icons.add_moderator_rounded, size: 16),
                              label: Text('KU DAR', style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, letterSpacing: 1)),
                            ),
                          ],
                        ),
                        SizedBox(height: 12.h),
                        if (_fetchingAdmins)
                          const Center(child: CircularProgressIndicator())
                        else if (_schoolAdmins.isEmpty)
                          _emptyAdminTile()
                        else
                          ..._schoolAdmins.map((admin) => _adminTile(school['id'], admin)),

                        SizedBox(height: 40.h),
                        
                        // Protocol Actions
                        Text(
                          'AMARADA PROTOCOL-KA',
                          style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: const Color(0xFF94A3B8), letterSpacing: 2),
                        ),
                        SizedBox(height: 16.h),
                        _protocolAction(
                          'GAL PORTAL-KA DUGSIGA',
                          Icons.rocket_launch_rounded,
                          const Color(0xFF0F172A),
                          Colors.white,
                          () => _impersonateSchool(school, fromModal: true),
                        ),
                        SizedBox(height: 12.h),
                        Row(
                          children: [
                            Expanded(
                              child: _protocolAction(
                                'BEDEL NODE-KA',
                                Icons.tune_rounded,
                                const Color(0xFFF1F5F9),
                                const Color(0xFF475569),
                                () {
                                  Navigator.pop(context);
                                  _openEdit(school);
                                },
                              ),
                            ),
                            SizedBox(width: 12.w),
                            Expanded(
                              child: _protocolAction(
                                isActive ? 'XIDH NIDAAMKA' : 'FURA NIDAAMKA',
                                isActive ? Icons.lock_rounded : Icons.lock_open_rounded,
                                isActive ? const Color(0xFFFEF2F2) : const Color(0xFFECFDF5),
                                isActive ? const Color(0xFFDC2626) : const Color(0xFF10B981),
                                () => _toggleSchoolLock(school),
                              ),
                            ),
                          ],
                        ),
                        SizedBox(height: 12.h),
                        _protocolAction(
                          'TIRTIR DUGSIGA',
                          Icons.delete_forever_rounded,
                          const Color(0xFFF1F5F9),
                          const Color(0xFF94A3B8),
                          () {
                            Navigator.pop(context);
                            _deleteSchool(school['id']);
                          },
                        ),
                        SizedBox(height: 50.h),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _intelligenceStat(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: EdgeInsets.all(24.w),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24.r),
          border: Border.all(color: const Color(0xFFF1F5F9), width: 2.w),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(color: color, fontSize: 8.sp, fontWeight: FontWeight.w900, letterSpacing: 2)),
            SizedBox(height: 8.h),
            Text(value, style: TextStyle(fontSize: 24.sp, fontWeight: FontWeight.w900, color: const Color(0xFF0F172A), letterSpacing: -1)),
          ],
        ),
      ),
    );
  }

  Widget _miniIntelligenceStat(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: EdgeInsets.symmetric(vertical: 16.h),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(20.r),
          border: Border.all(color: color.withValues(alpha: 0.1)),
        ),
        child: Column(
          children: [
            Text(value, style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.w900, color: color)),
            SizedBox(height: 2.h),
            Text(label, style: TextStyle(fontSize: 8.sp, fontWeight: FontWeight.w900, color: color.withValues(alpha: 0.6), letterSpacing: 1)),
          ],
        ),
      ),
    );
  }

  Widget _adminTile(String schoolId, dynamic admin) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: EdgeInsets.all(16.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20.r),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: const Color(0xFFF1F5F9),
            child: Text(admin['name'][0].toUpperCase(), style: const TextStyle(color: Color(0xFF475569), fontWeight: FontWeight.w900)),
          ),
          SizedBox(width: 16.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(admin['name'], style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14.sp, color: const Color(0xFF0F172A))),
                Text('@${admin['username']}', style: TextStyle(fontSize: 10.sp, color: Colors.blue, fontWeight: FontWeight.w800, letterSpacing: 0.5)),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.remove_circle_outline_rounded, color: Color(0xFF94A3B8), size: 20),
            onPressed: () => _deleteSchoolAdmin(schoolId, admin['id']),
          ),
        ],
      ),
    );
  }

  Widget _emptyAdminTile() {
    return Container(
      padding: EdgeInsets.all(24.w),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(24.r),
        border: Border.all(color: const Color(0xFFF1F5F9), style: BorderStyle.none),
      ),
      child: Center(
        child: Column(
          children: [
            const Icon(Icons.shield_outlined, size: 24, color: Color(0xFFCBD5E1)),
            SizedBox(height: 8.h),
            Text('Wali ma jiraan maamulayaal loo qoondeeyey node-kan', style: TextStyle(fontSize: 10.sp, color: const Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  Widget _protocolAction(String label, IconData icon, Color bgColor, Color textColor, VoidCallback onTap) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        style: ElevatedButton.styleFrom(
          backgroundColor: bgColor,
          foregroundColor: textColor,
          elevation: 0,
          padding: EdgeInsets.symmetric(vertical: 18.h),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20.r)),
        ),
        icon: Icon(icon, size: 18),
        label: Text(label, style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11.sp, letterSpacing: 1.5)),
        onPressed: onTap,
      ),
    );
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Add-school overlay ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â mirrors web modal ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  Widget _buildAddSchoolOverlay() {
    return Material(
      color: Colors.transparent,
      child: GestureDetector(
      onTap: () => setState(() => _showAddSchool = false),
      child: Container(
        color: Colors.black.withValues(alpha: 0.6),
        child: Center(
          child: GestureDetector(
            onTap: () {},
            child: Container(
              margin: EdgeInsets.all(20.w),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(28.r),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Header ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â blue gradient matching web
                  Container(
                    padding: EdgeInsets.all(24.w),
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: AppTheme.primary,
                      borderRadius:
                          BorderRadius.vertical(top: Radius.circular(28.r)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                         Text(
                          'DIYAARINTA DUGSI CUSUB',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18.sp,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.5,
                          ),
                        ),
                        Text(
                          'Ku dar dugsi cusub nidaamka',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.7),
                            fontSize: 11.sp,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Form
                  Padding(
                    padding: EdgeInsets.all(24.w),
                    child: Column(
                      children: [
                         _formField(_nameCtrl, 'Magaca Dugsiga (WAA QASAB)',
                            'Ahmed Gurey Secondary School',
                            icon: Icons.school_rounded),
                        SizedBox(height: 12.h),
                        _formField(_codeCtrl, 'ShortCode-ka Dugsiga (WAA QASAB)',
                            'Tusaale: SCH001',
                            icon: Icons.key_rounded),
                        SizedBox(height: 12.h),
                        Row(children: [
                          Expanded(
                              child: _formField(
                                  _phoneCtrl, 'Talefoonka', '+252...',
                                  icon: Icons.phone_rounded)),
                          SizedBox(width: 12.w),
                          Expanded(
                              child: _formField(
                                  _emailCtrl, 'Email-ka Nidaamka', 'admin@school.so',
                                  icon: Icons.email_rounded)),
                        ]),
                        SizedBox(height: 12.h),
                        _formField(_addressCtrl, 'Cinwaanka / Meesha',
                            'Mogadishu, Somalia',
                            icon: Icons.location_on_rounded),
                        SizedBox(height: 16.h),
                        // Logo Picker
                        Text(
                          'LOGADA DUGSIGA',
                          style: TextStyle(
                            fontSize: 9.sp,
                            fontWeight: FontWeight.w900,
                            color: AppTheme.textSecondary,
                            letterSpacing: 1.5,
                          ),
                        ),
                        SizedBox(height: 8.h),
                        InkWell(
                          onTap: _pickLogo,
                          borderRadius: BorderRadius.circular(16.r),
                          child: Container(
                            height: 100.h,
                            width: double.infinity,
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(16.r),
                              border: Border.all(color: Colors.grey[200]!),
                            ),
                            child: _selectedLogo != null
                                ? ClipRRect(
                                    borderRadius: BorderRadius.circular(16.r),
                                    child: Image.file(
                                      File(_selectedLogo!.path),
                                      fit: BoxFit.contain,
                                    ),
                                  )
                                : (_editingSchool?['logo'] != null
                                    ? ClipRRect(
                                        borderRadius: BorderRadius.circular(16.r),
                                        child: CachedNetworkImage(
                                          imageUrl: '${ApiConfig.baseUrl.endsWith('/') ? ApiConfig.baseUrl.substring(0, ApiConfig.baseUrl.length - 1) : ApiConfig.baseUrl}${_editingSchool!['logo'].toString().startsWith('/') ? _editingSchool!['logo'] : '/${_editingSchool!['logo']}'}',
                                          fit: BoxFit.contain,
                                          placeholder: (context, url) => const Center(child: CircularProgressIndicator()),
                                          errorWidget: (context, url, error) => const Icon(Icons.add_photo_alternate_rounded, size: 40, color: Colors.grey),
                                        ),
                                      )
                                    : Column(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          const Icon(Icons.add_photo_alternate_rounded, size: 32, color: AppTheme.primary),
                                          SizedBox(height: 4.h),
                                          Text('Dooro Logada Dugsiga', style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w700, color: AppTheme.primary)),
                                        ],
                                      )),
                          ),
                        ),
                        SizedBox(height: 24.h),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                style: OutlinedButton.styleFrom(
                                  padding:
                                      EdgeInsets.symmetric(vertical: 16.h),
                                  shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(14.r)),
                                ),
                                onPressed: () {
                                  _editingSchool = null;
                                  setState(() => _showAddSchool = false);
                                },
                                child: const Text('Jooji',
                                    style:
                                        TextStyle(fontWeight: FontWeight.w800)),
                              ),
                            ),
                            SizedBox(width: 12.w),
                            Expanded(
                              flex: 2,
                              child: ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppTheme.primary,
                                  foregroundColor: Colors.white,
                                  padding:
                                      EdgeInsets.symmetric(vertical: 16.h),
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(14.r)),
                                ),
                                onPressed: _saving ? null : _addSchool,
                                child: Text(
                                  _saving
                                      ? 'Waa socotaa...'
                                      : (_editingSchool != null
                                          ? 'Kaydi Isbedelka'
                                          : 'Xaqiiji Dugsiga'),
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 0.5),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          ),
        ),
      ),
    );
  }

  Widget _formField(
      TextEditingController ctrl, String label, String placeholder,
      {IconData? icon}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: TextStyle(
            fontSize: 9.sp,
            fontWeight: FontWeight.w900,
            color: AppTheme.textSecondary,
            letterSpacing: 1.5,
          ),
        ),
        SizedBox(height: 6.h),
        TextField(
          controller: ctrl,
          decoration: InputDecoration(
            hintText: placeholder,
            prefixIcon: icon != null ? Icon(icon, size: 18) : null,
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14.r),
              borderSide: BorderSide.none,
            ),
            contentPadding:
                EdgeInsets.symmetric(horizontal: 16.w, vertical: 14.h),
          ),
        ),
      ],
    );
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ School impersonation ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  Future<void> _impersonateSchool(Map<String, dynamic> school,
      {bool fromModal = false}) async {
    try {
      await _auth.impersonateSchool(school['id']);
      if (mounted) {
        if (fromModal) Navigator.pop(context); // close bottom sheet if open
        AuthState().update(true, 'admin');
        GoRouter.of(context).go('/dashboard');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Waa lagu fashilmay: $e')),
        );
      }
    }
  }
}



