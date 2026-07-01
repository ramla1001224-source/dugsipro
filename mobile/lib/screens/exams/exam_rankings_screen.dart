import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../../services/api_service.dart';
import '../../config/api_config.dart';
import '../../main.dart';

class ExamRankingsScreen extends StatefulWidget {
  const ExamRankingsScreen({super.key});

  @override
  State<ExamRankingsScreen> createState() => _ExamRankingsScreenState();
}

class _ExamRankingsScreenState extends State<ExamRankingsScreen> {
  final ApiService _api = ApiService();
  
  List<dynamic> _rankings = [];
  List<dynamic> _classes = [];
  List<dynamic> _sections = [];
  List<dynamic> _academicYears = [];
  
  String? _selectedYearId;
  String? _selectedClassId;
  String? _selectedSectionId;
  String _sortOrder = 'desc';
  bool _loading = false;
  bool _initialLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchInitialData();
  }

  Future<void> _fetchInitialData() async {
    setState(() => _initialLoading = true);
    try {
      final yearsRes = await _api.get(ApiConfig.academicYears);
      final classesRes = await _api.get(ApiConfig.classes);
      
      final years = yearsRes.data is List ? yearsRes.data : (yearsRes.data['data'] ?? []);
      final classes = classesRes.data is List ? classesRes.data : (classesRes.data['data'] ?? []);
      
      String? currentYearId;
      for (var y in years) {
        if (y['isCurrent'] == true) {
          currentYearId = y['id'].toString();
          break;
        }
      }

      setState(() {
        _academicYears = years;
        _classes = classes;
        _selectedYearId = currentYearId;
        _initialLoading = false;
      });
      
      if (_selectedYearId != null && _classes.isNotEmpty) {
        _selectedClassId = _classes[0]['id'].toString();
        _fetchSections(_selectedClassId!);
        _fetchRankings();
      }
    } catch (e) {
      setState(() {
        _initialLoading = false;
        _error = 'Error loading filters: ${e.toString()}';
      });
    }
  }

  Future<void> _fetchSections(String classId) async {
    try {
      final res = await _api.get('${ApiConfig.sections}?classId=$classId');
      setState(() {
        _sections = res.data is List ? res.data : (res.data['data'] ?? []);
        _selectedSectionId = null;
      });
    } catch (e) {
      debugPrint('Error fetching sections: $e');
    }
  }

  Future<void> _fetchRankings() async {
    if (_selectedYearId == null || _selectedClassId == null) return;
    
    setState(() {
      _loading = true;
      _error = null;
    });
    
    try {
      String url = '${ApiConfig.exams}/rankings?academicYearId=$_selectedYearId&classId=$_selectedClassId&order=$_sortOrder';
      if (_selectedSectionId != null && _selectedSectionId!.isNotEmpty) {
        url += '&sectionId=$_selectedSectionId';
      }
      
      final res = await _api.get(url);
      setState(() {
        _rankings = res.data is List ? res.data : [];
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _error = 'Error fetching rankings: ${e.toString()}';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
        title: Text(
          _sortOrder == 'desc' ? 'Top 10 Rankings' : 'Bottom 10 Rankings',
          style: TextStyle(
            color: AppTheme.textPrimary,
            fontWeight: FontWeight.w900,
            fontSize: 18.sp,
          ),
        ),
      ),
      body: _initialLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                _buildFilters(),
                Expanded(
                  child: _loading
                      ? const Center(child: CircularProgressIndicator())
                      : _error != null
                          ? _buildErrorState()
                          : _rankings.isEmpty
                              ? _buildEmptyState()
                              : _buildRankingList(),
                ),
              ],
            ),
    );
  }

  Widget _buildFilters() {
    return Container(
      color: Colors.white,
      padding: EdgeInsets.all(16.w),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _buildDropdown(
                  label: 'YEAR',
                  value: _selectedYearId,
                  items: _academicYears.map((y) => DropdownMenuItem(
                    value: y['id'].toString(),
                    child: Text(y['name'].toString().toUpperCase()),
                  )).toList(),
                  onChanged: (val) {
                    setState(() => _selectedYearId = val);
                    _fetchRankings();
                  },
                ),
              ),
              SizedBox(width: 12.w),
              Expanded(
                child: _buildDropdown(
                  label: 'ORDER',
                  value: _sortOrder,
                  items: [
                    DropdownMenuItem(value: 'desc', child: Text('TOP 10')),
                    DropdownMenuItem(value: 'asc', child: Text('BOTTOM 10')),
                  ],
                  onChanged: (val) {
                    setState(() => _sortOrder = val!);
                    _fetchRankings();
                  },
                ),
              ),
            ],
          ),
          SizedBox(height: 12.h),
          Row(
            children: [
              Expanded(
                child: _buildDropdown(
                  label: 'CLASS',
                  value: _selectedClassId,
                  items: _classes.map((c) => DropdownMenuItem(
                    value: c['id'].toString(),
                    child: Text(c['class_name'].toString().toUpperCase()),
                  )).toList(),
                  onChanged: (val) {
                    setState(() {
                      _selectedClassId = val;
                      _sections = [];
                      _selectedSectionId = null;
                    });
                    if (val != null) _fetchSections(val);
                    _fetchRankings();
                  },
                ),
              ),
              SizedBox(width: 12.w),
              Expanded(
                child: _buildDropdown(
                  label: 'SECTION',
                  value: _selectedSectionId,
                  items: [
                    DropdownMenuItem(value: null, child: Text('ALL SECTIONS')),
                    ..._sections.map((s) => DropdownMenuItem(
                      value: s['id'].toString(),
                      child: Text(s['name'].toString().toUpperCase()),
                    )),
                  ],
                  onChanged: (val) {
                    setState(() => _selectedSectionId = val);
                    _fetchRankings();
                  },
                ),
              ),
            ],
          ),
          SizedBox(height: 12.h),
          Container(
            padding: EdgeInsets.all(12.w),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF7ED),
              borderRadius: BorderRadius.circular(12.r),
              border: Border.all(color: const Color(0xFFFFEDD5)),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline_rounded,
                    color: Color(0xFFEA580C), size: 16),
                SizedBox(width: 8.w),
                Expanded(
                  child: Text(
                    'Natiijadan waxaa lagu xisaabiyay imtixaanada Grading, Published ama Locked.',
                    style: TextStyle(
                      fontSize: 10.sp,
                      color: const Color(0xFF9A3412),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDropdown({
    required String label,
    required dynamic value,
    required List<DropdownMenuItem<dynamic>> items,
    required Function(dynamic) onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 10.sp,
            fontWeight: FontWeight.w900,
            color: AppTheme.textSecondary,
            letterSpacing: 1,
          ),
        ),
        SizedBox(height: 6.h),
        Container(
          padding: EdgeInsets.symmetric(horizontal: 12.w),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(12.r),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<dynamic>(
              isExpanded: true,
              value: value,
              items: items,
              onChanged: onChanged,
              icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 20),
              style: TextStyle(
                fontSize: 12.sp,
                fontWeight: FontWeight.w700,
                color: AppTheme.textPrimary,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildRankingList() {
    return ListView.builder(
      padding: EdgeInsets.all(16.w),
      itemCount: _rankings.length,
      itemBuilder: (context, index) {
        final r = _rankings[index];
        final percentage = ((r['totalMarks'] / r['possibleMarks']) * 100).toStringAsFixed(1);
        final isTop3 = index < 3 && _sortOrder == 'desc';
        
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: EdgeInsets.all(16.w),
          decoration: BoxDecoration(
            color: isTop3 ? Colors.indigo.withValues(alpha: 0.05) : Colors.white,
            borderRadius: BorderRadius.circular(20.r),
            border: Border.all(
              color: isTop3 ? Colors.indigo.withValues(alpha: 0.2) : const Color(0xFFF1F5F9),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 40.w,
                height: 40.h,
                decoration: BoxDecoration(
                  color: isTop3 ? Colors.indigo : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(12.r),
                ),
                alignment: Alignment.center,
                child: Text(
                  '${index + 1}',
                  style: TextStyle(
                    color: isTop3 ? Colors.white : AppTheme.textSecondary,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              SizedBox(width: 16.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      r['name'] ?? 'Unknown',
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 14.sp,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    Text(
                      'ID: ${r['student_id']}',
                      style: TextStyle(
                        fontSize: 11.sp,
                        color: AppTheme.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '${r['totalMarks']}/${r['possibleMarks']}',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 14.sp,
                      color: const Color(0xFF4F46E5),
                    ),
                  ),
                  Text(
                    '$percentage%',
                    style: TextStyle(
                      fontSize: 11.sp,
                      fontWeight: FontWeight.w900,
                      color: double.parse(percentage) >= 50 ? Colors.green : Colors.red,
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text('📱‰', style: TextStyle(fontSize: 48.sp)),
          SizedBox(height: 16.h),
          const Text(
            'NO RANKINGS FOUND',
            style: TextStyle(
              fontWeight: FontWeight.w900,
              color: AppTheme.textSecondary,
              letterSpacing: 1,
            ),
          ),
          SizedBox(height: 8.h),
          Text(
            'Ensure exams are published for this period.',
            style: TextStyle(fontSize: 12.sp, color: AppTheme.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(20.w),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline_rounded, color: Colors.red, size: 48),
            SizedBox(height: 16.h),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.red, fontWeight: FontWeight.w600),
            ),
            SizedBox(height: 24.h),
            ElevatedButton(
              onPressed: _fetchRankings,
              child: const Text('RETRY'),
            ),
          ],
        ),
      ),
    );
  }
}

