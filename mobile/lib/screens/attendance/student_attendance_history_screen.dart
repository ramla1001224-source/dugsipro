import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';

class StudentAttendanceHistoryScreen extends StatefulWidget {
  const StudentAttendanceHistoryScreen({super.key});

  @override
  State<StudentAttendanceHistoryScreen> createState() => _StudentAttendanceHistoryScreenState();
}

class _StudentAttendanceHistoryScreenState extends State<StudentAttendanceHistoryScreen> {
  final ApiService _api = ApiService();
  
  List<dynamic> _attendance = [];
  bool _loading = true;
  DateTime? _startDate;
  DateTime? _endDate;
  String? _selectedSession;
  
  final List<String> _sessions = ['Break 1', 'Break 2'];

  @override
  void initState() {
    super.initState();
    // Default to last 30 days
    _endDate = DateTime.now();
    _startDate = DateTime.now().subtract(const Duration(days: 30));
    _loadAttendance();
  }

  Future<void> _loadAttendance() async {
    setState(() => _loading = true);
    try {
      final Map<String, dynamic> params = {};
      if (_startDate != null) {
        params['startDate'] = _startDate!.toIso8601String().substring(0, 10);
      }
      if (_endDate != null) {
        params['endDate'] = _endDate!.toIso8601String().substring(0, 10);
      }
      if (_selectedSession != null) {
        params['session'] = _selectedSession;
      }

      final res = await _api.get(ApiConfig.attendance, params: params);
      if (mounted) {
        setState(() {
          _attendance = res.data is List ? res.data : (res.data['data'] ?? []);
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error loading attendance history')),
        );
      }
    }
  }

  Future<void> _selectDateRange() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(DateTime.now().year),
      lastDate: DateTime.now(),
      initialDateRange: (_startDate != null && _endDate != null)
          ? DateTimeRange(start: _startDate!, end: _endDate!)
          : null,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppTheme.primary,
              onPrimary: Colors.white,
              onSurface: AppTheme.textPrimary,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _startDate = picked.start;
        _endDate = picked.end;
      });
      _loadAttendance();
    }
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'present':
        return const Color(0xFF10B981);
      case 'absent':
        return const Color(0xFFEF4444);
      case 'late':
        return const Color(0xFFF59E0B);
      case 'excused':
        return const Color(0xFF3B82F6);
      default:
        return AppTheme.textSecondary;
    }
  }

  Widget _buildStatCard(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: EdgeInsets.symmetric(vertical: 12.h, horizontal: 4.w),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(12.r),
          border: Border.all(color: color.withValues(alpha: 0.1)),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                color: color,
                fontSize: 16.sp,
                fontWeight: FontWeight.w900,
              ),
            ),
            SizedBox(height: 2.h),
            Text(
              label,
              style: TextStyle(
                color: color.withValues(alpha: 0.6),
                fontSize: 9.sp,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('My Attendance History'),
      ),
      body: Column(
        children: [
          Container(
            margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            padding: EdgeInsets.all(16.w),
            decoration: BoxDecoration(
              color: const Color(0xFFF59E0B).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(16.r),
              border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline_rounded, color: Color(0xFFD97706), size: 20),
                SizedBox(width: 12.w),
                Expanded(
                  child: Text(
                    'Xogta imaanshaha sanadaha hore waa la kaydiyaa (archived). Kaliya sanadka hadda socda ayaa la heli karaa.',
                    style: TextStyle(
                      color: const Color(0xFF92400E),
                      fontSize: 10.sp,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ),
          ),
          // Filter Bar
          Container(
            padding: EdgeInsets.all(16.w),
            color: Colors.white,
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: _selectDateRange,
                        child: Container(
                          padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 12.h),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(12.r),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.calendar_today_rounded, size: 16, color: AppTheme.textSecondary),
                              SizedBox(width: 8.w),
                              Expanded(
                                child: Text(
                                  (_startDate != null && _endDate != null)
                                      ? '${_startDate!.day}/${_startDate!.month} - ${_endDate!.day}/${_endDate!.month}'
                                      : 'Select Date Range',
                                  style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.bold),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    SizedBox(width: 8.w),
                    Container(
                      padding: EdgeInsets.symmetric(horizontal: 12.w),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(12.r),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _selectedSession,
                          hint: Text('Session', style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.bold)),
                          items: [
                            DropdownMenuItem(value: null, child: Text('All')),
                            ..._sessions.map((s) => DropdownMenuItem(value: s, child: Text(s))),
                          ],
                          onChanged: (v) {
                            setState(() => _selectedSession = v);
                            _loadAttendance();
                          },
                        ),
                      ),
                    ),
                    if (_startDate != null || _selectedSession != null) ...[
                      SizedBox(width: 8.w),
                      IconButton(
                        onPressed: () {
                          setState(() {
                            _startDate = DateTime.now().subtract(const Duration(days: 30));
                            _endDate = DateTime.now();
                            _selectedSession = null;
                          });
                          _loadAttendance();
                        },
                        icon: const Icon(Icons.refresh_rounded, color: AppTheme.primary),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),

          // Summary Stats (Like Web)
          if (!_loading && _attendance.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Row(
                children: [
                  _buildStatCard('Total', _attendance.length.toString(), Colors.blueGrey),
                  SizedBox(width: 8.w),
                  _buildStatCard('Present', _attendance.where((a) => a['status']?.toString().toLowerCase() == 'present').length.toString(), Colors.green),
                  SizedBox(width: 8.w),
                  _buildStatCard('Absent', _attendance.where((a) => a['status']?.toString().toLowerCase() == 'absent').length.toString(), Colors.red),
                  SizedBox(width: 8.w),
                  _buildStatCard('Late', _attendance.where((a) => a['status']?.toString().toLowerCase() == 'late').length.toString(), Colors.amber),
                ],
              ),
            ),
          
          
          // List
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _attendance.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.event_note_rounded, size: 64, color: AppTheme.textSecondary.withValues(alpha: 0.2)),
                            SizedBox(height: 16.h),
                            const Text(
                              'No records found',
                              style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textSecondary),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: EdgeInsets.all(16.w),
                        itemCount: _attendance.length,
                        itemBuilder: (context, i) {
                          final a = _attendance[i];
                          final date = DateTime.tryParse(a['date']?.toString() ?? '')?.toLocal();
                          final dateStr = date != null ? '${date.day}/${date.month}/${date.year}' : 'N/A';
                          final status = a['status']?.toString() ?? 'N/A';
                          final color = _statusColor(status);
                          
                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            padding: EdgeInsets.all(16.w),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16.r),
                              border: Border.all(color: const Color(0xFFF1F5F9)),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: EdgeInsets.all(10.w),
                                  decoration: BoxDecoration(
                                    color: color.withValues(alpha: 0.1),
                                    shape: BoxShape.circle,
                                  ),
                                  child: Icon(
                                    status.toLowerCase() == 'present' ? Icons.check_rounded : Icons.close_rounded,
                                    color: color,
                                    size: 20,
                                  ),
                                ),
                                SizedBox(width: 16.w),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '${a['session']?.toString().toUpperCase() ?? 'CLASS'} (${a['shift']?.toString().toUpperCase() ?? ''})',
                                        style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13.sp),
                                      ),
                                      SizedBox(height: 4.h),
                                      Text(
                                        dateStr,
                                        style: TextStyle(fontSize: 12.sp, color: AppTheme.textSecondary),
                                      ),
                                    ],
                                  ),
                                ),
                                Container(
                                  padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
                                  decoration: BoxDecoration(
                                    color: color.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(12.r),
                                  ),
                                  child: Text(
                                    status.toUpperCase(),
                                    style: TextStyle(
                                      color: color,
                                      fontWeight: FontWeight.w900,
                                      fontSize: 10.sp,
                                      letterSpacing: 0.5,
                                    ),
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
  }
}

