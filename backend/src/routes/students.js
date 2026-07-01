const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles, requireSchoolAccess } = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');

const cacheMiddleware = require('../middleware/cacheMiddleware');


// Multer config — store in memory (for excel uploads only)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ==================== GET ALL STUDENTS ====================
router.get('/', authenticateToken, authorizeRoles('admin', 'teacher', 'accountant', 'librarian', 'super_admin', 'owner'), requireSchoolAccess(), async (req, res) => {
  try {
    const { classId, sectionId, search, page, limit } = req.query;
    let schoolId = req.query.schoolId || req.user.schoolId;

    // If schoolId is missing from token, recover from User record
    if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase()) && req.user.id) {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user) schoolId = user.schoolId;
      } catch (err) {
        console.error('Students Recovery Error:', err);
      }
    }

    // Filter criteria
    const where = {
      isCurrent: true,
      status: { in: ['active', 'promoted', 'retained'] },
      student: {
        user: { isActive: true },
        status: { not: 'graduated' }
      }
    };

    if (schoolId) where.schoolId = schoolId;
    if (classId) where.classId = classId;
    if (sectionId) where.sectionId = sectionId;

    // Optional: Filter by joined date (Student.created_at) instead of Enrollment creation
    if (req.query.asOfDate) {
      const asOf = new Date(req.query.asOfDate);
      asOf.setUTCHours(23, 59, 59, 999);
      where.student.created_at = { lte: asOf };
    }

    if (search && search.trim()) {
      const searchPattern = search.trim();
      where.student = {
        ...where.student, // Preserve existing filters like isActive and status
        OR: [
          { user: { name: { contains: searchPattern, mode: 'insensitive' } } },
          { student_id: { contains: searchPattern, mode: 'insensitive' } }
        ]
      };
    }

    const p = Number(page) || 1;
    const l = Number(limit) || 200;
    const skip = (p - 1) * l;

    const [enrollments, total] = await Promise.all([
      prisma.enrollment.findMany({
        where,
        include: {
          student: { include: { user: true } },
          clss: true,
          section: true
        },
        skip,
        take: l,
        orderBy: { student: { user: { name: 'asc' } } }
      }),
      prisma.enrollment.count({ where })
    ]);

    const normalizedStudents = enrollments.map(e => ({
      ...e.student,
      enrollmentId: e.id,
      classId: e.classId,
      sectionId: e.sectionId,
      class_name: e.clss?.class_name || 'N/A',
      section_name: e.section?.name || 'N/A',
      balance: e.balance
    }));

    if (page || limit) {
      return res.json({
        students: normalizedStudents,
        pagination: {
          total,
          page: p,
          limit: l,
          totalPages: Math.ceil(total / l)
        }
      });
    }

    res.setHeader('X-Total-Count', total);
    return res.json(normalizedStudents);

    // Send total count in headers if needed later, but keep response as array for frontend compatibility
    res.setHeader('X-Total-Count', total);
    res.setHeader('X-Total-Pages', Math.ceil(total / l));

    return res.json(students);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ==================== GET ALUMNI/GRADUATED STUDENTS ====================
router.get('/alumni', authenticateToken, authorizeRoles('admin', 'super_admin', 'owner'), requireSchoolAccess(), async (req, res) => {
  try {
    const { year, className, search } = req.query;
    let schoolId = req.query.schoolId || req.user.schoolId;

    // Recover schoolId if missing (for non-owner/super_admin)
    if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user) schoolId = user.schoolId;
    }

    // Filter criteria for DB query
    const where = {
      status: 'graduated'
    };

    if (schoolId) where.schoolId = schoolId;
    
    if (className) {
      where.clss = { class_name: className };
    }

    if (year) {
      where.academicYear = { name: year };
    }

    if (search && search.trim()) {
      where.student = {
        OR: [
          { user: { name: { contains: search.trim(), mode: 'insensitive' } } },
          { student_id: { contains: search.trim(), mode: 'insensitive' } }
        ]
      };
    }

    // Get graduates
    const graduates = await prisma.enrollment.findMany({
      where,
      include: {
        student: { include: { user: { select: { name: true, username: true, phone: true } } } },
        clss: { select: { class_name: true } },
        section: { select: { name: true } },
        academicYear: { select: { name: true } }
      },
      orderBy: { student: { user: { name: 'asc' } } },
      take: 1000 // Limit for performance
    });

    // Prepare alumni list for frontend
    const alumni = graduates.map(e => ({
      ...e.student,
      class: e.clss?.class_name,
      section: e.section?.name,
      graduationYear: e.academicYear?.name,
      updated_at: e.updated_at
    }));

    // For filter options, we need ALL graduates in this school to populate the dropdowns
    const filterWhere = { status: 'graduated' };
    if (schoolId) filterWhere.schoolId = schoolId;

    const allGrads = await prisma.enrollment.findMany({
      where: filterWhere,
      select: {
        clss: { select: { class_name: true } },
        academicYear: { select: { name: true } }
      }
    });

    const uniqueClasses = [...new Set(allGrads.map(e => e.clss?.class_name).filter(Boolean))];
    const uniqueYears = [...new Set(allGrads.map(e => e.academicYear?.name).filter(Boolean))].sort((a, b) => b.localeCompare(a));

    res.json({
      students: alumni,
      filterOptions: {
        classes: uniqueClasses,
        years: uniqueYears
      }
    });

  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ==================== GET SINGLE STUDENT ====================
router.get('/:id', authenticateToken, cacheMiddleware(60), async (req, res) => {
  try {
    let schoolId = req.query.schoolId || req.user.schoolId;

    // Recovery logic for schoolId if missing from token
    if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase()) && req.user.id) {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user) schoolId = user.schoolId;
      } catch (err) { console.error('Student Recovery Error:', err); }
    }

    // Permission Check: Admin can see student if student has ANY enrollment in their school
    const userRole = (req.user.role || '').toLowerCase();
    const isSuperAdmin = ['super_admin', 'owner'].includes(userRole);

    if (schoolId && !isSuperAdmin) {
      // Permission check: student must belong to the same school as the requester
      // We'll check this after fetching the student to avoid redundant queries
    }

    const student = await prisma.student.findFirst({
      where: { id: req.params.id },
      include: {
        user: true,
        clss: true,
        section: true,
        Enrollments: {
          include: { clss: true, section: true, school: { select: { name: true } } },
          orderBy: { created_at: 'desc' }
        },
        Parents: { include: { parent: { include: { user: true } } } }
      }
    });

    if (!student) {
      return res.status(404).json({
        message: 'Student record not found in database',
        details: `ID ${req.params.id} does not exist.`
      });
    }

    // Permission check: Ensure the student belongs to the requester's school
    const studentSchoolId = student.user?.schoolId || student.schoolId;
    if (schoolId && !isSuperAdmin && studentSchoolId !== schoolId) {
      // Double check: maybe they have an enrollment record in this school (for history)
      const hasHistory = await prisma.enrollment.findFirst({
        where: { studentId: student.id, schoolId }
      });

      if (!hasHistory) {
        return res.status(403).json({
          message: 'Access denied: Student belongs to another school.',
          details: `Student school: ${studentSchoolId}, Your school: ${schoolId}`
        });
      }
    }


    // Flatten current enrollment (the first one since we sorted by desc)
    if (student.Enrollments && student.Enrollments.length > 0) {
      const curr = student.Enrollments.find(e => e.isCurrent) || student.Enrollments[0];
      student.enrollmentId = curr.id;
      student.classId = student.classId || curr.classId;
      student.sectionId = student.sectionId || curr.sectionId;
      student.class_name = curr.clss?.class_name || student.clss?.class_name;
      student.section_name = curr.section?.name || student.section?.name;
    }

    // Flatten parent for frontend compatibility
    if (student.Parents && student.Parents[0]) {
      student.parent = student.Parents[0].parent;
    }

    res.json(student);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ==================== VALIDATE STUDENT CODE ====================
// Used for live verification during marks entry
router.get('/validate-code/:code', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;
    let schoolId = req.user.schoolId;

    if (!code) return res.status(400).json({ message: 'Code required' });

    const student = await prisma.student.findFirst({
      where: {
        student_id: { equals: code.trim(), mode: 'insensitive' },
        user: { schoolId }
      },
      include: {
        user: { select: { name: true } },
        clss: { select: { class_name: true } },
        section: { select: { name: true } }
      }
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student code not found' });
    }

    return res.json({
      success: true,
      id: student.id,
      name: student.user?.name,
      className: student.clss?.class_name,
      sectionName: student.section?.name,
      student_id: student.student_id
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==================== CREATE SINGLE STUDENT ====================
router.post('/create', authenticateToken, authorizeRoles('admin', 'owner', 'super_admin'), requireSchoolAccess(), async (req, res) => {
  const { name, password, class: className, phone, address, gender, scholarship } = req.body;
  if (!name || !password) return res.status(400).json({ message: 'Missing fields' });

  const bcrypt = require('bcrypt');
  const hashed = await bcrypt.hash(password, 10);
  let schoolId = req.user.schoolId;
  const studentId = `S-${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    const { classId, sectionId } = req.body;
    if (!sectionId) return res.status(400).json({ message: 'Fadlan dooro Section (Qaybta) uu ardaygu ka mid yahay.' });

    let finalClassName = className;

    // Validate class and get schoolId if needed
    if (classId) {
      const targetClass = await prisma.class.findUnique({ where: { id: classId } });
      if (!targetClass || (schoolId && targetClass.schoolId !== schoolId)) {
        return res.status(403).json({ message: 'Ma geli kartid fasalkan (Invalid class for this school)' });
      }
      if (!schoolId) schoolId = targetClass.schoolId;
      if (!finalClassName) finalClassName = targetClass.class_name;
    }

    // Validate section
    if (sectionId) {
      const targetSection = await prisma.section.findUnique({ where: { id: sectionId } });
      if (!targetSection || (schoolId && targetSection.schoolId !== schoolId)) {
        return res.status(403).json({ message: 'Ma geli kartid qaybtan (Invalid section for this school)' });
      }
      if (!schoolId) schoolId = targetSection.schoolId;
    }

    // Use transaction to ensure both user and student and enrollment are created
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          username: studentId.toLowerCase(),
          password: hashed,
          role: 'student',
          schoolId
        }
      });

      const student = await tx.student.create({
        data: {
          userId: user.id,
          student_id: studentId,
          class: finalClassName,
          classId: classId || null,
          sectionId: sectionId || null,
          phone,
          address,
          gender: gender || null,
          scholarship: scholarship || 'none',
          status: 'active'
        }
      });

      // Find current academic year for this school
      const currentYear = await tx.academicYear.findFirst({
        where: { schoolId, isCurrent: true },
        orderBy: { startDate: 'desc' }
      });

      if (!currentYear) {
        throw new Error('No current academic year found. Please create one first.');
      }

      // Create initial Enrollment record
      await tx.enrollment.create({
        data: {
          studentId: student.id,
          classId: classId,
          sectionId: sectionId,
          academicYearId: currentYear.id,
          schoolId,
          isCurrent: true,
          status: 'active'
        }
      });

      return { user, student };
    });

    // Clear cache to ensure the new student appears immediately
    if (typeof router.clearCache === 'function') {
      router.clearCache();
    }

    res.json(result);
  } catch (err) {
    console.error('[Student Creation Error]:', err);
    if (err.code === 'P2002') return res.status(400).json({ message: 'Student ID already exists, try again' });
    res.status(500).json({ message: err.message });
  }
});

// ==================== DOWNLOAD EXCEL TEMPLATE ====================
router.get('/template', authenticateToken, authorizeRoles('admin', 'owner'), (req, res) => {
  const wb = XLSX.utils.book_new();
  const headers = [['Name', 'Username', 'Password', 'Class', 'Phone', 'Address', 'Gender', 'Date of Birth']];
  // Add example row
  headers.push(['Ahmed Mohamed', 'ahmed123', 'pass1234', 'Grade 10A', '0612345678', 'Garowe', 'Male', '2008-05-15']);
  const ws = XLSX.utils.aoa_to_sheet(headers);

  // Set column widths
  ws['!cols'] = [
    { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
    { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 15 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Students');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=students_template.xlsx');
  res.send(buffer);
});

// Helper for fuzzy column matching
const getValue = (row, possibleKeys) => {
  const rowKeys = Object.keys(row);
  // Match by checking if any row key contains or is contained in our target keys
  const foundKey = rowKeys.find(k => {
    const lk = String(k).toLowerCase().trim();
    return possibleKeys.some(pk => lk.includes(pk) || pk.includes(lk));
  });
  return foundKey ? row[foundKey] : null;
};

// ==================== BULK IMPORT FROM EXCEL ====================
router.post('/import', authenticateToken, authorizeRoles('admin', 'owner'), requireSchoolAccess(), upload.single('file'), async (req, res) => {
  const schoolId = req.user.schoolId;
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(ws);

    if (!rawRows.length) return res.status(400).json({ message: 'Excel file is empty' });

    const bcrypt = require('bcrypt');
    const results = { success: 0, errors: [] };

    // Fetch classes for matching
    const allClasses = await prisma.class.findMany();
    const forcedClassId = req.body.classId;
    const forcedSectionId = req.body.sectionId;

    if (!forcedSectionId) {
      return res.status(400).json({ message: 'Fadlan dooro Section-ka (Qaybta) aad rabto inay ardaydan galaan.' });
    }

    // Recover schoolId from section if missing (for Owners/SuperAdmins)
    let finalSchoolId = schoolId;
    const targetSection = await prisma.section.findUnique({
      where: { id: forcedSectionId },
      include: { class: true }
    });

    if (targetSection) {
      finalSchoolId = targetSection.schoolId;
    } else {
      return res.status(400).json({ message: 'Section-ka aad dooratay ma jiro.' });
    }

    const forcedClass = forcedClassId ? allClasses.find(c => c.id === forcedClassId) : (targetSection ? targetSection.class : null);

    // 1. Normalize Rows
    const rows = rawRows.map((row, index) => {
      const name = getValue(row, ['name', 'magaca', 'fullname', 'full name', 'student name', 'ardayga', 'magaca ardayga']);
      const student_id = 'S' + Math.floor(100000 + Math.random() * 900000); // Unique-ish ID
      const username = student_id;
      let password = String(getValue(row, ['password', 'pass', 'pincode', 'sirta']) || '').trim();

      if (name && !password) {
        password = '123123'; // Default password
      }

      const classNameInExcel = getValue(row, ['class', 'fasalka', 'grade', 'classname']);
      let classId = null;
      let className = null;

      if (forcedClass) {
        classId = forcedClass.id;
        className = forcedClass.class_name;
      } else {
        const matchingClass = allClasses.find(c =>
          String(c.class_name).toLowerCase().trim() === String(classNameInExcel || '').toLowerCase().trim()
        );
        classId = matchingClass ? matchingClass.id : null;
        className = classNameInExcel ? String(classNameInExcel) : null;
      }

      return {
        rowNum: index + 2,
        name,
        username, // This is our student_id for login
        password,
        className,
        classId,
        sectionId: forcedSectionId,
        phone: getValue(row, ['phone', 'telefon', 'mobile', 'cell']) || null,
        address: getValue(row, ['address', 'cinwaanka', 'location']) || null,
        gender: getValue(row, ['gender', 'jinsiga', 'sex']) || null,
        dob: getValue(row, ['date of birth', 'dob', 'dhalashada', 'birthdate', 'taariikh']) || null
      };
    }).filter(r => {
      if (!r.name) {
        results.errors.push({ row: r.rowNum, message: `Row ${r.rowNum}: Magaca ardayga waa maqan yahay (Missing Name). Hubi in header-ka Excel-ka uu yahay "Name" ama "Magaca".` });
        return false;
      }
      return true;
    });

    // 2. Bulk Check Duplicates (Case Insensitive) - scoped to this school only
    const usernames = rows.map(r => r.username.toLowerCase()).filter(u => u);
    const existingUsers = await prisma.user.findMany({
      where: { username: { in: usernames }, schoolId: finalSchoolId },
      select: { username: true, name: true, role: true }
    });
    const existingMap = new Map(existingUsers.map(u => [u.username.toLowerCase(), u]));

    // 3. Process in Batches
    const validRows = [];
    rows.forEach(r => {
      const normalizedReq = r.username.toLowerCase();
      if (existingMap.has(normalizedReq)) {
        const u = existingMap.get(normalizedReq);
        results.errors.push({ row: r.rowNum, message: `Row ${r.rowNum}: Student ID '${r.username}' taken by ${u.name}` });
      } else {
        validRows.push(r);
      }
    });

    const BATCH_SIZE = 20;

    // Fetch academic year once to use for all enrollments
    const currentYear = await prisma.academicYear.findFirst({
      where: { schoolId: finalSchoolId, isCurrent: true },
      orderBy: { startDate: 'desc' }
    });

    if (!currentYear) {
      return res.status(400).json({ message: 'Ma jiro Sanad Waxbarasho oo furan (No current academic year found). Fadlan horta create-garee sanad waxbarasho.' });
    }

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (row) => {
        try {
          const hashed = await bcrypt.hash(row.password, 10);
          await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
              data: {
                name: String(row.name),
                username: row.username.toLowerCase().trim(),
                password: hashed,
                role: 'student',
                schoolId: finalSchoolId
              }
            });
            const student = await tx.student.create({
              data: {
                userId: user.id,
                student_id: row.username,
                class: row.className,
                classId: row.classId,
                sectionId: row.sectionId || null,
                phone: row.phone ? String(row.phone) : null,
                address: row.address ? String(row.address) : null,
                gender: row.gender ? String(row.gender) : null,
                dob: row.dob ? new Date(row.dob) : null
              }
            });

            await tx.enrollment.create({
              data: {
                studentId: student.id,
                classId: row.classId,
                sectionId: row.sectionId,
                academicYearId: currentYear.id,
                schoolId: finalSchoolId,
                isCurrent: true,
                status: 'active'
              }
            });
          });
          results.success++;
        } catch (err) {
          results.errors.push({ row: row.rowNum, message: `Row ${row.rowNum}: ${err.message}` });
        }
      }));
    }

    res.json({
      message: `Import complete: ${results.success} students created successfully`,
      success: results.success,
      total: rawRows.length,
      errors: results.errors
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: `Import failed: ${err.message}` });
  }
});

// ==================== UPDATE STUDENT ====================
router.put('/:id', authenticateToken, authorizeRoles('admin', 'owner'), requireSchoolAccess(), async (req, res) => {
  const { name, password, class: className, phone, address, gender, dob, student_id, scholarship } = req.body;
  try {
    let schoolId = req.query.schoolId || req.user.schoolId;

    const studentWhere = { id: req.params.id };
    if (schoolId) studentWhere.user = { schoolId };
    else studentWhere.user = { schoolId: 'NONE_AUTHORIZED' };

    const student = await prisma.student.findFirst({
      where: studentWhere,
      include: { user: true }
    });
    if (!student) return res.status(404).json({ message: 'Student not found in your school' });

    const bcrypt = require('bcrypt');

    // Build user update data
    const userData = {};
    if (name) userData.name = name;
    if (password) userData.password = await bcrypt.hash(password, 10);

    // Build student update data
    const studentData = {};
    if (student_id && student_id !== student.student_id) {
      // Check if new student_id is unique within THIS SCHOOL only
      const existing = await prisma.student.findFirst({
        where: { student_id, user: { schoolId }, NOT: { id: req.params.id } }
      });
      if (existing) return res.status(400).json({ message: `Student ID '${student_id}' is already used by another student in this school.` });
      studentData.student_id = student_id;
      // Also update login username to match new student ID
      userData.username = student_id.toLowerCase();
    }
    if (req.body.classId !== undefined) {
      const cid = req.body.classId;
      if (cid) {
        const targetClass = await prisma.class.findUnique({ where: { id: cid } });
        if (!targetClass || targetClass.schoolId !== schoolId) {
          return res.status(403).json({ message: 'Invalid class for this school' });
        }
      }
      studentData.classId = cid || null;
    }

    if (req.body.sectionId !== undefined) {
      const sid = req.body.sectionId;
      if (sid) {
        const targetSection = await prisma.section.findUnique({ where: { id: sid } });
        if (!targetSection || targetSection.schoolId !== schoolId) {
          return res.status(403).json({ message: 'Invalid section for this school' });
        }
      }
      studentData.sectionId = sid || null;
    }
    if (phone !== undefined) studentData.phone = phone || null;
    if (address !== undefined) studentData.address = address || null;
    if (gender !== undefined) studentData.gender = gender || null;
    if (dob !== undefined) studentData.dob = dob ? new Date(dob) : null;
    if (scholarship !== undefined) studentData.scholarship = scholarship || 'none';

    const [updatedUser, updatedStudent] = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id: student.userId }, data: userData });
      const s = await tx.student.update({ where: { id: req.params.id }, data: studentData });

      // Synchronize with Enrollment if class or section changed
      if (studentData.classId !== undefined || studentData.sectionId !== undefined) {
        const currentEnrollment = await tx.enrollment.findFirst({
          where: { studentId: req.params.id, isCurrent: true }
        });

        if (currentEnrollment) {
          await tx.enrollment.update({
            where: { id: currentEnrollment.id },
            data: {
              classId: studentData.classId !== undefined ? studentData.classId : currentEnrollment.classId,
              sectionId: studentData.sectionId !== undefined ? studentData.sectionId : currentEnrollment.sectionId
            }
          });
        }
      }
      return [u, s];
    });

    res.json({ user: updatedUser, student: updatedStudent });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ message: 'Username already exists' });
    res.status(500).json({ message: err.message });
  }
});

// ==================== DELETE STUDENT ====================
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'owner', 'super_admin'), requireSchoolAccess(), async (req, res) => {
  try {
    let schoolId = req.query.schoolId || req.user.schoolId;

    const studentWhere = { id: req.params.id };
    if (schoolId) studentWhere.user = { schoolId };
    else studentWhere.user = { schoolId: 'NONE_AUTHORIZED' };

    const student = await prisma.student.findFirst({
      where: studentWhere
    });
    if (!student) return res.status(404).json({ message: 'Student not found in your school' });

    await prisma.user.delete({ where: { id: student.userId } });
    if (router.clearCache) router.clearCache();
    res.json({ message: 'Ardayga iyo xogtiisa waa la tirtiray si guul ah' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ==================== BULK DELETE BY SECTION ====================
router.delete('/bulk-delete/section/:sectionId', authenticateToken, authorizeRoles('admin', 'owner', 'super_admin'), requireSchoolAccess(), async (req, res) => {
  try {
    let schoolId = req.query.schoolId || req.user.schoolId;

    if (!schoolId) return res.status(403).json({ message: 'Authorization required or schoolId missing' });

    // 1. Verify the section belongs to this school
    const section = await prisma.section.findFirst({
      where: { id: req.params.sectionId, schoolId }
    });

    if (!section) {
      return res.status(404).json({ message: 'Section not found or does not belong to your school' });
    }

    // 2. Find all students in this section
    const students = await prisma.student.findMany({
      where: { sectionId: req.params.sectionId, user: { schoolId } },
      select: { userId: true }
    });

    if (students.length === 0) {
      return res.json({ message: 'No students found in this section to delete', count: 0 });
    }

    const userIds = students.map(s => s.userId);

    // 3. Delete all Users (Cascading leads to Student deletion)
    const result = await prisma.user.deleteMany({
      where: { id: { in: userIds }, schoolId }
    });

    // 4. Invalidate cache
    if (router.clearCache) router.clearCache();

    res.json({
      message: `Dhammaan ardaydii qaybtan (Section) ku jirtay waa la tirtiray. Tirada la tirtiray: ${result.count}`,
      count: result.count
    });
  } catch (err) {
    console.error('Bulk delete failed:', err);
    res.status(500).json({ message: err.message });
  }
});



module.exports = router;
