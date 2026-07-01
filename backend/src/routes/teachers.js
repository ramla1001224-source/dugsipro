const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');
const cacheMiddleware = require('../middleware/cacheMiddleware');
const cache = require('../lib/cache');


// Multer config — store in memory (for Excel imports)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ==================== GET ALL TEACHERS ====================
router.get('/', authenticateToken, async (req, res) => {
  try {
    let schoolId = req.user.schoolId;
    if ((req.user.role || '').toLowerCase() === 'super_admin' && req.query.schoolId) {
      schoolId = req.query.schoolId;
    }

    // If schoolId is missing from token, recover from User record
    if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user) schoolId = user.schoolId;
      } catch (err) {
        console.error('Teachers Recovery Error:', err);
      }
    }

    if (!schoolId && !['super_admin', 'owner'].includes(req.user.role)) {
      return res.status(400).json({ message: 'School ID required' });
    }

    const { page, limit, withAssignments } = req.query;

    const where = schoolId ? { user: { schoolId } } : { user: { schoolId: 'NONE_AUTHORIZED' } };
    const p = Number(page) || 1;
    const l = Math.min(Number(limit) || 50, 500); // Reduced default: 50 (was 200)
    const skip = (p - 1) * l;

    // Load SubjectAssignments by default so that the UI can show assigned classes
    const includeAssignments = withAssignments !== 'false';

    const [teachers, total] = await Promise.all([
      prisma.teacher.findMany({
        where,
        select: {
          id: true,
          subject: true,
          phone: true,
          salary: true,
          gender: true,
          userId: true,
          // Only fetch necessary user fields — drops password hash, large timestamps etc.
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              phone: true,
              isActive: true,
              role: true,
              created_at: true
            }
          },
          // Only include assignments when the assignment/scheduling page asks for them
          ...(includeAssignments ? {
            SubjectAssignments: {
              include: {
                section: { include: { class: true } },
                subject: true
              }
            }
          } : {})
        },
        skip,
        take: l,
        orderBy: { user: { name: 'asc' } }
      }),
      prisma.teacher.count({ where })
    ]);

    // Send total count in headers if needed later, but keep response as array for frontend compatibility
    res.setHeader('X-Total-Count', total);
    res.setHeader('X-Total-Pages', Math.ceil(total / l));

    return res.json(teachers);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ==================== CREATE SINGLE TEACHER ====================
router.post('/create', authenticateToken, authorizeRoles('admin', 'owner', 'super_admin'), async (req, res) => {
  const { name, username, password, subject, phone, salary } = req.body;
  if (!name || !username || !password) return res.status(400).json({ message: 'Missing fields' });
  const bcrypt = require('bcrypt');
  const hashed = await bcrypt.hash(password, 10);
  const normalizedUsername = username.toLowerCase();

  try {
    let schoolId = req.user.schoolId;
    if (req.user.role === 'super_admin' && req.query.schoolId) {
      schoolId = req.query.schoolId;
    }

    const existingUser = await prisma.user.findFirst({ where: { username: normalizedUsername, schoolId } });
    if (existingUser) {
      return res.status(400).json({
        message: `Username '${username}' is already taken by ${existingUser.name} (${existingUser.role.toUpperCase()}) in this school.`
      });
    }

    const teacher = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { name, username: normalizedUsername.trim(), password: hashed, role: 'teacher', schoolId }
      });
      return await tx.teacher.create({
        data: { userId: newUser.id, subject, phone, salary: salary ? Number(salary) : undefined }
      });
    });
    res.json(teacher);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ message: 'Username already exists in this school' });
    res.status(500).json({ message: err.message });
  }
});

// ==================== DOWNLOAD EXCEL TEMPLATE ====================
router.get('/template', authenticateToken, authorizeRoles('admin', 'owner'), (req, res) => {
  const wb = XLSX.utils.book_new();
  const headers = [['Name', 'Username', 'Password', 'Subject', 'Phone', 'Salary', 'Gender']];
  // Add example row
  headers.push(['Fatima Ali', 'fatima_ali', 'pass1234', 'Mathematics', '0615556677', '500', 'Female']);
  const ws = XLSX.utils.aoa_to_sheet(headers);

  // Set column widths
  ws['!cols'] = [
    { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 12 }, { wch: 10 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Teachers');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=teachers_template.xlsx');
  res.send(buffer);
});

// Helper for fuzzy column matching
const getValue = (row, possibleKeys) => {
  const rowKeys = Object.keys(row);
  const lowerKeys = rowKeys.map(k => k.toLowerCase().trim());
  const foundKeyIndex = lowerKeys.findIndex(k => possibleKeys.includes(k));
  return foundKeyIndex !== -1 ? row[rowKeys[foundKeyIndex]] : null;
};

// ==================== BULK IMPORT FROM EXCEL ====================
router.post('/import', authenticateToken, authorizeRoles('admin', 'owner'), upload.single('file'), async (req, res) => {
  const schoolId = (req.user.role === 'super_admin' || req.user.role === 'owner') ? (req.query.schoolId || req.user.schoolId) : req.user.schoolId;
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(ws);

    if (!rawRows.length) return res.status(400).json({ message: 'Excel file is empty' });

    const bcrypt = require('bcrypt');
    const results = { success: 0, errors: [] };

    // 1. Normalize Rows
    const rows = rawRows.map((row, index) => {
      const name = getValue(row, ['name', 'magaca', 'fullname', 'full name', 'teacher name']) || null;
      let username = String(getValue(row, ['username', 'user name', 'login']) || '').trim();
      let password = String(getValue(row, ['password', 'pass', 'pincode']) || '').trim();

      if (name && !username) {
        username = name.toLowerCase().replace(/\s+/g, '').trim();
      }
      if (name && !password) {
        password = '123123';
      }

      return {
        rowNum: index + 2,
        name,
        username,
        password,
        subject: getValue(row, ['subject', 'maadada', 'course']) || null,
        phone: getValue(row, ['phone', 'telefon', 'mobile', 'cell']) || null,
        salary: getValue(row, ['salary', 'mushaharka', 'wage']) || null,
        gender: getValue(row, ['gender', 'jinsiga', 'sex']) || null
      };
    }).filter(r => r.name || r.username);

    // 2. Bulk Check Duplicates (Case Insensitive)
    const usernames = rows.map(r => r.username.toLowerCase()).filter(u => u);
    const existingUsers = await prisma.user.findMany({
      where: { username: { in: usernames }, schoolId },
      select: { username: true, name: true, role: true }
    });
    const existingMap = new Map(existingUsers.map(u => [u.username.toLowerCase(), u]));

    // 2b. Ensure Subjects Exist
    const uniqueSubjects = [...new Set(rows.map(r => r.subject).filter(s => s))];
    for (const subjName of uniqueSubjects) {
      const exists = await prisma.subject.findFirst({ where: { name: { equals: subjName, mode: 'insensitive' } } });
      if (!exists) {
        // Create subject if not exists (Auto-generate code)
        const code = subjName.substring(0, 3).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900);
        await prisma.subject.create({ data: { name: subjName, code } });
      }
    }

    // 3. Process in Batches
    const validRows = [];
    rows.forEach(r => {
      const normalizedReq = r.username.toLowerCase();
      if (!r.name || !r.username || !r.password) {
        results.errors.push({ row: r.rowNum, message: 'Row ' + r.rowNum + ': Missing required fields' });
      } else if (existingMap.has(normalizedReq)) {
        const u = existingMap.get(normalizedReq);
        results.errors.push({ row: r.rowNum, message: `Row ${r.rowNum}: Username '${r.username}' taken by ${u.name} (${u.role.toUpperCase()})` });
      } else {
        validRows.push(r);
      }
    });

    const BATCH_SIZE = 20;
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
                role: 'teacher',
                schoolId // CRITICAL: Save schoolId
              }
            });
            await tx.teacher.create({
              data: {
                userId: user.id,
                subject: row.subject ? String(row.subject) : null,
                phone: row.phone ? String(row.phone) : null,
                salary: row.salary ? Number(row.salary) : null,
                gender: row.gender ? String(row.gender) : null
              }
            });
          });
          results.success++;
        } catch (err) {
          results.errors.push({ row: row.rowNum, message: `Row ${row.rowNum}: ${err.message} ` });
        }
      }));
    }

    res.json({
      message: `Import complete: ${results.success} teachers created successfully`,
      success: results.success,
      total: rawRows.length,
      errors: results.errors
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: `Import failed: ${err.message} ` });
  }
});

// ==================== UPDATE TEACHER ====================
router.put('/:id', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
  const { name, username, password, subject, phone, salary, gender } = req.body;
  try {
    const schoolId = (req.user.role === 'super_admin' || req.user.role === 'owner') ? (req.query.schoolId || req.user.schoolId) : req.user.schoolId;

    const teacherWhere = { id: req.params.id };
    if (schoolId) teacherWhere.user = { schoolId };
    else if (req.user.role !== 'super_admin' && req.user.role !== 'owner') teacherWhere.user = { schoolId: 'none' };

    const teacher = await prisma.teacher.findFirst({
      where: teacherWhere,
      include: { user: true }
    });
    if (!teacher) return res.status(404).json({ message: 'Teacher not found in your school' });

    const bcrypt = require('bcrypt');

    // Build user update data
    const userData = {};
    if (name) userData.name = name;
    if (username) {
      userData.username = username.toLowerCase();
      // Check if this new username is already taken by ANOTHER user in THIS school
      const conflict = await prisma.user.findFirst({
        where: { username: userData.username, schoolId, NOT: { id: teacher.userId } }
      });
      if (conflict) {
        return res.status(400).json({
          message: `Username '${username}' is already taken by ${conflict.name} (${conflict.role.toUpperCase()}) in this school.`
        });
      }
    }
    if (password) userData.password = await bcrypt.hash(password, 10);

    // Build teacher update data
    const teacherData = {};
    if (subject !== undefined) teacherData.subject = subject || null;
    if (phone !== undefined) teacherData.phone = phone || null;
    if (salary !== undefined) teacherData.salary = salary ? Number(salary) : null;
    if (gender !== undefined) teacherData.gender = gender || null;

    const [updatedUser, updatedTeacher] = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id: teacher.userId }, data: userData });
      const t = await tx.teacher.update({ where: { id: req.params.id }, data: teacherData });

      // If salary changed, update all pending SalaryRecords
      if (salary !== undefined) {
        const newSalary = salary ? Number(salary) : 0;
        const pendingRecords = await tx.salaryRecord.findMany({
          where: { teacherId: req.params.id, status: 'pending' }
        });

        for (const record of pendingRecords) {
          const net = newSalary - record.deductions + record.bonus;
          await tx.salaryRecord.update({
            where: { id: record.id },
            data: { baseSalary: newSalary, netSalary: net }
          });
        }
      }
      return [u, t];
    });

    res.json({ user: updatedUser, teacher: updatedTeacher });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ message: 'Username already exists' });
    res.status(500).json({ message: err.message });
  }
});

// ==================== DELETE TEACHER ====================
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
  try {
    const schoolId = (req.user.role === 'super_admin' || req.user.role === 'owner') ? (req.query.schoolId || req.user.schoolId) : req.user.schoolId;

    const teacherWhere = { id: req.params.id };
    if (schoolId) teacherWhere.user = { schoolId };
    else if (req.user.role !== 'super_admin' && req.user.role !== 'owner') teacherWhere.user = { schoolId: 'none' };

    const teacher = await prisma.teacher.findFirst({
      where: teacherWhere
    });
    if (!teacher) return res.status(404).json({ message: 'Teacher not found in your school' });

    // Deleting the User record automatically deletes the Teacher profile and all associated 
    // data (salary records, assignments, etc.) through 'onDelete: Cascade' in the database.
    await prisma.user.delete({ where: { id: teacher.userId } });
    res.json({ message: 'Macalinka iyo xogtiisa waa la tirtiray si guul ah' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ==================== GET TEACHER ASSIGNMENTS ====================
router.get('/:id/assignments', authenticateToken, authorizeRoles('admin', 'teacher'), async (req, res) => {
  try {
    const schoolId = (req.user.role === 'super_admin' || req.user.role === 'owner') ? (req.query.schoolId || req.user.schoolId) : req.user.schoolId;
    const teacherWhere = { id: req.params.id };
    if (schoolId) teacherWhere.user = { schoolId };
    const teacher = await prisma.teacher.findFirst({
      where: teacherWhere
    });
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

    const assignments = await prisma.subjectAssignment.findMany({
      where: { teacherId: req.params.id },
      include: {
        section: { include: { class: true } },
        subject: true
      }
    });
    res.json(assignments);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ==================== UPDATE TEACHER ASSIGNMENTS ====================
router.post('/:id/assignments', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
  const { assignments } = req.body; // Expects array of { classId, subjectId } OR { sectionId, subjectId }
  if (!Array.isArray(assignments)) return res.status(400).json({ message: 'Invalid format' });

  try {
    const schoolId = (req.user.role === 'super_admin' || req.user.role === 'owner') ? (req.query.schoolId || req.user.schoolId) : req.user.schoolId;
    const teacherWhere = { id: req.params.id };
    if (schoolId) teacherWhere.user = { schoolId };

    const teacher = await prisma.teacher.findFirst({
      where: teacherWhere
    });
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

    await prisma.$transaction(async (tx) => {
      // 1. Remove all existing assignments for this teacher
      await tx.subjectAssignment.deleteMany({ where: { teacherId: req.params.id } });

      // 2. Create new assignments
      if (assignments.length > 0) {
        // Optimization: Fetch all needed sections in one query to avoid N+1 inside transaction
        const classIds = [...new Set(assignments.filter(a => a.classId).map(a => a.classId))];
        let allSections = [];
        if (classIds.length > 0) {
          // Relaxing schoolId filter here to ensure sections are found even if schoolId is missing in token (Super Admin)
          // Class UUID is unique enough.
          const sectionWhere = { classId: { in: classIds } };
          allSections = await tx.section.findMany({ where: sectionWhere });
          console.log(`[Assign] Found ${allSections.length} sections for ${classIds.length} classes`);
        }

        const finalAssignments = [];
        for (const a of assignments) {
          if (a.sectionId) {
            finalAssignments.push({
              teacherId: req.params.id,
              sectionId: a.sectionId,
              subjectId: a.subjectId
            });
          } else if (a.classId) {
            const sections = allSections.filter(s => s.classId === a.classId);
            for (const s of sections) {
              finalAssignments.push({
                teacherId: req.params.id,
                sectionId: s.id,
                subjectId: a.subjectId
              });
            }
          }
        }

        if (finalAssignments.length > 0) {
          // 3. Optimized Conflict Cleanup: Remove conflicting assignments from OTHER teachers in one query
          // Using OR filter for all section+subject pairs
          const conflictFilter = finalAssignments.map(a => ({
            subjectId: a.subjectId,
            sectionId: a.sectionId,
            teacherId: { not: req.params.id }
          }));

          await tx.subjectAssignment.deleteMany({
            where: { OR: conflictFilter }
          });

          // 4. Create new assignments one-by-one to avoid createMany skipDuplicate quirks and ensures atomic persistence
          for (const fa of finalAssignments) {
            await tx.subjectAssignment.upsert({
              where: {
                subjectId_sectionId: {
                  subjectId: fa.subjectId,
                  sectionId: fa.sectionId
                }
              },
              create: fa,
              update: fa // Explicitly transfer teaching responsibility if someone else was there
            });
          }
          console.log(`[Assign] Successfully processed ${finalAssignments.length} links for teacher ${req.params.id}`);

          // Update the teacher's primary subject summary field (comma-separated list for table view)
          const assignedSubjectIds = [...new Set(finalAssignments.map(a => a.subjectId))];
          const assignedSubjects = await tx.subject.findMany({
            where: { id: { in: assignedSubjectIds } },
            select: { name: true }
          });
          const subjectSummary = assignedSubjects.map(s => s.name).join(', ');

          await tx.teacher.update({
            where: { id: req.params.id },
            data: { subject: subjectSummary || 'General' }
          });
          console.log(`[Assign] Updated teacher summary to: ${subjectSummary}`);
        } else {
          // No assignments selected? Reset the subject summary field
          await tx.teacher.update({
            where: { id: req.params.id },
            data: { subject: '' }
          });
        }
      }
    }, {
      timeout: 30000 // Extended timeout to handle bulk assignments reliably
    });

    // 🛑 Aggressive Cache Clearing: Ensure the UI sees fresh data immediately
    await cache.delByPrefix('route:/api/teachers:');
    await cache.delByPrefix('route:/api/classes:');
    // Also clear specific IDs in case they are cached individually
    await cache.del(`route:/api/teachers/${req.params.id}/assignments`);

    res.json({ message: 'Waa la xiriiriyay fasallada iyo maadooyinka si guul ah.' });

  } catch (err) {
    console.error('Assignment error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
