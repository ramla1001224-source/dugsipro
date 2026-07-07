const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const cacheMiddleware = require('../middleware/cacheMiddleware');
const { enqueueBulkSMS } = require('../services/smsQueue');
const { sendPushNotification } = require('../services/notificationService');
const { createNotification } = require('../utils/notificationHelper');


router.get('/', authenticateToken, async (req, res) => {
  const { classId, sectionId, date, session, studentId } = req.query;
  let schoolId = req.user.schoolId;

  // If schoolId is missing from token, recover from User record
  if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (user) schoolId = user.schoolId;
    } catch (err) {
      console.error('Attendance Recovery Error:', err);
    }
  }

  if ((req.user.role || '').toLowerCase() === 'super_admin' && req.query.schoolId) {
    schoolId = req.query.schoolId;
  }

  try {
    let where = schoolId ? { schoolId } : { schoolId: 'NONE_AUTHORIZED' };

    // ... (rest of the route logic continues logically)

    if ((req.user.role || '').toLowerCase() === 'student') {
      const student = await prisma.student.findFirst({ where: { userId: req.user.id } });
      if (!student) return res.status(404).json({ message: 'Student record not found' });

      // Identity Unification: Always include own records (userId match),
      // then add same-school records with matching student_id to capture promotion history.
      // IMPORTANT: student_id match is scoped to same school to prevent cross-branch data leakage.
      const effectiveSchoolId = schoolId || student.user?.schoolId;
      const ownStudentRecords = await prisma.student.findMany({
        where: { userId: student.userId },
        select: { id: true }
      });
      let sameSchoolRecords = [];
      if (student.student_id && student.student_id.trim() !== '' && effectiveSchoolId) {
        sameSchoolRecords = await prisma.student.findMany({
          where: {
            student_id: { equals: student.student_id, mode: 'insensitive' },
            user: { schoolId: effectiveSchoolId }
          },
          select: { id: true }
        });
      }
      const relatedIds = [...new Set([
        ...ownStudentRecords.map(s => s.id),
        ...sameSchoolRecords.map(s => s.id)
      ])];
      where.studentId = { in: relatedIds };

      // Apply date filters for student
      if (date) {
        const dateObj = new Date(date);
        dateObj.setUTCHours(0, 0, 0, 0);
        where.date = dateObj;
      } else if (req.query.startDate || req.query.endDate) {
        where.date = {};
        if (req.query.startDate) {
          const sd = new Date(req.query.startDate);
          sd.setUTCHours(0, 0, 0, 0);
          where.date.gte = sd;
        }
        if (req.query.endDate) {
          const ed = new Date(req.query.endDate);
          ed.setUTCHours(23, 59, 59, 999);
          where.date.lte = ed;
        }
      }
      // Apply session filter for student
      if (session) where.session = session;
      if (req.query.shift) where.shift = req.query.shift;

    } else if ((req.user.role || '').toLowerCase() === 'parent') {
      // If parent, they must provide studentId and we verify
      if (!studentId) return res.status(400).json({ message: 'studentId is required for parents' });
      const link = await prisma.parentStudent.findFirst({
        where: { studentId, parent: { userId: req.user.id } }
      });
      if (!link) return res.status(403).json({ message: 'Forbidden' });
      where.studentId = studentId;
    } else {
      // Admin/Teacher logic
      if (studentId) where.studentId = studentId;
      if (sectionId) where.sectionId = sectionId;
      else if (classId) where.classId = classId;

      if (date) {
        const dateObj = new Date(date);
        dateObj.setUTCHours(0, 0, 0, 0);
        where.date = dateObj;
      } else if (req.query.startDate || req.query.endDate) {
        where.date = {};
        if (req.query.startDate) {
          const sd = new Date(req.query.startDate);
          sd.setUTCHours(0, 0, 0, 0);
          where.date.gte = sd;
        }
        if (req.query.endDate) {
          const ed = new Date(req.query.endDate);
          ed.setUTCHours(23, 59, 59, 999);
          where.date.lte = ed;
        }
      }

      if (session) where.session = session;
      if (req.query.shift) where.shift = req.query.shift;
    }

    // New: Support academicYearId filter (Applies to all roles if provided)
    const { academicYearId: queryYearId, startDate, endDate } = req.query;

    if (queryYearId) {
      const ay = await prisma.academicYear.findUnique({ where: { id: queryYearId } });
      if (ay) {
        where.date = {
          gte: new Date(ay.startDate),
          lte: new Date(ay.endDate)
        };
      }
    } else if (!date && !startDate && !endDate) {
      // Default: Current Academic Year for all roles if no date filter is provided
      const activeYear = await prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true }
      });
      if (activeYear) {
        where.date = {
          gte: new Date(activeYear.startDate),
          lte: new Date(activeYear.endDate)
        };
      }
    }

    const limit = Math.min(parseInt(req.query.limit) || 100, 500); // Hard cap 500
    const attendance = await prisma.attendance.findMany({
      where,
      select: {
        id: true,
        date: true,
        status: true,
        session: true,
        shift: true,
        studentId: true,
        classId: true,
        sectionId: true,
        schoolId: true,
        // EGRESS FIX: select only needed user fields instead of include: { user: true }
        student: {
          select: {
            id: true,
            student_id: true,
            user: {
              select: {
                id: true,
                name: true,
                phone: true
              }
            },
            Enrollments: {
              where: { isCurrent: true },
              select: {
                clss: { select: { class_name: true } },
                section: { select: { name: true } }
              }
            }
          }
        }
      },
      orderBy: { date: 'desc' },
      take: limit
    });

    const normalized = attendance.map(a => {
      const enrollment = a.student?.Enrollments?.[0];
      return {
        ...a,
        student_name: a.student?.user?.name || 'Unknown',
        class_name: enrollment?.clss?.class_name || 'N/A',
        section_name: enrollment?.section?.name || 'N/A'
      };
    });
    res.json(normalized);
  } catch (err) {
    console.error('Attendance fetch error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Bulk upsert attendance
router.post('/', authenticateToken, authorizeRoles('admin', 'teacher', 'accountant'), async (req, res) => {
  const { classId, sectionId, date, session, shift, attendance } = req.body;
  if (!date || !session || !attendance || !Array.isArray(attendance)) {
    return res.status(400).json({ message: 'Missing required fields (date, session, or attendance list)' });
  }
  let schoolId = req.user.schoolId;

  // If schoolId is missing from token, recover from User record
  if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (user) schoolId = user.schoolId;
    } catch (err) {
      console.error('Attendance Save Recovery Error:', err);
    }
  }

  try {
    const formattedDate = new Date(date);
    if (isNaN(formattedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    formattedDate.setUTCHours(0, 0, 0, 0);
    const shiftVal = shift || 'morning';

    // PERMISSION CHECK for Teachers: Section assignment & Edit past attendance (> 24h)
    if (req.user.role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
      if (!teacher) return res.status(403).json({ message: 'Teacher record not found' });

      // 1. Verify section assignment (either as class teacher or subject teacher)
      if (sectionId) {
        const isClassTeacher = await prisma.section.findFirst({
          where: { id: sectionId, teacherId: teacher.id }
        });

        const isSubjectTeacher = await prisma.subjectAssignment.findFirst({
          where: {
            teacherId: teacher.id,
            OR: [
              { sectionId: sectionId },
              { sectionId: null }
            ]
          }
        });

        if (!isClassTeacher && !isSubjectTeacher) {
          return res.status(403).json({
            message: 'Ma haysatid ogolaanshaha fasalkan (Section).',
            error: 'Section Access Restricted'
          });
        }
      }

      // 2. Edit past attendance (> 24h) check
      const now = new Date();
      const diffTime = Math.abs(now - formattedDate);
      const diffHours = diffTime / (1000 * 60 * 60);

      if (diffHours > 24) {
        const setting = await prisma.schoolSettings.findUnique({
          where: { key_schoolId: { key: 'perm_tea_edit_attendance', schoolId: schoolId } }
        });
        if (!setting || setting.value !== 'true') {
          return res.status(403).json({
            message: 'Ma beddeli kartid xaadiris ka weyn 24 saac. Fadlan la xiriir Maamulka.',
            error: 'Past Attendance Restricted'
          });
        }
      }
    }

    console.log(`[Attendance] Saving for School: ${schoolId}, Class: ${classId}, Date: ${formattedDate.toISOString()}, Session: ${session}, Initial Shift: ${shift || 'not provided'}`);

    // --- OPTIMIZATION: PRE-FETCH ENROLLMENTS ---
    // Fetch all current enrollments for the provided students in one query
    const studentIds = attendance.map(a => String(a.studentId)).filter(id => id);
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: { in: studentIds }, isCurrent: true },
      include: { section: true }
    });
    const enrollmentMap = new Map(enrollments.map(e => [e.studentId, e]));

    const operations = [];
    const smsTargets = [];

    for (const item of attendance) {
      if (!item.studentId) continue;

      const enrollment = enrollmentMap.get(String(item.studentId));
      let studentSectionId = item.sectionId || sectionId || enrollment?.sectionId;
      // Explicit shift from request ALWAYS wins; fallback to section shift, then 'morning'
      let finalShift = (shift && shift !== 'undefined' && shift !== '')
        ? shift
        : (enrollment?.section?.shift || 'morning');

      if (!studentSectionId) {
        console.warn(`[Attendance] Skipping student ${item.studentId} - no sectionId found.`);
        continue;
      }

      // Normalize status
      let normalizedStatus = String(item.status || 'Present').trim();
      if (normalizedStatus.length > 0) {
        normalizedStatus = normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1).toLowerCase();
      }

      // Prepare for Auto-SMS logic
      if (normalizedStatus.toLowerCase() === 'absent') {
        smsTargets.push(item.studentId);
      }

      // Use upsert in a transaction
      operations.push(
        prisma.attendance.upsert({
          where: {
            studentId_sectionId_date_session_shift: {
              studentId: String(item.studentId),
              sectionId: String(studentSectionId),
              date: formattedDate,
              session: String(session),
              shift: finalShift
            }
          },
          update: { status: normalizedStatus },
          create: {
            studentId: String(item.studentId),
            sectionId: String(studentSectionId),
            classId: classId || null,
            date: formattedDate,
            status: normalizedStatus,
            session: String(session),
            shift: finalShift,
            schoolId: schoolId ? String(schoolId) : null
          }
        })
      );
    }

    // --- TRANSACTIONAL EXECUTION ---
    // This ensures all records are saved efficiently
    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }

    // --- QUEUED AUTO-SMS FOR PARENTS (ABSENT ONLY) ---
    // Uses SMSQueue to batch-send messages safely (50 per batch, 500ms delay).
    // This prevents overloading the gateway when there are thousands of absent students.
    if (smsTargets.length > 0) {
      // Run async in background — don't block the HTTP response
      (async () => {
        try {
          // Fetch school admin phone OR school phone to include in the message
          const [schoolAdmin, schoolInfo] = await Promise.all([
            prisma.user.findFirst({
              where: { schoolId: schoolId || undefined, role: 'admin', NOT: { phone: null } },
              select: { phone: true }
            }),
            prisma.school.findUnique({
              where: { id: schoolId || undefined },
              select: { name: true, phone: true, institutionType: true, superAdminId: true }
            })
          ]);

          // Get the proper school display name from super admin's schoolName field
          let schoolDisplayName = schoolInfo?.name || 'Schoolka';
          if (schoolInfo?.superAdminId) {
            const superAdminUser = await prisma.user.findUnique({
              where: { id: schoolInfo.superAdminId },
              select: { schoolName: true }
            });
            if (superAdminUser?.schoolName) schoolDisplayName = superAdminUser.schoolName;
          }
          // Prefix with institution type label
          // Prefix with institution type label removed as per request
          // const instPrefix = (schoolInfo?.institutionType || 'school').toLowerCase() === 'machad' ? 'Machad' : 'School';
          // schoolDisplayName = `${instPrefix}: ${schoolDisplayName}`;


          const adminPhone = schoolAdmin?.phone || schoolInfo?.phone || '';

          const now = new Date();
          const day = now.getDate();
          const month = now.getMonth() + 1;
          const year = now.getFullYear();

          // Somali Day Names
          const somaliDays = ['Axad', 'Isniin', 'Talaado', 'Arbaco', 'Khamiis', 'Jimce', 'Sabti'];
          const dayName = somaliDays[now.getDay()];

          // Somali date format: "Sabti 26 Bisha 5aad 2026"
          const somaliDate = `${dayName} ${day} Bisha ${month}aad ${year}`;

          // Session Translation
          const sessionMap = {
            'break1': 'break 1aad',
            'break2': 'break 2aad',
            'break 1': 'break 1aad',
            'break 2': 'break 2aad',
            'morning': 'subaxii',
            'afternoon': 'galabtii',
            'night': 'habeenkii'
          };
          const sessionSomali = sessionMap[String(session).toLowerCase()] || session;

          // Dynamic Labels based on Institution Type and Shift Time
          const instType = (schoolInfo?.institutionType || 'school').toLowerCase();
          const instLabel = instType === 'machad' ? 'machadka' : 'schoolka';

          const timeMap = {
            'morning': 'saaka',
            'afternoon': 'galabta',
            'night': 'caawa'
          };
          const timeLabel = timeMap[String(shift).toLowerCase()] || 'maanta';

          const studentsInfo = await prisma.student.findMany({
            where: { id: { in: smsTargets } },
            include: {
              user: true,
              Parents: {
                include: { parent: { include: { user: true } } }
              }
            }
          });

          // Build SMS job list — one per parent phone number
          const smsJobs = [];

          for (const studentInfo of studentsInfo) {
            const parent = studentInfo?.Parents?.[0]?.parent;
            const parentPhone = parent?.user?.phone || parent?.phone || studentInfo?.parentPhone;
            const studentName = studentInfo?.user?.name || 'Ardayga';

            if (parentPhone) {
              const msg = `${schoolDisplayName}\nWaalid ${studentName} maanta ${instLabel} ma imaan fadhiga ${sessionSomali}. Taariikhda: ${somaliDate}. Fadlan la xiriir maamulaha: ${adminPhone}.`;
              smsJobs.push({
                phone: parentPhone,
                message: msg,
                schoolId,
                studentId: studentInfo.id,
                type: 'attendance',
                studentName
              });
            }

            // Push notification (fire-and-forget per student)
            if (parent?.user?.fcmToken) {
              const title = 'Maqnaansho Arday';
              const body = `Ogeysiis: ${studentName} ${timeLabel} ${instLabel} ma soo xaadirin fadhiga ${sessionSomali}.`;
              console.log(`[AttendanceNotification] Sending push to parent: ${parent.user.name}, Token: ${parent.user.fcmToken.substring(0, 10)}...`);
              sendPushNotification([parent.user.fcmToken], title, body, { type: 'attendance', studentId: studentInfo.id })
                .then(() => console.log(`[AttendanceNotification] Push success for ${studentName}`))
                .catch(err => console.error(`[Push Attendance] Failed for ${studentName}:`, err));
            } else {
              console.warn(`[AttendanceNotification] No FCM token for parent of: ${studentName}. Parent User ID: ${parent?.userId}`);
            }

            // In-app DB notification
            if (parent?.userId) {
              const title = 'Maqnaansho Arday';
              const body = `Ogeysiis: ${studentName} ${timeLabel} ${instLabel} ma soo xaadirin fadhiga ${sessionSomali}.`;
              createNotification({
                userId: parent.userId,
                title,
                message: body,
                type: 'ATTENDANCE'
              }).catch(err => console.error(`[DB Notification] Failed for ${studentName}:`, err));
            }
          }

          // Enqueue all SMS jobs — they will be sent in batches of 50 with 500ms delays
          if (smsJobs.length > 0) {
            console.log(`[SMSQueue] Attendance: Enqueueing ${smsJobs.length} SMS for absent students.`);
            enqueueBulkSMS(smsJobs);
          }

        } catch (err) {
          console.error('[Attendance SMS Background Error]:', err);
        }
      })();
    }

    res.json({
      message: 'Xaadirinta waa la keydiyey si guul ah.',
      successCount: operations.length
    });
  } catch (err) {
    console.error('[Attendance] Main Error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/student/:id', authenticateToken, async (req, res) => {
  const studentId = req.params.id;

  try {
    // Security check: if parent, verify the student is theirs
    if (req.user.role === 'parent') {
      const link = await prisma.parentStudent.findFirst({
        where: {
          studentId,
          parent: { userId: req.user.id }
        }
      });
      if (!link) return res.status(403).json({ message: 'Forbidden: You are not authorized to view this student data' });
    } else if (req.user.role === 'student') {
      const student = await prisma.student.findFirst({ where: { userId: req.user.id } });

      // Identity Unification: Always include own records (userId match),
      // then add same-school records. Scoped to prevent cross-branch leakage.
      const effectiveSchoolId = req.user.schoolId || student.user?.schoolId;
      const ownIds = await prisma.student.findMany({
        where: { userId: student.userId },
        select: { id: true }
      });
      let sameSchoolIds = [];
      if (student?.student_id && effectiveSchoolId) {
        sameSchoolIds = await prisma.student.findMany({
          where: {
            student_id: { equals: student.student_id, mode: 'insensitive' },
            user: { schoolId: effectiveSchoolId }
          },
          select: { id: true }
        });
      }
      const relatedIds = [...new Set([
        ...ownIds.map(s => s.id),
        ...sameSchoolIds.map(s => s.id)
      ])];

      if (!relatedIds.includes(studentId)) return res.status(403).json({ message: 'Forbidden' });
    }

    let schoolId = req.user.schoolId;
    if (req.user.role === 'super_admin' && req.query.schoolId) {
      schoolId = req.query.schoolId;
    }

    // Support identity unification for the specific query too
    // IMPORTANT: Scope student_id match to same school to prevent cross-branch data leakage
    const targetStudent = await prisma.student.findUnique({ where: { id: studentId } });
    let relatedIds = [studentId];
    if (targetStudent) {
      // Always include all records linked to same userId
      const byUserId = await prisma.student.findMany({
        where: { userId: targetStudent.userId },
        select: { id: true }
      });
      // Add same-school records with matching student_id
      let byStudentId = [];
      if (targetStudent.student_id && targetStudent.user?.schoolId) {
        byStudentId = await prisma.student.findMany({
          where: {
            student_id: { equals: targetStudent.student_id, mode: 'insensitive' },
            user: { schoolId: targetStudent.user.schoolId }
          },
          select: { id: true }
        });
      }
      relatedIds = [...new Set([
        ...byUserId.map(r => r.id),
        ...byStudentId.map(r => r.id)
      ])];
    }

    let where = { studentId: { in: relatedIds } };
    if (schoolId) where.schoolId = schoolId;

    const { month, year, startDate, endDate, session, academicYearId } = req.query;

    if (month && year) {
      const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
      const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59));
      where.date = { gte: startOfMonth, lte: endOfMonth };
    } else if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        const sd = new Date(startDate);
        sd.setUTCHours(0, 0, 0, 0);
        where.date.gte = sd;
      }
      if (endDate) {
        const ed = new Date(endDate);
        ed.setUTCHours(23, 59, 59, 999);
        where.date.lte = ed;
      }
    } else if (academicYearId) {
      const ay = await prisma.academicYear.findFirst({
        where: { id: academicYearId, ...(schoolId ? { schoolId } : {}) }
      });
      if (ay) {
        where.date = {
          gte: new Date(ay.startDate),
          lte: new Date(ay.endDate)
        };
      }
    } else {
      // Default: Current Academic Year
      const activeYear = await prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true }
      });
      if (activeYear) {
        where.date = {
          gte: new Date(activeYear.startDate),
          lte: new Date(activeYear.endDate)
        };
      }
    }

    if (session) {
      where.session = session;
    }

    const attendance = await prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
      take: (month && year) || startDate || endDate || academicYearId ? undefined : 100 // increased default
    });
    res.json(attendance);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Mark attendance via QR Code
router.post('/mark-qr', authenticateToken, authorizeRoles('admin', 'teacher'), async (req, res) => {
  const { studentId, session } = req.body; // studentId is actually the userId from QR
  if (!studentId || !session) return res.status(400).json({ message: 'Missing fields' });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  try {
    let schoolId = req.user.schoolId;
    if (req.user.role === 'super_admin' && req.query.schoolId) {
      schoolId = req.query.schoolId;
    }

    // Find student and their current enrollment for context
    const student = await prisma.student.findFirst({
      where: { userId: studentId },
      include: {
        user: true,
        Enrollments: {
          where: { isCurrent: true },
          include: { section: true }
        }
      }
    });

    if (!student || (schoolId && student.user.schoolId !== schoolId)) {
      return res.status(404).json({ message: 'Student not found in your school' });
    }

    const enrollment = student.Enrollments?.[0];
    if (!enrollment || !enrollment.sectionId) {
      return res.status(400).json({ message: 'Student is not assigned to any section for the current year' });
    }

    // Determine shift from enrollment's section
    const shift = enrollment.section?.shift || 'morning';

    // Mark as present
    const record = await prisma.attendance.upsert({
      where: {
        studentId_sectionId_date_session_shift: {
          studentId: student.id,
          sectionId: student.sectionId,
          date: today,
          session,
          shift
        }
      },
      update: { status: 'Present' },
      create: {
        studentId: student.id,
        sectionId: enrollment.sectionId,
        classId: enrollment.classId,
        date: today,
        status: 'Present',
        session,
        shift,
        schoolId
      }
    });

    res.json({ message: 'Attendance marked successfully', studentName: student.user.name, record });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get monthly attendance summary for a section
router.get('/monthly-summary', authenticateToken, async (req, res) => {
  const { sectionId, classId, month, year, academicYearId } = req.query;
  if (!sectionId && !classId) return res.status(400).json({ message: 'Missing sectionId or classId' });
  if (!academicYearId && (!month || !year)) return res.status(400).json({ message: 'Missing month/year or academicYearId' });

  try {
    let schoolId = req.user.schoolId;
    if (req.user.role === 'super_admin' && req.query.schoolId) {
      schoolId = req.query.schoolId;
    }

    // Identify the academic year to use (ongoing year history)
    const activeYear = await prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true }
    });
    const yearToUse = academicYearId || activeYear?.id;

    let dateFilter = {};
    if (academicYearId) {
      const ay = await prisma.academicYear.findUnique({ where: { id: academicYearId } });
      if (ay) {
        dateFilter = { gte: new Date(ay.startDate), lte: new Date(ay.endDate) };
      }
    } else {
      const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
      const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59));
      dateFilter = { gte: startOfMonth, lte: endOfMonth };
    }

    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        ...(schoolId ? { schoolId } : {}),
        ...(sectionId ? { sectionId } : { classId }),
        date: dateFilter
      },
      select: { date: true, status: true }
    });

    // Group by date
    const summary = {};
    attendanceRecords.forEach(rec => {
      const d = rec.date.toISOString().split('T')[0];
      if (!summary[d]) summary[d] = { date: d, Present: 0, Absent: 0, Late: 0 };
      summary[d][rec.status] = (summary[d][rec.status] || 0) + 1;
    });

    res.json(Object.values(summary).sort((a, b) => new Date(b.date) - new Date(a.date)));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get detailed monthly attendance matrix (student vs days) for a section
router.get('/monthly-register', authenticateToken, async (req, res) => {
  const { sectionId, classId, month, year, academicYearId, asOfDate } = req.query;
  if (!sectionId && !classId) return res.status(400).json({ message: 'Missing sectionId or classId' });
  if (!academicYearId && (!month || !year)) return res.status(400).json({ message: 'Missing month/year or academicYearId' });

  try {
    let schoolId = req.user.schoolId;
    if (req.user.role === 'super_admin' && req.query.schoolId) {
      schoolId = req.query.schoolId;
    }

    // Identify the academic year to use (ongoing year history)
    const activeYear = await prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true }
    });
    const yearToUse = academicYearId || activeYear?.id;

    let dateFilter = {};
    if (academicYearId) {
      const ay = await prisma.academicYear.findUnique({ where: { id: academicYearId } });
      if (ay) {
        dateFilter = { gte: new Date(ay.startDate), lte: new Date(ay.endDate) };
      }
    } else {
      const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
      const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59));
      dateFilter = { gte: startOfMonth, lte: endOfMonth };
    }

    // Fetch ALL students enrolled in this academic year for this class/section.
    // We do NOT filter by created_at because we want to show the full student list
    // for any historical month within the current academic year.
    const enrollmentWhere = {
      ...(sectionId ? { sectionId } : { classId }),
      schoolId,
      ...(yearToUse ? { academicYearId: yearToUse } : { isCurrent: true }),
    };

    const enrollments = await prisma.enrollment.findMany({
      where: enrollmentWhere,
      include: {
        student: {
          include: { user: { select: { name: true } } }
        }
      },
      orderBy: { student: { user: { name: 'asc' } } }
    });

    const students = enrollments.map(e => ({
      ...e.student,
      enrollmentId: e.id,
      status: e.status
    }));

    // Get all attendance records for this date range (month/year)
    // No academic year filter here — just look at actual attendance dates
    const attendanceStudentIds = students.map(s => s.id);
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        ...(schoolId ? { schoolId } : {}),
        studentId: { in: attendanceStudentIds },
        date: dateFilter
      },
      select: { studentId: true, date: true, status: true, session: true }
    });

    res.json({ students, attendanceRecords });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
