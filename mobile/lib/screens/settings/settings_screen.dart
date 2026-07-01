import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../config/api_config.dart';
import '../../services/locale_service.dart';
import 'package:provider/provider.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final ApiService _api = ApiService();
  final AuthService _auth = AuthService();
  bool _loading = true;
  bool _saving = false;
  String _role = '';

  // System Settings
  Map<String, dynamic> _settings = {};
  List<dynamic> _gradingScale = [];

  // SMS Status (read-only for school admin)
  Map<String, dynamic>? _smsStatus;
  List<dynamic> _smsHistory = [];

  static const _monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  // Profile Settings (Non-admin)
  String _profileName = '';
  String _profileUsername = '';
  String _profilePhone = '';
  String _profilePassword = '';
  String _profileConfirmPassword = '';

  final List<String> _daysOfWeek = [
    'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  bool get _isAdmin => _role == 'admin' || _role == 'owner' || _role == 'super_admin';

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final role = await _auth.getRole() ?? '';
      _role = role;
      
      if (!_isAdmin) {
        final resProfile = await _api.get('/api/auth/profile');
        if (mounted) {
          setState(() {
            _profileName = resProfile.data['name'] ?? '';
            _profileUsername = resProfile.data['username'] ?? '';
            _profilePhone = resProfile.data['phone'] ?? '';
            _loading = false;
          });
        }
        return; // Stop loading system settings for non-admins
      }

      final resSettings = await _api.get(ApiConfig.settings);
      final resGrading = await _api.get("${ApiConfig.settings}/grading");

      // Fetch SMS status (non-blocking)
      _api.get('/api/sms/settings').then((smsRes) {
        if (mounted && smsRes.data is Map) {
          setState(() => _smsStatus = Map<String, dynamic>.from(smsRes.data));
        }
      }).catchError((_) {});
      _api.get('/api/sms/usage-history').then((histRes) {
        if (mounted && histRes.data is List) {
          setState(() => _smsHistory = histRes.data);
        }
      }).catchError((_) {});
      
      if (mounted) {
        setState(() {
          _settings = resSettings.data is Map ? resSettings.data : {};
          final grads = resGrading.data is List ? resGrading.data : [];
          _gradingScale = grads.isNotEmpty ? grads : [
            {'grade': 'A', 'minScore': 90, 'maxScore': 100, 'gpa': 4.0},
            {'grade': 'B+', 'minScore': 85, 'maxScore': 89, 'gpa': 3.5},
            {'grade': 'B', 'minScore': 80, 'maxScore': 84, 'gpa': 3.0},
            {'grade': 'C+', 'minScore': 75, 'maxScore': 79, 'gpa': 2.5},
            {'grade': 'C', 'minScore': 70, 'maxScore': 74, 'gpa': 2.0},
            {'grade': 'D', 'minScore': 60, 'maxScore': 69, 'gpa': 1.0},
            {'grade': 'F', 'minScore': 0, 'maxScore': 59, 'gpa': 0},
          ];
          _loading = false;
        });
      }
    } catch (_) {
      // Create defaults if API fails
      if (mounted) {
        setState(() {
          _gradingScale = [
            {'grade': 'A', 'minScore': 90, 'maxScore': 100, 'gpa': 4.0},
            {'grade': 'B+', 'minScore': 85, 'maxScore': 89, 'gpa': 3.5},
            {'grade': 'B', 'minScore': 80, 'maxScore': 84, 'gpa': 3.0},
            {'grade': 'C+', 'minScore': 75, 'maxScore': 79, 'gpa': 2.5},
            {'grade': 'C', 'minScore': 70, 'maxScore': 74, 'gpa': 2.0},
            {'grade': 'D', 'minScore': 60, 'maxScore': 69, 'gpa': 1.0},
            {'grade': 'F', 'minScore': 0, 'maxScore': 59, 'gpa': 0},
          ];
          _loading = false;
        });
      }
    }
  }

  Future<void> _saveSettings() async {
    if (_saving) return;
    
    if (!_isAdmin) {
      if (_profilePassword.isNotEmpty && _profilePassword != _profileConfirmPassword) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Passwords do not match'), backgroundColor: Colors.red),
        );
        return;
      }
      
      setState(() => _saving = true);
      try {
        await _api.put('/api/auth/profile', data: {
          'name': _profileName,
          'username': _profileUsername,
          'phone': _profilePhone,
          if (_profilePassword.isNotEmpty) 'password': _profilePassword,
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Profile updated successfully!'), backgroundColor: Colors.green),
          );
          setState(() {
            _profilePassword = '';
            _profileConfirmPassword = '';
          });
        }
      } catch (_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Error updating profile'), backgroundColor: Colors.red),
          );
        }
      } finally {
        if (mounted) setState(() => _saving = false);
      }
      return;
    }

    setState(() => _saving = true);
    try {
      await _api.put(ApiConfig.settings, data: _settings);
      await _api.post("${ApiConfig.settings}/grading", data: {'scales': _gradingScale});
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Settings saved successfully!'), backgroundColor: Colors.green),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error saving settings'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _buildTextField(String key, String label, String placeholder, {TextInputType type = TextInputType.text}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.bold, color: AppTheme.textSecondary, letterSpacing: 1.5)),
          SizedBox(height: 8.h),
          TextFormField(
            initialValue: _settings[key]?.toString() ?? '',
            keyboardType: type,
            onChanged: (val) => _settings[key] = val,
            style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
            decoration: InputDecoration(
              hintText: placeholder,
              hintStyle: TextStyle(color: AppTheme.textSecondary.withValues(alpha: 0.5)),
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(16.r), borderSide: BorderSide.none),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16.r), borderSide: BorderSide(color: Color(0xFF64748B), width: 2.w)),
              contentPadding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 16.h),
            ),
          ),
        ],
      ),
    );
  }

  List<String> _getWorkingDays() {
    if (_settings['timetable_days'] != null && _settings['timetable_days'].toString().isNotEmpty) {
      try {
        final List<dynamic> parsed = jsonDecode(_settings['timetable_days']);
        return parsed.map((e) => e.toString()).toList();
      } catch (_) {}
    }
    return ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  }

  @override
  Widget build(BuildContext context) {
    final localeProvider = Provider.of<LocaleProvider>(context);
    final t = localeProvider.t;

    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (!_isAdmin) {
      return Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          iconTheme: const IconThemeData(color: AppTheme.textPrimary),
          title: Text(t('settings'), style: TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w900, fontSize: 18.sp)),
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 16, top: 10, bottom: 10),
              child: ElevatedButton(
                onPressed: _saving ? null : _saveSettings,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.success,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
                  elevation: 0,
                  padding: EdgeInsets.symmetric(horizontal: 20.w),
                ),
                child: _saving
                    ? SizedBox(width: 16.w, height: 16.h, child: const CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(t('save').toUpperCase(), style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13.sp, letterSpacing: 1)),
              ),
            )
          ],
        ),
        body: _buildProfileSettingsBody(),
      );
    }

    final workingDays = _getWorkingDays();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
        title: Text(t('settings'), style: TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w900, fontSize: 18.sp)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16, top: 10, bottom: 10),
            child: ElevatedButton(
              onPressed: _saving ? null : _saveSettings,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.success,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
                elevation: 0,
                padding: EdgeInsets.symmetric(horizontal: 20.w),
              ),
              child: _saving
                  ? SizedBox(width: 16.w, height: 16.h, child: const CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(t('save').toUpperCase(), style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13.sp, letterSpacing: 1)),
            ),
          )
        ],
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Language Toggle Section
            Container(
              padding: EdgeInsets.all(24.w),
              margin: const EdgeInsets.only(bottom: 24),
              decoration: BoxDecoration(
                color: Colors.white, 
                borderRadius: BorderRadius.circular(32.r), 
                border: Border.all(color: const Color(0xFFF1F5F9))
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                   Text(t('language'), style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w900, color: AppTheme.textPrimary)),
                   SizedBox(height: 20.h),
                   Row(
                     children: [
                       _buildLangOption(
                         label: t('somali'),
                         isActive: localeProvider.locale.languageCode == 'so',
                         onTap: () => localeProvider.setLocale(const Locale('so')),
                       ),
                       SizedBox(width: 12.w),
                       _buildLangOption(
                         label: t('english'),
                         isActive: localeProvider.locale.languageCode == 'en',
                         onTap: () => localeProvider.setLocale(const Locale('en')),
                       ),
                     ],
                   ),
                ],
              ),
            ),
            Text(
              t('settings'),
              style: TextStyle(fontSize: 22.sp, fontWeight: FontWeight.w900, color: AppTheme.textPrimary, letterSpacing: -0.5),
            ),
            SizedBox(height: 4.h),
            Text(
              'Configure school profile and preferences',
              style: TextStyle(fontSize: 13.sp, color: AppTheme.textSecondary),
            ),
            SizedBox(height: 24.h),

            // Profile Section
            Container(
              padding: EdgeInsets.all(24.w),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32.r), border: Border.all(color: const Color(0xFFF1F5F9))),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('School Profile', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w900, color: AppTheme.textPrimary)),
                  SizedBox(height: 20.h),
                  _buildTextField('school_name', 'SCHOOL NAME', 'Dugsi Pro Academy'),
                  _buildTextField('school_motto', 'MOTTO', 'Excellence in Education'),
                  _buildTextField('tuition_fee', 'TUITION FEE (\$)', '50', type: TextInputType.number),
                  _buildTextField('school_address', 'ADDRESS', '123 Education Street'),
                  _buildTextField('school_phone', 'PHONE', '+1 234 567 8900', type: TextInputType.phone),
                  _buildTextField('school_email', 'EMAIL', 'info@school.edu', type: TextInputType.emailAddress),
                  _buildTextField('principal_name', "PRINCIPAL'S NAME", 'Dr. John Smith'),
                ],
              ),
            ),
            SizedBox(height: 24.h),

            // Timetable Section
            Container(
              padding: EdgeInsets.all(24.w),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32.r), border: Border.all(color: const Color(0xFFF1F5F9))),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Timetable Configuration', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w900, color: AppTheme.textPrimary)),
                  SizedBox(height: 20.h),
                  
                  Text('WORKING DAYS', style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.bold, color: AppTheme.textSecondary, letterSpacing: 1.5)),
                  SizedBox(height: 12.h),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _daysOfWeek.map((day) {
                      final isActive = workingDays.contains(day);
                      return GestureDetector(
                        onTap: () {
                          setState(() {
                            if (isActive) {
                              workingDays.remove(day);
                            } else {
                              workingDays.add(day);
                            }
                            _settings['timetable_days'] = jsonEncode(workingDays);
                          });
                        },
                        child: Container(
                          padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 10.h),
                          decoration: BoxDecoration(
                            color: isActive ? const Color(0xFFF0FDFA) : const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(12.r),
                            border: Border.all(color: isActive ? const Color(0xFF99F6E4) : Colors.transparent, width: 2.w),
                          ),
                          child: Text(
                            day.substring(0, 3),
                            style: TextStyle(
                              fontSize: 12.sp,
                              fontWeight: FontWeight.bold,
                              color: isActive ? const Color(0xFF0D9488) : AppTheme.textSecondary,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  SizedBox(height: 20.h),

                  Row(
                    children: [
                      Expanded(child: _buildTextField('timetable_start', 'START TIME', '08:00')),
                      SizedBox(width: 16.w),
                      Expanded(child: _buildTextField('timetable_duration', 'PERIOD DURATION (MIN)', '45', type: TextInputType.number)),
                    ],
                  ),
                  Row(
                    children: [
                      Expanded(child: _buildTextField('timetable_break_after', 'BREAK AFTER PERIOD', '3', type: TextInputType.number)),
                      SizedBox(width: 16.w),
                      Expanded(child: _buildTextField('timetable_break_duration', 'BREAK DURATION (MIN)', '30', type: TextInputType.number)),
                    ],
                  ),
                ],
              ),
            ),
            SizedBox(height: 24.h),

            // Grading Scale
            Container(
              padding: EdgeInsets.all(24.w),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32.r), border: Border.all(color: const Color(0xFFF1F5F9))),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Grading Scale', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w900, color: AppTheme.textPrimary)),
                      ElevatedButton(
                        onPressed: _saving ? null : () async {
                          setState(() => _saving = true);
                          try {
                            await _api.post("${ApiConfig.settings}/grading", data: {'scales': _gradingScale});
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Grading Scale saved successfully!'), backgroundColor: Colors.green),
                              );
                            }
                          } catch (_) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Error saving grading scale'), backgroundColor: Colors.red),
                              );
                            }
                          } finally {
                            if (mounted) setState(() => _saving = false);
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF4F46E5),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
                          elevation: 0,
                          padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: _saving
                            ? SizedBox(width: 12.w, height: 12.h, child: const CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : Text('SAVE SCALE', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 10.sp, letterSpacing: 1)),
                      ),
                    ],
                  ),
                  SizedBox(height: 20.h),
                  
                  Row(
                    children: [
                      Expanded(child: Text('GRADE', style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.bold, color: AppTheme.textSecondary, letterSpacing: 1.5))),
                      Expanded(child: Text('MIN %', textAlign: TextAlign.center, style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.bold, color: AppTheme.textSecondary, letterSpacing: 1.5))),
                      Expanded(child: Text('MAX %', textAlign: TextAlign.center, style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.bold, color: AppTheme.textSecondary, letterSpacing: 1.5))),
                      Expanded(child: Text('GPA', textAlign: TextAlign.center, style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.bold, color: AppTheme.textSecondary, letterSpacing: 1.5))),
                    ],
                  ),
                  SizedBox(height: 12.h),
                  
                  ...List.generate(_gradingScale.length, (i) {
                    final g = _gradingScale[i];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          Expanded(
                            flex: 2,
                            child: _buildGridInput(g['grade']?.toString() ?? '', (v) => _gradingScale[i]['grade'] = v),
                          ),
                          SizedBox(width: 8.w),
                          Expanded(
                            flex: 2,
                            child: _buildGridInput(g['minScore']?.toString() ?? '', (v) => _gradingScale[i]['minScore'] = int.tryParse(v) ?? 0, type: TextInputType.number),
                          ),
                          SizedBox(width: 8.w),
                          Expanded(
                            flex: 2,
                            child: _buildGridInput(g['maxScore']?.toString() ?? '', (v) => _gradingScale[i]['maxScore'] = int.tryParse(v) ?? 0, type: TextInputType.number),
                          ),
                          SizedBox(width: 8.w),
                          Expanded(
                            flex: 2,
                            child: _buildGridInput(g['gpa']?.toString() ?? '', (v) => _gradingScale[i]['gpa'] = double.tryParse(v) ?? 0.0, type: const TextInputType.numberWithOptions(decimal: true)),
                          ),
                          SizedBox(width: 8.w),
                          IconButton(
                            onPressed: () => setState(() => _gradingScale.removeAt(i)),
                            icon: const Icon(Icons.close, color: Colors.red, size: 20),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                          ),
                        ],
                      ),
                    );
                  }),
                  SizedBox(height: 12.h),
                  TextButton.icon(
                    onPressed: () => setState(() => _gradingScale.add({'grade': '', 'minScore': 0, 'maxScore': 0, 'gpa': 0})),
                    icon: const Icon(Icons.add_circle_outline, size: 18),
                    label: Text('ADD GRADE LEVEL', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11.sp, letterSpacing: 1)),
                    style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFF6366F1),
                      padding: EdgeInsets.symmetric(vertical: 12.h),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r), side: BorderSide(color: Colors.indigo.withValues(alpha: 0.1))),
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(height: 24.h),

            // SMS Status Section (read-only)
            Container(
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
                    children: [
                      const Icon(Icons.sms_rounded, size: 20, color: Colors.blue),
                      SizedBox(width: 10.w),
                      Text('SMS Notifications', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w900, color: AppTheme.textPrimary)),
                      const Spacer(),
                      Container(
                        padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
                        decoration: BoxDecoration(
                          color: Colors.grey[100],
                          borderRadius: BorderRadius.circular(8.r),
                        ),
                        child: Text('READ ONLY', style: TextStyle(fontSize: 8.sp, fontWeight: FontWeight.w900, color: AppTheme.textSecondary, letterSpacing: 1)),
                      ),
                    ],
                  ),
                  SizedBox(height: 16.h),
                  // Status card
                  Container(
                    padding: EdgeInsets.all(14.w),
                    decoration: BoxDecoration(
                      color: (_smsStatus?['isActive'] == true)
                          ? const Color(0xFFEFF6FF)
                          : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(16.r),
                      border: Border.all(
                        color: (_smsStatus?['isActive'] == true)
                            ? const Color(0xFFBFDBFE)
                            : const Color(0xFFE2E8F0),
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          (_smsStatus?['isActive'] == true) ? Icons.lock_open_rounded : Icons.lock_rounded,
                          color: (_smsStatus?['isActive'] == true) ? Colors.blue : Colors.grey,
                          size: 24,
                        ),
                        SizedBox(width: 12.w),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                (_smsStatus?['isActive'] == true) ? 'SMS Authorized' : 'SMS Restricted',
                                style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 14.sp,
                                  color: (_smsStatus?['isActive'] == true) ? Colors.blue : Colors.grey,
                                ),
                              ),
                              SizedBox(height: 2.h),
                              Text(
                                (_smsStatus?['isActive'] == true)
                                    ? 'Owner wuu ogolaaday â€” Farriimaha waa la diri karaa'
                                    : 'Owner wuxuu xidey â€” Xiriir la galo si loo furo',
                                style: TextStyle(fontSize: 10.sp, color: AppTheme.textSecondary, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ),
                        Column(
                          children: [
                            Text(
                              '${_smsStatus?['monthlyCount'] ?? 0}',
                              style: TextStyle(
                                fontWeight: FontWeight.w900,
                                fontSize: 20.sp,
                                color: (_smsStatus?['isActive'] == true) ? Colors.blue : Colors.grey,
                              ),
                            ),
                            Text('This Month', style: TextStyle(fontSize: 8.sp, fontWeight: FontWeight.w700, color: AppTheme.textSecondary)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: 16.h),
                  // History Chart
                  if (_smsHistory.isNotEmpty) ...[
                    Text('HISTORY â€” 6 BILOOD', style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: AppTheme.textSecondary, letterSpacing: 1.5)),
                    SizedBox(height: 12.h),
                    ...() {
                      final displayed = _smsHistory.take(6).toList();
                      final maxVal = displayed.map<int>((h) => (h['count'] as num? ?? 0).toInt()).fold(0, (a, b) => a > b ? a : b);
                      final safeMax = maxVal > 0 ? maxVal : 1;
                      return displayed.asMap().entries.map<Widget>((entry) {
                        final idx = entry.key;
                        final item = entry.value;
                        final int count = (item['count'] as num? ?? 0).toInt();
                        final int month = (item['month'] as num? ?? 1).toInt();
                        final double frac = count / safeMax;
                        final bool isCurrent = idx == 0;
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            children: [
                              SizedBox(
                                width: 28.w,
                                child: Text(
                                  _monthNames[month - 1],
                                  style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.w800, color: AppTheme.textSecondary),
                                  textAlign: TextAlign.right,
                                ),
                              ),
                              SizedBox(width: 8.w),
                              Expanded(
                                child: Stack(
                                  children: [
                                    Container(height: 20.h, decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(6.r))),
                                    FractionallySizedBox(
                                      widthFactor: frac < 0.04 ? 0.04 : frac,
                                      child: Container(
                                        height: 20.h,
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            colors: isCurrent
                                                ? [const Color(0xFF6366F1), const Color(0xFF4F46E5)]
                                                : [const Color(0xFFCBD5E1), const Color(0xFFE2E8F0)],
                                          ),
                                          borderRadius: BorderRadius.circular(6.r),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              SizedBox(width: 8.w),
                              SizedBox(
                                width: 28.w,
                                child: Text(
                                  '$count',
                                  textAlign: TextAlign.right,
                                  style: TextStyle(
                                    fontSize: 10.sp,
                                    fontWeight: FontWeight.w900,
                                    color: isCurrent ? const Color(0xFF4F46E5) : AppTheme.textSecondary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      }).toList();
                    }(),
                    Divider(color: Color(0xFFF1F5F9), height: 16.h),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Wadarta oo dhan', style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w800, color: AppTheme.textSecondary)),
                        Text(
                          '${_smsHistory.fold<int>(0, (sum, h) => sum + ((h['count'] as num? ?? 0).toInt()))} SMS',
                          style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w900, color: AppTheme.textPrimary),
                        ),
                      ],
                    ),
                  ] else
                    Center(
                      child: Padding(
                        padding: EdgeInsets.symmetric(vertical: 12.h),
                        child: Text('Wali SMS la ma dirin', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12.sp)),
                      ),
                    ),
                ],
              ),
            ),

            SizedBox(height: 80.h),
          ],
        ),
      ),
    );
  }

  Widget _buildGridInput(String value, Function(String) onChanged, {TextInputType type = TextInputType.text}) {
    return TextFormField(
      initialValue: value,
      keyboardType: type,
      onChanged: onChanged,
      textAlign: TextAlign.center,
      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.sp, color: AppTheme.textPrimary),
      decoration: InputDecoration(
        filled: true,
        fillColor: Colors.white,
        contentPadding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 12.h),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r), borderSide: BorderSide(color: Color(0xFF1E293B), width: 2.w)),
      ),
    );
  }

  Widget _buildProfileSettingsBody() {
    final localeProvider = Provider.of<LocaleProvider>(context);
    final t = localeProvider.t;

    return SingleChildScrollView(
      padding: EdgeInsets.all(16.w),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            t('settings'),
            style: TextStyle(fontSize: 22.sp, fontWeight: FontWeight.w900, color: AppTheme.textPrimary, letterSpacing: -0.5),
          ),
          SizedBox(height: 4.h),
          Text(
            t('configure_school_profile').toUpperCase(),
            style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.bold, color: AppTheme.textSecondary.withValues(alpha: 0.8), letterSpacing: 1.5),
          ),
          SizedBox(height: 24.h),

          // â”€â”€ Language Switcher â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          Container(
            padding: EdgeInsets.all(24.w),
            margin: const EdgeInsets.only(bottom: 24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(32.r),
              border: Border.all(color: const Color(0xFFF1F5F9)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(t('language'), style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w900, color: AppTheme.textPrimary)),
                SizedBox(height: 20.h),
                Row(
                  children: [
                    _buildLangOption(
                      label: t('somali'),
                      isActive: localeProvider.locale.languageCode == 'so',
                      onTap: () => localeProvider.setLocale(const Locale('so')),
                    ),
                    SizedBox(width: 12.w),
                    _buildLangOption(
                      label: t('english'),
                      isActive: localeProvider.locale.languageCode == 'en',
                      onTap: () => localeProvider.setLocale(const Locale('en')),
                    ),
                  ],
                ),
              ],
            ),
          ),

          Container(
            padding: EdgeInsets.all(24.w),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32.r), border: Border.all(color: const Color(0xFFF1F5F9))),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildProfileField('Full Name', _profileName, (v) => _profileName = v, readOnly: true),
                _buildProfileField('Username', _profileUsername, (v) => _profileUsername = v, readOnly: true),
                _buildProfileField('Phone Number', _profilePhone, (v) => _profilePhone = v, readOnly: true),
                SizedBox(height: 16.h),
                const Divider(color: Color(0xFFF1F5F9)),
                SizedBox(height: 24.h),
                Text('SECURITY UPDATE', style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.bold, color: AppTheme.textPrimary, letterSpacing: 1.5)),
                SizedBox(height: 16.h),
                _buildProfileField('New Password', _profilePassword, (v) => _profilePassword = v, isPassword: true, hint: 'Leave blank to keep current'),
                _buildProfileField('Confirm Password', _profileConfirmPassword, (v) => _profileConfirmPassword = v, isPassword: true, hint: 'Repeat new password'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProfileField(String label, String value, Function(String) onChanged, {bool isPassword = false, String? hint, bool readOnly = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: AppTheme.textSecondary, letterSpacing: 1.5)),
          SizedBox(height: 8.h),
          TextFormField(
            initialValue: value,
            obscureText: isPassword,
            onChanged: onChanged,
            readOnly: readOnly,
            style: TextStyle(
              fontWeight: FontWeight.bold, 
              color: readOnly ? AppTheme.textSecondary : AppTheme.textPrimary
            ),
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: TextStyle(color: AppTheme.textSecondary.withValues(alpha: 0.5)),
              filled: true,
              fillColor: readOnly ? const Color(0xFFF1F5F9) : const Color(0xFFF8FAFC),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(16.r), borderSide: BorderSide.none),
              focusedBorder: readOnly ? OutlineInputBorder(borderRadius: BorderRadius.circular(16.r), borderSide: BorderSide.none) : OutlineInputBorder(borderRadius: BorderRadius.circular(16.r), borderSide: BorderSide(color: Color(0xFF64748B), width: 2.w)),
              contentPadding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 16.h),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLangOption({required String label, required bool isActive, required VoidCallback onTap}) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: EdgeInsets.symmetric(vertical: 16.h),
          decoration: BoxDecoration(
            color: isActive ? const Color(0xFFF0FDFA) : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(16.r),
            border: Border.all(color: isActive ? const Color(0xFF99F6E4) : Colors.transparent, width: 2.w),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 14.sp,
              color: isActive ? const Color(0xFF0D9488) : AppTheme.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}


