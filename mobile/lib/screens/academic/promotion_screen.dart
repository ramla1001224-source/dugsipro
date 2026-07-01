import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../config/api_config.dart';

class PromotionScreen extends StatefulWidget {
  const PromotionScreen({super.key});

  @override
  State<PromotionScreen> createState() => _PromotionScreenState();
}

class _PromotionScreenState extends State<PromotionScreen> {
  final ApiService _api = ApiService();
  bool _loading = false;
  bool _submitting = false;
  bool _previewLoading = false;

  List<dynamic> _academicYears = [];
  List<dynamic> _classes = [];

  int _currentStep = 0; // 0: Setup, 1: Preview, 2: Success

  String? _selectedSourceYearId;
  String? _targetYearId;
  
  // Mapping detail: fromClassId -> { 'schoolId': '', 'classId': '', 'sectionId': '' }
  Map<String, Map<String, String>> _mappings = {}; 

  List<dynamic> _managedSchools = [];
  final Map<String, List<dynamic>> _schoolClassesCache = {};
  final Map<String, List<dynamic>> _classSectionsCache = {};
  final Map<String, bool> _loadingRemoteData = {}; // keyed by schoolId or classId

  // Per-student decisions: enrollmentId -> { action, targetClassId, targetSectionId, targetSchoolId }
  List<dynamic> _previewStudents = [];
  Map<String, Map<String, dynamic>> _studentDecisions = {};

  // Filters for step 2
  String _filterAction = 'all'; // 'all' | 'promote' | 'retain' | 'graduate'
  String _filterClass = 'all';  // classId or 'all'

  Map<String, dynamic>? _promotionResult;

  @override
  void initState() {
    super.initState();
    _fetchInitialData();
  }

  Future<void> _fetchInitialData() async {
    setState(() => _loading = true);
    try {
      final yearsRes = await _api.get(ApiConfig.academicYears);
      final classesRes = await _api.get(ApiConfig.classes);
      final schoolsRes = await _api.get(ApiConfig.schools);

      if (mounted) {
        final years = yearsRes.data is List ? yearsRes.data : (yearsRes.data['data'] ?? []);
        final classes = classesRes.data is List ? classesRes.data : (classesRes.data['data'] ?? []);
        final schools = schoolsRes.data is List ? schoolsRes.data : (schoolsRes.data['data'] ?? []);
        
        setState(() {
          _academicYears = years;
          _classes = classes;
          _managedSchools = schools;
          _schoolClassesCache['local'] = classes;
          _loading = false;
          _autoMapClasses();
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadClassesForSchool(String schoolId) async {
    if (schoolId == 'local') return;
    if (_schoolClassesCache.containsKey(schoolId)) return;
    
    setState(() => _loadingRemoteData[schoolId] = true);
    try {
      final res = await _api.get(ApiConfig.classes, params: {'schoolId': schoolId});
      final data = res.data is List ? res.data : (res.data['data'] ?? []);
      if (mounted) {
        setState(() {
          _schoolClassesCache[schoolId] = data;
          _loadingRemoteData[schoolId] = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loadingRemoteData[schoolId] = false);
    }
  }

  Future<void> _loadSectionsForClass(String classId, String schoolId) async {
    final key = '${schoolId}_$classId';
    if (_classSectionsCache.containsKey(key)) return;
    
    setState(() => _loadingRemoteData[key] = true);
    try {
      final res = await _api.get(ApiConfig.sections, params: {'classId': classId, 'schoolId': schoolId == 'local' ? null : schoolId});
      final data = res.data is List ? res.data : (res.data['data'] ?? []);
      if (mounted) {
        setState(() {
          _classSectionsCache[key] = data;
          _loadingRemoteData[key] = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loadingRemoteData[key] = false);
    }
  }

  void _autoMapClasses() {
    final Map<String, Map<String, String>> mapping = {};
    for (int i = 0; i < _classes.length; i++) {
      final cid = _classes[i]['id'].toString();
      if (i + 1 < _classes.length) {
        mapping[cid] = {
            'targetSchoolId': 'local',
            'targetClassId': _classes[i + 1]['id'].toString(),
            'targetSectionId': '',
        };
      } else {
        mapping[cid] = {
            'targetSchoolId': 'local',
            'targetClassId': 'graduate',
            'targetSectionId': '',
        };
      }
    }
    setState(() => _mappings = mapping);
  }

  String _className(dynamic cls) =>
      (cls['class_name'] ?? cls['name'] ?? 'Fasal').toString();

  int _countByAction(String action) {
    if (action == 'all') return _studentDecisions.length;
    return _studentDecisions.values.where((d) => (d['action'] ?? 'retain') == action).length;
  }

  List<dynamic> get _filteredStudents {
    return _previewStudents.where((s) {
      final eid = s['enrollmentId'].toString();
      final dec = _studentDecisions[eid];
      final actionMatch = _filterAction == 'all' || (dec?['action'] ?? 'retain') == _filterAction;
      final classMatch = _filterClass == 'all' || s['currentClassId'].toString() == _filterClass;
      return actionMatch && classMatch;
    }).toList();
  }

  Future<void> _generatePreview() async {
    if (_selectedSourceYearId == null || _targetYearId == null) {
      _showSnack('Fadlan dooro Source Year iyo Target Year labadaba', Colors.orange);
      return;
    }
    
    final mappedList = _mappings.entries
        .where((e) => e.value['targetClassId'] != null)
        .map((e) {
            final detail = e.value;
            return {
                'fromClassId': e.key,
                'toClassId': detail['targetClassId'],
                'toSectionId': detail['targetSectionId'],
                'targetSchoolId': detail['targetSchoolId'] == 'local' ? null : detail['targetSchoolId'],
            };
        })
        .toList();

    if (mappedList.isEmpty) {
      _showSnack('Fasal kasta u dooro fasalka xiga!', Colors.orange);
      return;
    }

    setState(() => _previewLoading = true);
    try {
      final res = await _api.post(
        ApiConfig.promotePreview.replaceAll('{id}', _selectedSourceYearId!),
        data: {'classMappings': mappedList, 'targetYearId': _targetYearId},
      );

      final students = List<dynamic>.from(res.data['preview'] ?? []);
      final Map<String, Map<String, dynamic>> decisions = {};
      for (final s in students) {
        final eid = s['enrollmentId'].toString();
        final suggested = (s['suggestedAction'] ?? 'retain').toString();
        decisions[eid] = {
          'action': suggested,
          'targetClassId': (s['targetClassId'] ?? s['currentClassId'] ?? '').toString(),
          'targetSectionId': (s['targetSectionId'] ?? '').toString(),
          'targetSchoolId': (s['targetSchoolId'] ?? '').toString(),
        };
      }

      if (mounted) {
        setState(() {
          _previewStudents = students;
          _studentDecisions = decisions;
          _filterAction = 'all';
          _filterClass = 'all';
          _currentStep = 1;
          _previewLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _previewLoading = false);
        _showSnack('Qalad: ${e.toString()}', Colors.red);
      }
    }
  }

  Future<void> _publishPromotions() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20.r)),
        title: const Text('Xaqiiji Promotion', style: TextStyle(fontWeight: FontWeight.w900)),
        content: Text(
          'Ma hubtaa? Tani waa ficil aan dib loo celin karin. Sanadkii hore waa la xirayaa.',
          style: TextStyle(fontSize: 14.sp),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Jooji')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.success, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r))),
            child: const Text('Xaqiiji & Fur', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _submitting = true);
    try {
      final decisionList = _previewStudents.map((s) {
        final eid = s['enrollmentId'].toString();
        final dec = _studentDecisions[eid];
        final action = dec?['action'] ?? 'retain';
        final targetClassId = action == 'graduate'
            ? 'graduate'
            : (dec?['targetClassId'] ?? s['currentClassId'] ?? '').toString();
            
        return {
          'enrollmentId': s['enrollmentId'],
          'studentId': s['studentId'],
          'action': action,
          'targetClassId': targetClassId,
          'targetSectionId': dec?['targetSectionId'],
          'targetSchoolId': dec?['targetSchoolId'] == 'local' ? null : dec?['targetSchoolId'],
        };
      }).toList();

      final res = await _api.post(
        ApiConfig.promotePublish.replaceAll('{id}', _selectedSourceYearId!),
        data: {'targetYearId': _targetYearId, 'studentDecisions': decisionList},
      );

      if (mounted) {
        setState(() {
          _promotionResult = res.data;
          _currentStep = 2;
          _submitting = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        _showSnack('Qalad: ${e.toString()}', Colors.red);
      }
    }
  }

  void _showSnack(String msg, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg, style: const TextStyle(fontWeight: FontWeight.bold)), backgroundColor: color, behavior: SnackBarBehavior.floating),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text('Arday Promote', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18.sp)),
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1.h, color: const Color(0xFFF1F5F9)),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                _buildStepperHeader(),
                Expanded(
                  child: _currentStep == 0
                      ? _buildStep1Setup()
                      : _currentStep == 1
                          ? _buildStep2Preview()
                          : _buildStep3Success(),
                ),
              ],
            ),
      bottomNavigationBar: _buildBottomBar(),
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ STEPPER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Widget _buildStepperHeader() {
    final steps = [
      {'label': 'Qorsheynta', 'icon': Icons.tune_rounded},
      {'label': 'Dib u Eeg', 'icon': Icons.preview_rounded},
      {'label': 'Dhammaad', 'icon': Icons.check_circle_rounded},
    ];
    return Container(
      color: Colors.white,
      padding: EdgeInsets.symmetric(vertical: 14.h, horizontal: 24.w),
      child: Row(
        children: List.generate(steps.length * 2 - 1, (i) {
          if (i.isOdd) {
            final stepIdx = i ~/ 2;
            final active = _currentStep > stepIdx;
            return Expanded(
              child: Container(
                height: 2.h,
                margin: const EdgeInsets.only(bottom: 18),
                decoration: BoxDecoration(
                  gradient: active
                      ? const LinearGradient(colors: [AppTheme.primary, Color(0xFF6366F1)])
                      : null,
                  color: active ? null : const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2.r),
                ),
              ),
            );
          }
          final idx = i ~/ 2;
          final step = steps[idx];
          final active = _currentStep >= idx;
          final done = _currentStep > idx;
          return Column(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                width: 36.w, height: 36.h,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: active ? AppTheme.primary : const Color(0xFFF1F5F9),
                  boxShadow: active ? [BoxShadow(color: AppTheme.primary.withValues(alpha: 0.3), blurRadius: 8.r, spreadRadius: 1)] : [],
                ),
                child: Icon(
                  done ? Icons.check_rounded : step['icon'] as IconData,
                  size: 18,
                  color: active ? Colors.white : const Color(0xFF94A3B8),
                ),
              ),
              SizedBox(height: 6.h),
              Text(
                step['label'] as String,
                style: TextStyle(
                  fontSize: 10.sp,
                  fontWeight: FontWeight.w800,
                  color: active ? AppTheme.primary : const Color(0xFF94A3B8),
                  letterSpacing: 0.3,
                ),
              ),
            ],
          );
        }),
      ),
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ STEP 1: SETUP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Widget _buildStep1Setup() {
    return SingleChildScrollView(
      padding: EdgeInsets.all(16.w),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Source Year
          _sectionLabel('1ï¸âƒ£  Sanadka La Xirayaa (Source Year)'),
          SizedBox(height: 8.h),
          _dropdown(
            hint: '-- Dooro Sanadka La Xirayaa --',
            value: _selectedSourceYearId,
            items: _academicYears.map((y) => DropdownMenuItem(
              value: y['id'].toString(),
              child: Row(children: [
                Icon(Icons.calendar_today_rounded, size: 16, color: _selectedSourceYearId == y['id'].toString() ? AppTheme.primary : Colors.grey),
                SizedBox(width: 10.w),
                Text(y['name'] ?? 'Year', style: const TextStyle(fontWeight: FontWeight.bold)),
                if (y['isCurrent'] == true) ...[
                  SizedBox(width: 8.w),
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 2.h),
                    decoration: BoxDecoration(color: AppTheme.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6.r)),
                    child: Text('Hadda', style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.w900, color: AppTheme.primary)),
                  ),
                ],
              ]),
            )).toList(),
            onChanged: (v) => setState(() => _selectedSourceYearId = v),
          ),
          SizedBox(height: 20.h),

          // Target Year
          _sectionLabel('2ï¸âƒ£  Sanadka Cusub (Target Year)'),
          SizedBox(height: 8.h),
          _dropdown(
            hint: '-- Dooro Sanadka Cusub --',
            value: _targetYearId,
            items: () {
              final futureYears = _academicYears.where((y) {
                if (y['id'].toString() == _selectedSourceYearId) return false;
                if (y['isCurrent'] == true) return false;
                try {
                  final endDate = DateTime.parse(y['endDate'].toString());
                  return endDate.isAfter(DateTime.now());
                } catch (_) {
                  return true;
                }
              }).toList();
              
              // Sort future years chronologically
              futureYears.sort((a, b) {
                final startA = DateTime.tryParse(a['startDate']?.toString() ?? '') ?? DateTime(0);
                final startB = DateTime.tryParse(b['startDate']?.toString() ?? '') ?? DateTime(0);
                return startA.compareTo(startB);
              });

              return futureYears.map((y) => DropdownMenuItem(
                value: y['id'].toString(),
                child: Text(y['name'] ?? 'Year', style: const TextStyle(fontWeight: FontWeight.bold)),
              )).toList();
            }(),
            onChanged: (v) => setState(() => _targetYearId = v),
          ),
          SizedBox(height: 28.h),

          // Class Mappings
          _sectionLabel('3ï¸âƒ£  U dooro Dugsiga, Fasalka, iyo Section-ka xiga'),
          SizedBox(height: 12.h),
          ..._classes.asMap().entries.map((entry) {
            final idx = entry.key;
            final cls = entry.value;
            final cid = cls['id'].toString();
            
            final mapping = _mappings[cid] ?? {
                'targetSchoolId': 'local',
                'targetClassId': 'graduate',
                'targetSectionId': ''
            };
            
            final String targetSchoolId = mapping['targetSchoolId'] ?? 'local';
            final String targetClassId = mapping['targetClassId'] ?? '';
            
            final isGraduate = targetClassId == 'graduate';
            
            final remoteClasses = _schoolClassesCache[targetSchoolId] ?? [];

            return Container(
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20.r),
                border: Border.all(
                  color: isGraduate ? Colors.amber.shade200 : (targetClassId.isNotEmpty ? const Color(0xFF34D399) : const Color(0xFFE2E8F0)),
                  width: 1.5.w,
                ),
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 12.r, offset: const Offset(0, 4))],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
                    decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.vertical(top: Radius.circular(19.r)),
                        border: Border(bottom: BorderSide(color: Colors.grey.shade100))
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 28.w, height: 28.h,
                          decoration: BoxDecoration(color: AppTheme.primary, borderRadius: BorderRadius.circular(8.r)),
                          child: Center(child: Text('${idx + 1}', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12.sp))),
                        ),
                        SizedBox(width: 12.w),
                        Text(_className(cls), style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15.sp)),
                        const Spacer(),
                        Text('Fasalka Hadda', style: TextStyle(fontSize: 10.sp, color: AppTheme.textSecondary, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                  
                  Padding(
                    padding: EdgeInsets.all(16.w),
                    child: Column(
                      children: [
                        // School Selection
                        _mappingSelector(
                          label: 'Dugsiga (Destination School)',
                          icon: Icons.business_rounded,
                          value: targetSchoolId,
                          items: [
                            DropdownMenuItem(value: 'local', child: Text('ðŸ  Local (Dugsigan)', style: TextStyle(fontWeight: FontWeight.bold))),
                            ..._managedSchools.map((s) => DropdownMenuItem(
                                value: s['id'].toString(),
                                child: Text('ðŸ¢ ${s['name']}', overflow: TextOverflow.ellipsis),
                            )),
                          ],
                          onChanged: (v) {
                             if (v == null) return;
                             setState(() {
                               _mappings[cid]!['targetSchoolId'] = v;
                               _mappings[cid]!['targetClassId'] = '';
                               _mappings[cid]!['targetSectionId'] = '';
                             });
                             if (v != 'local') _loadClassesForSchool(v);
                          },
                        ),
                        SizedBox(height: 12.h),

                        // Class Selection
                        _mappingSelector(
                          label: 'Fasalka (Target Class)',
                          icon: Icons.class_outlined,
                          isLoading: _loadingRemoteData[targetSchoolId] == true,
                          value: targetClassId.isEmpty ? null : targetClassId,
                          items: [
                            ...remoteClasses.map((tc) => DropdownMenuItem(
                                value: tc['id'].toString(),
                                child: Text(_className(tc)),
                            )),
                            DropdownMenuItem(
                                value: 'graduate',
                                child: Text('🎓 Qalin-jabi (Graduate)', style: TextStyle(color: Colors.amber, fontWeight: FontWeight.bold)),
                            ),
                          ],
                          onChanged: (v) {
                             if (v == null) return;
                             setState(() {
                               _mappings[cid]!['targetClassId'] = v;
                               _mappings[cid]!['targetSectionId'] = '';
                             });
                             if (v != 'graduate') _loadSectionsForClass(v, targetSchoolId);
                          },
                        ),

                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),

          SizedBox(height: 16.h),
          Container(
            padding: EdgeInsets.all(14.w),
            decoration: BoxDecoration(
              color: Colors.amber.shade50,
              borderRadius: BorderRadius.circular(14.r),
              border: Border.all(color: Colors.amber.shade200),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('âš ï¸', style: TextStyle(fontSize: 18.sp)),
                SizedBox(width: 10.w),
                Expanded(
                  child: Text(
                    'Kadib waxaad arki doontaa ardayda kasta oo leh natiijadooda. Waxaad badeli kartaa go\'aanka ardayda kasta ka hor inta aadan xaqiijin.',
                    style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w600, color: const Color(0xFF92400E)),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: 80.h),
        ],
      ),
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ STEP 2: PREVIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Widget _buildStep2Preview() {
    final filtered = _filteredStudents;
    return Column(
      children: [
        // Stats Bar
        Container(
          color: Colors.white,
          padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
          child: Row(
            children: [
              _statPill('Dhammaan', _previewStudents.length, const Color(0xFF64748B), const Color(0xFFF1F5F9)),
              SizedBox(width: 8.w),
              _statPill('â¬† Promote', _countByAction('promote'), AppTheme.success, const Color(0xFFD1FAE5)),
              SizedBox(width: 8.w),
              _statPill('â¸ Retain', _countByAction('retain'), AppTheme.danger, const Color(0xFFFEE2E2)),
              SizedBox(width: 8.w),
              _statPill('🎓 Graduate', _countByAction('graduate'), Colors.amber.shade700, Colors.amber.shade50),
            ],
          ),
        ),

        // Filter bar
        Container(
          color: const Color(0xFFF8FAFC),
          padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 10.h),
          child: Row(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _filterChip('Dhammaan', 'all'),
                      SizedBox(width: 6.w),
                      _filterChip('â¬† Promote', 'promote'),
                      SizedBox(width: 6.w),
                      _filterChip('â¸ Retain', 'retain'),
                      SizedBox(width: 6.w),
                      _filterChip('🎓 Graduate', 'graduate'),
                    ],
                  ),
                ),
              ),
              SizedBox(width: 8.w),
              // Class filter dropdown
              Container(
                padding: EdgeInsets.symmetric(horizontal: 10.w),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10.r),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _filterClass,
                    isDense: true,
                    style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
                    items: [
                      DropdownMenuItem(value: 'all', child: Text('Fasalka Dhamaan')),
                      ..._previewStudents
                          .map((s) => s['currentClassId'].toString())
                          .toSet()
                          .map((cid) {
                        final cls = _classes.firstWhere((c) => c['id'].toString() == cid, orElse: () => {'class_name': cid});
                        return DropdownMenuItem(value: cid, child: Text(_className(cls)));
                      }),
                    ],
                    onChanged: (v) => setState(() => _filterClass = v ?? 'all'),
                  ),
                ),
              ),
            ],
          ),
        ),

        // Table Header
        ColoredBox(
          color: Colors.white,
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
            child: Row(
              children: [
                Expanded(flex: 3, child: Text('ARDAYGA', style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.w900, color: AppTheme.textSecondary, letterSpacing: 0.8))),
                SizedBox(width: 8.w),
                Text('SCORE', style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.w900, color: AppTheme.textSecondary, letterSpacing: 0.8)),
                SizedBox(width: 8.w),
                Text('NATIIJADA', style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.w900, color: AppTheme.textSecondary, letterSpacing: 0.8)),
                SizedBox(width: 8.w),
                SizedBox(width: 110.w, child: Text("GO'AANKA", textAlign: TextAlign.center, style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.w900, color: AppTheme.textSecondary, letterSpacing: 0.8))),
              ],
            ),
          ),
        ),
        ColoredBox(color: const Color(0xFFF1F5F9), child: SizedBox(height: 1.h)),

        // Student List
        Expanded(
          child: filtered.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('🔍', style: TextStyle(fontSize: 40.sp)),
                      SizedBox(height: 12.h),
                      const Text('Arday kuma helin fiilerkan', style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textSecondary)),
                    ],
                  ),
                )
              : ListView.separated(
                  padding: EdgeInsets.symmetric(vertical: 4.h),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => Container(height: 1.h, color: const Color(0xFFF8FAFC)),
                  itemBuilder: (ctx, i) {
                    final s = filtered[i];
                    final eid = s['enrollmentId'].toString();
                    final dec = _studentDecisions[eid] ?? {'action': 'retain', 'targetClassId': ''};
                    final action = dec['action'] ?? 'retain';
                    final pct = s['percentage'] as int? ?? 0;
                    final pass = pct >= 50;

                    Color rowBg = Colors.white;
                    if (action == 'retain') rowBg = const Color(0xFFFFF5F5);
                    if (action == 'graduate') rowBg = const Color(0xFFFFFBEB);

                    return Container(
                      color: rowBg,
                      padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 10.h),
                      child: Row(
                        children: [
                          // Student info
                          Expanded(
                            flex: 3,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(s['studentName'] ?? 'Unknown',
                                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.sp, color: AppTheme.textPrimary),
                                    overflow: TextOverflow.ellipsis),
                                SizedBox(height: 2.h),
                                Text(
                                  '${s['currentClassName'] ?? ''} • ${s['student_id'] ?? ''}',
                                  style: TextStyle(fontSize: 10.sp, color: AppTheme.textSecondary, fontWeight: FontWeight.w600),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          SizedBox(width: 8.w),
                          // Score
                          SizedBox(
                            width: 44.w,
                            child: Text(
                              '$pct%',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontWeight: FontWeight.w900,
                                fontSize: 15.sp,
                                color: pct >= 70
                                    ? AppTheme.success
                                    : pct >= 50
                                        ? const Color(0xFF3B82F6)
                                        : AppTheme.danger,
                              ),
                            ),
                          ),
                          SizedBox(width: 8.w),
                          // Pass/Fail badge
                          Container(
                            padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
                            decoration: BoxDecoration(
                              color: pass ? const Color(0xFFD1FAE5) : const Color(0xFFFEE2E2),
                              borderRadius: BorderRadius.circular(8.r),
                            ),
                            child: Text(
                              pass ? '✅ Baasay' : 'âŒ Fashalay',
                              style: TextStyle(
                                fontSize: 9.sp,
                                fontWeight: FontWeight.w900,
                                color: pass ? AppTheme.success : AppTheme.danger,
                              ),
                            ),
                          ),
                          SizedBox(width: 8.w),
                          // Action dropdown
                          SizedBox(
                            width: 110.w,
                            child: Container(
                              padding: EdgeInsets.symmetric(horizontal: 8.w),
                              decoration: BoxDecoration(
                                color: action == 'promote'
                                    ? const Color(0xFFD1FAE5)
                                    : action == 'graduate'
                                        ? Colors.amber.shade50
                                        : const Color(0xFFFEE2E2),
                                borderRadius: BorderRadius.circular(10.r),
                                border: Border.all(
                                  color: action == 'promote'
                                      ? AppTheme.success
                                      : action == 'graduate'
                                          ? Colors.amber.shade400
                                          : AppTheme.danger,
                                  width: 1.2.w,
                                ),
                              ),
                              child: DropdownButtonHideUnderline(
                                child: DropdownButton<String>(
                                  value: action,
                                  isExpanded: true,
                                  isDense: true,
                                  style: TextStyle(
                                    fontSize: 11.sp,
                                    fontWeight: FontWeight.w800,
                                    color: action == 'promote'
                                        ? AppTheme.success
                                        : action == 'graduate'
                                            ? Colors.amber.shade700
                                            : AppTheme.danger,
                                  ),
                                  items: [
                                    DropdownMenuItem(value: 'promote', child: Text('â¬†ï¸ Promote')),
                                    DropdownMenuItem(value: 'retain', child: Text('â¸ Retain')),
                                    DropdownMenuItem(value: 'graduate', child: Text('🎓 Graduate')),
                                  ],
                                  onChanged: (v) {
                                    if (v == null) return;
                                    final mapping = _mappings[s['currentClassId'].toString()]?['targetClassId'];
                                    setState(() {
                                      _studentDecisions[eid] = {
                                        'action': v,
                                        'targetClassId': v == 'graduate'
                                            ? 'graduate'
                                            : v == 'retain'
                                                ? s['currentClassId'].toString()
                                                : (mapping ?? s['currentClassId'].toString()),
                                      };
                                    });
                                  },
                                ),
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
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ STEP 3: SUCCESS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Widget _buildStep3Success() {
    final promoted = _countByAction('promote');
    final retained = _countByAction('retain');
    final graduated = _countByAction('graduate');

    return Center(
      child: SingleChildScrollView(
        padding: EdgeInsets.all(28.w),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.5, end: 1.0),
              duration: const Duration(milliseconds: 600),
              curve: Curves.elasticOut,
              builder: (_, val, child) => Transform.scale(scale: val, child: child),
              child: Container(
                width: 100.w, height: 100.h,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [Color(0xFF10B981), Color(0xFF34D399)]),
                  shape: BoxShape.circle,
                  boxShadow: [BoxShadow(color: AppTheme.success.withValues(alpha: 0.4), blurRadius: 24.r, spreadRadius: 4)],
                ),
                child: const Icon(Icons.check_rounded, size: 52, color: Colors.white),
              ),
            ),
            SizedBox(height: 24.h),
            Text('Si Guul leh Dhammaaday!', style: TextStyle(fontSize: 24.sp, fontWeight: FontWeight.w900, color: AppTheme.textPrimary)),
            SizedBox(height: 8.h),
            Text(
              _promotionResult?['message'] ?? '',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 14.sp, fontWeight: FontWeight.w600),
            ),
            SizedBox(height: 28.h),

            // Result Cards
            Row(
              children: [
                if (promoted > 0) Expanded(child: _resultCard('â¬†ï¸ Promote', promoted, const Color(0xFFD1FAE5), AppTheme.success)),
                if (promoted > 0 && retained > 0) SizedBox(width: 10.w),
                if (retained > 0) Expanded(child: _resultCard('â¸ Retain', retained, const Color(0xFFFEE2E2), AppTheme.danger)),
                if ((promoted > 0 || retained > 0) && graduated > 0) SizedBox(width: 10.w),
                if (graduated > 0) Expanded(child: _resultCard('🎓 Graduate', graduated, Colors.amber.shade50, Colors.amber.shade700)),
              ],
            ),
            SizedBox(height: 20.h),

            Container(
              width: double.infinity,
              padding: EdgeInsets.all(16.w),
              decoration: BoxDecoration(
                color: const Color(0xFFEEF2FF),
                borderRadius: BorderRadius.circular(16.r),
                border: Border.all(color: const Color(0xFFC7D2FE)),
              ),
              child: Column(
                children: [
                  Text('✅ Sanadka Cusub', style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w900, color: AppTheme.primary)),
                  SizedBox(height: 4.h),
                  Text(
                    _promotionResult?['targetYear'] ?? '',
                    style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.w900, color: AppTheme.primary),
                  ),
                  SizedBox(height: 4.h),
                  Text('Sanadkii hore waa la xiray â€” Sanadka cusub waa la furay', style: TextStyle(fontSize: 11.sp, color: AppTheme.textSecondary, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ BOTTOM BAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Widget _buildBottomBar() {
    if (_currentStep == 2) {
      return SafeArea(
        child: Padding(
          padding: EdgeInsets.all(16.w),
          child: ElevatedButton(
            onPressed: () => Navigator.pop(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.textPrimary,
              padding: EdgeInsets.symmetric(vertical: 16.h),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14.r)),
            ),
            child: Text('Xir', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16.sp)),
          ),
        ),
      );
    }

    return SafeArea(
      child: Container(
        padding: EdgeInsets.all(16.w),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 16.r, offset: const Offset(0, -4))],
        ),
        child: Row(
          children: [
            if (_currentStep == 1) ...[
              OutlinedButton(
                onPressed: () => setState(() => _currentStep = 0),
                style: OutlinedButton.styleFrom(
                  padding: EdgeInsets.symmetric(vertical: 16.h, horizontal: 20.w),
                  side: BorderSide(color: const Color(0xFFCBD5E1), width: 1.5.w),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14.r)),
                ),
                child: Row(children: [
                  const Icon(Icons.arrow_back_rounded, size: 16, color: AppTheme.textSecondary),
                  SizedBox(width: 6.w),
                  const Text('Dib', style: TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.w800)),
                ]),
              ),
              SizedBox(width: 12.w),
            ],
            Expanded(
              child: ElevatedButton(
                onPressed: _previewLoading || _submitting
                    ? null
                    : (_currentStep == 0 ? _generatePreview : _publishPromotions),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _currentStep == 0 ? AppTheme.primary : AppTheme.success,
                  padding: EdgeInsets.symmetric(vertical: 16.h),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14.r)),
                  elevation: 2,
                  shadowColor: (_currentStep == 0 ? AppTheme.primary : AppTheme.success).withValues(alpha: 0.4),
                ),
                child: _previewLoading || _submitting
                    ? SizedBox(height: 20.h, width: 20.w, child: const CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                    : Text(
                        _currentStep == 0 ? 'Eeg Ardayda Preview â†’' : '🎓 Xaqiiji & Fur Sanadka Cusub',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 15.sp),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Widget _sectionLabel(String text) => Text(
        text,
        style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w900, color: AppTheme.textPrimary),
      );

  Widget _dropdown({
    required String hint,
    required String? value,
    required List<DropdownMenuItem<String>> items,
    required ValueChanged<String?> onChanged,
  }) =>
      Container(
        padding: EdgeInsets.symmetric(horizontal: 16.w),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14.r),
          border: Border.all(color: value != null ? AppTheme.primary.withValues(alpha: 0.4) : const Color(0xFFE2E8F0), width: 1.5.w),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8.r, offset: const Offset(0, 2))],
        ),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<String>(
            isExpanded: true,
            value: value,
            hint: Text(hint, style: TextStyle(color: const Color(0xFF94A3B8), fontSize: 14.sp)),
            items: items,
            onChanged: onChanged,
          ),
        ),
      );

  Widget _statPill(String label, int count, Color textColor, Color bgColor) => Expanded(
        child: Container(
          padding: EdgeInsets.symmetric(vertical: 8.h),
          decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(10.r)),
          child: Column(
            children: [
              Text('$count', style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.w900, color: textColor)),
              Text(label, style: TextStyle(fontSize: 9.sp, fontWeight: FontWeight.w800, color: textColor, letterSpacing: 0.3), textAlign: TextAlign.center),
            ],
          ),
        ),
      );

  Widget _filterChip(String label, String value) => GestureDetector(
        onTap: () => setState(() => _filterAction = value),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 7.h),
          decoration: BoxDecoration(
            color: _filterAction == value ? AppTheme.primary : Colors.white,
            borderRadius: BorderRadius.circular(10.r),
            border: Border.all(
              color: _filterAction == value ? AppTheme.primary : const Color(0xFFE2E8F0),
              width: 1.5.w,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11.sp,
              fontWeight: FontWeight.w800,
              color: _filterAction == value ? Colors.white : AppTheme.textSecondary,
            ),
          ),
        ),
      );

  Widget _resultCard(String label, int count, Color bg, Color textColor) => Container(
        padding: EdgeInsets.symmetric(vertical: 14.h),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(14.r),
          border: Border.all(color: textColor.withValues(alpha: 0.3)),
        ),
        child: Column(
          children: [
            Text('$count', style: TextStyle(fontSize: 26.sp, fontWeight: FontWeight.w900, color: textColor)),
            SizedBox(height: 4.h),
            Text(label, style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w800, color: textColor), textAlign: TextAlign.center),
          ],
        ),
      );

  Widget _mappingSelector({
    required String label,
    required IconData icon,
    required String? value,
    required List<DropdownMenuItem<String>> items,
    required ValueChanged<String?> onChanged,
    String? hint,
    bool isLoading = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.bold, color: AppTheme.textSecondary)),
        SizedBox(height: 6.h),
        Container(
          height: 48.h,
          padding: EdgeInsets.symmetric(horizontal: 12.w),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9).withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(12.r),
            border: Border.all(color: value != null ? AppTheme.primary.withValues(alpha: 0.3) : const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              Icon(icon, size: 16, color: value != null ? AppTheme.primary : AppTheme.textSecondary),
              SizedBox(width: 10.w),
              Expanded(
                child: isLoading
                    ? Center(child: SizedBox(width: 16.w, height: 16.h, child: const CircularProgressIndicator(strokeWidth: 2)))
                    : DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: value,
                          isExpanded: true,
                          hint: Text(hint ?? 'Dooro...', style: TextStyle(fontSize: 13.sp, color: Colors.grey)),
                          style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                          items: items,
                          onChanged: onChanged,
                        ),
                      ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

