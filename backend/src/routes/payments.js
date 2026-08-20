const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles, requireSchoolAccess } = require('../middleware/auth');
const crypto = require('crypto');
const responseHelper = require('../utils/responseHelper');
const { resolveStudentTuitionFee, resolveStudentTuitionFeeByStudentId, selectEnrollment } = require('../utils/paymentHelper');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');


router.get('/debug-info', authenticateToken, async (req, res) => {
  try {
    const parent = await prisma.parent.findUnique({
      where: { userId: req.user.id },
      include: { Children: true }
    });
    const studentIds = parent ? parent.Children.map(c => c.studentId) : [];
    const records = await prisma.monthlyPaymentRecord.findMany({
      where: { studentId: { in: studentIds } }
    });
    res.json({ userId: req.user.id, role: req.user.role, studentIds, records });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    let schoolId = req.query.schoolId || req.user.schoolId;

    // If schoolId is missing from token, recover from User record
    const userRole = (req.user.role || '').toLowerCase();
    if (!schoolId && !['super_admin', 'owner'].includes(userRole)) {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user) schoolId = user.schoolId;
      } catch (err) {
        console.error('Payments Recovery Error:', err);
      }
    }
    let where = schoolId ? { schoolId } : { schoolId: 'NONE_AUTHORIZED' };
    const { classId, sectionId, month, year, studentId, page, limit } = req.query;
    
    if (studentId) {
      // Identity Unification for Admins: fetch all related records for this student
      const targetStudent = await prisma.student.findUnique({ 
        where: { id: studentId },
        include: { user: true }
      });
      if (targetStudent) {
        const orConditions = [{ id: targetStudent.id }];
        if (targetStudent.userId) orConditions.push({ userId: targetStudent.userId });
        if (targetStudent.student_id && targetStudent.student_id.trim() !== '') {
          orConditions.push({
            AND: [
              { student_id: { equals: targetStudent.student_id, mode: 'insensitive' } },
              { user: { schoolId: schoolId || targetStudent.user?.schoolId } }
            ]
          });
        }
        const related = await prisma.student.findMany({
          where: { OR: orConditions },
          select: { id: true }
        });
        const relatedIds = [...new Set(related.map(r => r.id))];
        where.studentId = { in: relatedIds };
      } else {
        where.studentId = studentId;
      }
    }

    if (req.user.role === 'student') {
      const student = await prisma.student.findFirst({ where: { userId: req.user.id } });
      if (!student) return res.status(404).json({ message: 'Student record not found' });
      
        const orConditions = [{ id: student.id }];
        if (student.userId) orConditions.push({ userId: student.userId });
        if (student.student_id && student.student_id.trim() !== '') {
          orConditions.push({ student_id: student.student_id });
        }
        const relatedStudents = await prisma.student.findMany({
          where: { OR: orConditions },
          select: { id: true }
        });
      const relatedIds = [...new Set(relatedStudents.map(s => s.id))];
      where = { studentId: { in: relatedIds }, ...(schoolId ? { schoolId } : {}) };
    } else if (req.user.role === 'parent') {
      const parent = await prisma.parent.findUnique({
        where: { userId: req.user.id },
        include: { Children: { include: { student: true } } }
      });
      if (!parent) return res.status(404).json({ message: 'Parent record not found' });
      
      let allRelatedIds = [];
      for (const child of parent.Children) {
          if (child.student) {
              const related = await prisma.student.findMany({
                  where: {
                      OR: [
                          { userId: child.student.userId },
                          { student_id: child.student.student_id }
                      ]
                  },
                  select: { id: true }
              });
              allRelatedIds.push(...related.map(r => r.id));
          }
      }
      const uniqueStudentIds = [...new Set(allRelatedIds)];
      where = { studentId: { in: uniqueStudentIds }, ...(schoolId ? { schoolId } : {}) };
    }

    // If filtering by class/section, use enrollment records for historical accuracy
    if (classId || sectionId) {
      const filterMonth = parseInt(month) || (new Date().getMonth() + 1);
      const filterYear = parseInt(year) || new Date().getFullYear();
      const midMonthDate = new Date(filterYear, filterMonth - 1, 15);

      let academicYear = await prisma.academicYear.findFirst({
        where: {
          schoolId,
          startDate: { lte: midMonthDate },
          endDate: { gte: midMonthDate }
        }
      });

      const currentAcademicYear = await prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true }
      });

      if (currentAcademicYear) {
        const startYr = new Date(currentAcademicYear.startDate).getFullYear();
        const endYr = new Date(currentAcademicYear.endDate).getFullYear();
        if ((filterYear >= startYr && filterYear <= endYr) || !academicYear) {
          academicYear = currentAcademicYear;
        }
      }

      const enrollmentWhere = {
        schoolId,
        isCurrent: true, // Priority 1: only show currently active students
        ...(academicYear ? { academicYearId: academicYear.id } : {}),
        ...(classId ? { classId } : {}),
        ...(sectionId && sectionId !== 'all_sections' ? { sectionId } : {}),
      };

      const enrollments = await prisma.enrollment.findMany({
        where: enrollmentWhere,
        select: { studentId: true }
      });

      const matchedIds = enrollments.map(e => e.studentId);
      
      if (where.studentId) {
        // If a specific studentId was already requested, ensure they are in the matched set
        if (typeof where.studentId === 'string') {
          if (!matchedIds.includes(where.studentId)) where.studentId = 'NONE_FOUND';
        } else if (where.studentId.in) {
          where.studentId.in = where.studentId.in.filter(id => matchedIds.includes(id));
        }
      } else {
        where.studentId = { in: matchedIds };
      }
    }

    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);

    // Support startDate filter (used by parent dashboard for 3-month recent payments)
    if (req.query.startDate) {
      const startDate = new Date(req.query.startDate);
      if (!isNaN(startDate.getTime())) {
        where.date = { ...( where.date || {}), gte: startDate };
      }
    }

    if (req.query.academicYearId) {
      where.OR = [
        { academicYearId: req.query.academicYearId },
        { academicYearId: null } // Include legacy records that don't have it set
      ];
    } else if (['student', 'parent'].includes((req.user.role || '').toLowerCase()) && !month && !year) {
      const activeYear = await prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true }
      });
      if (activeYear) {
        where.OR = [
          { academicYearId: activeYear.id },
          { academicYearId: null, date: { gte: new Date(activeYear.startDate), lte: new Date(activeYear.endDate) } }
        ];
      }
    }

    const p = Number(page) || 1;
    const l = Math.min(Number(limit) || 200, 500); // Max 500
    const skip = (p - 1) * l;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: { student: { include: { user: true } } },
        skip,
        take: l,
        orderBy: { date: 'desc' }
      }),
      prisma.payment.count({ where })
    ]);

    // Send total count in headers if needed later, but keep response as array for frontend compatibility
    res.setHeader('X-Total-Count', total);
    res.setHeader('X-Total-Pages', Math.ceil(total / l));

    return res.json(payments);
  } catch (err) { res.status(500).json({ message: err.message }); }
});


router.get('/monthly-records', authenticateToken, async (req, res) => {
  try {
    let schoolId = req.user.schoolId;
    if (req.user.role === 'super_admin' && req.query.schoolId) {
      schoolId = req.query.schoolId;
    }

    // If schoolId is missing from token, recover from User record
    if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user) schoolId = user.schoolId;
      } catch (err) {
        console.error('Monthly Records Recovery Error:', err);
      }
    }
    
    let studentIds = [];
    let autoCreateIds = []; // Only for current active records

    if (req.user.role === 'student' || req.user.role === 'Student') {
      const student = await prisma.student.findFirst({ where: { userId: req.user.id } });
      if (student) {
        const orConditions = [{ id: student.id }];
        if (student.userId) orConditions.push({ userId: student.userId });
        if (student.student_id && student.student_id.trim() !== '') {
          orConditions.push({ student_id: { equals: student.student_id, mode: 'insensitive' } });
        }
        const related = await prisma.student.findMany({
          where: { OR: orConditions },
          include: { Enrollments: { where: { isCurrent: true } } }
        });
        studentIds = related.map(s => s.id);
        autoCreateIds = related.filter(s => s.Enrollments.length > 0).map(s => s.id);
        // Fallback: if no current enrollment found, use the latest record for auto-creation
        if (autoCreateIds.length === 0 && studentIds.length > 0) autoCreateIds = [studentIds[0]];
      }
    } else if (req.user.role === 'parent' || req.user.role === 'Parent') {
      const parentLinks = await prisma.parentStudent.findMany({
        where: { parent: { userId: req.user.id } },
        include: { student: { include: { Enrollments: { where: { isCurrent: true } } } } }
      });
      studentIds = parentLinks.map(l => l.studentId);
      autoCreateIds = parentLinks.filter(l => l.student?.Enrollments?.length > 0).map(l => l.studentId);
    } else if (req.query.studentId) {
      const sid = req.query.studentId;
      studentIds.push(sid);
      const hasCurrent = await prisma.enrollment.findFirst({ where: { studentId: sid, isCurrent: true } });
      if (hasCurrent) autoCreateIds.push(sid);
    }

    if (studentIds.length === 0) {
      console.log('[DEBUG-PAYMENTS] No student IDs found for user:', req.user.id, 'Role:', req.user.role);
      return res.json([]);
    }

    const now = new Date();
    const m = now.getMonth() + 1;
    const y = now.getFullYear();

    // EGRESS FIX: Batch-fetch all students at once — eliminates N+1 queries (was 1 query per student)
    const studentDataMap = new Map();
    if (autoCreateIds.length > 0) {
      const batchStudents = await prisma.student.findMany({
        where: { id: { in: autoCreateIds } },
        include: { Enrollments: { include: { academicYear: true } } }
      });
      batchStudents.forEach(s => studentDataMap.set(s.id, s));
    }

    // Ensure current month record exists - ONLY for active students to avoid duplicates
    for (const studentId of autoCreateIds) {
      try {
        // Use pre-fetched data from the map — zero DB calls inside loop
        const student = studentDataMap.get(studentId);
        const enrollment = selectEnrollment(student?.Enrollments || [], m, y);
        const ayId = enrollment?.academicYearId;

        if (ayId) {
          await prisma.$executeRawUnsafe(`
            INSERT INTO "MonthlyPaymentRecord" (id, "studentId", month, year, status, "updatedAt", "academicYearId")
            VALUES ($1, $2, $3, $4, 'unpaid', NOW(), $5)
            ON CONFLICT ("studentId", month, year, "academicYearId") DO NOTHING
          `, crypto.randomUUID(), studentId, m, y, ayId);
        } else {
          // Backward compatibility if no enrollment found
          await prisma.$executeRawUnsafe(`
            INSERT INTO "MonthlyPaymentRecord" (id, "studentId", month, year, status, "updatedAt")
            VALUES ($1, $2, $3, $4, 'unpaid', NOW())
            ON CONFLICT ("studentId", month, year, "academicYearId") DO NOTHING
          `, crypto.randomUUID(), studentId, m, y);
        }
      } catch (e) {
        console.error(`[DEBUG-PAYMENTS] INSERT failed for student ${studentId}:`, e.message);
      }
    }

    const currentYear = await prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true }
    });

    const records = await prisma.monthlyPaymentRecord.findMany({
      where: {
        studentId: { in: studentIds },
        // If we are in the context of a current year, only show its records (User Request: Isolation)
        ...(currentYear ? { 
            OR: [
                { academicYearId: currentYear.id },
                { academicYearId: null } // Legacy support
            ]
        } : {})
      },
      select: {
        id: true,
        studentId: true,
        month: true,
        year: true,
        status: true,
        updatedAt: true,
        academicYearId: true,
        student: { 
          include: { 
            user: true,
            Enrollments: {
              include: {
                clss: { include: { FeeStructures: true } },
                section: { include: { FeeStructures: true } },
                academicYear: true
              }
            },
            Payment: {
                select: { id: true, month: true, year: true, academicYearId: true }
            }
          } 
        } 
      },
      orderBy: [ { year: 'desc' }, { month: 'desc' } ],
      take: 50
    });

    // Fetch all relevant fee structures for the school once to avoid N+1 queries
    const allSchoolFees = await prisma.feeStructure.findMany({
      where: { schoolId: schoolId || 'NONE', frequency: 'monthly' },
      include: { clss: { select: { class_name: true } } }
    });

    // Map records to include expected fee and actual payment id
    const formatted = await Promise.all(records.map(async (r) => {
      const enrollment = selectEnrollment(r.student?.Enrollments || [], r.month, r.year);
      // Find the payment id for this specific month/year
      const paymentRecord = r.student?.Payment?.find(p => p.month === r.month && p.year === r.year);
      
      // Use pre-fetched fees to avoid 50+ extra DB calls
      const expectedAmount = await resolveStudentTuitionFee(prisma, enrollment, r.student, allSchoolFees);

      return {
        ...r,
        expectedAmount,
        remainingAmount: Math.max(0, expectedAmount - (r.amountPaid || 0)),
        paymentId: paymentRecord?.id
      };
    }));

    res.json(formatted);
  } catch (err) { 
    console.error('[ERROR-MONTHLY-RECORDS]:', err);
    res.status(500).json({ message: err.message, stack: err.stack }); 
  }
});

router.post('/create', authenticateToken, authorizeRoles('admin', 'owner', 'accountant'), async (req, res) => {
  const { studentId, amount, payment_method, month, year, description, transactionId, phoneNumber } = req.body;
  if (!studentId || amount === undefined || amount === null) return res.status(400).json({ message: 'Missing fields' });

  const numericAmount = Number(amount);
  if (isNaN(numericAmount)) return res.status(400).json({ message: 'Invalid amount' });

  try {
    // Find student first to determine its school if context schoolId is missing
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { 
        user: true,
        Enrollments: { where: { isCurrent: true }, take: 1 }
      }
    });

    if (!student) return res.status(404).json({ message: 'Ardayga lama helin.' });

    let schoolId = req.user.schoolId;
    if (req.user.role === 'super_admin' && req.query.schoolId) {
      schoolId = req.query.schoolId;
    }

    // If schoolId is missing from token, recover from User record
    if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user) schoolId = user.schoolId;
      } catch (err) {
        console.error('Payment Create Recovery Error:', err);
      }
    }
    
    // If user is super_admin/owner and no schoolId in request, use the student's schoolId
    if (!schoolId && (req.user.role === 'super_admin' || req.user.role === 'owner')) {
      schoolId = student.user.schoolId;
    }

    const enrollment = selectEnrollment(student.Enrollments || [], month ? parseInt(month) : null, year ? parseInt(year) : null);
    
    const data = {
      studentId,
      amount: numericAmount,
      payment_method: payment_method || 'Cash',
      description: description || 'Miscellaneous Fee',
      transactionId,
      phoneNumber,
      schoolId: schoolId || student.user.schoolId,
      academicYearId: enrollment?.academicYearId || null
    };
    if (month) data.month = parseInt(month);
    if (year) data.year = parseInt(year);

    const p = await prisma.payment.create({ data });
    res.json(p);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get monthly payment status for a class/month/year
router.get('/monthly-status', authenticateToken, authorizeRoles('admin', 'owner', 'accountant'), async (req, res) => {
  const { classId, sectionId, month, year } = req.query;
  if (!month || !year) return res.status(400).json({ message: 'Missing month or year' });

  try {
    let schoolId = req.user.schoolId;
    if (req.user.role === 'super_admin' && req.query.schoolId) {
      schoolId = req.query.schoolId;
    }

    // If schoolId is missing from token, recover from User record
    if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user) schoolId = user.schoolId;
      } catch (err) {
        console.error('Monthly Status Recovery Error:', err);
      }
    }
    // Determine Academic Year for this month/year
    const dateOfPayment = new Date(year, month - 1, 15); // Use mid-month for range check
    let academicYear = await prisma.academicYear.findFirst({
      where: {
        schoolId,
        startDate: { lte: dateOfPayment },
        endDate: { gte: dateOfPayment }
      }
    });

    const currentAcademicYear = await prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true }
    });

    if (currentAcademicYear) {
      const startYr = new Date(currentAcademicYear.startDate).getFullYear();
      const endYr = new Date(currentAcademicYear.endDate).getFullYear();
      // Prioritize current if the year queried sits within its start/end year range, or if no other year matched.
      if ((parseInt(year) >= startYr && parseInt(year) <= endYr) || !academicYear) {
        academicYear = currentAcademicYear;
      }
    }

    if (!academicYear) return res.status(400).json({ message: 'No academic year found for the specified month/year.' });

    // Fetch students via Enrollment for that academic year
    const enrollments = await prisma.enrollment.findMany({
      where: {
        schoolId,
        status: { in: ['active', 'promoted', 'retained'] },
        OR: [
          { academicYearId: academicYear.id, isCurrent: true },
          { isCurrent: true }
        ],
        ...(classId ? { classId } : {}),
        ...(sectionId ? { sectionId } : {}),
        ...(req.query.shift ? { section: { shift: { equals: req.query.shift.toLowerCase(), mode: 'insensitive' } } } : {})
      },
      include: {
        student: {
          include: {
            user: true,
            MonthlyPaymentRecord: {
              where: { 
                month: parseInt(month), 
                year: parseInt(year),
                OR: [
                    { academicYearId: academicYear.id },
                    { academicYearId: null } // Fallback for legacy records
                ]
              },
              select: { id: true, studentId: true, month: true, year: true, status: true, amountPaid: true }
            },
            Enrollments: {
              where: { isCurrent: true },
              include: {
                clss: { include: { FeeStructures: { where: { name: 'Tuition Fee' } } } },
                section: { include: { FeeStructures: { where: { name: 'Tuition Fee' } } } }
              },
              take: 1
            }
          }
        }
      }
    });

    // Pre-fetch all school fee structures once
    let schoolId2 = req.user.schoolId;
    if (!schoolId2) {
      try {
        const u = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (u) schoolId2 = u.schoolId;
      } catch (_) {}
    }
    const allSchoolFees = await prisma.feeStructure.findMany({
      where: { schoolId: schoolId2 || 'NONE', name: 'Tuition Fee', frequency: 'monthly' }
    });

    const results = await Promise.all(enrollments.map(async e => {
      const rec = e.student.MonthlyPaymentRecord[0];
      const enrollment = e.student.Enrollments?.[0];
      // Resolve class fee: section fee → class fee → school default
      let classFee = 0;
      if (enrollment) {
        const sectionFee = enrollment.section?.FeeStructures?.[0]?.amount;
        const classFeeVal = enrollment.clss?.FeeStructures?.[0]?.amount;
        const schoolFee = allSchoolFees.find(f => f.classId === enrollment.classId)?.amount;
        classFee = sectionFee ?? classFeeVal ?? schoolFee ?? 0;
      }
      return {
        studentId: e.studentId,
        name: e.student.user.name,
        student_id: e.student.student_id,
        status: rec?.status || 'unpaid',
        amountPaid: rec?.amountPaid || 0,
        classFee
      };
    }));

    res.json(results);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PDF export route for monthly fee status
router.get('/monthly-status/pdf', authenticateToken, authorizeRoles('admin', 'owner', 'accountant'), async (req, res) => {
  const { classId, sectionId, month, year } = req.query;
  if (!month || !year) return res.status(400).json({ message: 'Missing month or year' });

  try {
    let schoolId = req.user.schoolId;
    if (req.user.role === 'super_admin' && req.query.schoolId) schoolId = req.query.schoolId;
    if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
      try {
        const u = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (u) schoolId = u.schoolId;
      } catch (err) { console.error('PDF monthly-status schoolId recovery:', err); }
    }

    const school = schoolId ? await prisma.school.findUnique({ where: { id: schoolId } }) : null;
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthName = monthNames[parseInt(month) - 1] || month;

    const dateOfPayment = new Date(year, month - 1, 15);
    let academicYear = await prisma.academicYear.findFirst({
      where: { schoolId, startDate: { lte: dateOfPayment }, endDate: { gte: dateOfPayment } }
    });
    const currentAcademicYear = await prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } });
    if (currentAcademicYear) {
      const startYr = new Date(currentAcademicYear.startDate).getFullYear();
      const endYr = new Date(currentAcademicYear.endDate).getFullYear();
      if ((parseInt(year) >= startYr && parseInt(year) <= endYr) || !academicYear) academicYear = currentAcademicYear;
    }
    if (!academicYear) return res.status(400).json({ message: 'No academic year found.' });

    const enrollments = await prisma.enrollment.findMany({
      where: {
        schoolId,
        status: { in: ['active', 'promoted', 'retained'] },
        OR: [{ academicYearId: academicYear.id, isCurrent: true }, { isCurrent: true }],
        ...(classId ? { classId } : {}),
        ...(sectionId ? { sectionId } : {})
      },
      include: {
        student: {
          include: {
            user: true,
            MonthlyPaymentRecord: {
              where: {
                month: parseInt(month),
                year: parseInt(year),
                OR: [{ academicYearId: academicYear.id }, { academicYearId: null }]
              },
              select: { status: true, amountPaid: true }
            },
            Enrollments: {
              where: { isCurrent: true },
              include: { clss: { include: { FeeStructures: { where: { name: 'Tuition Fee' } } } } },
              take: 1
            }
          }
        },
        clss: true,
        section: true
      }
    });

    const allSchoolFees = await prisma.feeStructure.findMany({
      where: { schoolId: schoolId || 'NONE', name: 'Tuition Fee', frequency: 'monthly' }
    });

    const rows = await Promise.all(enrollments.map(async (e, idx) => {
      const rec = e.student.MonthlyPaymentRecord[0];
      const enrollment = e.student.Enrollments?.[0];
      let classFee = 0;
      if (enrollment) {
        const classFeeVal = enrollment.clss?.FeeStructures?.[0]?.amount;
        const schoolFee = allSchoolFees.find(f => f.classId === enrollment.classId)?.amount;
        classFee = classFeeVal ?? schoolFee ?? 0;
      }
      const status = rec?.status || 'unpaid';
      let amountPaid = rec?.amountPaid || 0;
      if (status === 'paid') amountPaid = classFee;
      return {
        idx: idx + 1,
        name: e.student.user.name,
        student_id: e.student.student_id,
        className: e.clss?.class_name || '',
        sectionName: e.section?.name || '',
        status,
        amountPaid,
        classFee,
        remaining: Math.max(0, classFee - amountPaid)
      };
    }));

    const paid = rows.filter(r => r.status === 'paid');
    const partial = rows.filter(r => r.status === 'partial');
    const unpaid = rows.filter(r => r.status === 'unpaid');

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-disposition', `attachment; filename="Fee_Report_${monthName}_${year}.pdf"`);
    res.setHeader('Content-type', 'application/pdf');
    doc.pipe(res);

    // Header
    if (school?.logo) {
      try {
        if (school.logo.startsWith('data:image/')) {
          const imgBuffer = Buffer.from(school.logo.split(';base64,').pop(), 'base64');
          doc.image(imgBuffer, 40, 30, { width: 50 });
        } else {
          const logoPath = path.join(process.cwd(), school.logo.replace(/^\//, ''));
          if (fs.existsSync(logoPath)) doc.image(logoPath, 40, 30, { width: 50 });
        }
      } catch (e) {}
    }

    doc.fontSize(18).fillColor('#1e293b').text(school?.name || 'Dugsi Pro', 100, 38);
    doc.fontSize(10).fillColor('#64748b').text(`Lacagta Bisha: ${monthName} ${year}`, 100, 60);
    doc.text(`Warbixinta la sameeyay: ${new Date().toLocaleDateString()}`, 100, 73);
    doc.moveDown(2);

    // Summary stats
    const totalCollected = [...paid, ...partial].reduce((sum, r) => sum + r.amountPaid, 0);
    const totalExpected = rows.reduce((sum, r) => sum + r.classFee, 0);

    const statY = doc.y;
    doc.roundedRect(40, statY, 155, 60, 8).fillAndStroke('#dcfce7', '#86efac');
    doc.roundedRect(205, statY, 155, 60, 8).fillAndStroke('#fef9c3', '#fde047');
    doc.roundedRect(370, statY, 155, 60, 8).fillAndStroke('#fee2e2', '#fca5a5');

    doc.fontSize(22).fillColor('#16a34a').text(paid.length, 60, statY + 8, { align: 'left' });
    doc.fontSize(9).fillColor('#15803d').text('BIXIYAY (PAID)', 40, statY + 38, { width: 155, align: 'center' });

    doc.fontSize(22).fillColor('#ca8a04').text(partial.length, 225, statY + 8, { align: 'left' });
    doc.fontSize(9).fillColor('#a16207').text('QAYB BIXIYAY (PARTIAL)', 205, statY + 38, { width: 155, align: 'center' });

    doc.fontSize(22).fillColor('#dc2626').text(unpaid.length, 390, statY + 8, { align: 'left' });
    doc.fontSize(9).fillColor('#b91c1c').text('MA BIXIN (UNPAID)', 370, statY + 38, { width: 155, align: 'center' });

    doc.moveDown(5);
    doc.fontSize(9).fillColor('#475569').text(`Wadarta La Ururiyay: $${totalCollected.toFixed(2)}   |   Wadarta La Filayey: $${totalExpected.toFixed(2)}`, { align: 'right' });
    doc.moveDown(0.5);

    // Table header
    const drawTableHeader = (y) => {
      doc.rect(40, y, 520, 20).fill('#1e293b');
      doc.fontSize(8).fillColor('#ffffff');
      doc.text('#', 45, y + 5);
      doc.text('Magaca Ardayga', 65, y + 5);
      doc.text('ID', 230, y + 5);
      doc.text('Fasalka', 285, y + 5);
      doc.text('Status', 355, y + 5);
      doc.text('Bixiyay', 415, y + 5);
      doc.text('Fee-ga', 470, y + 5);
      doc.text('Hadhay', 515, y + 5);
    };

    const drawRow = (row, y, isEven) => {
      if (isEven) doc.rect(40, y, 520, 18).fill('#f8fafc').stroke('#e2e8f0');
      else doc.rect(40, y, 520, 18).stroke('#e2e8f0');

      const statusColor = row.status === 'paid' ? '#16a34a' : row.status === 'partial' ? '#ca8a04' : '#dc2626';
      const statusLabel = row.status === 'paid' ? 'Bixiyay' : row.status === 'partial' ? 'Qayb' : 'Ma Bixin';

      doc.fontSize(7.5).fillColor('#1e293b');
      doc.text(row.idx, 45, y + 4);
      doc.text(row.name.substring(0, 22), 65, y + 4);
      doc.text(row.student_id || '-', 230, y + 4);
      doc.text((row.className + (row.sectionName ? ' - ' + row.sectionName : '')).substring(0, 15), 285, y + 4);
      doc.fillColor(statusColor).text(statusLabel, 355, y + 4);
      doc.fillColor('#1e293b');
      doc.text(row.amountPaid > 0 ? `$${row.amountPaid.toFixed(2)}` : '$0.00', 415, y + 4);
      doc.text(row.classFee > 0 ? `$${row.classFee.toFixed(2)}` : '$0.00', 470, y + 4);
      doc.text(`$${row.remaining.toFixed(2)}`, 515, y + 4);
    };

    let currentY = doc.y + 5;
    drawTableHeader(currentY);
    currentY += 22;

    rows.forEach((row, i) => {
      if (currentY > 750) {
        doc.addPage();
        currentY = 40;
        drawTableHeader(currentY);
        currentY += 22;
      }
      drawRow(row, currentY, i % 2 === 0);
      currentY += 19;
    });

    doc.moveDown(3);
    doc.fontSize(8).fillColor('#94a3b8').text('Nidaamka Dugsi Pro — Warbixinta Lacagta', { align: 'center' });
    doc.end();
  } catch (err) {
    console.error('[PDF monthly-status error]', err);
    res.status(500).json({ message: err.message });
  }
});


// Get status history for a specific student (last 12 records)
router.get('/student/:studentId/status-history', authenticateToken, async (req, res) => {
  const { studentId } = req.params;

  try {
    // Basic security check: if parent or student, check if they own this student
    if (req.user.role === 'student') {
      const student = await prisma.student.findFirst({ where: { userId: req.user.id } });
      if (student?.id !== studentId) return res.status(403).json({ message: 'Forbidden' });
    } else if (req.user.role === 'parent') {
      const parent = await prisma.parent.findUnique({
        where: { userId: req.user.id },
        include: { Children: { where: { studentId } } }
      });
      if (!parent || parent.Children.length === 0) return res.status(403).json({ message: 'Forbidden' });
    }

    let schoolId = req.user.schoolId;
    if (req.user.role === 'super_admin' && req.query.schoolId) {
      schoolId = req.query.schoolId;
    }

    // If schoolId is missing from token, recover from User record
    if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user) schoolId = user.schoolId;
      } catch (err) {
        console.error('Status History Recovery Error:', err);
      }
    }
    const currentYear = await prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true }
    });

    const records = await prisma.monthlyPaymentRecord.findMany({
      where: { 
        studentId,
        ...(schoolId ? { student: { user: { schoolId } } } : {}),
        ...(req.query.academicYearId ? {
            OR: [
                { academicYearId: req.query.academicYearId },
                { academicYearId: null }
            ]
        } : currentYear && ['student', 'parent'].includes((req.user.role || '').toLowerCase()) ? {
            OR: [
                { academicYearId: currentYear.id },
                { academicYearId: null }
            ]
        } : {})
      },
      select: {
        id: true,
        studentId: true,
        month: true,
        year: true,
        status: true,
        updatedAt: true,
        academicYear: { select: { name: true } }
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ],
      take: 12
    });

    res.json(records);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Toggle monthly payment status
router.post('/toggle', authenticateToken, authorizeRoles('admin', 'owner', 'accountant'), async (req, res) => {
  const { studentId, month, year, status, payment_method, transactionId, phoneNumber, amountPaid } = req.body;
  if (!studentId || !month || !year || !status) return res.status(400).json({ message: 'Missing fields' });

  // Prevent marking future months as paid
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  if ((status === 'paid' || status === 'partial') && (parseInt(year) > currentYear || (parseInt(year) === currentYear && parseInt(month) > currentMonth))) {
    return res.status(400).json({ message: 'Lama bixin karo lacagta bilaha mustaqbalka.' });
  }

  try {
    let schoolId = req.user.schoolId;
    if (req.user.role === 'super_admin' && req.query.schoolId) {
      schoolId = req.query.schoolId;
    }

    // If schoolId is missing from token, recover from User record
    if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user) schoolId = user.schoolId;
      } catch (err) {
        console.error('Payment Toggle Recovery Error:', err);
      }
    }
    
    // Find student first to determine its school if context schoolId is missing
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { 
        user: true,
        Enrollments: { include: { academicYear: true } }
      }
    });

    if (!student) return res.status(404).json({ message: 'Ardayga lama helin.' });
    
    // If user is super_admin/owner and no schoolId in request, use the student's schoolId
    if (!schoolId && (req.user.role === 'super_admin' || req.user.role === 'owner')) {
      schoolId = student.user.schoolId;
    }

    if (schoolId && student.user.schoolId !== schoolId) {
      return res.status(403).json({ message: 'Ma geli kartid xogta dugsi kale.' });
    }

    const record = await prisma.$transaction(async (tx) => {
      const recordId = crypto.randomUUID();
      const enrollment = selectEnrollment(student.Enrollments || [], parseInt(month), parseInt(year));
      const ayId = enrollment?.academicYearId || null;

      // Resolve class fee for validation
      let classFee = 0;
      if (enrollment) {
        classFee = await resolveStudentTuitionFee(tx, enrollment, student);
      }

      // Validate partial amount doesn't exceed class fee
      let numericAmountPaid = null;
      if (status === 'partial') {
        numericAmountPaid = Number(amountPaid);
        if (isNaN(numericAmountPaid) || numericAmountPaid <= 0) {
          throw new Error('Lacagta qayb-bixinta waa inay ka badan tahay 0.');
        }
        if (classFee > 0 && numericAmountPaid > classFee) {
          throw new Error(`Lacagta laga bixin karo waxay tahay $${classFee} oo kaliya. Lacagta aad galisay ($${numericAmountPaid}) waa ka badan tahay.`);
        }
        if (classFee > 0 && numericAmountPaid >= classFee) {
          // If paying full amount, mark as paid
          numericAmountPaid = classFee;
        }
      } else if (status === 'paid') {
        numericAmountPaid = classFee || null;
      }

      await tx.$executeRawUnsafe(`
        INSERT INTO "MonthlyPaymentRecord" (id, "studentId", month, year, status, "amountPaid", "updatedAt", "academicYearId")
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
        ON CONFLICT ("studentId", month, year, "academicYearId") 
        DO UPDATE SET status = EXCLUDED.status, "amountPaid" = EXCLUDED."amountPaid", "updatedAt" = NOW()
      `, recordId, studentId, parseInt(month), parseInt(year), status, numericAmountPaid, ayId);

      const rec = await tx.monthlyPaymentRecord.findFirst({
        where: { studentId, month: parseInt(month), year: parseInt(year), academicYearId: ayId },
        select: { id: true, studentId: true, month: true, year: true, status: true, amountPaid: true }
      });

      if (status === 'paid') {
        const existingPayment = await tx.payment.findFirst({
          where: { studentId, month: parseInt(month), year: parseInt(year) }
        });

        if (!existingPayment) {
          const enrollment = selectEnrollment(student.Enrollments || [], parseInt(month), parseInt(year));
          if (enrollment) {
            const finalAmount = await resolveStudentTuitionFee(tx, enrollment, student);
            
            await tx.payment.create({
              data: {
                studentId,
                amount: finalAmount,
                payment_method: payment_method || 'Cash',
                transactionId,
                phoneNumber,
                description: `Tuition Fee for ${month}/${year}${student.scholarship !== 'none' ? ` (${student.scholarship} scholarship)` : ''}`,
                month: parseInt(month),
                year: parseInt(year),
                date: new Date(),
                schoolId: schoolId || student.user.schoolId,
                academicYearId: ayId
              }
            });
          }
        }
      } else if (status === 'partial') {
        // For partial: update or create a partial payment record
        const existingPayment = await tx.payment.findFirst({
          where: { studentId, month: parseInt(month), year: parseInt(year), description: { contains: 'Tuition Fee' } }
        });
        if (existingPayment) {
          await tx.payment.update({
            where: { id: existingPayment.id },
            data: { amount: numericAmountPaid, payment_method: payment_method || 'Cash' }
          });
        } else if (enrollment) {
          await tx.payment.create({
            data: {
              studentId,
              amount: numericAmountPaid,
              payment_method: payment_method || 'Cash',
              transactionId,
              phoneNumber,
              description: `Tuition Fee (Partial) for ${month}/${year}`,
              month: parseInt(month),
              year: parseInt(year),
              date: new Date(),
              schoolId: schoolId || student.user.schoolId,
              academicYearId: ayId
            }
          });
        }
      } else {
        // PERMISSION CHECK: If accountant, check if they can delete payments
        if (req.user.role === 'accountant') {
          const setting = await tx.schoolSettings.findUnique({
            where: { key_schoolId: { key: 'perm_acc_delete_payment', schoolId: schoolId || req.user.schoolId } }
          });
          if (!setting || setting.value !== 'true') {
            throw new Error('Fasax uma lihid inaad tirtirto lacag bixinta bilaha hore. Fadlan la xiriir Admin-ka.');
          }
        }

        await tx.payment.deleteMany({
          where: {
            studentId,
            month: parseInt(month),
            year: parseInt(year),
            description: { contains: 'Tuition Fee' }
          }
        });
      }

      return rec;
    });

    res.json(record);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Bulk update monthly payment status
router.post('/bulk', authenticateToken, authorizeRoles('admin', 'owner', 'accountant'), async (req, res) => {
  const { updates, month, year, payment_method } = req.body; // updates: [{ studentId, status, amountPaid? }]
  if (!updates || !Array.isArray(updates) || !month || !year) return res.status(400).json({ message: 'Invalid data' });

  // Prevent marking future months as paid
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  if (parseInt(year) > currentYear || (parseInt(year) === currentYear && parseInt(month) > currentMonth)) {
    return res.status(400).json({ message: 'Lama cusboonaysiin karo lacagta bilaha mustaqbalka.' });
  }

  try {
    let schoolId = req.user.schoolId;
    if (req.user.role === 'super_admin' && req.query.schoolId) {
      schoolId = req.query.schoolId;
    }

    // If schoolId is missing from token, recover from User record
    if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user) schoolId = user.schoolId;
      } catch (err) {
        console.error('Payment Bulk Recovery Error:', err);
      }
    }
    const studentIds = updates.map(u => u.studentId);

    // ── PERFORMANCE FIX: Batch-fetch ALL students in ONE query instead of N sequential queries ──
    const allStudents = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      include: {
        user: true,
        Enrollments: { include: { academicYear: true } }
      }
    });
    const studentMap = new Map(allStudents.map(s => [s.id, s]));

    // ── Process all updates IN PARALLEL with Promise.all ──
    const results = await Promise.all(
      updates.map(async ({ studentId, status }) => {
        const student = studentMap.get(studentId);
        if (!student) return null;

        let effectiveSchoolId = schoolId;
        if (!effectiveSchoolId && (req.user.role === 'super_admin' || req.user.role === 'owner')) {
          effectiveSchoolId = student.user.schoolId;
        }
        if (effectiveSchoolId && student.user.schoolId !== effectiveSchoolId) return null;

        try {
          const record = await prisma.$transaction(async (tx) => {
            const recordId = crypto.randomUUID();
            const enrollment = selectEnrollment(student.Enrollments || [], parseInt(month), parseInt(year));
            const ayId = enrollment?.academicYearId || null;

            // Resolve class fee for partial validation
            let classFee = 0;
            if (enrollment) classFee = await resolveStudentTuitionFee(tx, enrollment, student);

            // Get amountPaid from the update object
            const updateObj = updates.find(u => u.studentId === studentId);
            let numericAmountPaid = null;
            if (status === 'partial') {
              numericAmountPaid = Number(updateObj?.amountPaid || 0);
              if (isNaN(numericAmountPaid) || numericAmountPaid <= 0) numericAmountPaid = 0;
              if (classFee > 0 && numericAmountPaid > classFee) numericAmountPaid = classFee;
            } else if (status === 'paid') {
              numericAmountPaid = classFee || null;
            }

            await tx.$executeRawUnsafe(`
              INSERT INTO "MonthlyPaymentRecord" (id, "studentId", month, year, status, "amountPaid", "updatedAt", "academicYearId")
              VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
              ON CONFLICT ("studentId", month, year, "academicYearId")
              DO UPDATE SET status = EXCLUDED.status, "amountPaid" = EXCLUDED."amountPaid", "updatedAt" = NOW()
            `, recordId, studentId, parseInt(month), parseInt(year), status, numericAmountPaid, ayId);

            const rec = await tx.monthlyPaymentRecord.findFirst({
              where: { studentId, month: parseInt(month), year: parseInt(year), academicYearId: ayId },
              select: { id: true, studentId: true, month: true, year: true, status: true, amountPaid: true }
            });

            if (status === 'paid') {
              const existingPayment = await tx.payment.findFirst({
                where: { studentId, month: parseInt(month), year: parseInt(year) }
              });
              if (!existingPayment && enrollment) {
                const finalAmount = await resolveStudentTuitionFee(tx, enrollment, student);
                await tx.payment.create({
                  data: {
                    studentId,
                    amount: finalAmount,
                    payment_method: payment_method || 'Cash',
                    description: `Tuition Fee for ${month}/${year}${student.scholarship !== 'none' ? ` (${student.scholarship} scholarship)` : ''}`,
                    month: parseInt(month),
                    year: parseInt(year),
                    date: new Date(),
                    schoolId: effectiveSchoolId || student.user.schoolId,
                    academicYearId: ayId
                  }
                });
              }
            } else if (status === 'partial') {
              const existingPayment = await tx.payment.findFirst({
                where: { studentId, month: parseInt(month), year: parseInt(year), description: { contains: 'Tuition Fee' } }
              });
              if (existingPayment) {
                await tx.payment.update({
                  where: { id: existingPayment.id },
                  data: { amount: numericAmountPaid, payment_method: payment_method || 'Cash' }
                });
              } else if (enrollment && numericAmountPaid > 0) {
                await tx.payment.create({
                  data: {
                    studentId,
                    amount: numericAmountPaid,
                    payment_method: payment_method || 'Cash',
                    description: `Tuition Fee (Partial) for ${month}/${year}`,
                    month: parseInt(month),
                    year: parseInt(year),
                    date: new Date(),
                    schoolId: effectiveSchoolId || student.user.schoolId,
                    academicYearId: ayId
                  }
                });
              }
            } else {
              await tx.payment.deleteMany({
                where: {
                  studentId,
                  month: parseInt(month),
                  year: parseInt(year),
                  description: { contains: 'Tuition Fee' }
                }
              });
            }
            return rec;
          });
          return record;
        } catch (err) {
          console.error(`[BULK PAYMENT] Error processing student ${studentId}:`, err.message);
          return null;
        }
      })
    );

    const processed = results.filter(Boolean);
    res.json(processed);
  } catch (err) { console.error('[BULK PAYMENT ERROR]', err); res.status(500).json({ message: err.message, detail: err.meta || err.code }); }
});

router.get('/:id/receipt', authenticateToken, async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: {
        student: { 
          include: { 
            user: true,
            Enrollments: {
              where: {
                academicYear: {
                  startDate: { lte: new Date() }, // We'll filter properly in memory below
                  endDate: { gte: new Date() }
                }
              },
              include: { clss: true, section: true }
            }
          } 
        },
        school: true
      }
    });

    if (!payment) return res.status(404).json({ message: 'Lacag bixinta lama helin.' });

    // Find the correct enrollment for the date of this payment
    const paymentDate = new Date(payment.date);
    const enrollment = payment.student.Enrollments.find(e => 
      new Date(e.academicYear.startDate) <= paymentDate && 
      new Date(e.academicYear.endDate) >= paymentDate
    ) || await prisma.enrollment.findFirst({
      where: { studentId: payment.studentId, isCurrent: true },
      include: { clss: true, section: true }
    });

    const className = enrollment?.clss?.class_name || 'N/A';
    const sectionName = enrollment?.section?.name || 'N/A';

    // Security check
    if (req.user.role === 'student') {
      const student = await prisma.student.findFirst({ where: { userId: req.user.id } });
      if (student?.id !== payment.studentId) return res.status(403).json({ message: 'Forbidden' });
    } else if (req.user.role === 'parent') {
      const parent = await prisma.parent.findUnique({
        where: { userId: req.user.id },
        include: { Children: { where: { studentId: payment.studentId } } }
      });
      if (!parent || parent.Children.length === 0) return res.status(403).json({ message: 'Forbidden' });
    }

    const doc = new PDFDocument({ margin: 50 });

    let filename = `Receipt_${payment.id.substring(0, 8)}.pdf`;
    
    res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    // Header
    if (payment.school?.logo) {
        try {
            if (payment.school.logo.startsWith('data:image/')) {
                const base64Data = payment.school.logo.split(';base64,').pop();
                const imgBuffer = Buffer.from(base64Data, 'base64');
                doc.image(imgBuffer, 50, 40, { width: 60 });
                doc.moveDown(2);
            } else {
                const cleanLogoPath = payment.school.logo.startsWith('public/') ? payment.school.logo.replace('public/', '') : payment.school.logo;
                
                const pathsToTry = [
                    path.join(process.cwd(), cleanLogoPath),
                    path.join(process.cwd(), 'backend', cleanLogoPath),
                    path.join(__dirname, '../../', cleanLogoPath),
                    path.join(__dirname, '../../../', cleanLogoPath)
                ];

                let logoPath = null;
                for (const p of pathsToTry) {
                    if (fs.existsSync(p)) {
                        logoPath = p;
                        break;
                    }
                }

                if (logoPath) {
                    doc.image(logoPath, 50, 40, { width: 60 });
                    doc.moveDown(2);
                } else {
                    console.warn('[PDF-Receipt] Logo not found at any of these paths:', pathsToTry);
                }
            }
        } catch (e) {
            console.error('[PDF-Receipt] Logo Error:', e);
        }
    }

    
    doc.fontSize(20).text(payment.school?.name || 'DUGSI PRO SYSTEM', { align: 'right' });
    doc.fontSize(10).text(payment.school?.address || '', { align: 'right' });
    doc.fontSize(10).text(payment.school?.phone || '', { align: 'right' });
    doc.moveDown();

    doc.fontSize(16).text('RISIIDHKA LACAGTA (PAYMENT RECEIPT)', { align: 'center', underline: true });
    doc.moveDown(2);

    // Receipt Info
    doc.fontSize(12).text(`Taariikhda: ${payment.date.toLocaleDateString()}`);
    doc.text(`Risiidh No: ${payment.id.substring(0, 8).toUpperCase()}`);
    doc.moveDown();

    // Student Info
    doc.rect(50, doc.y, 510, 80).stroke();
    const currentY = doc.y + 10;
    doc.text(`Magaca Ardayga: ${payment.student.user.name}`, 60, currentY);
    doc.text(`ID-ga Ardayga: ${payment.student.student_id}`, 60, currentY + 20);
    doc.text(`Fasalka: ${className} - ${sectionName}`, 60, currentY + 40);
    
    doc.moveDown(5);

    // Payment Details Table
    const tableTop = doc.y;
    doc.fontSize(12).text('Faahfaahinta', 60, tableTop, { bold: true });
    doc.text('Lacagta', 400, tableTop, { bold: true, align: 'right' });
    doc.moveTo(50, tableTop + 15).lineTo(560, tableTop + 15).stroke();

    const rowY = tableTop + 25;
    doc.text(payment.description || 'Lacagta Waxbarashada', 60, rowY);
    doc.text(`$${payment.amount.toFixed(2)}`, 400, rowY, { align: 'right' });

    doc.moveTo(50, rowY + 15).lineTo(560, rowY + 15).stroke();
    
    doc.moveDown(2);
    doc.fontSize(14).text(`Wadarta Guud: $${payment.amount.toFixed(2)}`, { align: 'right', bold: true });
    doc.moveDown();
    
    doc.fontSize(10).text(`Habka Lacag-bixinta: ${payment.payment_method || 'Cash'}`, { italic: true });
    if (payment.transactionId) {
        doc.text(`Transaction ID: ${payment.transactionId}`, { italic: true });
    }

    doc.moveDown(4);
    doc.fontSize(10).text('Mahadsanid! Waxbarasho Wacan.', { align: 'center' });
    
    doc.end();
  } catch (err) {
    console.error('Receipt Error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
