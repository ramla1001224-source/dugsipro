import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:file_picker/file_picker.dart';
import 'package:dio/dio.dart' as dio;
import '../../services/api_service.dart';
import '../../config/api_config.dart';

class ImportStudentsScreen extends StatefulWidget {
  const ImportStudentsScreen({super.key});

  @override
  State<ImportStudentsScreen> createState() => _ImportStudentsScreenState();
}

class _ImportStudentsScreenState extends State<ImportStudentsScreen> {
  final ApiService _api = ApiService();

  List<dynamic> _classes = [];
  String? _selectedClassId;
  String? _selectedSectionId;
  List<dynamic> _sections = [];

  PlatformFile? _pickedFile;
  bool _loading = false;
  bool _importing = false;
  String? _resultMessage;
  bool _resultSuccess = false;
  List<dynamic> _errors = [];

  @override
  void initState() {
    super.initState();
    _loadClasses();
  }

  Future<void> _loadClasses() async {
    setState(() => _loading = true);
    try {
      final res = await _api.get(ApiConfig.classes);
      final data = res.data;
      final list = data is List ? data : (data['classes'] ?? data['data'] ?? []);
      setState(() {
        _classes = list;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  void _onClassChanged(String? classId) {
    setState(() {
      _selectedClassId = classId;
      _selectedSectionId = null;
      _sections = [];
    });
    if (classId == null) return;
    final selected = _classes.firstWhere(
      (c) => c['id'].toString() == classId,
      orElse: () => null,
    );
    if (selected != null) {
      setState(() => _sections = List<dynamic>.from(selected['Sections'] ?? []));
    }
  }

  Future<void> _pickFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['xlsx', 'xls'],
        withData: true,
      );
      if (result != null && result.files.isNotEmpty) {
        setState(() {
          _pickedFile = result.files.first;
          _resultMessage = null;
          _errors = [];
        });
      }
    } catch (e) {
      _showSnack('Khalad: Fayl dooro la waayey. ${e.toString()}', error: true);
    }
  }

  Future<void> _import() async {
    if (_pickedFile == null) {
      _showSnack('Fadlan marka hore dooro fayl Excel ah.', error: true);
      return;
    }
    if (_selectedSectionId == null || _selectedSectionId!.isEmpty) {
      _showSnack('Fadlan dooro Section-ka (Qaybta) ardaydan galaan.', error: true);
      return;
    }

    setState(() {
      _importing = true;
      _resultMessage = null;
      _errors = [];
    });

    try {
      final bytes = _pickedFile!.bytes;
      if (bytes == null) {
        _showSnack('Fayl-ka bytes-kii la waayey. Dib u isku day.', error: true);
        setState(() => _importing = false);
        return;
      }

      final formData = dio.FormData.fromMap({
        'file': dio.MultipartFile.fromBytes(
          bytes,
          filename: _pickedFile!.name,
        ),
        'classId': _selectedClassId ?? '',
        'sectionId': _selectedSectionId!,
      });

      final res = await _api.post(
        '${ApiConfig.students}/import',
        data: formData,
      );

      final data = res.data;
      setState(() {
        _resultSuccess = (data['success'] ?? 0) > 0;
        _resultMessage = data['message'] ?? 'Import dhammaatay.';
        _errors = data['errors'] ?? [];
        _importing = false;
      });

      if (_resultSuccess) {
        _showSnack('✅ ${data['success']} ardayood si guul ah ayaa loo geliyey!');
      }
    } catch (e) {
      final errMsg = e is dio.DioException
          ? (e.response?.data?['message'] ?? e.message ?? e.toString())
          : e.toString();
      setState(() {
        _resultSuccess = false;
        _resultMessage = 'Import wuu fashilmay: $errMsg';
        _importing = false;
      });
    }
  }

  void _showSnack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: error ? Colors.red.shade700 : Colors.green.shade700,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        backgroundColor: const Color(0xFF059669),
        elevation: 0,
        centerTitle: false,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          'Import Students (Excel)',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w900,
            fontSize: 17.sp,
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF059669)))
          : SingleChildScrollView(
              padding: EdgeInsets.all(16.w),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Info Card
                  _infoCard(),
                  SizedBox(height: 16.h),

                  // Step 1: Class & Section
                  _stepCard(
                    step: '1',
                    title: 'Dooro Class iyo Section',
                    child: Column(
                      children: [
                        _label('GRADE / CLASS'),
                        SizedBox(height: 6.h),
                        _dropdown(
                          hint: '-- Dooro Class --',
                          value: _selectedClassId,
                          items: _classes
                              .map<DropdownMenuItem<String>>((c) => DropdownMenuItem(
                                    value: c['id'].toString(),
                                    child: Text(c['class_name']?.toString() ?? 'Class',
                                        style: TextStyle(fontSize: 13.sp)),
                                  ))
                              .toList(),
                          onChanged: _onClassChanged,
                        ),
                        if (_selectedClassId != null) ...[
                          SizedBox(height: 12.h),
                          _label('SECTION *'),
                          SizedBox(height: 6.h),
                          _dropdown(
                            hint: '-- Dooro Section --',
                            value: _selectedSectionId,
                            items: _sections
                                .map<DropdownMenuItem<String>>((s) => DropdownMenuItem(
                                      value: s['id'].toString(),
                                      child: Text(
                                        '${s['name'] ?? 'Section'} (${s['shift'] ?? ''})',
                                        style: TextStyle(fontSize: 13.sp),
                                      ),
                                    ))
                                .toList(),
                            onChanged: (v) => setState(() => _selectedSectionId = v),
                          ),
                        ],
                      ],
                    ),
                  ),
                  SizedBox(height: 12.h),

                  // Step 2: Pick File
                  _stepCard(
                    step: '2',
                    title: 'Dooro Fayl Excel',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        GestureDetector(
                          onTap: _pickFile,
                          child: Container(
                            padding: EdgeInsets.all(20.w),
                            decoration: BoxDecoration(
                              color: _pickedFile != null
                                  ? const Color(0xFFECFDF5)
                                  : const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(14.r),
                              border: Border.all(
                                color: _pickedFile != null
                                    ? const Color(0xFF059669)
                                    : const Color(0xFFCBD5E1),
                                width: 2,
                              ),
                            ),
                            child: _pickedFile == null
                                ? Column(
                                    children: [
                                      Icon(Icons.upload_file_rounded,
                                          size: 36.sp, color: const Color(0xFF94A3B8)),
                                      SizedBox(height: 8.h),
                                      Text(
                                        'Tabo halkan si aad u doorato fayl',
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                          fontSize: 13.sp,
                                          fontWeight: FontWeight.bold,
                                          color: const Color(0xFF64748B),
                                        ),
                                      ),
                                      SizedBox(height: 4.h),
                                      Text(
                                        '.xlsx ama .xls kaliya',
                                        style: TextStyle(
                                            fontSize: 11.sp,
                                            color: const Color(0xFF94A3B8)),
                                      ),
                                    ],
                                  )
                                : Row(
                                    children: [
                                      Container(
                                        padding: EdgeInsets.all(10.w),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF059669),
                                          borderRadius: BorderRadius.circular(10.r),
                                        ),
                                        child: const Icon(Icons.check,
                                            color: Colors.white, size: 20),
                                      ),
                                      SizedBox(width: 12.w),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              _pickedFile!.name,
                                              style: TextStyle(
                                                fontWeight: FontWeight.bold,
                                                fontSize: 13.sp,
                                                color: const Color(0xFF1E293B),
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            Text(
                                              '${(_pickedFile!.size / 1024).toStringAsFixed(1)} KB',
                                              style: TextStyle(
                                                  fontSize: 11.sp,
                                                  color: const Color(0xFF059669)),
                                            ),
                                          ],
                                        ),
                                      ),
                                      TextButton(
                                        onPressed: _pickFile,
                                        child: Text('Bedel',
                                            style: TextStyle(
                                                fontSize: 12.sp,
                                                color: const Color(0xFF059669),
                                                fontWeight: FontWeight.bold)),
                                      ),
                                    ],
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: 12.h),

                  // Result
                  if (_resultMessage != null) ...[
                    Container(
                      padding: EdgeInsets.all(14.w),
                      decoration: BoxDecoration(
                        color: _resultSuccess
                            ? const Color(0xFFECFDF5)
                            : const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(14.r),
                        border: Border.all(
                          color: _resultSuccess
                              ? const Color(0xFF6EE7B7)
                              : const Color(0xFFFCA5A5),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(
                                _resultSuccess ? Icons.check_circle : Icons.error,
                                color: _resultSuccess
                                    ? const Color(0xFF059669)
                                    : Colors.red,
                                size: 20,
                              ),
                              SizedBox(width: 8.w),
                              Expanded(
                                child: Text(
                                  _resultMessage!,
                                  style: TextStyle(
                                    fontSize: 13.sp,
                                    fontWeight: FontWeight.bold,
                                    color: _resultSuccess
                                        ? const Color(0xFF065F46)
                                        : Colors.red.shade800,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          if (_errors.isNotEmpty) ...[
                            SizedBox(height: 10.h),
                            Text(
                              'Khaladaadka (${_errors.length}):',
                              style: TextStyle(
                                  fontSize: 11.sp,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.red.shade700),
                            ),
                            SizedBox(height: 4.h),
                            ..._errors.take(10).map((err) => Padding(
                                  padding: EdgeInsets.only(top: 2.h),
                                  child: Text(
                                    '⚠ ${err['message'] ?? err.toString()}',
                                    style: TextStyle(
                                        fontSize: 11.sp,
                                        color: Colors.red.shade600),
                                  ),
                                )),
                            if (_errors.length > 10)
                              Text(
                                '... iyo ${_errors.length - 10} khalad oo kale',
                                style: TextStyle(
                                    fontSize: 11.sp,
                                    color: Colors.red.shade400),
                              ),
                          ],
                        ],
                      ),
                    ),
                    SizedBox(height: 12.h),
                  ],

                  // Import Button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: (_importing ||
                              _pickedFile == null ||
                              _selectedSectionId == null)
                          ? null
                          : _import,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF059669),
                        disabledBackgroundColor: const Color(0xFFCBD5E1),
                        padding: EdgeInsets.symmetric(vertical: 16.h),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14.r)),
                        elevation: 2,
                      ),
                      child: _importing
                          ? Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                SizedBox(
                                  height: 18.h,
                                  width: 18.w,
                                  child: const CircularProgressIndicator(
                                      color: Colors.white, strokeWidth: 2),
                                ),
                                SizedBox(width: 10.w),
                                Text('Importing...',
                                    style: TextStyle(
                                        fontSize: 15.sp,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white)),
                              ],
                            )
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.upload_rounded,
                                    color: Colors.white, size: 20),
                                SizedBox(width: 8.w),
                                Text(
                                  'Import Ardayda',
                                  style: TextStyle(
                                    fontSize: 15.sp,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.white,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                  SizedBox(height: 40.h),
                ],
              ),
            ),
    );
  }

  Widget _infoCard() {
    return Container(
      padding: EdgeInsets.all(14.w),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(14.r),
        border: Border.all(color: const Color(0xFFBFDBFE)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.info_outline, color: Color(0xFF2563EB), size: 18),
              SizedBox(width: 8.w),
              Text(
                'Sida Excel-ka loo diyaariyaa',
                style: TextStyle(
                  fontSize: 13.sp,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF1E40AF),
                ),
              ),
            ],
          ),
          SizedBox(height: 8.h),
          _infoRow('✅', 'Student ID (Optional)', 'Ku qor haddii ardayga ID leeyahay — haddii kale, banaan ka daa, system auto-generate gareenayaa'),
          _infoRow('✅', 'Name', 'Magaca ardayga — WAAJIB AH'),
          _infoRow('✅', 'Password', 'Haddii banaan default waa: 123123'),
          _infoRow('✅', 'Phone, Address, Gender', 'Optional (ikhtiyaari)'),
        ],
      ),
    );
  }

  Widget _infoRow(String emoji, String label, String desc) {
    return Padding(
      padding: EdgeInsets.only(top: 4.h),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(emoji, style: TextStyle(fontSize: 12.sp)),
          SizedBox(width: 6.w),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: TextStyle(fontSize: 11.sp, color: const Color(0xFF1E40AF)),
                children: [
                  TextSpan(
                      text: '$label: ',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  TextSpan(text: desc),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _stepCard({
    required String step,
    required String title,
    required Widget child,
  }) {
    return Container(
      padding: EdgeInsets.all(16.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16.r),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10.r,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 28.w,
                height: 28.w,
                decoration: BoxDecoration(
                  color: const Color(0xFF059669),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(step,
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 13.sp,
                          fontWeight: FontWeight.w900)),
                ),
              ),
              SizedBox(width: 10.w),
              Text(
                title,
                style: TextStyle(
                  fontSize: 14.sp,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF1E293B),
                ),
              ),
            ],
          ),
          SizedBox(height: 14.h),
          child,
        ],
      ),
    );
  }

  Widget _label(String text) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 9.sp,
        fontWeight: FontWeight.w900,
        color: const Color(0xFF64748B),
        letterSpacing: 0.8,
      ),
    );
  }

  Widget _dropdown({
    required String hint,
    required String? value,
    required List<DropdownMenuItem<String>> items,
    required void Function(String?)? onChanged,
  }) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 4.h),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(10.r),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          isExpanded: true,
          value: value,
          hint: Text(hint,
              style: TextStyle(fontSize: 12.sp, color: const Color(0xFF94A3B8))),
          items: items,
          onChanged: onChanged,
        ),
      ),
    );
  }
}
