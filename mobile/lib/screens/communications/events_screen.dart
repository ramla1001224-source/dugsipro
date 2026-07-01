import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';

class EventsScreen extends StatefulWidget {
  const EventsScreen({super.key});
  @override
  State<EventsScreen> createState() => _EventsScreenState();
}

class _EventsScreenState extends State<EventsScreen> {
  final ApiService _api = ApiService();
  List<dynamic> _events = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.get(ApiConfig.events);
      if (mounted) {
        setState(() {
          _events = res.data is List ? res.data : (res.data['data'] ?? []);
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _deleteEvent(String id) async {
    final bool? confirm = await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Delete',
            style: TextStyle(fontWeight: FontWeight.w900)),
        content: const Text('Are you sure you want to delete this event?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('CANCEL')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('DELETE', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _api.delete('${ApiConfig.events}/$id');
        _load();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Error deleting event')));
        }
      }
    }
  }

  Future<void> _showAddEventModal() async {
    final titleCtrl = TextEditingController();
    final locationCtrl = TextEditingController();
    String type = 'event';
    DateTime selectedDate = DateTime.now();

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Add Event'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: titleCtrl,
                  decoration: InputDecoration(labelText: 'Title')),
              TextField(
                  controller: locationCtrl,
                  decoration: InputDecoration(labelText: 'Location')),
              SizedBox(height: 12.h),
              DropdownButtonFormField<String>(
                initialValue: type,
                decoration: InputDecoration(labelText: 'Type'),
                items: ['event', 'holiday', 'meeting']
                    .map((t) => DropdownMenuItem(
                        value: t, child: Text(t.toUpperCase())))
                    .toList(),
                onChanged: (v) {
                  if (v != null) setDialogState(() => type = v);
                },
              ),
              SizedBox(height: 12.h),
              Row(
                children: [
                  Text("Date: ${selectedDate.toString().split(' ').first}"),
                  const Spacer(),
                  TextButton(
                    onPressed: () async {
                      final d = await showDatePicker(
                        context: context,
                        initialDate: selectedDate,
                        firstDate: DateTime(2020),
                        lastDate: DateTime(2030),
                      );
                      if (d != null) setDialogState(() => selectedDate = d);
                    },
                    child: const Text('SELECT'),
                  ),
                ],
              ),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('CANCEL')),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('CREATE'),
            ),
          ],
        ),
      ),
    );

    if (ok == true && titleCtrl.text.isNotEmpty) {
      setState(() => _loading = true);
      try {
        await _api.post(ApiConfig.events, data: {
          'title': titleCtrl.text.trim(),
          'type': type,
          'location': locationCtrl.text.trim(),
          'startDate': selectedDate.toIso8601String(),
          'endDate': selectedDate.toIso8601String(),
        });
        _load();
      } catch (e) {
        if (mounted) {
          setState(() => _loading = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
                content: Text('Error: ${e.toString()}'),
                backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    int countEvent = _events.where((e) => e['type'] == 'event').length;
    int countHoliday = _events.where((e) => e['type'] == 'holiday').length;
    int countMeeting = _events.where((e) => e['type'] == 'meeting').length;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
        title: Text(
          'Events & Calendar',
          style: TextStyle(
              color: AppTheme.textPrimary,
              fontWeight: FontWeight.w900,
              fontSize: 18.sp),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddEventModal,
        backgroundColor: const Color(0xFF4F46E5),
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.all(16.w),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Events & Calendar',
                      style: TextStyle(
                          fontSize: 22.sp,
                          fontWeight: FontWeight.w900,
                          color: AppTheme.textPrimary,
                          letterSpacing: -0.5),
                    ),
                    SizedBox(height: 4.h),
                    Text(
                      'Manage school events and calendar',
                      style: TextStyle(
                          fontSize: 13.sp, color: AppTheme.textSecondary),
                    ),
                    SizedBox(height: 24.h),

                    // Callout Card
                    Container(
                      padding: EdgeInsets.all(24.w),
                      decoration: BoxDecoration(
                        color: const Color(0xFF4F46E5),
                        borderRadius: BorderRadius.circular(32.r),
                        boxShadow: [
                          BoxShadow(
                              color: const Color(0xFF4F46E5).withValues(alpha: 0.3),
                              blurRadius: 20.r,
                              offset: const Offset(0, 10))
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Modern School Management',
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 18.sp,
                                fontWeight: FontWeight.w900),
                          ),
                          SizedBox(height: 8.h),
                          Text(
                            'Plan and organize your school year with ease using our advanced calendar system.',
                            style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.8),
                                fontSize: 12.sp),
                          ),
                          SizedBox(height: 16.h),
                          Container(
                            padding: EdgeInsets.all(12.w),
                            decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(16.r)),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('COMING SOON',
                                    style: TextStyle(
                                        color: const Color(0xFFC7D2FE),
                                        fontSize: 9.sp,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 1.5)),
                                SizedBox(height: 4.h),
                                Text('Google Calendar Sync & SMS Notifications',
                                    style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 12.sp,
                                        fontWeight: FontWeight.bold)),
                              ],
                            ),
                          )
                        ],
                      ),
                    ),
                    SizedBox(height: 24.h),

                    // Stats
                    Container(
                      padding: EdgeInsets.all(24.w),
                      decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(32.r),
                          border: Border.all(color: const Color(0xFFF1F5F9))),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('EVENT TYPES',
                              style: TextStyle(
                                  fontSize: 11.sp,
                                  fontWeight: FontWeight.w900,
                                  color: AppTheme.textPrimary,
                                  letterSpacing: 1.5)),
                          SizedBox(height: 20.h),
                          _buildStatRow('General Event', countEvent,
                              const Color(0xFF6366F1)),
                          SizedBox(height: 16.h),
                          _buildStatRow('Holidays', countHoliday,
                              const Color(0xFFF43F5E)),
                          SizedBox(height: 16.h),
                          _buildStatRow('School Meetings', countMeeting,
                              const Color(0xFFF59E0B)),
                        ],
                      ),
                    ),
                    SizedBox(height: 24.h),

                    // Upcoming Events List
                    Container(
                      padding: EdgeInsets.all(24.w),
                      decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(32.r),
                          border: Border.all(color: const Color(0xFFF1F5F9))),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('UPCOMING EVENTS',
                                  style: TextStyle(
                                      fontSize: 14.sp,
                                      fontWeight: FontWeight.w900,
                                      color: AppTheme.textPrimary,
                                      letterSpacing: 0.5)),
                              Container(
                                padding: EdgeInsets.symmetric(
                                    horizontal: 12.w, vertical: 4.h),
                                decoration: BoxDecoration(
                                    color: const Color(0xFFF1F5F9),
                                    borderRadius: BorderRadius.circular(16.r)),
                                child: Text('${_events.length} TOTAL',
                                    style: TextStyle(
                                        color: AppTheme.textSecondary,
                                        fontSize: 9.sp,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 1)),
                              )
                            ],
                          ),
                          SizedBox(height: 24.h),
                          if (_events.isEmpty)
                            Padding(
                              padding: EdgeInsets.symmetric(vertical: 40.h),
                              child: Column(
                                children: [
                                  Text('📅',
                                      style: TextStyle(
                                          fontSize: 48.sp,
                                          color: const Color(0xFFCBD5E1))),
                                  SizedBox(height: 16.h),
                                  Text('No upcoming scheduled events',
                                      style: TextStyle(
                                          color: AppTheme.textSecondary,
                                          fontWeight: FontWeight.w800,
                                          fontSize: 13.sp,
                                          letterSpacing: 0.5)),
                                ],
                              ),
                            )
                          else
                            ..._events.map((e) {
                              final title = e['title']?.toString() ?? '';
                              final type = e['type']?.toString() ?? 'event';
                              final location = e['location']?.toString() ?? '';
                              final startDate = e['startDate'] != null
                                  ? DateTime.tryParse(e['startDate'].toString())
                                  : null;

                              Color iconColor;
                              Color iconBg;
                              if (type == 'holiday') {
                                iconColor = const Color(0xFFE11D48);
                                iconBg = const Color(0xFFFFE4E6);
                              } else if (type == 'meeting') {
                                iconColor = const Color(0xFFD97706);
                                iconBg = const Color(0xFFFEF3C7);
                              } else {
                                iconColor = const Color(0xFF4F46E5);
                                iconBg = const Color(0xFFE0E7FF);
                              }

                              String month = '';
                              String day = '';
                              String time = '';
                              if (startDate != null) {
                                const months = [
                                  'Jan',
                                  'Feb',
                                  'Mar',
                                  'Apr',
                                  'May',
                                  'Jun',
                                  'Jul',
                                  'Aug',
                                  'Sep',
                                  'Oct',
                                  'Nov',
                                  'Dec'
                                ];
                                month = months[startDate.month - 1];
                                day = startDate.day.toString();
                                time =
                                    "${startDate.hour.toString().padLeft(2, '0')}:${startDate.minute.toString().padLeft(2, '0')}";
                              }

                              return Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: Container(
                                  padding: EdgeInsets.all(16.w),
                                  decoration: BoxDecoration(
                                      color: const Color(0xFFF8FAFC),
                                      borderRadius: BorderRadius.circular(20.r),
                                      border: Border.all(
                                          color: const Color(0xFFF1F5F9))),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 50.w,
                                        height: 50.h,
                                        decoration: BoxDecoration(
                                            color: iconBg,
                                            borderRadius:
                                                BorderRadius.circular(14.r)),
                                        child: Column(
                                          mainAxisAlignment:
                                              MainAxisAlignment.center,
                                          children: [
                                            Text(month.toUpperCase(),
                                                style: TextStyle(
                                                    color: iconColor,
                                                    fontSize: 9.sp,
                                                    fontWeight:
                                                        FontWeight.w900)),
                                            Text(day,
                                                style: TextStyle(
                                                    color: iconColor,
                                                    fontSize: 18.sp,
                                                    fontWeight:
                                                        FontWeight.w900)),
                                          ],
                                        ),
                                      ),
                                      SizedBox(width: 16.w),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(title,
                                                style: TextStyle(
                                                    fontWeight: FontWeight.w900,
                                                    color: AppTheme.textPrimary,
                                                    fontSize: 13.sp,
                                                    letterSpacing: 0.5)),
                                            SizedBox(height: 6.h),
                                            Row(
                                              children: [
                                                const Icon(
                                                    Icons.access_time_rounded,
                                                    size: 10,
                                                    color:
                                                        AppTheme.textSecondary),
                                                SizedBox(width: 4.w),
                                                Text(time,
                                                    style: TextStyle(
                                                        fontSize: 10.sp,
                                                        fontWeight:
                                                            FontWeight.bold,
                                                        color: AppTheme
                                                            .textSecondary)),
                                                if (location.isNotEmpty) ...[
                                                  SizedBox(width: 8.w),
                                                  const Icon(
                                                      Icons.location_on_rounded,
                                                      size: 10,
                                                      color: AppTheme
                                                          .textSecondary),
                                                  SizedBox(width: 4.w),
                                                  Text(location,
                                                      style: TextStyle(
                                                          fontSize: 10.sp,
                                                          fontWeight:
                                                              FontWeight.bold,
                                                          color: AppTheme
                                                              .textSecondary)),
                                                ]
                                              ],
                                            )
                                          ],
                                        ),
                                      ),
                                      IconButton(
                                        icon: const Icon(
                                            Icons.delete_outline_rounded,
                                            color: Color(0xFFEF4444),
                                            size: 18),
                                        onPressed: () =>
                                            _deleteEvent(e['id'].toString()),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildStatRow(String label, int count, Color color) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Container(
                width: 8.w,
                height: 8.h,
                decoration:
                    BoxDecoration(color: color, shape: BoxShape.circle)),
            SizedBox(width: 12.w),
            Text(label,
                style: TextStyle(
                    fontSize: 11.sp,
                    fontWeight: FontWeight.w900,
                    color: AppTheme.textSecondary,
                    letterSpacing: 1.5)),
          ],
        ),
        Text(count.toString(),
            style: TextStyle(
                fontSize: 14.sp,
                fontWeight: FontWeight.w900,
                color: AppTheme.textPrimary)),
      ],
    );
  }
}

