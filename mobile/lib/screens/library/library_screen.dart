import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../main.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../config/api_config.dart';

class LibraryScreen extends StatefulWidget {
  const LibraryScreen({super.key});

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> with SingleTickerProviderStateMixin {
  final ApiService _api = ApiService();
  final AuthService _auth = AuthService();
  late TabController _tabController;
  
  List<dynamic> _books = [];
  List<dynamic> _issues = [];
  List<dynamic> _students = [];
  List<dynamic> _classes = [];
  List<dynamic> _sections = [];
  bool _loading = true;
  String? _userRole;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final role = await _auth.getRole();
      _userRole = (role ?? '').toLowerCase();
      final booksRes = await _api.get(ApiConfig.libraryBooks);
      final issuesRes = await _api.get(ApiConfig.libraryIssues);
      dynamic studentsRes;
      dynamic classesRes;
      dynamic sectionsRes;
      try { studentsRes = await _api.get(ApiConfig.students); } catch (_) {}
      try { classesRes = await _api.get(ApiConfig.classes); } catch (_) {}
      try { sectionsRes = await _api.get(ApiConfig.sections); } catch (_) {}

      if (mounted) {
        setState(() {
          _books = booksRes.data is List 
              ? booksRes.data 
              : (booksRes.data['books'] ?? booksRes.data['data'] ?? []);
          _issues = issuesRes.data is List 
              ? issuesRes.data 
              : (issuesRes.data['issues'] ?? issuesRes.data['data'] ?? []);
          
          if (studentsRes != null) {
            _students = studentsRes.data is List ? studentsRes.data : (studentsRes.data['data'] ?? []);
          }
          if (classesRes != null) {
            _classes = classesRes.data is List ? classesRes.data : (classesRes.data['data'] ?? []);
          }
          if (sectionsRes != null) {
            _sections = sectionsRes.data is List ? sectionsRes.data : (sectionsRes.data['data'] ?? []);
          }
          
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _updateBook(String id, Map<String, dynamic> bookData) async {
    try {
      final res = await _api.put('${ApiConfig.libraryBooks}/$id', data: bookData);
      if (res.statusCode == 200 || res.statusCode == 201) {
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: ${e.toString()}')),
        );
      }
    }
  }

  Future<void> _deleteBook(String id) async {
    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm Delete'),
        content: const Text('Are you sure you want to delete this book?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('CANCEL')),
          TextButton(
            onPressed: () => Navigator.pop(context, true), 
            child: const Text('DELETE', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      final res = await _api.delete('${ApiConfig.libraryBooks}/$id');
      if (res.statusCode == 200 || res.statusCode == 201) {
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: ${e.toString()}')),
        );
      }
    }
  }

  Future<void> _addBook(Map<String, dynamic> bookData) async {
    try {
      final res = await _api.post(ApiConfig.libraryBooks, data: bookData);
      if (res.statusCode == 200 || res.statusCode == 201) {
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: ${e.toString()}')),
        );
      }
    }
  }

  void _showAddBookDialog({dynamic book}) {
    final titleController = TextEditingController(text: book?['title'] ?? '');
    final authorController = TextEditingController(text: book?['author'] ?? '');
    final isbnController = TextEditingController(text: book?['isbn'] ?? '');
    final categoryController = TextEditingController(text: book?['category'] ?? '');
    final qtyController = TextEditingController(text: book?['quantity']?.toString() ?? '1');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
          top: 20,
          left: 20,
          right: 20,
        ),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(30.r)),
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(book == null ? 'Add New Book' : 'Edit Book', 
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20.sp)),
              SizedBox(height: 20.h),
              TextField(
                controller: titleController,
                decoration: InputDecoration(
                  labelText: 'Title',
                  filled: true,
                  fillColor: Colors.grey[50],
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(15.r), borderSide: BorderSide.none),
                ),
              ),
              SizedBox(height: 12.h),
              TextField(
                controller: authorController,
                decoration: InputDecoration(
                  labelText: 'Author',
                  filled: true,
                  fillColor: Colors.grey[50],
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(15.r), borderSide: BorderSide.none),
                ),
              ),
              SizedBox(height: 12.h),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: isbnController,
                      decoration: InputDecoration(
                        labelText: 'ISBN',
                        filled: true,
                        fillColor: Colors.grey[50],
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(15.r), borderSide: BorderSide.none),
                      ),
                    ),
                  ),
                  SizedBox(width: 12.w),
                  Expanded(
                    child: TextField(
                      controller: qtyController,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: 'Quantity',
                        filled: true,
                        fillColor: Colors.grey[50],
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(15.r), borderSide: BorderSide.none),
                      ),
                    ),
                  ),
                ],
              ),
              SizedBox(height: 12.h),
              TextField(
                controller: categoryController,
                decoration: InputDecoration(
                  labelText: 'Category',
                  filled: true,
                  fillColor: Colors.grey[50],
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(15.r), borderSide: BorderSide.none),
                ),
              ),
              SizedBox(height: 24.h),
              ElevatedButton(
                onPressed: () {
                  final data = {
                    'title': titleController.text,
                    'author': authorController.text,
                    'isbn': isbnController.text,
                    'category': categoryController.text,
                    'quantity': int.tryParse(qtyController.text) ?? 1,
                  };
                  if (book == null) {
                    _addBook(data);
                  } else {
                    final int oldQty = book['quantity'] ?? 0;
                    final int newQty = int.tryParse(qtyController.text) ?? oldQty;
                    final int diff = newQty - oldQty;
                    data['available'] = (book['available'] ?? 0) + diff;
                    _updateBook(book['id'], data);
                  }
                  Navigator.pop(context);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  minimumSize: const Size(double.infinity, 56),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15.r)),
                ),
                child: Text(book == null ? 'Save Book' : 'Update Book', 
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
              SizedBox(height: 20.h),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _issueBook(Map<String, dynamic> issueData) async {
    try {
      final res = await _api.post('${ApiConfig.libraryBooks.replaceAll('/books', '')}/issue', data: issueData);
      if (res.statusCode == 200 || res.statusCode == 201) {
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: ${e.toString()}')),
        );
      }
    }
  }

  Future<void> _returnBook(String issueId) async {
    try {
      final res = await _api.post('${ApiConfig.libraryBooks.replaceAll('/books', '')}/return/$issueId', data: {});
      if (res.statusCode == 200 || res.statusCode == 201) {
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: ${e.toString()}')),
        );
      }
    }
  }

  void _showIssueBookDialog(dynamic book) {
    String? selectedClass;
    String? selectedSection;
    String? selectedStudent;
    final dueDateController = TextEditingController();
    DateTime? selectedDate;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) {
          // Filter sections based on selected class
          final filteredSections = _sections.where((s) {
            if (selectedClass == null) return true;
            return s['classId']?.toString() == selectedClass;
          }).toList();

          // Filter students based on selected class and section
          final filteredStudents = _students.where((s) {
            if (selectedClass != null && s['classId']?.toString() != selectedClass) return false;
            if (selectedSection != null && s['sectionId']?.toString() != selectedSection) return false;
            return true;
          }).toList();

          return Container(
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(context).viewInsets.bottom,
              top: 20,
              left: 20,
              right: 20,
            ),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(30.r)),
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Issue Book', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20.sp)),
                  SizedBox(height: 8.h),
                  Text(book?['title'] ?? '', style: const TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.bold)),
                  SizedBox(height: 20.h),
                  
                  // Class Dropdown
                  DropdownButtonFormField<String>(
                    decoration: InputDecoration(
                      labelText: 'Class Filter',
                      filled: true,
                      fillColor: Colors.grey[50],
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(15.r), borderSide: BorderSide.none),
                    ),
                    initialValue: selectedClass,
                    items: [
                      DropdownMenuItem(value: null, child: Text('All Classes')),
                      ..._classes.map((c) => DropdownMenuItem(
                            value: c['id']?.toString(),
                            child: Text(c['class_name']?.toString() ?? 'Class'),
                          ))
                    ],
                    onChanged: (val) {
                      setModalState(() {
                        selectedClass = val;
                        selectedSection = null;
                        selectedStudent = null;
                      });
                    },
                  ),
                  SizedBox(height: 12.h),
                  
                  // Section Dropdown
                  DropdownButtonFormField<String>(
                    decoration: InputDecoration(
                      labelText: 'Section Filter',
                      filled: true,
                      fillColor: Colors.grey[50],
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(15.r), borderSide: BorderSide.none),
                    ),
                    initialValue: selectedSection,
                    items: [
                      DropdownMenuItem(value: null, child: Text('All Sections')),
                      ...filteredSections.map((s) => DropdownMenuItem(
                            value: s['id']?.toString(),
                            child: Text(s['name']?.toString() ?? 'Section'),
                          ))
                    ],
                    onChanged: selectedClass == null ? null : (val) {
                      setModalState(() {
                        selectedSection = val;
                        selectedStudent = null;
                      });
                    },
                  ),
                  SizedBox(height: 12.h),
                  
                  // Student Dropdown
                  DropdownButtonFormField<String>(
                    decoration: InputDecoration(
                      labelText: 'Student',
                      filled: true,
                      fillColor: Colors.grey[50],
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(15.r), borderSide: BorderSide.none),
                    ),
                    initialValue: selectedStudent,
                    items: [
                      DropdownMenuItem(value: null, child: Text('Select Student')),
                      ...filteredStudents.map((s) => DropdownMenuItem(
                            value: s['id']?.toString(),
                            child: Text(s['user']?['name']?.toString() ?? 'Student'),
                          ))
                    ],
                    onChanged: (val) {
                      setModalState(() {
                        selectedStudent = val;
                      });
                    },
                  ),
              SizedBox(height: 12.h),
              GestureDetector(
                onTap: () async {
                  final date = await showDatePicker(
                    context: context,
                    initialDate: DateTime.now().add(const Duration(days: 7)),
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 365)),
                  );
                  if (date != null) {
                    setModalState(() {
                      selectedDate = date;
                      dueDateController.text = date.toString().substring(0, 10);
                    });
                  }
                },
                child: AbsorbPointer(
                  child: TextField(
                    controller: dueDateController,
                    decoration: InputDecoration(
                      labelText: 'Due Date',
                      suffixIcon: const Icon(Icons.calendar_today),
                      filled: true,
                      fillColor: Colors.grey[50],
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(15.r), borderSide: BorderSide.none),
                    ),
                  ),
                ),
              ),
              SizedBox(height: 24.h),
              ElevatedButton(
                onPressed: () {
                  if (selectedStudent == null || selectedDate == null) return;
                  _issueBook({
                    'bookId': book['id'],
                    'studentId': selectedStudent,
                    'dueDate': selectedDate?.toIso8601String(),
                  });
                  Navigator.pop(context);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  minimumSize: const Size(double.infinity, 56),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15.r)),
                ),
                child: const Text('Confirm Issue', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Text(
          'Library Management',
          style: TextStyle(
            color: AppTheme.textPrimary,
            fontWeight: FontWeight.w900,
            fontSize: 18.sp,
          ),
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppTheme.primary,
          unselectedLabelColor: AppTheme.textSecondary,
          indicatorColor: AppTheme.primary,
          labelStyle: TextStyle(fontWeight: FontWeight.w900, fontSize: 13.sp),
          tabs: [
            Tab(text: 'BOOKS'),
            Tab(text: 'ISSUED'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildBooksTab(),
                _buildIssuedTab(),
              ],
            ),
      floatingActionButton: (_userRole?.toLowerCase() == 'admin' || _userRole?.toLowerCase() == 'librarian' || _userRole?.toLowerCase() == 'owner')
          ? FloatingActionButton(
              onPressed: () => _showAddBookDialog(),
              backgroundColor: AppTheme.primary,
              child: const Icon(Icons.add, color: Colors.white),
            )
          : null,
    );
  }

  Widget _buildBooksTab() {
    if (_books.isEmpty) return _emptyState('No books found');
    return ListView.builder(
      padding: EdgeInsets.all(16.w),
      itemCount: _books.length,
      itemBuilder: (context, i) {
        final b = _books[i];
        final bool isAvailable = b['available'] != null && b['available'] > 0;
        final bool canManage = (_userRole?.toLowerCase() == 'admin' || _userRole?.toLowerCase() == 'librarian' || _userRole?.toLowerCase() == 'owner');

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: EdgeInsets.all(16.w),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20.r),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Container(
                    width: 48.w,
                    height: 48.h,
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12.r),
                    ),
                    child: const Icon(Icons.menu_book_rounded, color: AppTheme.primary),
                  ),
                  SizedBox(width: 16.w),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          b['title'] ?? '',
                          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14.sp),
                        ),
                        Text(
                          'Author: ${b['author'] ?? 'N/A'}',
                          style: TextStyle(color: AppTheme.textSecondary, fontSize: 11.sp),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'Qty: ${b['quantity'] ?? 0}',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12.sp),
                      ),
                      Text(
                        isAvailable ? 'Available' : 'Out',
                        style: TextStyle(
                          color: isAvailable ? Colors.green : Colors.red,
                          fontWeight: FontWeight.w900,
                          fontSize: 10.sp,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              if (canManage) ...[
                Divider(height: 24.h),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    if (isAvailable) 
                       TextButton.icon(
                        onPressed: () => _showIssueBookDialog(b),
                        icon: const Icon(Icons.outbound_rounded, size: 14),
                        label: Text('ISSUE', style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900)),
                      ),
                    TextButton.icon(
                      onPressed: () => _showAddBookDialog(book: b),
                      icon: const Icon(Icons.edit_rounded, size: 14),
                      label: Text('EDIT', style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900)),
                    ),
                    TextButton.icon(
                      onPressed: () => _deleteBook(b['id']),
                      icon: const Icon(Icons.delete_outline_rounded, size: 14, color: Colors.red),
                      label: Text('DELETE', style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: Colors.red)),
                    ),
                  ],
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildIssuedTab() {
    if (_issues.isEmpty) return _emptyState('No active issues');
    return ListView.builder(
      padding: EdgeInsets.all(16.w),
      itemCount: _issues.length,
      itemBuilder: (context, i) {
        final issue = _issues[i];
        final bool isReturned = issue['status'] == 'returned';
        final bool isStudent = issue['student'] != null;

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: EdgeInsets.all(16.w),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20.r),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.person, size: 16, color: AppTheme.primary),
                  SizedBox(width: 8.w),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          issue['student']?['user']?['name'] ?? issue['staff']?['user']?['name'] ?? 'Unknown',
                          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13.sp),
                        ),
                        if (isStudent)
                          (() {
                            final student = issue['student'];
                            if (student == null) return const SizedBox.shrink();
                            
                            String className = student['clss']?['class_name']?.toString() ?? '';
                            String sectionName = student['section']?['name']?.toString() ?? '';
                            
                            if (className.isEmpty || sectionName.isEmpty) {
                              final enrollments = student['Enrollments'];
                              if (enrollments is List && enrollments.isNotEmpty) {
                                final currentEnrollment = enrollments.firstWhere(
                                  (e) => e['isCurrent'] == true,
                                  orElse: () => enrollments.first,
                                );
                                if (currentEnrollment != null) {
                                  if (className.isEmpty) {
                                    className = currentEnrollment['clss']?['class_name']?.toString() ?? '';
                                  }
                                  if (sectionName.isEmpty) {
                                    sectionName = currentEnrollment['section']?['name']?.toString() ?? '';
                                  }
                                }
                              }
                            }
                            
                            final displayList = [
                              if (className.isNotEmpty) className,
                              if (sectionName.isNotEmpty) sectionName,
                            ];
                            final displayStr = displayList.join(' - ');
                            
                            return Text(
                              'Class: ${displayStr.isNotEmpty ? displayStr : 'N/A'}',
                              style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 10.sp),
                            );
                          })(),
                      ],
                    ),
                  ),
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                    decoration: BoxDecoration(
                      color: isReturned ? Colors.green.withValues(alpha: 0.1) : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8.r),
                    ),
                    child: Text(
                      issue['status']?.toUpperCase() ?? 'ISSUED',
                      style: TextStyle(
                        fontWeight: FontWeight.w900, 
                        fontSize: 9.sp, 
                        color: isReturned ? Colors.green : AppTheme.textSecondary
                      ),
                    ),
                  ),
                ],
              ),
              Divider(height: 24.h),
              Row(
                children: [
                  const Icon(Icons.book, size: 14, color: AppTheme.textSecondary),
                  SizedBox(width: 8.w),
                  Text(
                    issue['book']?['title'] ?? 'Book N/A',
                    style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              SizedBox(height: 8.h),
              Row(
                children: [
                  const Icon(Icons.calendar_today, size: 14, color: AppTheme.textSecondary),
                  SizedBox(width: 8.w),
                  Text(
                    isReturned 
                      ? 'Returned: ${issue['returnDate']?.toString().substring(0, 10) ?? 'N/A'}'
                      : 'Due: ${issue['dueDate']?.toString().substring(0, 10) ?? 'N/A'}',
                    style: TextStyle(
                      fontSize: 11.sp, 
                      color: isReturned ? Colors.green : Colors.red, 
                      fontWeight: FontWeight.bold
                    ),
                  ),
                  if (!isReturned && (_userRole?.toLowerCase() == 'admin' || _userRole?.toLowerCase() == 'librarian' || _userRole?.toLowerCase() == 'owner')) ...[
                    const Spacer(),
                    TextButton(
                      onPressed: () => _returnBook(issue['id']),
                      child: Text('RETURN', style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900)),
                    ),
                  ],
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _emptyState(String msg) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.library_books_rounded, size: 64, color: Color(0xFFE2E8F0)),
          SizedBox(height: 16.h),
          Text(
            msg,
            style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textSecondary),
          ),
        ],
      ),
    );
  }
}


