const express = require('express');
const router = require('express').Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const cache = require('../lib/cache');
const cacheMiddleware = require('../middleware/cacheMiddleware');


// GET /api/dashboard/debug-revenue - TEMPORARY DEBUG ENDPOINT
router.get('/debug-revenue', authenticateToken, authorizeRoles('admin', 'super_admin', 'owner'), async (req, res) => {
    try {
        let schoolId = req.user.schoolId;
        if (!schoolId && req.user.id) {
            const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { schoolId: true } });
            if (u) schoolId = u.schoolId;
        }

        const [fees, enrollments, academicYear] = await Promise.all([
            prisma.feeStructure.findMany({ where: { schoolId } }),
            prisma.enrollment.findMany({
                where: { schoolId },
                select: { id: true, classId: true, sectionId: true, status: true, isCurrent: true, academicYearId: true, student: { select: { id: true, scholarship: true, status: true } } },
                take: 20
            }),
            prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } })
        ]);

        res.json({
            schoolId,
            currentAcademicYear: academicYear,
            totalFees: fees.length,
            fees: fees.map(f => ({ id: f.id, name: f.name, amount: f.amount, frequency: f.frequency, classId: f.classId, sectionId: f.sectionId })),
            totalEnrollments: enrollments.length,
            enrollments: enrollments.map(e => ({ id: e.id, classId: e.classId, sectionId: e.sectionId, status: e.status, isCurrent: e.isCurrent, academicYearId: e.academicYearId, studentScholarship: e.student?.scholarship }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/dashboard/stats
// GET /api/dashboard/stats
router.get('/stats', authenticateToken, authorizeRoles('admin', 'super_admin', 'owner'), async (req, res) => {
    // 0. Initialize defaults to prevent 'undefined' crashes
    let studentsCount = 0, teachersCount = 0, parentsCount = 0, adminsCount = 0, staffCount = 0, classesCount = 0;
    let paymentAggr = { _sum: { amount: 0 } }, expenseAggr = { _sum: { amount: 0 } }, paidSalAggr = { _sum: { netSalary: 0 } };
    let feeStructures = [], schoolSections = [], smsCount = 0;
    let dayAttendance = [], totalShiftClasses = 0, paidPaymentsCount = 0, totalStudentsCountForPayment = 0;
    let presentCount = 0, absentCount = 0, lateCount = 0, markedSectionsCount = 0;
    let paymentTotalsForYear = [], expenseTotalsByDay = [], salaryTotalsByMonth = [];
    let activeEnrollmentsForRevenue = [];

    try {
        const academicYear = req.query.academicYear || req.query.session;
        const attendanceSession = req.query.session;
        const shift = req.query.shift?.toLowerCase();

        console.log('[DASHBOARD] Stats Request received:', { academicYear, attendanceSession, shift, user: req.user.id });

        // Resolve schoolId logic (Secure & Multi-school aware)
        let schoolId = (req.user.role === 'super_admin' || req.user.role === 'owner')
            ? (req.query.schoolId || null)
            : req.user.schoolId;

        // Force schoolId recovery if missing from token for non-global users
        if (!schoolId && !(['super_admin', 'owner'].includes(req.user.role))) {
            const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { schoolId: true } });
            if (user?.schoolId) schoolId = user.schoolId;
        }

        // Strict Enforcement for Super Admin: verify they manage this school
        if (req.user.role === 'super_admin' && schoolId) {
            const school = await prisma.school.findFirst({ where: { id: schoolId, superAdminId: req.user.id } });
            if (!school) return res.status(403).json({ message: 'Unauthorized access to this school' });
        }

        if (!schoolId && !(['super_admin', 'owner'].includes(req.user.role))) {
            return res.status(400).json({ message: 'School ID is required' });
        }

        const schoolFilter = schoolId ? { schoolId } : {};
        const userSchoolFilter = schoolId ? { schoolId } : {};
        const isGlobal = !schoolId && (req.user.role === 'super_admin' || req.user.role === 'owner');

        // Dates — use local midnight so dates match how attendance records are saved
        const today = new Date();
        // Local-midnight approach: get today's date in local timezone, then set to start/end of that day in UTC
        const localYear = today.getFullYear();
        const localMonth = today.getMonth();
        const localDate = today.getDate();
        const startOfDay = new Date(Date.UTC(localYear, localMonth, localDate, 0, 0, 0, 0));
        const endOfDay = new Date(Date.UTC(localYear, localMonth, localDate, 23, 59, 59, 999));
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();
        const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        const startOfMonth = new Date(Date.UTC(currentYear, today.getMonth(), 1));
        const endOfMonth = new Date(Date.UTC(currentYear, today.getMonth() + 1, 0, 23, 59, 59));
        const startOfYear = new Date(Date.UTC(currentYear, 0, 1));
        const endOfYear = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59));

        // 1. Resolve Academic Year Context (Secure & Multi-School Aware)
        let targetYearIds = [];
        let activeYearRecord = null;
        try {
            // Find ALL matching years within the AUTHORIZED scope (schoolFilter)
            let matchingYears = [];

            if (academicYear && academicYear !== 'undefined') {
                const cleanYear = academicYear.replace(/\s+/g, '').toLowerCase();
                const allYears = await prisma.academicYear.findMany({
                    where: schoolFilter,
                    orderBy: [
                        { isCurrent: 'desc' },
                        { startDate: 'desc' }
                    ]
                });
                matchingYears = allYears.filter(y => (y.name || '').replace(/\s+/g, '').toLowerCase() === cleanYear);
            } else {
                matchingYears = await prisma.academicYear.findMany({
                    where: { ...schoolFilter, isCurrent: true },
                    orderBy: [
                        { isCurrent: 'desc' },
                        { startDate: 'desc' }
                    ]
                });
            }

            // Smart Fallback 1: If no current/named year, check dates within the schoolFilter
            if (matchingYears.length === 0) {
                const now = new Date();
                const dateYears = await prisma.academicYear.findMany({
                    where: { ...schoolFilter, startDate: { lte: now }, endDate: { gte: now } },
                    orderBy: [
                        { isCurrent: 'desc' },
                        { startDate: 'desc' }
                    ]
                });
                if (dateYears.length > 0) matchingYears.push(...dateYears);
            }

            // Smart Fallback 2: Last resort - latest year within schoolFilter
            if (matchingYears.length === 0) {
                const latestYear = await prisma.academicYear.findFirst({
                    where: schoolFilter,
                    orderBy: [
                        { isCurrent: 'desc' },
                        { startDate: 'desc' }
                    ]
                });
                if (latestYear) matchingYears.push(latestYear);
            }

            targetYearIds = matchingYears.map(y => y.id);
            activeYearRecord = matchingYears[0] || null; // For naming/range context

            console.log('[DASHBOARD] Resolved Year Context:', { name: activeYearRecord?.name, count: targetYearIds.length, isGlobal });
        } catch (e) { console.error('[DASHBOARD] AcademicYear Sync Error:', e.message); }

        const currentYearRecord = activeYearRecord;
        const yearIdFilter = targetYearIds.length > 0 ? { in: targetYearIds } : undefined;

        // Calculate effective end date for trend logic: Include today if this is the current active session
        const todayEndOfDay = new Date(new Date().setUTCHours(23, 59, 59, 999));
        let effectiveTrendEndDate = currentYearRecord?.endDate ? new Date(new Date(currentYearRecord.endDate).setUTCHours(23, 59, 59, 999)) : endOfYear;
        if (currentYearRecord?.isCurrent && todayEndOfDay > effectiveTrendEndDate) {
            effectiveTrendEndDate = todayEndOfDay;
        }

        // 2. Execute Stats Batch 1 (Isolated & Precise)
        try {
            console.time('Batch1');
            const [
                sCnt, tCnt, pCnt, aCnt, stfCnt, cCnt,
                pA, eA, sA, fS, sS, sC
            ] = await Promise.all([
                prisma.enrollment.count({
                    where: {
                        ...schoolFilter,
                        isCurrent: true,
                        status: { in: ['active', 'promoted', 'retained'] },
                        ...(shift ? { section: { shift: { equals: shift, mode: 'insensitive' } } } : {})
                    }
                }),
                prisma.teacher.count({ where: { user: userSchoolFilter } }),
                prisma.parent.count({ where: { user: userSchoolFilter } }),
                prisma.user.count({ where: { role: 'admin', ...userSchoolFilter } }),
                prisma.staff.count({ where: { user: userSchoolFilter } }),
                prisma.section.count({ where: { ...schoolFilter, ...(shift ? { shift: { equals: shift, mode: 'insensitive' } } : {}) } }),
                prisma.payment.aggregate({
                    _sum: { amount: true },
                    where: {
                        month: currentMonth,
                        year: currentYear,
                        ...(shift ? { student: { section: { shift: { equals: shift, mode: 'insensitive' } } } } : {}),
                        OR: [
                            { ...schoolFilter },
                            { student: { Enrollments: { some: { ...schoolFilter, isCurrent: true, ...(shift ? { section: { shift: { equals: shift, mode: 'insensitive' } } } : {}) } } } }
                        ]
                    }
                }),
                prisma.expense.aggregate({ _sum: { amount: true }, where: { ...schoolFilter, date: { gte: startOfMonth, lte: endOfMonth } } }),
                prisma.salaryRecord.aggregate({ _sum: { netSalary: true }, where: { ...schoolFilter, month: monthStr, status: 'paid' } }),
                prisma.feeStructure.findMany({ where: { ...schoolFilter } }),
                prisma.section.findMany({ where: { ...schoolFilter, ...(shift ? { shift: { equals: shift, mode: 'insensitive' } } : {}) }, select: { id: true } }),
                prisma.smsLog.count({ where: { ...schoolFilter, status: 'sent', month: currentMonth, year: currentYear } })
            ]);
            studentsCount = sCnt; teachersCount = tCnt; parentsCount = pCnt; adminsCount = aCnt; staffCount = stfCnt; classesCount = cCnt;
            paymentAggr = pA; expenseAggr = eA; paidSalAggr = sA; feeStructures = fS; schoolSections = sS; smsCount = sC;
            console.timeEnd('Batch1');
        } catch (e) {
            console.error('[DASHBOARD] Batch1 Security/Scope Error:', e.message);
        }



        // 4. Batch 2 (Optimized Trends & Attendance)
        try {
            console.time('Batch2');
            const [
                pC, aC, lC, attendanceBySection, tSC, tSCFP, sCS, pPC, pTFY, eTBD, sTBM
            ] = await Promise.all([
                // Present count
                prisma.attendance.count({
                    where: {
                        ...schoolFilter,
                        date: { gte: startOfDay, lte: endOfDay },
                        status: 'Present',
                        ...(attendanceSession && attendanceSession !== 'undefined' ? { session: { in: [attendanceSession, attendanceSession.replace(/_/g, ' '), attendanceSession.replace(/ /g, '_')] } } : {}),
                        ...(shift ? { shift } : {})
                    }
                }),
                // Absent count
                prisma.attendance.count({
                    where: {
                        ...schoolFilter,
                        date: { gte: startOfDay, lte: endOfDay },
                        status: 'Absent',
                        ...(attendanceSession && attendanceSession !== 'undefined' ? { session: { in: [attendanceSession, attendanceSession.replace(/_/g, ' '), attendanceSession.replace(/ /g, '_')] } } : {}),
                        ...(shift ? { shift } : {})
                    }
                }),
                // Late count
                prisma.attendance.count({
                    where: {
                        ...schoolFilter,
                        date: { gte: startOfDay, lte: endOfDay },
                        status: 'Late',
                        ...(attendanceSession && attendanceSession !== 'undefined' ? { session: { in: [attendanceSession, attendanceSession.replace(/_/g, ' '), attendanceSession.replace(/ /g, '_')] } } : {}),
                        ...(shift ? { shift } : {})
                    }
                }),
                // Attendance grouped by section (for pending detection)
                prisma.attendance.groupBy({
                    by: ['sectionId'],
                    _count: { id: true },
                    where: {
                        ...schoolFilter,
                        date: { gte: startOfDay, lte: endOfDay },
                        ...(attendanceSession && attendanceSession !== 'undefined' ? { session: { in: [attendanceSession, attendanceSession.replace(/_/g, ' '), attendanceSession.replace(/ /g, '_')] } } : {}),
                        ...(shift ? { shift } : {})
                    }
                }),
                // Total sections
                prisma.section.count({ where: { ...schoolFilter, ...(shift ? { shift } : {}) } }),
                // Total enrolled students
                prisma.enrollment.count({ where: { ...schoolFilter, isCurrent: true, status: { in: ['active', 'promoted', 'retained'] }, ...(shift ? { section: { shift } } : {}) } }),
                // Student counts per section (for pending detection)
                prisma.enrollment.groupBy({
                    by: ['sectionId'],
                    _count: { id: true },
                    where: {
                        ...schoolFilter,
                        isCurrent: true,
                        status: { in: ['active', 'promoted', 'retained'] },
                        ...(shift ? { section: { shift } } : {})
                    }
                }),
                // Paid students count — include records with null academicYearId (legacy) OR matching year
                prisma.monthlyPaymentRecord.count({
                    where: {
                        student: {
                            user: { schoolId: schoolId || undefined },
                            Enrollments: { some: { isCurrent: true, status: { in: ['active', 'promoted', 'retained'] }, ...schoolFilter } }
                        },
                        month: currentMonth,
                        year: currentYear,
                        status: 'paid',
                        ...(activeYearRecord ? {
                            OR: [
                                { academicYearId: activeYearRecord.id },
                                { academicYearId: null }
                            ]
                        } : {})
                    }
                }),
                prisma.payment.groupBy({
                    by: ['month', 'year'],
                    _sum: { amount: true },
                    where: {
                        date: { gte: currentYearRecord?.startDate || startOfYear, lte: effectiveTrendEndDate },
                        OR: [{ ...schoolFilter }, { student: { Enrollments: { some: { ...schoolFilter, isCurrent: true } } } }]
                    }
                }),
                prisma.expense.groupBy({
                    by: ['date'],
                    _sum: { amount: true },
                    where: { ...schoolFilter, date: { gte: currentYearRecord?.startDate || startOfYear, lte: effectiveTrendEndDate } }
                }),
                prisma.salaryRecord.groupBy({
                    by: ['month'],
                    _sum: { netSalary: true },
                    where: { ...schoolFilter, status: 'paid' }
                })
            ]);

            presentCount = pC; absentCount = aC; lateCount = lC;
            totalShiftClasses = tSC; totalStudentsCountForPayment = tSCFP; paidPaymentsCount = pPC;
            paymentTotalsForYear = pTFY; expenseTotalsByDay = eTBD; salaryTotalsByMonth = sTBM;

            // PRECISE PENDING DETECTION: A section is "unmarked" if attendance count < student count
            let unmarkedCount = 0;
            sCS.forEach(sc => {
                const att = attendanceBySection.find(a => a.sectionId === sc.sectionId)?._count?.id || 0;
                if (sc._count?.id > 0 && att < sc._count.id) {
                    unmarkedCount++;
                }
            });
            markedSectionsCount = unmarkedCount; // We'll use this for unmarkedClasses logic

            console.timeEnd('Batch2');
        } catch (e) {
            console.error('[DASHBOARD] Batch2 Error:', e.message);
        }

        // 5. Processing Results
        const attendance = {
            present: presentCount,
            absent: absentCount,
            late: lateCount,
            unmarkedClasses: markedSectionsCount
        };

        const monthlyStudentPayments = (paymentAggr?._sum?.amount) || 0;
        const currentMonthExpense = ((expenseAggr?._sum?.amount) || 0) + ((paidSalAggr?._sum?.netSalary) || 0);

        // --- OPTIMIZED: Calculate Expected Revenue ---
        let expectedRevenue = 0;
        try {
            // Re-use feeStructures from Batch 1 if available
            const schoolFees = feeStructures.filter(f => f.frequency === 'monthly');

            // We only need specific fields for revenue calculation
            const activeEnrollments = await prisma.enrollment.findMany({
                where: {
                    ...schoolFilter,
                    isCurrent: true,
                    status: { in: ['active', 'promoted', 'retained'] },
                    ...(shift ? { section: { shift: { equals: shift, mode: 'insensitive' } } } : {})
                },
                select: {
                    classId: true,
                    sectionId: true,
                    student: { select: { scholarship: true } }
                }
            });

            // Use a local cache for resolved fees per class/section to avoid repeat lookups
            const feeCache = new Map();

            activeEnrollments.forEach(e => {
                const cacheKey = `${e.classId}-${e.sectionId}`;
                let baseFee = 0;

                if (feeCache.has(cacheKey)) {
                    baseFee = feeCache.get(cacheKey);
                } else {
                    const sectionFee = schoolFees.find(f => f.sectionId === e.sectionId && e.sectionId !== null);
                    const classFee = schoolFees.find(f => f.classId === e.classId && f.sectionId === null);
                    baseFee = sectionFee ? (sectionFee.amount || 0) : (classFee ? (classFee.amount || 0) : 0);
                    feeCache.set(cacheKey, baseFee);
                }

                let amount = baseFee;
                if (e.student?.scholarship === 'full') amount = 0;
                else if (e.student?.scholarship === 'half') amount /= 2;
                else if (e.student?.scholarship === 'quarter') amount *= 0.75;

                expectedRevenue += amount;
            });
        } catch (err) {
            console.error('[DASHBOARD] Expected Revenue Error:', err.message);
        }

        const graph = [];
        const monthlyExpenseMap = {};
        (expenseTotalsByDay || []).forEach(e => {
            if (e.date) {
                const d = new Date(e.date);
                const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
                monthlyExpenseMap[key] = (monthlyExpenseMap[key] || 0) + (e._sum?.amount || 0);
            }
        });

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let loopDate = currentYearRecord?.startDate ? new Date(currentYearRecord.startDate) : new Date(Date.UTC(currentYear, 0, 1));
        const stopDate = currentYearRecord?.endDate ? new Date(currentYearRecord.endDate) : new Date(Date.UTC(currentYear, 11, 31));

        let safetyBreak = 0;
        while (loopDate <= stopDate && safetyBreak < 15) {
            safetyBreak++;
            const m = loopDate.getUTCMonth() + 1, y = loopDate.getUTCFullYear();
            const lookupMonthStr = `${y}-${String(m).padStart(2, '0')}`;
            const income = (paymentTotalsForYear || []).find(p => p.month === m && p.year === y)?._sum?.amount || 0;
            const expense = (monthlyExpenseMap[lookupMonthStr] || 0) + ((salaryTotalsByMonth || []).find(s => s.month === lookupMonthStr)?._sum?.netSalary || 0);
            graph.push({ name: `${monthNames[m - 1]} ${y % 100}`, income, expense });
            loopDate.setUTCMonth(loopDate.getUTCMonth() + 1); loopDate.setUTCDate(1);
        }

        const result = {
            counts: { students: studentsCount, teachers: teachersCount, parents: parentsCount, admins: adminsCount, employees: staffCount, classes: classesCount },
            financials: { monthlyStudentPayments, expectedRevenue, currentOtherIncome: 0, currentMonthExpense },
            attendance,
            paymentStatus: { paid: paidPaymentsCount, unpaid: Math.max(0, (totalStudentsCountForPayment || 0) - (paidPaymentsCount || 0)) },
            smsMonthlyCount: smsCount || 0,
            graph,
            currentYear: currentYearRecord
        };

        res.json(result);
    } catch (err) {
        console.error('[DASHBOARD] Critical Catch-All Error:', err);
        res.status(500).json({ message: 'Internal Server Error', error: err.message });
    }
});

// GET /api/dashboard/student-stats
router.get('/student-stats', authenticateToken, authorizeRoles('student'), async (req, res) => {
    try {
        console.log(`[student-stats] Fetching for user: ${req.user.id}, name: ${req.user.name}`);
        const student = await prisma.student.findFirst({
            where: { userId: req.user.id },
            include: {
                user: true,
                clss: { select: { id: true, class_name: true } },
                section: { select: { id: true, name: true } }
            }
        });

        if (!student) {
            console.error(`Student record not found for user ${req.user.id}`);
            return res.status(404).json({ message: 'Student record not found' });
        }

        // Resilient Identity Unification for historical records
        // IMPORTANT: Scope student_id match to same school to prevent cross-branch data leakage
        const studentSchoolId = student.user?.schoolId || req.user.schoolId;
        const orConditions = [{ userId: student.userId }];
        if (student.student_id && student.student_id.trim() !== '') {
            orConditions.push({
                student_id: student.student_id,
                user: { schoolId: studentSchoolId } // Correct relation path
            });
        }

        const relatedStudents = await prisma.student.findMany({
            where: { OR: orConditions },
            select: { id: true }
        });
        const relatedIds = [...new Set(relatedStudents.map(s => s.id))];

        // FOLLOW THE ENROLLMENT: Retrieve the student's most relevant enrollment FIRST
        const enrollment = await prisma.enrollment.findFirst({
            where: { studentId: { in: relatedIds } },
            include: {
                clss: { include: { FeeStructures: true } },
                section: { include: { FeeStructures: true } },
                academicYear: true
            },
            orderBy: [
                { isCurrent: 'desc' }, // Prioritize current
                { created_at: 'desc' }
            ]
        });

        // Use the enrollment's year if available, otherwise fallback to global school active year
        let activeYear = enrollment?.academicYear;
        if (!activeYear) {
            activeYear = await prisma.academicYear.findFirst({
                where: { schoolId: student.user.schoolId, isCurrent: true }
            });
        }

        // We use relatedIds for all historical logs so we don't miss payments/attendance across promotions
        const exactStudentId = enrollment ? enrollment.studentId : student.id;

        const [attendance, recentPayments, examResults, allPaymentsSum, attendanceStats] = await Promise.all([
            prisma.attendance.findMany({
                where: {
                    studentId: { in: relatedIds },
                    ...(activeYear ? {
                        date: {
                            gte: new Date(activeYear.startDate),
                            lte: new Date(activeYear.endDate)
                        }
                    } : {})
                },
                orderBy: { date: 'desc' },
                take: 14
            }),
            prisma.payment.findMany({
                where: {
                    studentId: { in: relatedIds },
                    // Only show payments from the last 3 months
                    date: { gte: new Date(new Date().setMonth(new Date().getMonth() - 3)) },
                    ...(activeYear ? {
                        OR: [
                            { academicYearId: activeYear.id },
                            { academicYearId: null, date: { gte: new Date(activeYear.startDate), lte: new Date(activeYear.endDate) } }
                        ]
                    } : {})
                },
                orderBy: { date: 'desc' },
                take: 5
            }),
            prisma.examResult.findMany({
                where: {
                    studentId: { in: relatedIds },
                    exam: {
                        status: { in: ['published', 'locked'] },
                        ...(activeYear ? {
                            OR: [
                                { term: { academicYearId: activeYear.id } },
                                { termId: null }
                            ]
                        } : {})
                    }
                },
                include: {
                    exam: {
                        include: { subject: true }
                    }
                },
                orderBy: { exam: { date: 'desc' } },
                take: 10
            }),
            prisma.payment.aggregate({
                where: {
                    studentId: { in: relatedIds },
                    ...(activeYear ? {
                        OR: [
                            { academicYearId: activeYear.id },
                            { academicYearId: null, date: { gte: new Date(activeYear.startDate), lte: new Date(activeYear.endDate) } }
                        ]
                    } : {})
                },
                _sum: { amount: true }
            }),
            prisma.attendance.aggregate({
                where: {
                    studentId: { in: relatedIds },
                    ...(activeYear ? {
                        date: {
                            gte: new Date(activeYear.startDate),
                            lte: new Date(activeYear.endDate)
                        }
                    } : {})
                },
                _count: { id: true }
            })
        ]);

        const currentMonthNum = new Date().getMonth() + 1;
        const currentYearNum = new Date().getFullYear();
        const monthRecord = await prisma.monthlyPaymentRecord.findFirst({
            where: {
                studentId: { in: relatedIds },
                month: currentMonthNum,
                year: currentYearNum,
                ...(activeYear ? {
                    OR: [
                        { academicYearId: activeYear.id },
                        { academicYearId: null }
                    ]
                } : {})
            },
            select: { id: true, studentId: true, month: true, year: true, status: true }
        });
        const currentStatus = monthRecord ? monthRecord.status : 'unpaid';

        const presentCount = await prisma.attendance.count({
            where: {
                studentId: { in: relatedIds },
                status: { in: ['Present', 'Late'] },
                ...(activeYear ? {
                    date: {
                        gte: new Date(activeYear.startDate),
                        lte: new Date(activeYear.endDate)
                    }
                } : {})
            }
        });

        const paidFees = allPaymentsSum._sum?.amount || 0;

        const totalAttendance = attendanceStats._count.id;
        const attendancePercentage = totalAttendance > 0 ? (presentCount / totalAttendance) * 100 : 0;

        const gradingScales = await prisma.gradingScale.findMany({
            where: { schoolId: req.user.schoolId || student.user?.schoolId },
            orderBy: { minScore: 'desc' }
        });

        function calculateGradeValue(marks, totalMarks, scales) {
            if (!totalMarks || totalMarks === 0) return 'N/A';
            const percentage = Math.round((marks / totalMarks) * 100);

            if (scales && scales.length > 0) {
                // Ensure DESC order for matching threshold
                const sorted = [...scales].sort((a, b) => b.minScore - a.minScore);
                const scale = sorted.find(s => percentage >= s.minScore);
                if (scale) return scale.grade;
            }

            // Standard Universal Fallback
            if (percentage >= 90) return 'A+';
            if (percentage >= 85) return 'B++';
            if (percentage >= 80) return 'B-';
            if (percentage >= 75) return 'C+';
            if (percentage >= 70) return 'C';
            if (percentage >= 60) return 'D';
            return 'F';
        }

        const grandTotal = examResults.reduce((s, r) => s + r.marks, 0);
        const grandMax = examResults.reduce((s, r) => s + (r.exam?.totalMarks || 100), 0);
        const average = grandMax > 0 ? ((grandTotal / grandMax) * 100).toFixed(1) : 0;

        const academicGrade = calculateGradeValue(
            grandTotal,
            grandMax,
            gradingScales
        );

        // Resolve class and section - directly from the exact enrollment, fallback to student
        let resolvedClassName = enrollment?.clss?.class_name || student.clss?.class_name || null;
        let resolvedSectionName = enrollment?.section?.name || student.section?.name || null;
        let resolvedClassId = enrollment?.classId || student.classId || null;
        let resolvedSectionId = enrollment?.sectionId || student.sectionId || null;

        res.json({
            name: student.user?.name,
            class_name: resolvedClassName,
            section_name: resolvedSectionName,
            classId: resolvedClassId,
            sectionId: resolvedSectionId,
            enrollmentId: enrollment?.id || null,
            academicYearId: activeYear?.id || null,
            paidFees,
            currentStatus,
            attendancePercentage,
            recentAttendance: attendance,
            recentPayments: recentPayments,
            recentResults: examResults.map(r => ({
                id: r.id,
                subject: r.exam?.subject?.name,
                score: r.marks,
                totalMarks: r.exam?.totalMarks,
                grade: calculateGradeValue(r.marks, r.exam?.totalMarks || 100, gradingScales),
                date: r.exam?.date
            })),
            grandTotal,
            grandMax,
            average,
            academicGrade,
            grade: academicGrade,
            gradingScales,
            currentYear: activeYear,
            status: student.status
        });
    } catch (err) {
        console.error('Student Stats Error:', err);
        res.status(500).json({ message: err.message });
    }
});

// GET /api/dashboard/accountant-stats
router.get('/accountant-stats', authenticateToken, authorizeRoles('accountant', 'admin', 'owner'), async (req, res) => {
    try {
        const session = req.query.session;
        const shift = req.query.shift?.toLowerCase();
        let schoolId = req.user.schoolId;
        // Fallback: If JWT token doesn't have schoolId, fetch from User table
        if (!schoolId && req.user.id) {
            const userRecord = await prisma.user.findUnique({ where: { id: req.user.id }, select: { schoolId: true } });
            if (userRecord && userRecord.schoolId) schoolId = userRecord.schoolId;
        }
        const schoolFilter = { schoolId };

        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        const startOfDay = new Date(today);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setUTCHours(23, 59, 59, 999);

        const startOfMonth = new Date(Date.UTC(currentYear, today.getMonth(), 1));
        const endOfMonth = new Date(Date.UTC(currentYear, today.getMonth() + 1, 0, 23, 59, 59));
        const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

        const activeYear = await prisma.academicYear.findFirst({
            where: { schoolId: schoolId || 'NONE', isCurrent: true }
        });

        const [paymentAggr, expenseAggr, paidSalAggr, paidCount, dayAttendance, totalSections] = await Promise.all([
            prisma.payment.aggregate({
                _sum: { amount: true },
                where: {
                    ...schoolFilter,
                    month: currentMonth,
                    year: currentYear,
                    ...(activeYear ? { academicYearId: activeYear.id } : {}),
                    ...(shift ? { student: { section: { shift: { equals: shift, mode: 'insensitive' } } } } : {})
                }
            }),
            prisma.expense.aggregate({ _sum: { amount: true }, where: { ...schoolFilter, date: { gte: startOfMonth, lte: endOfMonth } } }),
            prisma.salaryRecord.aggregate({ _sum: { netSalary: true }, where: { ...schoolFilter, month: monthStr, status: 'paid' } }),
            prisma.monthlyPaymentRecord.count({
                where: {
                    student: {
                        user: { schoolId },
                        ...(shift ? { section: { shift: { equals: shift, mode: 'insensitive' } } } : {})
                    },
                    month: currentMonth,
                    year: currentYear,
                    status: 'paid',
                    ...(activeYear ? { academicYearId: activeYear.id } : {})
                }
            }),
            prisma.attendance.findMany({
                where: {
                    ...schoolFilter,
                    date: { gte: startOfDay, lte: endOfDay },
                    ...(session && session !== 'undefined' ?
                        { session: { in: [session, session.replace(/_/g, ' '), session.replace(/ /g, '_')], mode: 'insensitive' } } : {}),
                    ...(shift ? { shift: { equals: shift, mode: 'insensitive' } } : {})
                },
                select: { status: true, sectionId: true }
            }),
            prisma.section.count({
                where: {
                    ...schoolFilter,
                    ...(shift ? { shift: { equals: shift, mode: 'insensitive' } } : {})
                }
            })
        ]);

        // Calculate unpaid students: enrolled students who do NOT have a paid record this month
        const paidStudentIds = (await prisma.monthlyPaymentRecord.findMany({
            where: {
                student: { user: { schoolId } },
                month: currentMonth,
                year: currentYear,
                status: 'paid',
                ...(activeYear ? { academicYearId: activeYear.id } : {})
            },
            select: { studentId: true }
        })).map(r => r.studentId);

        const unpaidCount = await prisma.enrollment.count({
            where: {
                schoolId,
                isCurrent: true,
                status: { in: ['active', 'promoted', 'retained'] },
                studentId: { notIn: paidStudentIds },
                ...(shift ? { section: { shift: { equals: shift, mode: 'insensitive' } } } : {})
            }
        });


        // Format attendance for Accountant (Parity with Admin)
        const attendance = {
            present: (dayAttendance || []).filter(a => a.status === 'Present' || a.status === 'Late').length,
            absent: (dayAttendance || []).filter(a => a.status === 'Absent').length,
            late: (dayAttendance || []).filter(a => a.status === 'Late').length,
            unmarkedClasses: Math.max(0, (totalSections || 0) - new Set((dayAttendance || []).map(a => a.sectionId)).size)
        };

        // --- ADDED: Calculate Expected Revenue (Parity with Admin) ---
        let expectedRevenue = 0;
        try {
            const [activeEnrollments, schoolFees] = await Promise.all([
                prisma.enrollment.findMany({
                    where: {
                        ...schoolFilter,
                        isCurrent: true,
                        status: { in: ['active', 'promoted', 'retained'] },
                        ...(activeYear ? { academicYearId: activeYear.id } : {}),
                        ...(shift ? { section: { shift: { equals: shift, mode: 'insensitive' } } } : {})
                    },
                    select: {
                        classId: true,
                        sectionId: true,
                        student: { select: { scholarship: true } }
                    }
                }),
                prisma.feeStructure.findMany({
                    where: { ...schoolFilter, frequency: 'monthly' }
                })
            ]);

            activeEnrollments.forEach(e => {
                const sectionFee = schoolFees.find(f => f.sectionId === e.sectionId && e.sectionId !== null);
                const classFee = schoolFees.find(f => f.classId === e.classId && f.sectionId === null);
                let baseFee = sectionFee ? (sectionFee.amount || 0) : (classFee ? (classFee.amount || 0) : 0);

                if (e.student?.scholarship === 'full') baseFee = 0;
                else if (e.student?.scholarship === 'half') baseFee /= 2;

                expectedRevenue += baseFee;
            });
        } catch (e) {
            console.error('[ACCOUNTANT-STATS] Expected Revenue Error:', e.message);
        }

        res.json({
            monthlyRevenue: paymentAggr?._sum?.amount || 0,
            expectedRevenue,
            monthlyExpense: (expenseAggr._sum?.amount || 0) + (paidSalAggr._sum?.netSalary || 0),
            unpaidStudents: unpaidCount,
            paidStudents: paidCount,
            attendance,
            currency: '$'
        });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/dashboard/librarian-stats
router.get('/librarian-stats', authenticateToken, authorizeRoles('librarian', 'admin', 'owner'), async (req, res) => {
    try {
        let schoolId = req.user.schoolId;
        // Fallback: If JWT token doesn't have schoolId, fetch from User table
        if (!schoolId && req.user.id) {
            const userRecord = await prisma.user.findUnique({ where: { id: req.user.id }, select: { schoolId: true } });
            if (userRecord && userRecord.schoolId) schoolId = userRecord.schoolId;
        }
        const schoolFilter = { schoolId };

        const [totalBooks, issuedBooks] = await Promise.all([
            prisma.book.aggregate({ _sum: { quantity: true }, where: schoolFilter }),
            prisma.bookIssue.count({ where: { book: { schoolId }, status: 'issued' } })
        ]);

        const totalQty = totalBooks._sum?.quantity || 0;

        res.json({
            totalBooks: totalQty,
            issuedBooks: issuedBooks,
            availableBooks: Math.max(0, totalQty - issuedBooks),
            overdueBooks: await prisma.bookIssue.count({
                where: { book: { schoolId }, status: 'issued', dueDate: { lt: new Date() } }
            })
        });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/dashboard/staff-stats
router.get('/staff-stats', authenticateToken, authorizeRoles('staff', 'admin', 'owner'), async (req, res) => {
    try {
        let schoolId = req.user.schoolId;
        const userSchoolFilter = { schoolId };

        const [studentsCount, teachersCount, eventsCount, announcementsCount] = await Promise.all([
            prisma.enrollment.count({ where: { schoolId, isCurrent: true, status: { in: ['active', 'promoted', 'retained'] } } }),
            prisma.teacher.count({ where: { user: userSchoolFilter } }),
            prisma.event.count({ where: { schoolId } }),
            prisma.announcement.count({ where: { schoolId } })
        ]);

        res.json({
            totalStudents: studentsCount,
            totalTeachers: teachersCount,
            upcomingEvents: eventsCount,
            announcements: announcementsCount
        });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/dashboard/teacher-stats
router.get('/teacher-stats', authenticateToken, authorizeRoles('teacher'), async (req, res) => {
    try {
        const shift = req.query.shift?.toLowerCase();
        const session = req.query.session;
        const teacher = await prisma.teacher.findUnique({
            where: { userId: req.user.id }
        });

        if (!teacher) {
            return res.status(404).json({ message: 'Teacher record not found' });
        }

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const endOfToday = new Date(today);
        endOfToday.setUTCHours(23, 59, 59, 999);

        // 1. Get Assigned Classes (Sections) - Filter by shift if provided
        const assignments = await prisma.subjectAssignment.findMany({
            where: {
                teacherId: teacher.id,
                ...(shift && shift !== 'undefined' ? { section: { shift } } : {})
            },
            include: {
                section: { include: { class: true } },
                subject: true
            }
        });

        const sectionIds = [...new Set(assignments.map(a => a.sectionId).filter(id => id))];

        // 2. Get student count and pending homework count
        const [studentCount, homeworkCount] = await Promise.all([
            prisma.enrollment.count({
                where: {
                    sectionId: { in: sectionIds },
                    isCurrent: true,
                    status: { in: ['active', 'promoted', 'retained'] }
                }
            }),
            prisma.homework.count({
                where: {
                    teacherId: teacher.id,
                    dueDate: { gte: new Date() }
                }
            })
        ]);

        // 3. Aggregate Data for Presence vs Late
        const [todayAttendance, todayLate, todayAbsent] = await Promise.all([
            prisma.attendance.count({
                where: {
                    sectionId: { in: sectionIds },
                    date: { gte: today, lte: endOfToday },
                    status: { in: ['Present', 'Late'] },
                    ...(session && session !== 'undefined' ? { session } : {}),
                    ...(shift && shift !== 'undefined' ? { shift } : {})
                }
            }),
            prisma.attendance.count({
                where: {
                    sectionId: { in: sectionIds },
                    date: { gte: today, lte: endOfToday },
                    status: 'Late',
                    ...(session && session !== 'undefined' ? { session } : {}),
                    ...(shift && shift !== 'undefined' ? { shift } : {})
                }
            }),
            prisma.attendance.count({
                where: {
                    sectionId: { in: sectionIds },
                    date: { gte: today, lte: endOfToday },
                    status: 'Absent',
                    ...(session && session !== 'undefined' ? { session } : {}),
                    ...(shift && shift !== 'undefined' ? { shift } : {})
                }
            })
        ]);

        // 4. Format assigned classes for table
        const assignedClasses = assignments.map(a => ({
            id: a.id,
            class_name: a.section?.class?.class_name || 'N/A',
            section: a.section?.name || 'A',
            subject: { name: a.subject?.name || 'N/A' },
            shift: a.section?.shift || 'morning'
        }));

        const currentYearRecord = await prisma.academicYear.findFirst({
            where: { schoolId: req.user.schoolId || teacher.user?.schoolId, isCurrent: true }
        });

        res.json({
            myClasses: sectionIds.length,
            myStudents: studentCount,
            pendingHomework: homeworkCount,
            todayAttendance,
            todayLate,
            todayAbsent,
            assignedClasses,
            currentYear: currentYearRecord
        });
    } catch (err) {
        console.error('Teacher Stats Error:', err);
        res.status(500).json({ message: err.message });
    }
});

// GET /api/dashboard/charts
router.get('/charts', authenticateToken, authorizeRoles('admin', 'super_admin', 'owner'), async (req, res) => {
    try {
        const { fromDate, toDate, academicYear, session } = req.query;
        // academicYear takes priority for historical trends, session handles attendance distribution
        const targetSession = academicYear || session;

        // Resolve schoolId
        const schoolId = (req.user.role === 'super_admin' || req.user.role === 'owner') ? req.query.schoolId : req.user.schoolId;
        if (!schoolId && !(['super_admin', 'owner'].includes(req.user.role))) {
            return res.status(400).json({ message: 'School ID is required' });
        }

        const today = new Date();
        const currentYearNum = today.getFullYear();

        // 1. Resolve Academic Year Context
        let activeYearRecord = null;
        if (targetSession && targetSession !== 'undefined') {
            activeYearRecord = await prisma.academicYear.findFirst({
                where: { schoolId, name: targetSession }
            });
        }
        if (!activeYearRecord) {
            activeYearRecord = await prisma.academicYear.findFirst({
                where: { schoolId, isCurrent: true }
            });
        }

        // 2. Determine Date Range
        const todayEndOfDayCharts = new Date(new Date().setUTCHours(23, 59, 59, 999));
        let startFilter = activeYearRecord?.startDate || new Date(Date.UTC(currentYearNum, 0, 1));
        let endFilter = activeYearRecord?.endDate ? new Date(new Date(activeYearRecord.endDate).setUTCHours(23, 59, 59, 999)) : new Date(Date.UTC(currentYearNum, 11, 31, 23, 59, 59));

        // If this is the current active year, allow looking at data up to today
        if (activeYearRecord?.isCurrent && todayEndOfDayCharts > endFilter) {
            endFilter = todayEndOfDayCharts;
        }

        if (fromDate) startFilter = new Date(`${fromDate}T00:00:00.000Z`);
        if (toDate) endFilter = new Date(`${toDate}T23:59:59.999Z`);

        let allowedSchoolIds = null;
        if (!schoolId && req.user.role === 'super_admin') {
            const adminSchools = await prisma.school.findMany({ where: { superAdminId: req.user.id }, select: { id: true } });
            allowedSchoolIds = adminSchools.map(s => s.id);
        }

        let schoolFilter = { schoolId: 'NONE_AUTHORIZED' };
        if (schoolId) {
            schoolFilter = { schoolId };
        } else if (req.user.role === 'owner') {
            schoolFilter = {};
        } else if (req.user.role === 'super_admin' && allowedSchoolIds.length > 0) {
            schoolFilter = { schoolId: { in: allowedSchoolIds } };
        }

        // 3. Data Fetching — OPTIMIZED: use aggregations only
        const [incomeByMonth, incomeByClassData, expenseCategories, expensesByMonth, salaryRecords] = await Promise.all([
            // Income grouped by month/year (for trend chart)
            prisma.payment.groupBy({
                by: ['month', 'year'],
                _sum: { amount: true },
                where: {
                    date: { gte: startFilter, lte: endFilter },
                    ...schoolFilter
                }
            }),
            // Income by class (for pie chart) — Selecting ONLY what is needed
            prisma.payment.findMany({
                where: {
                    date: { gte: startFilter, lte: endFilter },
                    ...schoolFilter
                },
                select: {
                    amount: true,
                    studentId: true,
                    academicYearId: true,
                    student: { select: { clss: { select: { class_name: true } } } }
                },
                take: 5000 // Hard cap to prevent memory/egress explosion
            }),
            // Expenses by Category (groupBy)
            prisma.expense.groupBy({
                by: ['category'],
                _sum: { amount: true },
                where: { ...schoolFilter, date: { gte: startFilter, lte: endFilter } }
            }),
            // Expenses by month (calculated in JS since month/year fields don't exist on Expense model)
            prisma.expense.findMany({
                where: { ...schoolFilter, date: { gte: startFilter, lte: endFilter } },
                select: { amount: true, date: true }
            }).then(expenses => {
                const map = {};
                expenses.forEach(e => {
                    if (e.date) {
                        const d = new Date(e.date);
                        const m = d.getUTCMonth() + 1;
                        const y = d.getUTCFullYear();
                        const key = `${y}-${m}`;
                        map[key] = (map[key] || 0) + (e.amount || 0);
                    }
                });
                return Object.entries(map).map(([key, amt]) => {
                    const [y, m] = key.split('-');
                    return { month: parseInt(m), year: parseInt(y), _sum: { amount: amt } };
                });
            }).catch((err) => {
                console.error('Expense group error:', err);
                return [];
            }),
            // Salaries (grouped by month string)
            prisma.salaryRecord.groupBy({
                by: ['month'],
                _sum: { netSalary: true },
                where: {
                    ...schoolFilter,
                    month: {
                        gte: `${startFilter.getUTCFullYear()}-${String(startFilter.getUTCMonth() + 1).padStart(2, '0')}`,
                        lte: `${endFilter.getUTCFullYear()}-${String(endFilter.getUTCMonth() + 1).padStart(2, '0')}`
                    },
                    status: 'paid'
                }
            })
        ]);

        // 4. Processing results
        // Income by Class Breakdown (Historical Context Aware)
        const studentIds = [...new Set(incomeByClassData.map(p => p.studentId))];
        const enrollmentsForIncome = await prisma.enrollment.findMany({
            where: { studentId: { in: studentIds }, ...schoolFilter },
            select: { studentId: true, academicYearId: true, clss: { select: { class_name: true } } }
        });

        const incomeMap = {};
        incomeByClassData.forEach(p => {
            let className = 'Other';
            if (p.academicYearId) {
                const enrollment = enrollmentsForIncome.find(e => e.studentId === p.studentId && e.academicYearId === p.academicYearId);
                if (enrollment && enrollment.clss) {
                    className = enrollment.clss.class_name;
                } else if (p.student?.clss) {
                    className = p.student.clss.class_name; // Fallback to current
                }
            } else if (p.student?.clss) {
                className = p.student.clss.class_name;
            }
            incomeMap[className] = (incomeMap[className] || 0) + (p.amount || 0);
        });
        const incomeByClass = Object.keys(incomeMap).map(name => ({ name, value: incomeMap[name] }));

        // Expense Breakdown by Category
        const expenseByCategory = expenseCategories.map(e => ({ name: e.category || 'General', value: e._sum.amount || 0 }));
        const totalPaidSal = salaryRecords.reduce((sum, r) => sum + (r._sum.netSalary || 0), 0);
        if (totalPaidSal > 0) expenseByCategory.push({ name: 'Salaries', value: totalPaidSal });

        // Expense per month map
        const monthlyExpenseMap = {};
        (expensesByMonth || []).forEach(e => {
            if (e.month && e.year) {
                const key = `${e.year}-${String(e.month).padStart(2, '0')}`;
                monthlyExpenseMap[key] = (monthlyExpenseMap[key] || 0) + (e._sum?.amount || 0);
            }
        });

        // Trends: Chronological iteration
        const trends = [];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        let loopDate = new Date(startFilter);
        loopDate.setUTCDate(1);
        const stopDate = new Date(endFilter);

        let safety = 0;
        while (loopDate <= stopDate && safety < 24) {
            safety++;
            const m = loopDate.getUTCMonth() + 1;
            const y = loopDate.getUTCFullYear();
            const monthStr = `${y}-${String(m).padStart(2, '0')}`;
            const label = `${monthNames[m - 1]} ${y % 100}`;

            const income = (incomeByMonth || []).find(p => p.month === m && p.year === y)?._sum?.amount || 0;
            const expense = (monthlyExpenseMap[monthStr] || 0) + (salaryRecords.find(s => s.month === monthStr)?._sum?.netSalary || 0);

            trends.push({ name: label, month: m, income, expense });
            loopDate.setUTCMonth(loopDate.getUTCMonth() + 1);
            loopDate.setUTCDate(1);
        }

        res.json({
            incomeByClass,
            expenseByCategory,
            trends
        });
    } catch (err) {
        console.error('Charts Error:', err);
        res.status(500).json({ message: 'Internal Server Error', error: err.message });
    }
});


// GET /api/dashboard/attendance-details
router.get('/attendance-details', authenticateToken, authorizeRoles('admin', 'super_admin', 'owner', 'teacher', 'accountant'), async (req, res) => {
    try {
        const shift = req.query.shift?.toLowerCase();
        const session = req.query.session;
        const { status } = req.query;
        let schoolId = (req.user.role === 'super_admin' || req.user.role === 'owner') ? req.query.schoolId : req.user.schoolId;

        let teacherSectionFilter = {};
        if (req.user.role === 'teacher') {
            const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
            if (teacher) {
                const assignments = await prisma.subjectAssignment.findMany({
                    where: { teacherId: teacher.id },
                    select: { sectionId: true }
                });
                const teacherSectionIds = [...new Set(assignments.map(a => a.sectionId))];
                teacherSectionFilter = { id: { in: teacherSectionIds } };
            }
        }

        if (!schoolId && !(['super_admin', 'owner'].includes(req.user.role))) {
            return res.status(400).json({ message: 'School ID is required' });
        }

        const schoolFilter = schoolId ? { schoolId } : {};

        const today = new Date();
        const startOfDay = new Date(today);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setUTCHours(23, 59, 59, 999);

        if (status === 'Pending' || status === 'unmarked') {
            try {
                // 1. Get all sections for this scope
                const sections = await prisma.section.findMany({
                    where: {
                        ...schoolFilter,
                        ...(req.user.role === 'teacher' ? teacherSectionFilter : {}),
                        ...(shift && shift !== 'undefined' ? { shift: { equals: shift, mode: 'insensitive' } } : {})
                    },
                    include: {
                        class: true,
                        teacher: { include: { user: true } }
                    }
                });

                // 2. Get student counts per section
                const studentCounts = await prisma.enrollment.groupBy({
                    by: ['sectionId'],
                    _count: { id: true },
                    where: {
                        ...schoolFilter,
                        isCurrent: true,
                        status: { in: ['active', 'promoted', 'retained'] }
                    }
                });

                // 3. Get attendance counts per section for today/session/shift
                const attendanceCounts = await prisma.attendance.groupBy({
                    by: ['sectionId'],
                    _count: { id: true },
                    where: {
                        ...schoolFilter,
                        date: { gte: startOfDay, lte: endOfDay },
                        ...(session && session !== 'undefined' ?
                            { session: { in: [session, session.replace(/_/g, ' '), session.replace(/ /g, '_')], mode: 'insensitive' } } : {}),
                        ...(shift && shift !== 'undefined' ? { shift: { equals: shift, mode: 'insensitive' } } : {})
                    }
                });

                // 4. Identify Pending Sections (Attendance count < Student count)
                const pendingSections = sections.filter(s => {
                    const studentCount = studentCounts.find(c => c.sectionId === s.id)?._count?.id || 0;
                    const attendanceCount = attendanceCounts.find(c => c.sectionId === s.id)?._count?.id || 0;

                    // If there are students but not all have attendance, it's pending
                    return studentCount > 0 && attendanceCount < studentCount;
                });

                return res.json(pendingSections.map(s => ({
                    name: `${s.class?.class_name || 'N/A'} - ${s.name || 'N/A'}`,
                    student_id: s.shift || 'morning',
                    class: s.teacher?.user?.name || 'No Teacher'
                })));
            } catch (err) {
                console.error('Pending Details Error:', err);
                return res.status(500).json({ message: err.message });
            }
        }

        const attendance = await prisma.attendance.findMany({
            where: {
                ...schoolFilter,
                date: { gte: startOfDay, lte: endOfDay },
                status: status === 'Present' ? { in: ['Present', 'Late'] } : status,
                ...(req.user.role === 'teacher' ? { sectionId: teacherSectionFilter.id } : {}),
                ...(session && session !== 'undefined' ?
                    { session: { in: [session, session.replace(/_/g, ' '), session.replace(/ /g, '_')], mode: 'insensitive' } } : {}),
                ...(shift && shift !== 'undefined' ? { section: { shift: { equals: shift, mode: 'insensitive' } } } : {})
            },
            include: {
                student: {
                    include: {
                        user: true,
                        clss: true,
                        section: true,
                        Parents: {
                            include: {
                                parent: {
                                    include: { user: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        res.json(attendance.map(a => {
            const parentRelation = a.student.Parents?.[0];
            const p = parentRelation?.parent;
            return {
                name: a.student.user.name,
                student_id: a.student.student_id,
                class: `${a.student.clss?.class_name || 'N/A'} - ${a.student.section?.name || 'N/A'}`,
                parent_name: p?.user?.name || 'N/A',
                parent_phone: p?.user?.phone || p?.phone || 'N/A'
            };
        }));
    } catch (err) {
        console.error('Attendance Details Error:', err);
        res.status(500).json({ message: err.message });
    }
});

// GET /api/dashboard/payment-details
router.get('/payment-details', authenticateToken, authorizeRoles('admin', 'super_admin', 'owner', 'accountant'), async (req, res) => {
    try {
        const { status } = req.query;
        const schoolId = (req.user.role === 'super_admin' || req.user.role === 'owner') ? req.query.schoolId : req.user.schoolId;
        if (!schoolId && !(['super_admin', 'owner'].includes(req.user.role))) {
            return res.status(400).json({ message: 'School ID is required' });
        }

        const schoolFilter = schoolId ? { schoolId } : {};
        const userSchoolFilter = schoolId ? { schoolId } : {};

        const today = new Date();
        const month = today.getMonth() + 1;
        const year = today.getFullYear();

        if (status === 'unpaid') {
            // Resolve active academic year context
            const activeYear = await prisma.academicYear.findFirst({
                where: { ...schoolFilter, isCurrent: true }
            });

            // Unpaid students are those who do NOT have a 'paid' record for this month
            const paidStudentIds = (await prisma.monthlyPaymentRecord.findMany({
                where: {
                    student: { user: { ...userSchoolFilter } },
                    month,
                    year,
                    status: 'paid',
                    ...(activeYear ? { academicYearId: activeYear.id } : {})
                },
                select: { studentId: true }
            })).map(r => r.studentId);

            const unpaidStudents = await prisma.enrollment.findMany({
                where: {
                    schoolId,
                    isCurrent: true,
                    studentId: { notIn: paidStudentIds },
                    ...(req.query.shift && req.query.shift !== 'undefined' ? { section: { shift: { equals: req.query.shift, mode: 'insensitive' } } } : {})
                },
                include: { student: { include: { user: true } }, clss: true, section: true }
            });

            return res.json(unpaidStudents.map(e => ({
                name: e.student.user.name,
                student_id: e.student.student_id,
                class: `${e.clss?.class_name || 'N/A'} - ${e.section?.name || 'N/A'}`
            })));
        }

        // Resolve active academic year context
        const activeYear = await prisma.academicYear.findFirst({
            where: { ...schoolFilter, isCurrent: true }
        });

        const records = await prisma.monthlyPaymentRecord.findMany({
            where: {
                student: {
                    user: { ...userSchoolFilter },
                    ...(req.query.shift && req.query.shift !== 'undefined' ? { section: { shift: { equals: req.query.shift, mode: 'insensitive' } } } : {})
                },
                month,
                year,
                status,
                ...(activeYear ? { academicYearId: activeYear.id } : {})
            },
            select: {
                id: true,
                studentId: true,
                month: true,
                year: true,
                status: true,
                student: {
                    include: { user: true, clss: true, section: true }
                }
            }
        });

        // Deduplicate by studentId to prevent "Ghost" or duplicate entries during promotions
        const uniqueStudents = new Map();
        records.forEach(r => {
            if (r.student && !uniqueStudents.has(r.studentId)) {
                uniqueStudents.set(r.studentId, {
                    name: r.student?.user?.name,
                    student_id: r.student?.student_id,
                    class: `${r.student?.clss?.class_name || 'N/A'} - ${r.student?.section?.name || 'N/A'}`
                });
            }
        });

        res.json(Array.from(uniqueStudents.values()));
    } catch (err) {
        console.error('Payment Details Error:', err);
        res.status(500).json({ message: err.message });
    }
});

// GET /api/dashboard/superadmin
// Aggregates data across ALL schools for the owner/super_admin
router.get('/superadmin', authenticateToken, authorizeRoles('super_admin', 'owner'), async (req, res) => {
    try {
        const { academicYearId } = req.query;

        // 1. Identify Schools managed by this user
        const schoolFilter = { isActive: true };
        if (req.user.role === 'super_admin') {
            schoolFilter.superAdminId = req.user.id;
        }

        const cacheKey = `dashboard:superadmin:${req.user.id}:${academicYearId || 'current'}`;
        const cached = await cache.get(cacheKey);
        if (cached) {
            console.log(`[Cache Hit] Superadmin Stats for ${req.user.id}`);
            return res.json(cached);
        }

        const schools = await prisma.school.findMany({
            where: schoolFilter,
            select: { id: true, name: true }
        });

        const schoolIds = schools.map(s => s.id);
        if (schoolIds.length === 0) {
            return res.json({ counts: { totalSchools: 0, totalStudents: 0, totalTeachers: 0 }, financials: { totalRevenue: 0, thisMonthRevenue: 0 }, monthlyTrends: [], schoolStats: [] });
        }

        // 2. Resolve Date Range Context
        const today = new Date();
        const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
        const endOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0, 23, 59, 59, 999));

        let startFilter = null;
        let endFilter = null;

        if (academicYearId) {
            const yearRec = await prisma.academicYear.findUnique({ where: { id: academicYearId } });
            if (yearRec) {
                startFilter = new Date(yearRec.startDate);
                endFilter = new Date(yearRec.endDate);
                endFilter.setUTCHours(23, 59, 59, 999);
            }
        }

        // 3. Parallel Data Fetching
        const queries = [
            // Student count
            academicYearId
                ? prisma.enrollment.count({ where: { schoolId: { in: schoolIds }, academicYearId, status: { in: ['active', 'promoted', 'retained'] } } })
                : prisma.enrollment.count({ where: { schoolId: { in: schoolIds }, isCurrent: true, status: { in: ['active', 'promoted', 'retained'] } } }),

            prisma.teacher.count({ where: { user: { schoolId: { in: schoolIds } } } }),

            // Financials within the academic year date range
            prisma.payment.aggregate({
                where: {
                    schoolId: { in: schoolIds },
                    ...(startFilter && endFilter ? { date: { gte: startFilter, lte: endFilter } } : {})
                },
                _sum: { amount: true }
            }),

            // Financials for THIS MONTH (Global)
            prisma.payment.aggregate({
                where: {
                    schoolId: { in: schoolIds },
                    date: { gte: startOfMonth, lte: endOfMonth }
                },
                _sum: { amount: true }
            }),

            // Monthly Trends (limit to last 12 months or academic year months)
            prisma.payment.groupBy({
                by: ['month', 'year'],
                where: {
                    schoolId: { in: schoolIds },
                    ...(startFilter && endFilter ? { date: { gte: startFilter, lte: endFilter } } : {
                        date: { gte: new Date(today.getFullYear() - 1, today.getMonth(), 1) }
                    })
                },
                _sum: { amount: true },
                orderBy: [{ year: 'asc' }, { month: 'asc' }]
            }),

            // Collection Efficiency Support: Total students and their expected revenue
            // For a "Global" estimate, we use the sum of balances + sum of payments
            prisma.enrollment.aggregate({
                where: {
                    schoolId: { in: schoolIds },
                    ...(academicYearId ? { academicYearId } : { isCurrent: true }),
                    status: 'active'
                },
                _sum: { balance: true }
            })
        ];

        const [
            globalStudents,
            globalTeachers,
            yearRevenueAgg,
            thisMonthRevenueAgg,
            monthlyTrendsAgg,
            totalBalancesAgg
        ] = await Promise.all(queries);

        const totalRevenue = yearRevenueAgg._sum.amount || 0;
        const thisMonthRevenue = thisMonthRevenueAgg._sum.amount || 0;
        const totalPending = totalBalancesAgg._sum.balance || 0;
        const expectedTotal = totalRevenue + totalPending;
        const efficiency = expectedTotal > 0 ? (totalRevenue / expectedTotal) * 100 : 100;

        // 4. Format Monthly Trends
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthlyTrends = monthlyTrendsAgg.map(t => ({
            month: `${monthNames[t.month - 1]} ${String(t.year).slice(-2)}`,
            revenue: t._sum.amount || 0
        }));

        // 5. School Stats (Bulk)
        const [studentCountsAgg, teacherCountsAgg, schoolRevAgg] = await Promise.all([
            // Student counts per school for the selected year
            prisma.enrollment.groupBy({
                by: ['schoolId'],
                where: {
                    schoolId: { in: schoolIds },
                    ...(academicYearId ? { academicYearId } : { isCurrent: true }),
                    status: { in: ['active', 'promoted', 'retained'] }
                },
                _count: { id: true }
            }),
            prisma.user.groupBy({
                by: ['schoolId'],
                where: { schoolId: { in: schoolIds }, role: 'teacher' },
                _count: { id: true }
            }),
            prisma.payment.groupBy({
                by: ['schoolId'],
                where: {
                    schoolId: { in: schoolIds },
                    ...(startFilter && endFilter ? { date: { gte: startFilter, lte: endFilter } } : { year: today.getFullYear() })
                },
                _sum: { amount: true }
            })
        ]);

        const schoolStats = schools.map(school => {
            const students = studentCountsAgg.find(c => c.schoolId === school.id)?._count?.id || 0;
            const teachers = teacherCountsAgg.find(c => c.schoolId === school.id)?._count?.id || 0;
            const totalRev = schoolRevAgg.find(r => r.schoolId === school.id)?._sum?.amount || 0;

            return {
                schoolId: school.id,
                schoolName: school.name,
                studentsCount: students,
                teachersCount: teachers,
                totalRevenue: totalRev
            };
        });

        const result = {
            counts: {
                totalSchools: schools.length,
                totalStudents: globalStudents,
                totalTeachers: globalTeachers
            },
            financials: {
                totalRevenue,
                thisMonthRevenue,
                overallCollectionEfficiency: efficiency,
                collectionsExcellence: efficiency // Mobile fallback
            },
            monthlyTrends,
            schoolStats
        };

        // Cache for 60 seconds
        await cache.set(cacheKey, result, 60000);
        res.json(result);
    } catch (err) {
        console.error('Superadmin Dashboard Error:', err);
        res.status(500).json({ message: err.message });
    }
});

// GET /api/dashboard/student-trend/:studentId
// Returns grade trends for a specific student for charting
router.get('/student-trend/:studentId', authenticateToken, authorizeRoles('admin', 'super_admin', 'owner', 'student', 'parent'), async (req, res) => {
    try {
        const studentId = req.params.studentId;

        // Fetch published exam results grouped by Exam
        const results = await prisma.examResult.findMany({
            where: {
                studentId,
                exam: { status: 'published' }
            },
            include: { exam: { include: { subject: true } } },
            orderBy: { exam: { date: 'asc' } }
        });

        const trendData = results.map(r => ({
            examName: r.exam.name,
            subject: r.exam.subject.name,
            date: r.exam.date,
            score: r.marks,
            totalMarks: r.exam.totalMarks
        }));

        res.json(trendData);
    } catch (err) {
        console.error('Student Trend Error:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
