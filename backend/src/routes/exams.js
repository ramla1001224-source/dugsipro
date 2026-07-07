const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { sendGolisSMS } = require('../utils/smsHelper');
const { createNotification, createOrUpdateNotification } = require('../utils/notificationHelper');
const responseHelper = require('../utils/responseHelper');
const { sendPushNotification } = require('../services/notificationService');
const { enqueueBulkSMS } = require('../services/smsQueue');
const multer = require('multer');
const xlsx = require('xlsx');

// Multer config for in-memory upload
const upload = multer({ storage: multer.memoryStorage() });

// Helper to calculate grade based on school's GradingScale settings
const calculateGrade = (marks, totalMarks, scales = []) => {
    if (marks === undefined || marks === null || !totalMarks || isNaN(marks) || isNaN(totalMarks)) return 'F';
    const percentage = Math.round((marks / totalMarks) * 100);

    // Use dynamic scales if provided (Robust sort: DESC ensures highest match is taken)
    if (scales && scales.length > 0) {
        const sortedScales = [...scales]
            .filter(s => s && s.minScore !== undefined)
            .sort((a, b) => (Number(b.minScore) || 0) - (Number(a.minScore) || 0));

        const matchingScale = sortedScales.find(s => percentage >= (Number(s.minScore) || 0));
        if (matchingScale) return matchingScale.grade;
    }

    // Standard fallback (Matching Somali/School standard shown in settings)
    if (percentage >= 90) return 'A+';
    if (percentage >= 85) return 'B++';
    if (percentage >= 80) return 'B-';
    if (percentage >= 75) return 'C+';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
};

// DIAGNOSTIC HEARTBEAT
router.get('/ping', (req, res) => {
    const keys = Object.keys(prisma).filter(k => !k.startsWith('$'));
    res.json({
        status: 'online',
        version: '2.0.6-proxy-audit',
        timestamp: new Date().toISOString(),
        availableModels: keys
    });
});

// DEV TEST ENDPOINT - REMOVE LATER
router.get('/test-student-view', async (req, res) => {
    try {
        const { classId, sectionId } = req.query;
        let whereClause = {};
        const andConditions = [];
        if (classId) andConditions.push({ classId });
        if (sectionId) andConditions.push({ OR: [{ sectionId }, { sectionId: null }] });

        andConditions.push({
            OR: [
                { status: { in: ['published', 'locked'] } },
                { date: { not: null } }
            ]
        });
        if (andConditions.length > 0) whereClause.AND = andConditions;

        const exams = await prisma.exam.findMany({
            where: whereClause,
            include: { subject: true }
        });
        res.json({ count: exams.length, exams });
    } catch (err) { res.status(500).json(err); }
});

// Get all exams (filtered by teacher's subjects if role is teacher)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { termId, classId, sectionId, academicYearId, page, limit } = req.query;
        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }

        // If schoolId is missing from token, recover from User record
        const userRole = (req.user.role || '').toLowerCase();
        if (!schoolId && !['super_admin', 'owner'].includes(userRole)) {
            try {
                const user = await prisma.user.findUnique({ where: { id: req.user.id } });
                if (user) schoolId = user.schoolId;
            } catch (err) {
                console.error('Exams Recovery Error:', err);
            }
        }

        let whereClause = schoolId ? { schoolId } : { schoolId: 'NONE_AUTHORIZED' };

        const andConditions = [];

        if (termId) andConditions.push({ termId });

        const isStudentOrParent = ['student', 'parent'].includes(userRole);

        // Student/Parent context resolution: ensure they only see their own class/section
        if (isStudentOrParent && !classId) {
            const studentId = req.user.role === 'student'
                ? (await prisma.student.findFirst({ where: { userId: req.user.id } }))?.id
                : null;

            if (studentId) {
                // First try isCurrent=true, then fall back to most recent enrollment
                // This handles promoted students whose new enrollment was just created
                let enrollment = await prisma.enrollment.findFirst({
                    where: { studentId: studentId, isCurrent: true },
                    orderBy: { created_at: 'desc' }
                });

                // Fallback: use the student's own classId/sectionId directly
                if (!enrollment) {
                    const studentRec = await prisma.student.findUnique({
                        where: { id: studentId },
                        select: { classId: true, sectionId: true }
                    });
                    if (studentRec?.classId) {
                        andConditions.push({ classId: studentRec.classId });
                        andConditions.push({ OR: [{ sectionId: studentRec.sectionId }, { sectionId: null }] });
                    }
                } else {
                    andConditions.push({ classId: enrollment.classId });
                    andConditions.push({ OR: [{ sectionId: enrollment.sectionId }, { sectionId: null }] });
                }
            }
        } else {
            if (classId) andConditions.push({ classId });
            if (sectionId) andConditions.push({ OR: [{ sectionId }, { sectionId: null }] });
        }

        if (req.query.onlyCurrent === 'true') {
            const currentYearFilter = { term: { academicYear: { isCurrent: true } } };
            const studentYearFilter = [];

            // If student, also include exams from their enrollment year
            if (req.user.role === 'student') {
                const studentId = (await prisma.student.findFirst({ where: { userId: req.user.id }, select: { id: true } }))?.id;
                if (studentId) {
                    const enrollment = await prisma.enrollment.findFirst({
                        where: { studentId, isCurrent: true },
                        select: { academicYearId: true }
                    });
                    if (enrollment?.academicYearId) {
                        studentYearFilter.push({ term: { academicYearId: enrollment.academicYearId } });
                    }
                }
            }

            andConditions.push({
                OR: [
                    currentYearFilter,
                    ...studentYearFilter,
                    { termId: null } // Always show exams with no term (newly created, not yet assigned)
                ]
            });
        } else if (academicYearId) {
            andConditions.push({
                OR: [
                    { term: { academicYearId } },
                    { termId: null }
                ]
            });
        }

        // Teachers: Restrict to assigned subjects only for Grading (page where all=true is NOT sent).
        // If all=true is sent (from Scheduling page), show EVERYTHING in the school.
        if (req.user.role === 'teacher' && req.query.all !== 'true') {
            const teacher = await prisma.teacher.findFirst({
                where: { userId: req.user.id }
            });

            if (teacher) {
                const assignments = await prisma.subjectAssignment.findMany({
                    where: { teacherId: teacher.id },
                    select: { subjectId: true, sectionId: true, section: { select: { classId: true } } }
                });

                if (assignments.length > 0) {
                    const subjectIds = [...new Set(assignments.map(a => a.subjectId))];
                    const sectionIds = [...new Set(assignments.filter(a => a.sectionId).map(a => a.sectionId))];
                    const classIdsFromSections = [...new Set(assignments.filter(a => a.section?.classId).map(a => a.section.classId))];

                    andConditions.push({
                        OR: [
                            {
                                AND: [
                                    { subjectId: { in: subjectIds } },
                                    { sectionId: { in: sectionIds } }
                                ]
                            },
                            {
                                AND: [
                                    { subjectId: { in: subjectIds } },
                                    { sectionId: null }, // Class-wide exam
                                    { classId: { in: classIdsFromSections } }
                                ]
                            }
                        ]
                    });
                } else {
                    andConditions.push({ id: 'NONE_ASSIGNED' });
                }
            } else {
                andConditions.push({ id: 'TEACHER_RECORD_NOT_FOUND' });
            }
        }

        // Students and Parents should see exams that are published/locked 
        // OR exams that are scheduled (have a date) so they can see their timetable.
        if (isStudentOrParent) {
            andConditions.push({
                OR: [
                    { status: { in: ['published', 'locked'] } }, // Published results
                    { date: { not: null } }                      // Scheduled exams
                ]
            });
        }

        if (andConditions.length > 0) {
            whereClause.AND = andConditions;
        }

        console.log('STUDENT EXAM SCHEDULE QUERY:', JSON.stringify(whereClause, null, 2));

        const p = Number(page) || 1;
        const l = Math.min(Number(limit) || 100, 300); // Max 300
        const skip = (p - 1) * l;

        const [exams, total] = await Promise.all([
            prisma.exam.findMany({
                where: whereClause,
                include: { subject: true, class: true, section: true, term: true, _count: { select: { Results: true } } },
                skip,
                take: l,
                orderBy: { created_at: 'desc' }
            }),
            prisma.exam.count({ where: whereClause })
        ]);

        // FIXED: Calculate missingCount using Enrollment records tied to the exam's academic year.
        // This prevents counting students from previous years who are no longer in this class/section.
        const combinations = [...new Set(exams.map(ex => `${ex.classId}|${ex.sectionId}|${ex.term?.academicYearId || 'null'}`))];
        const studentCounts = {};

        await Promise.all(combinations.map(async (combo) => {
            const [cId, sId, yearId] = combo.split('|');

            let count = 0;
            if (yearId && yearId !== 'null') {
                // Use enrollment-based count for the specific academic year (CORRECT approach)
                count = await prisma.enrollment.count({
                    where: {
                        classId: cId === 'null' ? undefined : cId,
                        ...(sId && sId !== 'null' ? { sectionId: sId } : {}),
                        academicYearId: yearId,
                        isCurrent: true
                    }
                });
            } else {
                // Fallback: use active student count if no academic year available
                count = await prisma.student.count({
                    where: {
                        classId: cId === 'null' ? null : cId,
                        sectionId: (sId === 'null' || !sId) ? undefined : sId,
                        status: 'active'
                    }
                });
            }
            studentCounts[combo] = count;
        }));

        const normalizedExams = exams.map(ex => {
            const comboKey = `${ex.classId}|${ex.sectionId}|${ex.term?.academicYearId || 'null'}`;
            const totalStudents = studentCounts[comboKey] || 0;
            const marksEntered = ex._count?.Results || 0;

            return {
                ...ex,
                class_name: ex.class?.class_name || ex.clss?.class_name || 'All',
                section_name: ex.section?.name || 'All',
                totalStudents,
                missingCount: Math.max(0, totalStudents - marksEntered)
            };
        });

        res.setHeader('X-Total-Count', total);
        res.setHeader('X-Total-Pages', Math.ceil(total / l));

        return res.json(normalizedExams);
    } catch (err) {
        console.error('EXAMS GET ALL ERROR:', err);
        return res.status(500).json({ message: 'Qalad ayaa ka dhacay keenista exam-yada', error: err.message, stack: err.stack });
    }
});

// GET /api/exams/student-results
router.get('/student-results', authenticateToken, authorizeRoles('student', 'parent'), async (req, res) => {
    try {
        console.log(`[student-results] Fetching for user: ${req.user.id}, role: ${req.user.role}`);

        // 1. Resolve Student ID with Healing Support
        let studentId = req.query.studentId;

        if (!studentId && req.user.role === 'student') {
            const sRecord = await prisma.student.findFirst({ where: { userId: req.user.id } });
            if (!sRecord) {
                // HEALING: Auto-create if missing for student role
                try {
                    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
                    if (user) {
                        const h = await prisma.student.create({
                            data: {
                                userId: user.id,
                                schoolId: user.schoolId,
                                student_id: user.username || `S-${user.id.substring(0, 8)}`,
                                status: 'active'
                            }
                        });
                        studentId = h.id;
                    }
                } catch (e) { console.error('Healing in results failed:', e); }
            } else {
                studentId = sRecord.id;
            }
        }

        if (!studentId) {
            return res.status(404).json({
                success: false,
                message: 'Student record not found',
                code: 'STUDENT_NOT_FOUND'
            });
        }

        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: { user: true, clss: true, section: true }
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student record not found',
                code: 'STUDENT_NOT_FOUND'
            });
        }

        const schoolIdToUse = student.user?.schoolId || student.schoolId || req.user.schoolId;
        const scalesWhere = schoolIdToUse ? { schoolId: schoolIdToUse } : { schoolId: 'NONE' };

        const gradingScales = await prisma.gradingScale.findMany({
            where: scalesWhere,
            orderBy: { minScore: 'desc' }
        });

        const subjects = await prisma.subject.findMany({
            where: { schoolId: schoolIdToUse },
            orderBy: { name: 'asc' }
        });

        const { academicYearId } = req.query;
        let effectiveYearId = academicYearId;

        // 1. Initial Year Selection Logic
        if (!effectiveYearId) {
            const currentYear = await prisma.academicYear.findFirst({
                where: { schoolId: schoolIdToUse, isCurrent: true }
            });

            if (currentYear) {
                effectiveYearId = currentYear.id;
            } else {
                const enrollment = await prisma.enrollment.findFirst({
                    where: { studentId: student.id, isCurrent: true },
                    orderBy: { created_at: 'desc' }
                });
                if (enrollment) effectiveYearId = enrollment.academicYearId;
            }
        }

        // 2. Fetch Results with Identity Unification (Resilience)
        // Find all student records that might belong to this same identity 
        // (same userId OR same registration code in this school)
        const relatedStudents = await prisma.student.findMany({
            where: {
                OR: [
                    { userId: student.userId },
                    {
                        AND: [
                            { student_id: { equals: student.student_id, mode: 'insensitive' } },
                            { user: { schoolId: schoolIdToUse } }
                        ]
                    }
                ]
            },
            select: { id: true }
        });
        const relatedIds = relatedStudents.map(s => s.id);

        // Query results for the selected/current year only.
        // NO automatic fallback - if no results for this year, return empty state.
        // The student can use the year dropdown in the UI to browse other years.
        const examFilter = {
            status: { in: ['published', 'locked'] }
            // schoolId: schoolIdToUse -- Removed to allow historical results from other schools
        };
        if (effectiveYearId) {
            // Include exams in this year's terms OR exams with no term (newly created)
            examFilter.OR = [
                { term: { academicYearId: effectiveYearId } },
                { termId: null }
            ];
        }

        const rawResults = await prisma.examResult.findMany({
            where: {
                studentId: { in: relatedIds },
                exam: examFilter
            },
            include: {
                exam: {
                    select: {
                        id: true, name: true, type: true, subjectId: true,
                        totalMarks: true, date: true, classId: true, termId: true
                    }
                }
            }
        });

        // 4. Resolve Display Class/Section from enrollment or exam data
        let displayClass = student.clss?.class_name;
        let displaySection = student.section?.name;
        let isEnrolled = !!(student.classId);

        // Try to get class info from enrollment for the selected year
        if (effectiveYearId) {
            const enrollmentForDisplay = await prisma.enrollment.findFirst({
                where: { studentId: { in: relatedIds }, academicYearId: effectiveYearId },
                include: { clss: true, section: true },
                orderBy: { created_at: 'desc' }
            });
            if (enrollmentForDisplay && enrollmentForDisplay.clss) {
                displayClass = enrollmentForDisplay.clss.class_name || displayClass;
                displaySection = enrollmentForDisplay.section?.name || displaySection;
                isEnrolled = true;
            } else {
                const history = await prisma.studentHistory.findFirst({
                    where: { studentId: { in: relatedIds }, academicYearId: effectiveYearId },
                    include: { clss: true, section: true }
                });
                if (history && history.clss) {
                    displayClass = history.clss.class_name || displayClass;
                    displaySection = history.section?.name || displaySection;
                }
            }
        } else if (rawResults.length > 0) {
            // Fallback: get class info from the first exam if no enrollment found
            const firstExam = await prisma.exam.findUnique({
                where: { id: rawResults[0].examId },
                include: { class: true, section: true }
            });
            if (firstExam) {
                displayClass = firstExam.class?.class_name || displayClass;
                displaySection = firstExam.section?.name || displaySection;
                isEnrolled = true;
            }
        }

        if (rawResults.length === 0) {
            return res.json({
                success: true,
                isEnrolled,
                results: [],
                subjects: [],
                message: isEnrolled ? "Natiijo ma jirto sanadkan" : "Wali fasal laguma qorin",
                code: isEnrolled ? 'NO_RESULTS_FOR_YEAR' : 'NOT_ENROLLED_IN_CLASS'
            });
        }

        // Use the global calculateGrade helper
        const calculateGradeValue = (marks, totalMarks, scales) => calculateGrade(marks, totalMarks, scales);

        // Resilient Subject Mapping: Instead of using the 'active' subjects list, 
        // we use the actual subjects represented in the results to ensure NO results are hidden.
        const subjectsData = [];
        const subjectGroups = {};

        // Group results by subject
        rawResults.forEach(r => {
            const sId = r.exam?.subjectId;
            if (!sId) return;
            if (!subjectGroups[sId]) subjectGroups[sId] = [];
            subjectGroups[sId].push(r);
        });

        // EGRESS FIX: Batch-fetch any subjects missing from the main list — avoids N+1 queries in the loop
        const knownSubjectIds = new Set(subjects.map(s => s.id));
        const missingSubjectIds = Object.keys(subjectGroups).filter(sId => !knownSubjectIds.has(sId));
        let extraSubjects = [];
        if (missingSubjectIds.length > 0) {
            extraSubjects = await prisma.subject.findMany({ where: { id: { in: missingSubjectIds } } });
        }
        const allSubjects = [...subjects, ...extraSubjects];

        // Map each subject found in the results
        for (const sId in subjectGroups) {
            const subResults = subjectGroups[sId];
            const examRef = subResults[0].exam;

            // In-memory lookup only — no DB calls inside the loop
            const subName = allSubjects.find(s => s.id === sId)?.name || examRef?.name || 'Unknown Subject';

            const scores = {};
            let subTotal = 0;
            let subMax = 0;

            subResults.forEach(r => {
                const mark = r.marks || 0;
                scores[r.exam.type] = (scores[r.exam.type] || 0) + mark;
                subTotal += mark;
                subMax += (r.exam.totalMarks || 100);
            });

            subjectsData.push({
                id: sId,
                name: subName,
                scores,
                total: subTotal,
                totalMarks: subMax,
                grade: calculateGradeValue(subTotal, subMax, gradingScales)
            });
        }

        const grandTotal = subjectsData.reduce((sum, s) => sum + s.total, 0);
        const grandMax = subjectsData.reduce((sum, s) => sum + s.totalMarks, 0);
        const average = grandMax > 0 ? parseFloat(((grandTotal / grandMax) * 100).toFixed(1)) : 0;

        // Determine pass/fail: passing is >= 50% by default, or use grading scale minimum
        const passThreshold = gradingScales.length > 0
            ? Math.min(...gradingScales.filter(s => s.grade !== 'F').map(s => Number(s.minScore) || 50))
            : 50;
        const status = average >= passThreshold ? 'Pass' : 'Fail';

        // Calculate class position by comparing this student's grandTotal against peers
        let classPosition = null;
        let totalStudentsInClass = 0;
        try {
            // Get the class/section from enrollment or student record
            const enrollmentForRank = effectiveYearId ? await prisma.enrollment.findFirst({
                where: { studentId: { in: relatedIds }, academicYearId: effectiveYearId },
                select: { classId: true, sectionId: true }
            }) : null;

            const rankClassId = enrollmentForRank?.classId || student.classId;
            const rankSectionId = enrollmentForRank?.sectionId || student.sectionId;

            if (rankClassId && effectiveYearId) {
                // Get grand totals for all class students for the same year by filtering exams directly
                const classResults = await prisma.examResult.groupBy({
                    by: ['studentId'],
                    where: {
                        exam: {
                            classId: rankClassId,
                            status: { in: ['published', 'locked'] },
                            OR: [
                                { term: { academicYearId: effectiveYearId } },
                                { termId: null }
                            ]
                        }
                    },
                    _sum: { marks: true }
                });

                totalStudentsInClass = classResults.length;

                // Sort descending and find this student's rank
                const sorted = classResults.sort((a, b) => (b._sum.marks || 0) - (a._sum.marks || 0));
                const myEntry = sorted.findIndex(r => relatedIds.includes(r.studentId));
                classPosition = myEntry >= 0 ? myEntry + 1 : null;
            }
        } catch (rankErr) {
            console.error('[student-results] Rank calculation error (non-fatal):', rankErr.message);
        }

        const yearDetails = await prisma.academicYear.findUnique({ where: { id: effectiveYearId } });

        return responseHelper.success(res, {
            student: {
                id: student.id,
                name: student.user?.name,
                regId: student.student_id,
                className: displayClass || "N/A",
                sectionName: displaySection || "N/A"
            },
            subjects: subjectsData,
            results: subjectsData,
            grandTotal,
            grandMax,
            average,
            status,
            classPosition,
            totalStudentsInClass,
            grade: calculateGradeValue(grandTotal, grandMax, gradingScales),
            academicYearId: effectiveYearId,
            academicYearName: yearDetails?.name || 'Unknown Year',
            gradingScales
        });
    } catch (err) {
        console.error('Student Results Error:', err);
        return res.status(500).json({ message: err.message });
    }
});

// GET /api/exams/rankings
router.get('/rankings', authenticateToken, authorizeRoles('admin', 'owner', 'super_admin'), async (req, res) => {
    try {
        const { classId, sectionId, academicYearId, order = 'desc' } = req.query;
        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }

        if (!classId || !academicYearId) {
            return res.status(400).json({ message: 'classId and academicYearId are required' });
        }

        // 1. Get all exams for the selected year and class/section
        const exams = await prisma.exam.findMany({
            where: {
                schoolId,
                classId,
                ...(sectionId ? { OR: [{ sectionId }, { sectionId: null }] } : {}),
                status: { in: ['published', 'locked', 'grading'] },
                term: { academicYearId }
            },
            select: { id: true, totalMarks: true }
        });

        if (exams.length === 0) {
            return res.json([]);
        }

        const examIds = exams.map(e => e.id);
        const totalPossibleMarks = exams.reduce((sum, e) => sum + e.totalMarks, 0);

        // 2. Get all results for these exams
        const results = await prisma.examResult.findMany({
            where: { 
                examId: { in: examIds },
                ...(sectionId ? { student: { sectionId } } : {})
            },
            include: {
                student: {
                    select: {
                        id: true,
                        student_id: true,
                        user: { select: { name: true } }
                    }
                }
            }
        });

        // 3. Aggregate results by student
        const studentAggregates = {};
        results.forEach(r => {
            const sId = r.studentId;
            if (!studentAggregates[sId]) {
                studentAggregates[sId] = {
                    id: sId,
                    student_id: r.student.student_id,
                    name: r.student.user?.name || 'Unknown',
                    totalMarks: 0,
                    possibleMarks: totalPossibleMarks
                };
            }
            studentAggregates[sId].totalMarks += r.marks;
        });

        // 4. Convert to array, sort based on order and take top/bottom 10
        const rankings = Object.values(studentAggregates)
            .sort((a, b) => {
                if (order === 'asc') {
                    return a.totalMarks - b.totalMarks;
                } else {
                    return b.totalMarks - a.totalMarks;
                }
            })
            .slice(0, 10);

        return res.json(rankings);
    } catch (err) {
        console.error('Rankings Error:', err);
        return res.status(500).json({ message: err.message });
    }
});

// Get exam results for a specific student (used by parents/admins)
router.get('/student/:studentId', authenticateToken, async (req, res) => {
    try {
        console.log('[EXAMS_DEBUG] Route Start: /student/:id');
        const { studentId: rawStudentId } = req.params;
        const { academicYearId: requestedYearId } = req.query;

        // 1. Resolve Student with Defensive Identity (Identity Unification)
        // Find existing student record by ID or UserID
        let student = await prisma.student.findUnique({
            where: { id: rawStudentId },
            include: { user: true, clss: true, section: true }
        });

        if (!student) {
            student = await prisma.student.findFirst({
                where: { userId: rawStudentId },
                include: { user: true, clss: true, section: true }
            });
        }

        if (!student) {
            return res.status(404).json({ success: false, message: 'Student record not found', code: 'STUDENT_NOT_FOUND' });
        }

        const schoolIdToUse = student.user?.schoolId || student.schoolId || req.user.schoolId;
        const studentRegId = student.student_id;

        // 2. Identify All Related Records (Unification Engine)
        // Find all student records that belong to this same identity (same userId OR same registration code)
        const relatedStudents = await prisma.student.findMany({
            where: {
                OR: [
                    { userId: student.userId },
                    {
                        AND: [
                            { student_id: { equals: studentRegId, mode: 'insensitive' } },
                            {
                                OR: [
                                    { user: { schoolId: schoolIdToUse } },
                                    { clss: { schoolId: schoolIdToUse } }
                                ]
                            }
                        ]
                    }
                ]
            },
            select: { id: true, student_id: true }
        });
        const relatedIds = [...new Set(relatedStudents.map(s => s.id))];

        // 3. Robust Year Selection
        let effectiveYearId = requestedYearId;
        if (!effectiveYearId) {
            // First check for school's current year
            const currentYear = await prisma.academicYear.findFirst({
                where: { schoolId: schoolIdToUse, isCurrent: true }
            });
            if (currentYear) {
                effectiveYearId = currentYear.id;
            } else {
                // Then check for student's current enrollment
                const enrollment = await prisma.enrollment.findFirst({
                    where: { studentId: { in: relatedIds }, isCurrent: true },
                    orderBy: { created_at: 'desc' }
                });
                if (enrollment) effectiveYearId = enrollment.academicYearId;
            }
        }

        // 4. Subject & Scale Preparation
        const [gradingScales, subjects] = await Promise.all([
            prisma.gradingScale.findMany({
                where: { schoolId: schoolIdToUse },
                orderBy: { minScore: 'desc' }
            }),
            prisma.subject.findMany({
                where: { schoolId: schoolIdToUse },
                orderBy: { name: 'asc' }
            })
        ]);

        const allowedStatuses = ['admin', 'owner', 'super_admin'].includes(req.user.role)
            ? ['published', 'locked', 'grading', 'draft']
            : ['published', 'locked'];

        // 5. Recursive Results Fetcher (Auto-Fallback resilience)
        const fetchResultsForYear = async (yearId) => {
            const filter = {
                status: { in: allowedStatuses }
                // schoolId: schoolIdToUse -- Removed to allow historical results from other schools
            };
            if (yearId) {
                // If a specific year is requested, only show exams belonging to that year's terms.
                // Do NOT include exams with termId: null, as those are usually current/unorganized.
                filter.term = { academicYearId: yearId };
            }


            return await prisma.examResult.findMany({
                where: { studentId: { in: relatedIds }, exam: filter },
                include: {
                    exam: {
                        select: {
                            id: true, name: true, type: true, subjectId: true,
                            totalMarks: true, date: true, classId: true, termId: true
                        }
                    }
                }
            });
        };

        let rawResults = await fetchResultsForYear(effectiveYearId);

        // Smart Fallback for promoted students: Automatically check for previous results if current year is empty
        if (rawResults.length === 0 && !requestedYearId) {
            const latestResult = await prisma.examResult.findFirst({
                where: { studentId: { in: relatedIds }, exam: { status: { in: allowedStatuses }, term: { isNot: null } } },
                include: { exam: { include: { term: true } } },
                orderBy: { exam: { date: 'desc' } }
            });

            if (latestResult?.exam?.term?.academicYearId && latestResult.exam.term.academicYearId !== effectiveYearId) {
                effectiveYearId = latestResult.exam.term.academicYearId;
                rawResults = await fetchResultsForYear(effectiveYearId);
            }
        }

        // 6. Final Grouping and Calculation
        const subjectsData = [];
        const subjectGroups = {};
        rawResults.forEach(r => {
            const sId = r.exam?.subjectId;
            if (!sId) return;
            if (!subjectGroups[sId]) subjectGroups[sId] = [];
            subjectGroups[sId].push(r);
        });

        const getGrade = (marks, total, scales) => {
            if (!total || total === 0) return 'N/A';
            const pct = Math.round((marks / total) * 100);

            // Robust dynamic scale matching
            if (scales && scales.length > 0) {
                const sortedScales = [...scales]
                    .filter(s => s && s.minScore !== undefined)
                    .sort((a, b) => (Number(b.minScore) || 0) - (Number(a.minScore) || 0));

                const match = sortedScales.find(s => pct >= (Number(s.minScore) || 0));
                if (match) return match.grade;
            }

            // Fallback standard
            if (pct >= 90) return 'A+';
            if (pct >= 85) return 'B++';
            if (pct >= 80) return 'B-';
            if (pct >= 75) return 'C+';
            if (pct >= 70) return 'C';
            if (pct >= 60) return 'D';
            return 'F';
        };

        // EGRESS FIX: Batch-fetch missing subjects before loop — avoids N+1 DB calls
        const knownSubIds = new Set(subjects.map(s => s.id));
        const missingIds = Object.keys(subjectGroups).filter(sId => !knownSubIds.has(sId));
        let extraSubs = [];
        if (missingIds.length > 0) {
            extraSubs = await prisma.subject.findMany({ where: { id: { in: missingIds } } });
        }
        const allSubjectsList = [...subjects, ...extraSubs];

        for (const sId in subjectGroups) {
            const group = subjectGroups[sId];
            const examRef = group[0].exam;

            // In-memory lookup only — no DB calls inside the loop
            const subName = allSubjectsList.find(s => s.id === sId)?.name || examRef?.name || 'Unknown Subject';

            const scores = {};
            let subTotal = 0, subMax = 0;
            group.forEach(r => {
                const m = r.marks || 0;
                scores[r.exam.type] = (scores[r.exam.type] || 0) + m;
                subTotal += m;
                subMax += (r.exam.totalMarks || 100);
            });

            subjectsData.push({
                id: sId, name: subName, scores, total: subTotal, totalMarks: subMax,
                grade: getGrade(subTotal, subMax, gradingScales)
            });
        }

        let displayClass = student.clss?.class_name;
        let displaySection = student.section?.name;
        if (effectiveYearId) {
            // IDENTITY UNIFICATION: Find enrollment across all related student IDs for this year
            const histEnr = await prisma.enrollment.findFirst({
                where: { studentId: { in: relatedIds }, academicYearId: effectiveYearId },
                include: { clss: true, section: true }
            });
            if (histEnr) {
                displayClass = histEnr.clss?.class_name;
                displaySection = histEnr.section?.name;
            }
        }

        const yearDetails = effectiveYearId ? await prisma.academicYear.findUnique({ where: { id: effectiveYearId } }) : null;

        const grandTotal = subjectsData.reduce((s, d) => s + d.total, 0);
        const grandMax = subjectsData.reduce((s, d) => s + d.totalMarks, 0);

        const average = grandMax > 0 ? parseFloat(((grandTotal / grandMax) * 100).toFixed(1)) : 0;
        
        const passThreshold = gradingScales.length > 0
            ? Math.min(...gradingScales.filter(s => s.grade !== 'F').map(s => Number(s.minScore) || 50))
            : 50;
        const status = average >= passThreshold ? 'Pass' : 'Fail';

        let classPosition = null;
        let totalStudentsInClass = 0;
        try {
            const enrollmentForRank = effectiveYearId ? await prisma.enrollment.findFirst({
                where: { studentId: { in: relatedIds }, academicYearId: effectiveYearId },
                select: { classId: true, sectionId: true }
            }) : null;

            const rankClassId = enrollmentForRank?.classId || student.classId;

            if (rankClassId && effectiveYearId) {
                const classResults = await prisma.examResult.groupBy({
                    by: ['studentId'],
                    where: {
                        exam: {
                            classId: rankClassId,
                            status: { in: allowedStatuses },
                            OR: [
                                { term: { academicYearId: effectiveYearId } },
                                { termId: null }
                            ]
                        }
                    },
                    _sum: { marks: true }
                });

                totalStudentsInClass = classResults.length;
                const sorted = classResults.sort((a, b) => (b._sum.marks || 0) - (a._sum.marks || 0));
                const myEntry = sorted.findIndex(r => relatedIds.includes(r.studentId));
                classPosition = myEntry >= 0 ? myEntry + 1 : null;
            }
        } catch (rankErr) {
            console.error('[admin-student-results] Rank calculation error:', rankErr.message);
        }

        return res.json({
            success: true,
            student: { id: student.id, name: student.user?.name, regId: student.student_id, className: displayClass || 'N/A', sectionName: displaySection || 'N/A' },
            subjects: subjectsData,
            results: subjectsData,
            grandTotal,
            grandMax,
            average,
            status,
            classPosition,
            totalStudentsInClass,
            grade: getGrade(grandTotal, grandMax, gradingScales),
            gradingScales,
            academicYearId: effectiveYearId,
            academicYearName: yearDetails?.name || 'Current Session'
        });

    } catch (err) {
        console.error('[Results Engine Critical]:', err);
        return res.status(500).json({
            success: false,
            message: `Qalad ayaa ka dhacay keenista natiijada: ${err.message}`,
            debug: err.stack?.substring(0, 100)
        });
    }
});

// Get all academic years with actual data/history for a student
router.get('/student-history-years/:studentId', authenticateToken, async (req, res) => {
    try {
        const { studentId } = req.params;
        const getModel = (name) => prisma[name] || prisma[name.charAt(0).toUpperCase() + name.slice(1)] || null;
        const studentModel = getModel('student');
        if (!studentModel) throw new Error('Student model missing from Prisma Client');

        // Try to find student by their record ID first
        let student = await studentModel.findUnique({
            where: { id: studentId },
            include: { user: true }
        });

        // If not found by student record ID, try by userId 
        // (frontend may pass the JWT user.id instead of student.id)
        if (!student) {
            student = await studentModel.findFirst({
                where: { userId: studentId },
                include: { user: true }
            });
        }

        if (!student) return res.status(404).json({ message: 'Student not found' });

        const schoolIdToUse = student.user?.schoolId || student.schoolId || req.user?.schoolId;

        // 1. Identity Normalization (Resilience)
        // Find all student records that belong to this same identity
        const relatedStudents = await studentModel.findMany({
            where: {
                OR: [
                    { userId: student.userId },
                    {
                        AND: [
                            { student_id: { equals: student.student_id, mode: 'insensitive' } },
                            { user: { schoolId: schoolIdToUse } }
                        ]
                    }
                ]
            },
            select: { id: true }
        });
        const relatedIds = relatedStudents.map(rs => rs.id);

        // Get specific years where the student was enrolled
        const enrollModel = getModel('enrollment');
        const enrollments = enrollModel ? await enrollModel.findMany({
            where: { studentId: { in: relatedIds } },
            select: { academicYearId: true }
        }) : [];

        // Also get years from ExamResults (Aggregate across all related IDs)
        const examResultModel = getModel('examResult');
        const results = examResultModel ? await examResultModel.findMany({
            where: { studentId: { in: relatedIds } },
            select: { exam: { select: { term: { select: { academicYearId: true } } } } }
        }) : [];

        // Get the school's configured current academic year
        const yearModel = getModel('academicYear');
        const currentYear = yearModel ? await yearModel.findFirst({
            where: { schoolId: schoolIdToUse, isCurrent: true },
            select: { id: true }
        }) : null;

        const yearIds = new Set();
        enrollments.forEach(e => yearIds.add(e.academicYearId));
        results.forEach(r => {
            if (r.exam?.term?.academicYearId) yearIds.add(r.exam.term.academicYearId);
        });
        if (currentYear) yearIds.add(currentYear.id);

        const filteredYears = await prisma.academicYear.findMany({
            where: { id: { in: Array.from(yearIds) } },
            orderBy: [
                { isCurrent: 'desc' },
                { startDate: 'desc' }
            ]
        });

        const uniqueYears = filteredYears;

        // Add hasResults and schoolName flags to each year (Aggregate across all related IDs)
        const yearsWithMetadata = await Promise.all(uniqueYears.map(async (y) => {
            const hasRes = await prisma.examResult.findFirst({
                where: {
                    studentId: { in: relatedIds },
                    exam: { term: { academicYearId: y.id }, status: { in: ['published', 'locked'] } }
                }
            });
            // Fetch the school associated with this year record
            const school = await prisma.school.findUnique({
                where: { id: y.schoolId },
                select: { name: true }
            });
            return {
                ...y,
                isCurrent: y.isCurrent && y.schoolId === schoolIdToUse,
                hasResults: !!hasRes,
                schoolName: school?.name || 'Unknown'
            };
        }));

        res.json(yearsWithMetadata);
    } catch (err) {
        console.error('History Years Error:', err);
        res.status(500).json({ message: err.message });
    }
});

// Get all students eligible for marking this exam
// Includes currently active students in the exam's class [AND section if specified]
router.get('/:id/students-for-marks', authenticateToken, async (req, res) => {
    const examId = req.params.id;
    const { sectionId } = req.query;
    let schoolId = req.user.schoolId;

    if (req.user.role === 'super_admin' && req.query.schoolId) {
        schoolId = req.query.schoolId;
    }

    try {
        const exam = await prisma.exam.findFirst({
            where: { id: examId, schoolId },
            include: { term: true }
        });

        if (!exam) return res.status(404).json({ message: 'Exam not found' });

        const academicYearId = exam.term?.academicYearId;
        if (!academicYearId) return res.status(400).json({ message: 'Exam must be linked to a term and academic year for proper student list retrieval.' });

        // Fetch students via Enrollment for the exact context of this exam
        const enrollments = await prisma.enrollment.findMany({
            where: {
                academicYearId,
                classId: exam.classId,
                sectionId: sectionId || exam.sectionId || undefined,
                schoolId,
                // We show any student who was enrolled during that year
                status: { in: ['active', 'promoted', 'retained', 'graduated'] }
            },
            include: {
                student: {
                    include: {
                        user: true,
                        Parents: { include: { parent: true } }
                    }
                },
                section: true
            }
        });

        const normalizedStudents = enrollments.map(e => ({
            ...e.student,
            enrollmentId: e.id,
            section: e.section,
            classId: e.classId,
            sectionId: e.sectionId
        })).sort((a, b) => (a.user?.name || '').localeCompare(b.user?.name || ''));

        res.json(normalizedStudents);
    } catch (err) {
        console.error('students-for-marks error:', err);
        return res.status(500).json({ message: 'Qalad ayaa ka dhacay soo jiidista ardayda imtixaankan' });
    }
});

// Create exams in bulk for ALL subjects (admin/teacher)
router.post('/', authenticateToken, authorizeRoles('admin', 'owner', 'teacher'), async (req, res, next) => {
    if (req.user.role === 'teacher') {
        const { authorizePermission } = require('../middleware/auth');
        return authorizePermission('perm_tea_manage_exams')(req, res, next);
    }
    next();
}, async (req, res) => {
    const { sessions, name, type, classId, sectionId, totalMarks, date, endTime, description, subjectId } = req.body;
    let { termId } = req.body;
    let schoolId = req.user.schoolId;

    if ((req.user.role === 'super_admin' || req.user.role === 'owner') && (req.query.schoolId || req.body.schoolId)) {
        schoolId = req.query.schoolId || req.body.schoolId;
    }

    // Resolve termId automatically if missing using the school's current academic year
    if (!termId && schoolId) {
        const currentYear = await prisma.academicYear.findFirst({
            where: { schoolId, isCurrent: true },
            include: { Terms: { orderBy: { startDate: 'asc' } } }
        });
        if (currentYear && currentYear.Terms?.length > 0) {
            termId = currentYear.Terms[0].id;
        }
    }

    if (!schoolId) {
        return res.status(400).json({ message: "School context missing." });
    }

    try {
        // Enforce required date for all exam creations
        if (!date && (!sessions || sessions.length === 0)) {
            return res.status(400).json({ message: "Fadlan dooro taariikhda imtixaanka. Taariikh la'aan imtixaanku uma muuqanayo ardayda." });
        }
        // Case 1: Specific sessions array provided
        if (sessions && Array.isArray(sessions) && sessions.length > 0) {
            const createdExams = await Promise.all(sessions.map(async session => {
                const sessionDate = session.date ? new Date(session.date) : (date ? new Date(date) : null);
                const sessionEnd = session.endTime ? new Date(session.endTime) : (endTime ? new Date(endTime) : null);

                // If ID is provided, UPDATE the existing exam with the schedule info.
                // This prevents new exams from being created in the scheduling page.
                if (session.id || session.examId) {
                    const targetId = session.id || session.examId;
                    return prisma.exam.update({
                        where: { id: targetId, schoolId },
                        data: {
                            date: sessionDate,
                            endTime: sessionEnd,
                            description: session.description || description || undefined
                        }
                    });
                }

                // If no ID is provided, the user must create the exam in the Exams page first.
                // However, to avoid breaking everything, we will skip creation if it's from the scheduling page.
                // For now, let's throw an error or just skip. I'll throw an error to be clear.
                return { error: 'Please select an existing exam to schedule.' };
            }));

            const errors = createdExams.filter(e => e.error);
            if (errors.length > 0) {
                return res.status(400).json({ message: "Qaar ka mid ah maaddooyinka ma lahan imtixaan horay loo abuuray. Fadlan marka hore bogga Exams-ka ka soo abuur." });
            }

            // --- PUSH NOTIFICATION FOR EXAM SCHEDULE ---
            (async () => {
                try {
                    const validExams = createdExams.filter(e => !e.error);
                    if (validExams.length === 0) return;

                    const classIdSet = new Set();
                    validExams.forEach(e => { if (e.classId) classIdSet.add(e.classId); });
                    const classIds = Array.from(classIdSet);

                    if (classIds.length === 0) return;

                    const classes = await prisma.clss.findMany({ where: { id: { in: classIds } } });
                    const targetSchoolId = validExams[0].schoolId;

                    const enrollments = await prisma.enrollment.findMany({
                        where: {
                            classId: { in: classIds },
                            schoolId: targetSchoolId,
                            status: { in: ['active'] }
                        },
                        select: {
                            student: {
                                select: {
                                    user: { select: { fcmToken: true } },
                                    Parents: { select: { parent: { select: { user: { select: { fcmToken: true } } } } } }
                                }
                            }
                        }
                    });

                    let tokenSet = new Set();
                    let recipientUserIds = new Set();
                    enrollments.forEach(e => {
                        if (e.student.userId) recipientUserIds.add(e.student.userId);
                        if (e.student.user?.fcmToken) tokenSet.add(e.student.user.fcmToken);
                        e.student.Parents?.forEach(p => {
                            if (p.parent?.userId) recipientUserIds.add(p.parent.userId);
                            if (p.parent?.user?.fcmToken) tokenSet.add(p.parent.user.fcmToken);
                        });
                    });

                    const schoolInfo = await prisma.school.findUnique({
                        where: { id: schoolId },
                        select: { institutionType: true }
                    });
                    const instLabel = (schoolInfo?.institutionType || 'school').toLowerCase() === 'machad' ? 'machadka' : 'schoolka';

                    const tokens = Array.from(tokenSet);
                    const title = `Jadwal Imtixaan Cusub (${instLabel})`;
                    const classNames = classes.map(c => c.class_name).join(', ');
                    const body = `Waxa la soo galiyay/cusboonaysiiyay jadwalka imtixaanka ${instLabel} fasalada ${classNames}. Fadlan isku diyaari!`;

                    if (tokens.length > 0) {
                        await sendPushNotification(tokens, title, body, { type: 'exam_schedule' });
                    }

                    // Also create DB notifications
                    const recipients = Array.from(recipientUserIds);
                    if (recipients.length > 0) {
                        await prisma.notification.createMany({
                            data: recipients.map(uId => ({
                                userId: uId,
                                title: title,
                                message: body,
                                type: 'EXAM',
                                status: 'sent'
                            })),
                            skipDuplicates: true
                        });
                    }
                } catch (error) {
                    console.error('[ExamScheduleNotify] Push error:', error);
                }
            })();

            return res.status(201).json({ message: `Jadwalada waa la cusboonaysiiyay`, data: createdExams });
        }

        // Case 2: Bulk creation based on Class or SubjectId
        let targetSubjects = [];
        if (subjectId) {
            const sub = await prisma.subject.findUnique({ where: { id: subjectId } });
            if (sub) targetSubjects = [sub];
        } else if (classId) {
            // NEW LOGIC: Filter subjects by their assignment to this class/section
            // If sectionId is provided, use it; otherwise, use all sections in the class
            const assignments = await prisma.subjectAssignment.findMany({
                where: {
                    ...(sectionId ? { sectionId } : { section: { classId } }),
                    subject: { schoolId }
                },
                select: { subject: true }
            });

            // Map to unique subjects
            const subjectMap = new Map();
            assignments.forEach(a => {
                if (a.subject) subjectMap.set(a.subject.id, a.subject);
            });
            targetSubjects = Array.from(subjectMap.values());

            // NO FALLBACK: If no assignments found, we return 404/400 below
        } else if (userRole === 'super_admin' && !classId) {
            // Global school bulk for super_admin (only if schoolId is valid)
            targetSubjects = await prisma.subject.findMany({ where: { schoolId } });
        }

        if (targetSubjects.length === 0) {
            return res.status(404).json({
                message: classId
                    ? "Fadlan marka hore maaddooyin u xir (assign) fasalkan ama qaybtan."
                    : "No subjects found for this selection."
            });
        }

        const examDate = date ? new Date(date) : null;
        const examEndDate = endTime ? new Date(endTime) : null;

        const exams = await Promise.all(targetSubjects.map(async sub => {
            try {
                // Check if an exam of this category (type) already exists for this subject/class/term
                const existing = await prisma.exam.findFirst({
                    where: {
                        type,
                        termId,
                        subjectId: sub.id,
                        classId: classId || null,
                        sectionId: sectionId || null,
                        schoolId
                    }
                });

                if (existing) return existing;

                const examName = `${name} - ${sub.name}`;
                return prisma.exam.create({
                    data: {
                        name: examName,
                        type: type || 'monthly_1',
                        subjectId: sub.id,
                        classId: classId || null,
                        sectionId: sectionId || null,
                        termId: termId || null,
                        totalMarks: Number(totalMarks) || 100,
                        date: examDate,
                        endTime: examEndDate,
                        description: description || null,
                        status: 'draft',
                        schoolId
                    }
                });
            } catch (err) {
                console.error(`[Exam] Error for subject ${sub.name}:`, err.message);
                return null;
            }
        }));

        const successfulExams = exams.filter(e => e !== null);
        return res.status(201).json({
            message: `Created ${successfulExams.length} out of ${targetSubjects.length} subjects`,
            data: successfulExams
        });

    } catch (err) {
        console.error('Create Exam Error:', err);
        return res.status(500).json({ message: 'Qalad ayaa ka dhacay database-ka', error: err.message });
    }
});



// Update exam status (teacher: draft -> published, admin: * -> locked)
router.patch('/:id/status', authenticateToken, authorizeRoles('admin', 'teacher', 'super_admin', 'owner'), async (req, res) => {
    const { status } = req.body;
    try {
        const where = { id: req.params.id };
        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }
        if (schoolId) where.schoolId = schoolId;

        const exam = await prisma.exam.findFirst({ where });
        if (!exam) return responseHelper.error(res, 'Exam not found', null, 404);

        // Teachers CANNOT publish or lock exams UNLESS they have the specific permission.
        if (req.user.role === 'teacher') {
            if (status === 'published' || status === 'locked') {
                const setting = await prisma.schoolSettings.findUnique({
                    where: { key_schoolId: { key: 'perm_tea_manage_exams', schoolId: schoolId || req.user.schoolId } }
                });

                if (!setting || setting.value !== 'true') {
                    return res.status(403).json({
                        message: 'Macallimiinta uma haystaan fasax ay ku daabacaan ama ku xiraan imtixaanka. Fadlan ka sug Admin-ka ama la xiriir si laguugu soo shido.'
                    });
                }
            }
            if (exam.status === 'locked') {
                return res.status(403).json({ message: 'Imtixaankan waa la xiray, waxba kama beddeli kartid.' });
            }
        }

        const updated = await prisma.exam.update({
            where: { id: req.params.id },
            data: { status },
            include: { subject: true, class: true, term: true }
        });

        // --- ASYNC NOTIFICATION & SMS TRIGGER ---
        if (status === 'published') {
            try {
                // Fetch all active students in the class/section
                const enrollments = await prisma.enrollment.findMany({
                    where: {
                        classId: updated.classId,
                        ...(updated.sectionId ? { sectionId: updated.sectionId } : {}),
                        schoolId: updated.schoolId,
                        status: 'active'
                    },
                    include: {
                        student: {
                            include: {
                                user: { select: { fcmToken: true } },
                                Parents: { include: { parent: { include: { user: true } } } }
                            }
                        }
                    }
                });

                const schoolInfo = await prisma.school.findUnique({
                    where: { id: updated.schoolId },
                    select: { name: true, institutionType: true, superAdminId: true }
                });
                const instLabel = (schoolInfo?.institutionType || 'school').toLowerCase() === 'machad' ? 'machadka' : 'schoolka';
                let schoolDisplayName = schoolInfo?.name || 'Schoolka';
                if (schoolInfo?.superAdminId) {
                    const superAdminUser = await prisma.user.findUnique({
                        where: { id: schoolInfo.superAdminId },
                        select: { schoolName: true }
                    });
                    if (superAdminUser?.schoolName) schoolDisplayName = superAdminUser.schoolName;
                }
                // Prefix with institution type label removed as per request
                // const instPrefix = (schoolInfo?.institutionType || 'school').toLowerCase() === 'machad' ? 'Machad' : 'School';
                // schoolDisplayName = `${instPrefix}: ${schoolDisplayName}`;

                const title = `Natiijada Imtixaanka (${instLabel})`;
                const body = `Natiijada imtixaanka ${updated.subject?.name || ''} ee ${instLabel} waa la soo dhajiyey. Fadlan hubi.`;

                const processedUserIds = new Set();

                for (const e of enrollments) {
                    const student = e.student;
                    if (!student) continue;

                    // List of potential recipients (userId and fcmToken)
                    const recipients = [];

                    // 1. Student
                    if (student.userId) {
                        recipients.push({ userId: student.userId, token: student.user?.fcmToken });
                    }

                    // 2. Parents
                    if (student.Parents) {
                        for (const p of student.Parents) {
                            if (p.parent?.userId) {
                                recipients.push({ userId: p.parent.userId, token: p.parent.user?.fcmToken });
                            }
                        }
                    }

                    for (const r of recipients) {
                        const dedupeKey = `${r.userId}:${student.id}`;
                        if (processedUserIds.has(dedupeKey)) continue;
                        processedUserIds.add(dedupeKey);

                        // A. Create DB Notification (Bell Icon)
                        await createOrUpdateNotification({
                            userId: r.userId,
                            title: title,
                            message: body,
                            type: 'EXAM'
                        }).catch(err => console.error(`[ExamNotify] DB Error for ${r.userId}:`, err));

                        // B. Send Push Notification (Firebase)
                        if (r.token) {
                            sendPushNotification([r.token], title, body, {
                                type: 'EXAM',
                                examId: updated.id,
                                click_action: 'FLUTTER_NOTIFICATION_CLICK'
                            }).catch(err => console.error(`[ExamNotify] Push Error for ${r.userId}:`, err));
                        }
                    }
                }
            } catch (err) {
                console.error('[ExamNotify] Global Notification Error:', err);
            }

            // --- QUEUED AUTO-SMS FOR PARENTS (EXAM RESULTS) ---
            // Uses SMSQueue to batch-send messages safely (50 per batch, 500ms delay).
            // This prevents overloading the gateway if there are thousands of results.
            try {
                const results = await prisma.examResult.findMany({
                    where: { examId: updated.id },
                    include: {
                        student: {
                            include: {
                                user: true,
                                Parents: { include: { parent: { include: { user: true } } } }
                            }
                        }
                    }
                });

                // Map exam type key → Somali label
                const examTypeMap = {
                    'bile_1': 'Bile 1',
                    'monthly_1': 'Bile 1',
                    'bile_2': 'Bile 2',
                    'monthly_2': 'Bile 2',
                    'midterm': 'Term Kowaad',
                    'midterm_exam': 'Term Kowaad',
                    'term_1': 'Term Kowaad',
                    'final': 'Final Term',
                    'final_term': 'Final Term',
                };
                const examTypeSomali = examTypeMap[updated.type] || updated.type || 'Imtixaanka';

                const smsJobs = [];
                for (const resItem of results) {
                    const parent = resItem.student?.Parents?.[0]?.parent;
                    const parentPhone = parent?.user?.phone || parent?.phone;
                    const studentName = resItem.student?.user?.name || 'Ardayga';
                    // Abbreviate subject name to first 4 characters
                    const fullSubjectName = updated.subject?.name || 'Maaddada';
                    const subjectShort = fullSubjectName.length > 4
                        ? fullSubjectName.substring(0, 4) + '.'
                        : fullSubjectName;

                    if (parentPhone) {
                        const msg = `${schoolDisplayName}\nNatiijada Imtixaan ${examTypeSomali}, Fasalka ${updated.class?.class_name || ''}: ${studentName} wuxuu ${subjectShort} ka keenay ${resItem.marks}/${updated.totalMarks}. Mahadsanid.`;
                        smsJobs.push({
                            phone: parentPhone,
                            message: msg,
                            schoolId: updated.schoolId,
                            studentId: resItem.studentId,
                            type: 'exam',
                            studentName
                        });
                    }
                }

                if (smsJobs.length > 0) {
                    console.log(`[SMSQueue] Exam publish: Enqueueing ${smsJobs.length} SMS for parents.`);
                    enqueueBulkSMS(smsJobs);
                }
            } catch (smsErr) {
                console.error('[SMS Exam Error]:', smsErr);
            }
        }

        return res.json(updated);
    } catch (err) {
        return res.status(500).json({ message: 'Error updating status' });
    }
});

// Bulk unschedule: clear date/endTime for all exams in a term (optionally filtered by class/section)
router.patch('/bulk-unschedule', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const { termId, classId, sectionId, examIds } = req.body;

    try {
        let schoolId = req.user.schoolId;
        if ((req.user.role === 'super_admin' || req.user.role === 'owner') && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }

        if (!schoolId) return res.status(400).json({ message: 'School ID is required' });

        // Build where clause
        const where = {
            schoolId,
            date: { not: null } // Only unschedule exams that currently have a date
        };

        // If specific exam IDs are passed, use those
        if (examIds && Array.isArray(examIds) && examIds.length > 0) {
            where.id = { in: examIds };
        } else {
            // Otherwise filter by term/class/section
            if (!termId) return res.status(400).json({ message: 'termId ama examIds ayaa loo baahan yahay' });
            where.termId = termId;
            if (classId) where.classId = classId;
            if (sectionId) where.sectionId = sectionId;
        }

        const result = await prisma.exam.updateMany({
            where,
            data: { date: null, endTime: null }
        });

        return res.json({
            message: `${result.count} imtixaan ayaa jadwalkooda laga saaray`,
            count: result.count
        });
    } catch (err) {
        console.error('Bulk unschedule error:', err);
        return res.status(500).json({ message: 'Qalad ayaa ka dhacay tirtiridda jadwalka', error: err.message });
    }
});

// Bulk update exam status
router.patch('/bulk-status', authenticateToken, authorizeRoles('admin', 'super_admin', 'owner'), async (req, res) => {
    const { ids, status } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'Exam IDs are required' });
    }

    try {
        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }

        const updateResult = await prisma.exam.updateMany({
            where: {
                id: { in: ids },
                schoolId
            },
            data: { status }
        });

        // Send notifications to students/parents for bulk publication
        if (status === 'published' && updateResult.count > 0) {
            const { sendPushNotification } = require('../services/notificationService');
            (async () => {
                try {
                    const exams = await prisma.exam.findMany({
                        where: { id: { in: ids } }
                    });

                    if (exams.length === 0) return;

                    const schoolInfo = await prisma.school.findUnique({
                        where: { id: exams[0].schoolId },
                        select: { institutionType: true }
                    });
                    const instLabel = (schoolInfo?.institutionType || 'school').toLowerCase() === 'machad' ? 'machadka' : 'schoolka';

                    const processedUserIds = new Set();
                    const title = `Natiijooyin Imtixaan (${instLabel})`;
                    const body = `Natiijooyinka imtixaanka (Bile/Term/Final) ee ${instLabel} ee dhowr maaddo ah ayaa la soo dhajiyey. Fadlan nidaamka ka hubi.`;

                    for (const exam of exams) {
                        const enrollments = await prisma.enrollment.findMany({
                            where: {
                                classId: exam.classId,
                                ...(exam.sectionId ? { sectionId: exam.sectionId } : {}),
                                schoolId: exam.schoolId,
                                status: 'active'
                            },
                            include: {
                                student: {
                                    include: {
                                        user: { select: { fcmToken: true } },
                                        Parents: { include: { parent: { include: { user: true } } } }
                                    }
                                }
                            }
                        });

                        for (const e of enrollments) {
                            const student = e.student;
                            if (!student) continue;

                            const recipients = [];
                            if (student.userId) recipients.push({ userId: student.userId, token: student.user?.fcmToken });
                            if (student.Parents) {
                                for (const p of student.Parents) {
                                    if (p.parent?.userId) {
                                        recipients.push({ userId: p.parent.userId, token: p.parent.user?.fcmToken });
                                    }
                                }
                            }

                            for (const r of recipients) {
                                const dedupeKey = `${r.userId}:${student.id}`;
                                if (processedUserIds.has(dedupeKey)) continue;
                                processedUserIds.add(dedupeKey);

                                // A. DB Notification
                                await createOrUpdateNotification({
                                    userId: r.userId,
                                    title: title,
                                    message: body,
                                    type: 'EXAM'
                                }).catch(err => console.error(`[BulkExamNotify] DB Error:`, err));

                                // B. Push Notification
                                if (r.token) {
                                    sendPushNotification([r.token], title, body, {
                                        type: 'EXAM',
                                        examIds: ids.join(','),
                                        click_action: 'FLUTTER_NOTIFICATION_CLICK'
                                    }).catch(err => console.error(`[BulkExamNotify] Push Error:`, err));
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('[BulkNotify] Global Error:', err);
                }
            })();
        }
        return res.json({ message: `Successfully updated ${updateResult.count} exams`, count: updateResult.count });
    } catch (err) {
        console.error('Bulk status update error:', err);
        return res.status(500).json({ message: 'Error updating batch status' });
    }
});

// Get exam results for a specific exam
router.get('/:examId/results', authenticateToken, async (req, res) => {
    const { grading, sectionId } = req.query;
    try {
        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }

        const examWhere = { id: req.params.examId };
        if (schoolId) examWhere.schoolId = schoolId;

        const exam = await prisma.exam.findFirst({
            where: examWhere,
            include: { class: true, term: true }
        });
        if (!exam) return responseHelper.error(res, 'Exam not found', null, 404);

        const resultsWhere = { examId: req.params.examId };
        if (sectionId) resultsWhere.sectionId = sectionId;

        const results = await prisma.examResult.findMany({
            where: resultsWhere,
            include: {
                student: {
                    include: {
                        user: true,
                        section: true,
                        Parents: { include: { parent: true } }
                    }
                },
                section: true
            },
            orderBy: { marks: 'desc' }
        });

        // TEACHER PERMISSION CHECK: Can only see results if assigned to this subject/section
        if (req.user.role === 'teacher') {
            const assignment = await prisma.subjectAssignment.findFirst({
                where: {
                    teacher: { userId: req.user.id },
                    subjectId: exam.subjectId,
                    OR: [
                        { sectionId: exam.sectionId }, // Match specific section if exam is section-specific
                        { sectionId: null },           // Match "All Sections" assignment
                        // Allow if exam is class-wide and teacher is assigned to ANY section in this class
                        ...(exam.sectionId === null && exam.classId ? [{ section: { classId: exam.classId } }] : [])
                    ]
                }
            });

            if (!assignment) {
                return res.status(403).json({
                    message: 'Uma haysat fasax aad ku aragto natiijada maaddadan. Waxaad arki kartaa oo kaliya maaddooyinka laguu xilsaaray.',
                    error: 'Teacher Subject Assignment Required'
                });
            }
        }

        if (grading === 'true') {
            const targetSchoolId = exam.schoolId;

            // Define student filter
            const enrollments = await prisma.enrollment.findMany({
                where: {
                    academicYearId: exam.term?.academicYearId,
                    classId: exam.classId,
                    ...(sectionId ? { sectionId } : {}),
                    schoolId: targetSchoolId,
                    status: { in: ['active', 'promoted', 'retained', 'graduated'] }
                },
                include: {
                    student: { include: { user: true } },
                    section: true
                }
            });

            const currentStudents = enrollments.map(e => ({
                ...e.student,
                section: e.section,
                sectionId: e.sectionId,
                classId: e.classId
            }));

            console.log('Results grading sheet:', {
                resultsWhere,
                foundCount: currentStudents.length,
                examId: req.params.examId
            });

            // 2. Merge with historical results not in current list
            const resultsStudentIds = results.map(r => r.studentId);
            const missingStudentIds = resultsStudentIds.filter(id => !currentStudents.some(s => s.id === id));

            const historicalStudents = missingStudentIds.length > 0
                ? await prisma.student.findMany({
                    where: { id: { in: missingStudentIds }, ...(schoolId ? { user: { schoolId } } : {}) },
                    include: {
                        user: true,
                        section: true,
                        Parents: { include: { parent: true } }
                    }
                })
                : [];

            const allStudents = [...currentStudents, ...historicalStudents].sort((a, b) =>
                (a.user?.name || '').localeCompare(b.user?.name || '')
            );

            const fullSheet = allStudents.map(student => {
                const existing = results.find(r => r.studentId === student.id);
                return {
                    studentId: student.id,
                    studentName: student.user?.name,
                    studentRegId: student.student_id,
                    sectionName: student.section?.name,
                    sectionId: student.sectionId,
                    classId: student.classId || exam.classId,
                    marks: existing ? existing.marks : '',
                    remarks: existing ? existing.remarks : '',
                    grade: existing ? existing.grade : '',
                    id: existing ? existing.id : null,
                    student: student
                };
            });
            const gradingScales = await prisma.gradingScale.findMany({
                where: { schoolId: targetSchoolId },
                orderBy: { minScore: 'desc' }
            });

            return res.json({ data: fullSheet, gradingScales });
        }
        return res.json({ data: results });
    } catch (err) {
        console.error('Results fetch error:', err);
        return res.status(500).json({ message: 'Qalad ayaa ka dhacay soo jiidista natiijada' });
    }
});

// Submit exam results (bulk) - blocked if exam is locked
router.post('/:examId/results', authenticateToken, authorizeRoles('admin', 'teacher'), async (req, res) => {
    const { results } = req.body;
    if (!results || !Array.isArray(results)) return responseHelper.error(res, 'Results array required', null, 400);
    try {
        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }
        const examWhere = { id: req.params.examId };
        if (schoolId) examWhere.schoolId = schoolId;
        const exam = await prisma.exam.findFirst({ where: examWhere });
        if (!exam) return responseHelper.error(res, 'Exam not found', null, 404);
        if (exam.status === 'locked') {
            return responseHelper.error(res, 'This exam is locked. No changes allowed.', null, 403);
        }

        // TEACHER PERMISSION CHECK: Can only submit if assigned to this subject/section
        if (req.user.role === 'teacher') {
            const assignment = await prisma.subjectAssignment.findFirst({
                where: {
                    teacher: { userId: req.user.id },
                    subjectId: exam.subjectId,
                    OR: [
                        { sectionId: exam.sectionId }, // Match specific section if exam is section-specific
                        { sectionId: null },           // Match "All Sections" assignment
                        // Allow if exam is class-wide and teacher is assigned to ANY section in this class
                        ...(exam.sectionId === null && exam.classId ? [{ section: { classId: exam.classId } }] : [])
                    ]
                }
            });

            if (!assignment) {
                return res.status(403).json({
                    message: 'Uma haysat fasax aad ku gasho dhibcaha maaddadan. Waxaad firi kartaa oo kaliya maaddooyinka laguu xilsaaray.',
                    error: 'Teacher Subject Assignment Required'
                });
            }
        }

        // Fetch school grading scales once
        const gradingScales = await prisma.gradingScale.findMany({
            where: { schoolId: exam.schoolId },
            orderBy: { minScore: 'desc' }
        });

        // Process results sequentially to avoid deadlock on upsert and provide better errors
        const savedResults = [];
        for (const r of results) {
            try {
                // 1. Identity Normalization Logic
                let resolvedStudentId = r.studentId;
                let targetStudent = null;

                const lookupCode = (r.studentCode || r.student_id || r.regId || '').toString().trim();

                // If we have a code, find all matching students and prioritize the one with a userId
                if (lookupCode) {
                    const candidates = await prisma.student.findMany({
                        where: {
                            student_id: { equals: lookupCode, mode: 'insensitive' },
                            user: { schoolId: exam.schoolId }
                        },
                        include: { user: true }
                    });

                    if (candidates.length > 0) {
                        // Prioritize the record with a userId (the one they login with)
                        targetStudent = candidates.find(c => c.userId) || candidates[0];
                        resolvedStudentId = targetStudent.id;
                    }
                }

                // 2. Fallback to UUID lookup if no code match or no code provided
                if (!targetStudent && resolvedStudentId) {
                    targetStudent = await prisma.student.findFirst({
                        where: { id: resolvedStudentId, user: { schoolId: exam.schoolId } },
                        include: { user: true }
                    });

                    // If the UUID we found is a "shadow" record, try to find a primary record for the same userId or code
                    if (targetStudent && !targetStudent.userId) {
                        const primary = await prisma.student.findFirst({
                            where: {
                                OR: [
                                    { student_id: targetStudent.student_id },
                                    { userId: { not: null } } // This is too broad, better match by student_id
                                ],
                                student_id: targetStudent.student_id,
                                userId: { not: null },
                                user: { schoolId: exam.schoolId }
                            }
                        });
                        if (primary) {
                            targetStudent = primary;
                            resolvedStudentId = primary.id;
                        }
                    }
                }

                if (!targetStudent || !resolvedStudentId) {
                    console.warn(`[Results] Student not found for code/id: ${r.studentCode || r.studentId}`);
                    continue;
                }

                const marksVal = parseFloat(r.marks);
                const finalClassId = r.classId || exam.classId;

                if (!finalClassId) {
                    throw new Error(`Fadlan u sameey Class ardayga: ${resolvedStudentId}`);
                }

                if (!isNaN(marksVal) && marksVal > exam.totalMarks) {
                    throw new Error(`Darajada (${marksVal}) way ka badantahay guud ahaan dhibcaha examka (${exam.totalMarks})`);
                }

                const res = await prisma.examResult.upsert({
                    where: { examId_studentId: { examId: req.params.examId, studentId: resolvedStudentId } },
                    update: {
                        marks: isNaN(marksVal) ? 0 : marksVal,
                        grade: r.grade || calculateGrade(marksVal, exam.totalMarks, gradingScales),
                        remarks: r.remarks || null,
                        sectionId: r.sectionId || targetStudent.sectionId || undefined
                    },
                    create: {
                        examId: req.params.examId,
                        studentId: resolvedStudentId,
                        sectionId: r.sectionId || targetStudent.sectionId || null,
                        marks: isNaN(marksVal) ? 0 : marksVal,
                        grade: r.grade || calculateGrade(marksVal, exam.totalMarks, gradingScales),
                        remarks: r.remarks || null
                    }
                });
                savedResults.push(res);
            } catch (itemErr) {
                console.error(`Item save error for student ${r.studentId}:`, itemErr);
                throw new Error(`Ardayga ${r.studentId} xogtiisa lama kaydin karo: ${itemErr.message}`);
            }
        }
        // Create notification for results submission
        // (In-app notification for marks entry removed to prevent spam)

        return res.json({ message: 'Natiijooyinka si guul leh ayaa loo kaydiyey', count: savedResults.length });
    } catch (err) {
        return res.status(500).json({ message: 'Error saving results' });
    }
});

// Delete exam (admin and super_admin)
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'super_admin', 'owner'), async (req, res) => {
    try {
        const where = { id: req.params.id };
        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }
        if (schoolId) where.schoolId = schoolId;

        const exam = await prisma.exam.findFirst({ where });
        if (!exam) return responseHelper.error(res, 'Exam not found or access denied', null, 404);

        // Prisma relation 'onDelete: Cascade' in ExamResult should handle result deletion,
        // but we delete manually just to be safe and explicit.
        await prisma.examResult.deleteMany({ where: { examId: req.params.id } });
        await prisma.exam.delete({ where: { id: req.params.id } });

        return res.json({ message: 'Exam deleted successfully' });
    } catch (err) {
        return res.status(500).json({ message: 'Error deleting exam' });
    }
});

// Bulk Send Exam Results via SMS (Combined Subjects per Student)
router.post('/send-bulk-sms', authenticateToken, authorizeRoles('admin', 'super_admin', 'owner'), async (req, res) => {
    try {
        const { examIds, isFinal, academicYearId } = req.body;
        if (!examIds || !Array.isArray(examIds) || examIds.length === 0) {
            return res.status(400).json({ message: 'Exam IDs are required' });
        }

        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }

        // 1. Fetch requested exams
        const exams = await prisma.exam.findMany({
            where: {
                id: { in: examIds },
                ...(schoolId ? { schoolId } : {})
            },
            include: { subject: true, class: true, term: true }
        });

        if (exams.length === 0) {
            return res.status(404).json({ message: 'No valid exams found' });
        }

        const classId = exams[0].classId;
        const className = exams[0].class?.class_name || 'N/A';
        let termName = exams[0].term?.name || 'Imtixaanka';

        // 2. Identify which exams to aggregate
        let targetExamIds = examIds;

        // If it's final, we aggregate the ENTIRE ACADEMIC YEAR for this class
        if (isFinal && academicYearId && classId) {
            const allYearExams = await prisma.exam.findMany({
                where: {
                    classId,
                    term: { academicYearId },
                    status: { in: ['published', 'locked'] },
                    ...(schoolId ? { schoolId } : {})
                }
            });
            targetExamIds = allYearExams.map(e => e.id);
            termName = `Sannadka (${termName} Final)`;
        }

        // 3. Fetch all results for these target exams
        const results = await prisma.examResult.findMany({
            where: { examId: { in: targetExamIds } },
            include: {
                exam: { include: { subject: true } },
                student: {
                    include: {
                        user: true,
                        Parents: {
                            include: { parent: true }
                        }
                    }
                }
            }
        });

        if (!results.length) {
            return res.status(400).json({ message: 'Lama helin natiijooyin la xiriira imtixaannada la calaamadeeyay.' });
        }

        const gradingScales = await prisma.gradingScale.findMany({
            where: { schoolId: exams[0].schoolId },
            orderBy: { minScore: 'desc' }
        });

        const schoolData = await prisma.school.findUnique({
            where: { id: exams[0].schoolId },
            select: { name: true, superAdminId: true, institutionType: true }
        });
        let schoolDisplayName = schoolData?.name || 'Schoolka';
        if (schoolData?.superAdminId) {
            const superAdminUser = await prisma.user.findUnique({
                where: { id: schoolData.superAdminId },
                select: { schoolName: true }
            });
            if (superAdminUser?.schoolName) schoolDisplayName = superAdminUser.schoolName;
        }
        // Prefix with institution type label removed as per request
        // const instPrefixBulk = (schoolData?.institutionType || 'school').toLowerCase() === 'machad' ? 'Machad' : 'School';
        // schoolDisplayName = `${instPrefixBulk}: ${schoolDisplayName}`;

        // 3. Group results by Student
        const studentMap = new Map();

        for (const r of results) {
            const studentId = r.studentId;
            if (!studentMap.has(studentId)) {
                const parentPhone = r.student?.Parents?.[0]?.parent?.phone;
                studentMap.set(studentId, {
                    studentName: r.student?.user?.name || "Ardayga",
                    parentPhone: parentPhone,
                    subjectTotals: {}, // Use object to sum marks by subject
                    totalMarksObtained: 0,
                    totalMaxMarks: 0
                });
            }

            const sData = studentMap.get(studentId);
            sData.totalMarksObtained += r.marks;
            sData.totalMaxMarks += (r.exam.totalMarks || 100);

            const rawSubName = r.exam.subject?.name || r.exam.name || 'Sub';
            // Abbreviate to first 4 letters with dot, or full name if shorter
            const subAbbr = rawSubName.length > 4 ? rawSubName.substring(0, 4) + '.' : rawSubName;

            if (!sData.subjectTotals[subAbbr]) {
                sData.subjectTotals[subAbbr] = 0;
            }
            sData.subjectTotals[subAbbr] += r.marks;
        }

        const trackingTypeBase = isFinal
            ? `final_results:${academicYearId}`
            : `term_results:${exams[0].termId}`;

        const existingLogs = await prisma.smsLog.findMany({
            where: {
                schoolId,
                type: { startsWith: trackingTypeBase },
                status: 'sent'
            },
            select: { studentId: true }
        });
        const alreadySentStudentIds = new Set(existingLogs.map(l => l.studentId));

        let sentCount = 0;
        let skipCount = 0;
        let alreadySentCount = 0;

        // 4. Collect SMS jobs for each student
        const smsJobs = [];
        for (const [studentId, sData] of studentMap.entries()) {
            if (alreadySentStudentIds.has(studentId)) {
                alreadySentCount++;
                continue;
            }

            if (sData.parentPhone) {
                // Combine subject totals into string "Arab. 85, Math. 90"
                const subjectsString = Object.entries(sData.subjectTotals)
                    .map(([sub, marks]) => `${sub} ${marks}`)
                    .join(', ');
                const grade = calculateGrade(sData.totalMarksObtained, sData.totalMaxMarks, gradingScales);
                const gradeString = grade && grade !== 'F' ? ` Grd:${grade}.` : '.';

                const message = `${schoolDisplayName}\nNatiijada ${termName}, Fasalka ${className}: ${sData.studentName} - ${subjectsString}. Wadarta: ${sData.totalMarksObtained}/${sData.totalMaxMarks}${gradeString} Mahadsanid.`;

                smsJobs.push({
                    phone: sData.parentPhone,
                    message: message,
                    schoolId: schoolId,
                    studentId: studentId,
                    type: isFinal ? 'final_result' : 'term_result',
                    studentName: sData.studentName
                });
                sentCount++;
            } else {
                skipCount++;
            }
        }

        // 5. Enqueue all jobs at once (background processing)
        if (smsJobs.length > 0) {
            console.log(`[SMSQueue] Bulk Send Results: Enqueueing ${smsJobs.length} jobs.`);
            enqueueBulkSMS(smsJobs);
        }

        let responseMsg = `SMS Sent successfully to ${sentCount} parents.`;
        if (alreadySentCount > 0) responseMsg += ` ${alreadySentCount} horay ayaa loo diray.`;
        if (skipCount > 0) responseMsg += ` Skipped ${skipCount} (cilad/nambar la'aan).`;

        return res.json({
            message: responseMsg,
            sent: sentCount,
            alreadySent: alreadySentCount,
            skipped: skipCount
        });

    } catch (err) {
        console.error('Bulk Send SMS Error:', err);
        return res.status(500).json({ message: 'Cillad ayaa ku timid diridda SMS-ka bulk ah' });
    }
});

// Send Exam Results via SMS (Legacy - Single Exam)
router.post('/:examId/send-sms', authenticateToken, authorizeRoles('admin', 'super_admin', 'owner'), async (req, res) => {
    try {
        const { examId } = req.params;
        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }

        const examWhere = { id: examId };
        if (schoolId) examWhere.schoolId = schoolId;
        const exam = await prisma.exam.findFirst({
            where: examWhere,
            include: { subject: true }
        });

        if (!exam) return responseHelper.error(res, 'Exam not found', null, 404);

        const examSchoolData = await prisma.school.findUnique({
            where: { id: exam.schoolId },
            select: { name: true, superAdminId: true, institutionType: true }
        });
        let examSchoolDisplayName = examSchoolData?.name || 'Schoolka';
        if (examSchoolData?.superAdminId) {
            const superAdminUser = await prisma.user.findUnique({
                where: { id: examSchoolData.superAdminId },
                select: { schoolName: true }
            });
            if (superAdminUser?.schoolName) examSchoolDisplayName = superAdminUser.schoolName;
        }
        // Prefix with institution type label removed as per request
        // const instPrefixLegacy = (examSchoolData?.institutionType || 'school').toLowerCase() === 'machad' ? 'Machad' : 'School';
        // examSchoolDisplayName = `${instPrefixLegacy}: ${examSchoolDisplayName}`;

        const results = await prisma.examResult.findMany({
            where: { examId },
            include: {
                student: {
                    include: {
                        user: true,
                        Parents: {
                            include: { parent: true }
                        }
                    }
                }
            }
        });

        if (!results.length) {
            return res.status(400).json({ message: 'No results found for this exam to send' });
        }

        let sentCount = 0;
        let skipCount = 0;

        for (const r of results) {
            const student = r.student;
            const parentRelation = student?.Parents?.[0];
            const parentPhone = parentRelation?.parent?.phone;

            if (parentPhone) {
                const studentName = student?.user?.name || "Ardaygaaga";
                const marks = r.marks;
                const total = exam.totalMarks;
                const subject = exam.subject?.name || exam.name;
                const grade = r.grade || 'N/A';

                const message = `${examSchoolDisplayName}\nNatiijada imtixaanka ${subject}: ${studentName} wuxuu ka keenay ${marks}/${total}. Grade: ${grade}. Mahadsanid.`;

                const smsResult = await sendGolisSMS(parentPhone, message);
                if (smsResult.success) sentCount++;
                else skipCount++;
            } else {
                skipCount++;
            }
        }

        return res.json({
            message: `SMS Sent successfully to ${sentCount} parents. Skipped ${skipCount} (no phone number/error).`,
            sent: sentCount,
            skipped: skipCount
        });

    } catch (err) {
        console.error('Send SMS Error:', err);
        return res.status(500).json({ message: 'Cillad ayaa ku timid diridda SMS-ka' });
    }
});

// Get aggregated results for an entire class (for mark sheets/report cards)
router.get('/class-results/:classId', authenticateToken, async (req, res) => {
    try {
        const { classId } = req.params;
        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }

        if (!schoolId) return responseHelper.error(res, 'School ID is required', null, 400);

        // Fetch grading scales once for this school
        const gradingScales = await prisma.gradingScale.findMany({
            where: { schoolId },
            orderBy: { minScore: 'desc' }
        });

        // 1. Get all students in the class/section for the specified period
        const { sectionId, academicYearId } = req.query;
        const isAllClasses = classId === 'all' || classId === 'null' || !classId;

        // Determine context year
        let targetYearId = academicYearId;
        if (!targetYearId) {
            const currentYear = await prisma.academicYear.findFirst({ where: { isCurrent: true, schoolId } });
            targetYearId = currentYear?.id;
        }

        if (!targetYearId) return res.status(400).json({ message: 'Academic Year context required.' });

        // Fetch students via Enrollment
        const enrollments = await prisma.enrollment.findMany({
            where: {
                academicYearId: targetYearId,
                ...(isAllClasses ? {} : { classId }),
                ...(sectionId ? { sectionId } : {}),
                schoolId,
                status: { in: ['active', 'promoted', 'retained', 'graduated'] }
            },
            include: {
                student: { include: { user: { select: { name: true } } } },
                section: true
            },
            orderBy: { student: { user: { name: 'asc' } } }
        });

        const targetStudents = enrollments.map(e => ({
            ...e.student,
            enrollmentId: e.id,
            section: e.section,
            classId: e.classId,
            sectionId: e.sectionId
        }));

        // 2. Get all subjects assigned to this school
        const subjects = await prisma.subject.findMany({
            where: { schoolId },
            orderBy: { name: 'asc' }
        });

        // 3. Get all exam results
        let resultsWhere = {
            exam: {
                schoolId,
                ...(isAllClasses ? {} : { classId })
            }
        };
        if (sectionId) resultsWhere.sectionId = sectionId;
        if (academicYearId) {
            resultsWhere.exam = {
                ...resultsWhere.exam,
                term: { academicYearId }
            };
        }

        if (req.user.role === 'student' || req.user.role === 'parent') {
            resultsWhere.exam.status = { in: ['published', 'locked'] };
        }

        const results = await prisma.examResult.findMany({
            where: resultsWhere,
            include: {
                exam: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        subjectId: true,
                        totalMarks: true
                    }
                }
            }
        });

        // FILTER SUBJECTS: Only show subjects that have actual exam results for this class/period
        const uniqueSubjectIdsFromResults = Array.from(new Set(results.map(r => r.exam?.subjectId).filter(Boolean)));
        const activeSubjects = subjects.filter(s => uniqueSubjectIdsFromResults.includes(s.id));

        // 4. Aggregate data per student
        const markSheet = targetStudents.map(student => {
            const studentResults = results.filter(r => r.studentId === student.id);
            const subjectsData = {};
            let classGrandTotal = 0;
            let classGrandMax = 0;

            subjects.forEach(sub => {
                const subResults = studentResults.filter(r => r.exam && r.exam.subjectId === sub.id);
                const scores = {};
                let subTotal = 0;
                let subMax = 0;

                subResults.forEach(r => {
                    if (!r.exam) return;
                    const mark = r.marks || 0;
                    scores[r.exam.type] = (scores[r.exam.type] || 0) + mark;
                    subTotal += mark;
                    subMax += (r.exam.totalMarks || 0);
                });

                subjectsData[sub.id] = {
                    name: sub.name,
                    scores,
                    total: subTotal,
                    totalMarks: subMax,
                    grade: calculateGrade(subTotal, subMax, gradingScales)
                };
                classGrandTotal += subTotal;
                classGrandMax += subMax;
            });

            return {
                studentId: student.id,
                studentName: student.user?.name,
                studentRegId: student.student_id,
                sectionName: student.section?.name,
                subjects: subjectsData,
                grandTotal: classGrandTotal,
                grandTotalMarks: classGrandMax,
                grade: calculateGrade(classGrandTotal, classGrandMax, gradingScales)
            };
        });

        return res.json({ markSheet, subjects: activeSubjects, gradingScales });
    } catch (err) {
        console.error('Class results error:', err);
        return res.status(500).json({ message: 'Error fetching class results' });
    }
});

// Get individual results for a single student
router.get('/student-results/:studentId', authenticateToken, async (req, res) => {
    try {
        const { studentId } = req.params;
        const { academicYearId } = req.query;

        // --- RESILIENT IDENTITY FINDER ---
        // Sometimes the frontend passes a userId, or an Enrollment ID, or a slightly mismatched ID.
        // We will perform an exhaustive search to find the correct student record first.
        let studentCheck = await prisma.student.findUnique({
            where: { id: studentId },
            include: { user: true }
        });

        if (!studentCheck) {
            // Try searching by userId
            studentCheck = await prisma.student.findUnique({
                where: { userId: studentId },
                include: { user: true }
            });
        }

        if (!studentCheck) {
            // Try searching by readable student_id (e.g. "9130")
            studentCheck = await prisma.student.findFirst({
                where: { student_id: studentId },
                include: { user: true }
            });
        }

        if (!studentCheck) return responseHelper.error(res, 'Student not found with provided ID: ' + studentId, null, 404);

        const finalStudentId = studentCheck.id;
        const schoolIdToUse = academicYearId ? (await prisma.academicYear.findUnique({ where: { id: academicYearId } }))?.schoolId : (studentCheck?.user?.schoolId || studentCheck?.schoolId || req.user?.schoolId);

        const schoolId = schoolIdToUse;
        if (!schoolId) return responseHelper.error(res, 'School ID is required or cannot be determined', null, 400);

        // Fetch current academic year context
        let activeYearId = academicYearId;
        if (!activeYearId) {
            // Prioritize school's global current year
            const currentYear = await prisma.academicYear.findFirst({
                where: { schoolId, isCurrent: true }
            });

            if (currentYear) {
                activeYearId = currentYear.id;
            } else {
                // Fallback to student's current enrollment year
                const enrollment = await prisma.enrollment.findFirst({
                    where: { studentId, isCurrent: true },
                    orderBy: { created_at: 'desc' }
                });
                if (enrollment) activeYearId = enrollment.academicYearId;
            }
        }

        console.log(`[DEBUG-RESULTS] StudentId: ${studentId}, SchoolId: ${schoolId}, ActiveYearId: ${activeYearId}`);

        // Fetch grading scales
        const gradingScales = await prisma.gradingScale.findMany({
            where: { schoolId },
            orderBy: { minScore: 'desc' }
        });

        // 1. Get student and their class/section details
        const student = await prisma.student.findFirst({
            where: {
                id: finalStudentId
            },
            include: {
                user: { select: { name: true } },
                clss: { select: { class_name: true } },
                section: { select: { name: true } }
            }
        });

        if (!student) return responseHelper.error(res, 'Student not found', null, 404);

        // 2. Get all subjects in the school
        const subjects = await prisma.subject.findMany({
            where: { schoolId },
            orderBy: { name: 'asc' }
        });

        // 2. Identity Normalization (Resilience)
        // Find all student records that belong to this same identity
        const isAdmin = ['admin', 'super_admin', 'owner'].includes((req.user?.role || '').toLowerCase());
        const relatedStudents = await prisma.student.findMany({
            where: {
                OR: [
                    { userId: student.userId },
                    {
                        AND: [
                            { student_id: { equals: student.student_id, mode: 'insensitive' } },
                            // If admin, we search globally across all schools to unify history
                            // If student/parent, we still restrict to the same school for security
                            isAdmin ? {} : { user: { schoolId } }
                        ]
                    },
                    // ULTIMATE NAME-BASED HEALING for Admins:
                    // If results are missing due to disparate records/ghost identities,
                    // we merge any account sharing the exact same name as a last resort.
                    isAdmin ? { user: { name: { equals: student.user?.name, mode: 'insensitive' } } } : {}
                ]
            },
            select: { id: true }
        });
        const relatedIds = relatedStudents.map(rs => rs.id);

        // 3. Get results for this student's identity - UNFILTERED for admins
        let results = await prisma.examResult.findMany({
            where: {
                studentId: { in: relatedIds },
                exam: isAdmin ? {} : {
                    schoolId,
                    ...(academicYearId ? {
                        OR: [
                            { term: { academicYearId: academicYearId } },
                            { termId: null }
                        ]
                    } : {}),
                    status: { in: ['published', 'locked'] }
                }
            },
            include: {
                exam: {
                    select: {
                        id: true, name: true, type: true, subjectId: true, totalMarks: true,
                        subject: { select: { name: true } }
                    }
                }
            }
        });

        // --- SMART FALLBACK INJECTION ---
        // If no results are found for the requested year, this could be a newly promoted student. 
        // Admin/Parent expects to see their previous/latest results instead of an empty screen ("iyadoo ay jirto").
        if (results.length === 0 && academicYearId) {
            const latestResult = await prisma.examResult.findFirst({
                where: {
                    studentId: { in: relatedIds },
                    exam: {
                        ...(!isAdmin ? { schoolId } : {}),
                        termId: { not: null },
                        ...(!isAdmin ? { status: { in: ['published', 'locked'] } } : {})
                    }
                },
                include: { exam: { include: { term: true } } },
                orderBy: { exam: { date: 'desc' } }
            });

            if (latestResult?.exam?.term?.academicYearId && latestResult.exam.term.academicYearId !== academicYearId) {
                const fallbackYearId = latestResult.exam.term.academicYearId;
                activeYearId = fallbackYearId; // switch display class context

                results = await prisma.examResult.findMany({
                    where: {
                        studentId: { in: relatedIds },
                        exam: {
                            ...(!isAdmin ? { schoolId } : {}),
                            OR: [
                                { term: { academicYearId: fallbackYearId } },
                                { termId: null }
                            ],
                            ...(!isAdmin ? { status: { in: ['published', 'locked'] } } : {})
                        }
                    },
                    include: {
                        exam: { select: { id: true, name: true, type: true, subjectId: true, totalMarks: true } }
                    }
                });
            } else if (results.length === 0) {
                // Last resort: find any results with NO term at all
                results = await prisma.examResult.findMany({
                    where: {
                        studentId: { in: relatedIds },
                        exam: {
                            ...(!isAdmin ? { schoolId } : {}),
                            termId: null,
                            ...(!isAdmin ? { status: { in: ['published', 'locked'] } } : {})
                        }
                    },
                    include: {
                        exam: { select: { id: true, name: true, type: true, subjectId: true, totalMarks: true } }
                    }
                });
            }

            // ULTIMATE ADMIN BRUTE-FORCE FALLBACK:
            // If results are STILL empty, and user is an admin, just fetch ANY exams for this student identity globally
            if (results.length === 0 && isAdmin) {
                results = await prisma.examResult.findMany({
                    where: { studentId: { in: relatedIds } },
                    include: {
                        exam: { select: { id: true, name: true, type: true, subjectId: true, totalMarks: true } }
                    }
                });
            }
        }
        // --- END SMART FALLBACK ---

        // Recover historical class info
        let displayClass = student.clss?.class_name;
        let displaySection = student.section?.name;

        if (activeYearId) {
            // Try explicit enrollment
            const enrollmentForDisplay = await prisma.enrollment.findFirst({
                where: { studentId: { in: relatedIds }, academicYearId: activeYearId },
                include: { clss: true, section: true },
                orderBy: { created_at: 'desc' }
            });
            if (enrollmentForDisplay && enrollmentForDisplay.clss) {
                displayClass = enrollmentForDisplay.clss.class_name;
                displaySection = enrollmentForDisplay.section?.name;
            } else {
                // Try historical archive
                const history = await prisma.studentHistory.findFirst({
                    where: { studentId: { in: relatedIds }, academicYearId: activeYearId },
                    include: { clss: true, section: true }
                });
                if (history && history.clss) {
                    displayClass = history.clss.class_name;
                    displaySection = history.section?.name;
                }
            }
        }

        console.log(`[DEBUG-RESULTS] Results found: ${results.length}, RelatedIds: ${relatedIds.join(',')}`);

        // Resilient Subject Mapping: Instead of using the 'active' subjects list, 
        // we use the actual subjects represented in the results to ensure NO results are hidden.
        const subjectsData = [];
        const subjectGroups = {};

        // Group results by subject
        results.forEach(r => {
            const sId = r.exam?.subjectId;
            if (!sId) return;
            if (!subjectGroups[sId]) subjectGroups[sId] = [];
            subjectGroups[sId].push(r);
        });

        // Map each subject found in the results
        for (const sId in subjectGroups) {
            const subResults = subjectGroups[sId];
            const examRef = subResults[0].exam;

            // Try to find subject name from the global subjects list or the exam result metadata
            const subName = subjects.find(s => s.id === sId)?.name || examRef?.subject?.name || "Unknown Subject";

            const scores = {};
            let subTotal = 0;
            let subMax = 0;

            subResults.forEach(r => {
                const mark = r.marks || 0;
                const type = r.exam?.type || "Exam";
                scores[type] = (scores[type] || 0) + mark;
                subTotal += mark;
                subMax += (r.exam?.totalMarks || 100);
            });

            subjectsData.push({
                id: sId,
                name: subName,
                scores,
                total: subTotal,
                totalMarks: subMax,
                grade: calculateGrade(subTotal, subMax, gradingScales)
            });
        }

        const grandTotal = subjectsData.reduce((sum, s) => sum + s.total, 0);
        const grandMax = subjectsData.reduce((sum, s) => sum + s.totalMarks, 0);

        return responseHelper.success(res, {
            student: {
                id: student.id,
                name: student.user?.name,
                regId: student.student_id,
                className: displayClass,
                sectionName: displaySection
            },
            subjects: subjectsData,
            grandTotal,
            grandMax,
            grade: calculateGrade(grandTotal, grandMax, gradingScales),
            gradingScales
        });
    } catch (err) {
        console.error('Student results error:', err);
        return responseHelper.error(res, 'Qalad ayaa dhacay keenista natiijada ardayga gaarka ah', err);
    }
});

// Update individual exam (date, description/time)
router.patch('/:id', authenticateToken, authorizeRoles('admin', 'teacher', 'owner'), async (req, res) => {
    const { date, endTime, description, totalMarks, name } = req.body;
    try {
        const where = { id: req.params.id };
        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }
        if (schoolId) where.schoolId = schoolId;

        const exam = await prisma.exam.findFirst({ where });
        if (!exam) return res.status(404).json({ message: 'Exam not found' });

        if (req.user.role === 'teacher' && exam.status === 'locked') {
            return res.status(403).json({ message: 'Imtixaankan waa la xiray, waxba kama beddeli kartid.' });
        }

        const data = {};
        if (date !== undefined) data.date = date ? new Date(date) : null;
        if (endTime !== undefined) data.endTime = endTime ? new Date(endTime) : null;
        if (description !== undefined) data.description = description;
        if (totalMarks !== undefined) data.totalMarks = Number(totalMarks);
        if (name !== undefined) data.name = name;

        const updated = await prisma.exam.update({
            where: { id: req.params.id },
            data
        });

        return res.json(updated);
    } catch (err) {
        console.error('Update Exam Error:', err);
        return res.status(500).json({ message: 'Error updating exam' });
    }
});

// GET SMS Status for bulk results
router.get('/bulk-sms-status', authenticateToken, async (req, res) => {
    try {
        const { termId, academicYearId, isFinal } = req.query;
        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }

        if (!schoolId) return res.status(400).json({ message: 'School ID required' });

        const trackingTypePrefix = isFinal === 'true'
            ? `final_results:${academicYearId}`
            : `term_results:${termId}`;

        // Get count of successful logs for each class in this term/year
        const logs = await prisma.smsLog.findMany({
            where: {
                schoolId,
                type: { startsWith: trackingTypePrefix },
                status: 'sent'
            },
            select: { type: true, studentId: true }
        });

        // Get total active students per class in the school
        const classes = await prisma.class.findMany({
            where: { schoolId },
            include: {
                _count: {
                    select: { Students: { where: { status: { in: ['active', 'promoted', 'retained'] } } } }
                }
            }
        });

        const statusMap = {};
        classes.forEach(c => {
            const classTrackingType = `${trackingTypePrefix}:${c.id}`;
            const sentStudents = logs.filter(l => l.type === classTrackingType).map(l => l.studentId);
            const uniqueSentCount = new Set(sentStudents).size;

            statusMap[c.id] = {
                sentCount: uniqueSentCount,
                totalCount: c._count.Students
            };
        });

        return res.json(statusMap);
    } catch (err) {
        console.error('Bulk SMS Status Error:', err);
        return res.status(500).json({ message: 'Error fetching SMS status' });
    }
});

// Download Excel Template for Marks
router.get('/export-template', authenticateToken, async (req, res) => {
    try {
        const { classId, sectionId, subjectId, examId, session } = req.query;
        let schoolId = req.user.schoolId;
        
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }
        
        // Ensure class, section, subject are provided
        if (!classId || !subjectId || !examId) {
            return res.status(400).json({ message: 'classId, subjectId, and examId are required' });
        }

        const exam = await prisma.exam.findUnique({ where: { id: examId } });
        if (!exam) return res.status(404).json({ message: 'Exam not found' });

        const enrollments = await prisma.enrollment.findMany({
            where: {
                classId,
                ...(sectionId ? { sectionId } : {}),
                schoolId,
                isCurrent: true
            },
            include: {
                student: { include: { user: true } }
            }
        });

        // Get existing marks if any
        const existingResults = await prisma.examResult.findMany({
            where: {
                examId,
                studentId: { in: enrollments.map(e => e.studentId) }
            }
        });
        const marksMap = new Map(existingResults.map(r => [r.studentId, r.marks]));

        // Sort enrollments by student ID (numerically)
        enrollments.sort((a, b) => {
            const idA = a.student?.student_id || a.studentId || '';
            const idB = b.student?.student_id || b.studentId || '';
            return String(idA).localeCompare(String(idB), undefined, { numeric: true, sensitivity: 'base' });
        });

        // Generate Excel data
        const data = enrollments.map(e => ({
            'Student ID': e.student.student_id || e.studentId,
            'Student Name': e.student.user.name,
            'Marks': marksMap.has(e.studentId) ? marksMap.get(e.studentId) : ''
        }));

        const ws = xlsx.utils.json_to_sheet(data);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, "Marks");

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', 'attachment; filename="marks_template.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        console.error('Export Template Error:', err);
        res.status(500).json({ message: 'Error exporting template' });
    }
});

// Import Marks from Excel
router.post('/import-marks', authenticateToken, authorizeRoles('admin', 'teacher', 'accountant'), upload.single('file'), async (req, res) => {
    try {
        const { examId } = req.body;
        if (!req.file || !examId) {
            return res.status(400).json({ message: 'Faylka Excel iyo examId waa qasab.' });
        }

        const exam = await prisma.exam.findUnique({ where: { id: examId } });
        if (!exam) {
            return res.status(404).json({ message: 'Imtixaanka lama helin.' });
        }

        const gradingScales = await prisma.gradingScale.findMany({
            where: { schoolId: exam.schoolId },
            orderBy: { minScore: 'desc' }
        });

        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(ws);

        if (!data || data.length === 0) {
            return res.status(400).json({ message: 'Faylka Excel waa faaruq.' });
        }

        let successCount = 0;
        let errors = [];

        for (const row of data) {
            const studentId = row['Student ID'];
            const marksStr = row['Marks'];
            
            if (marksStr === undefined || marksStr === null || marksStr === '') continue; // Skip empty
            
            const marksVal = parseFloat(marksStr);

            if (!studentId) {
                errors.push(`Row without student ID skipped.`);
                continue;
            }

            if (isNaN(marksVal)) {
                errors.push(`Ardayga ${studentId} dhibcihiisu sax maaha.`);
                continue;
            }

            if (marksVal > exam.totalMarks) {
                errors.push(`Ardayga ${studentId} dhibcihiisu way ka badan yihiin (${marksVal} > ${exam.totalMarks}).`);
                continue;
            }

            try {
                // Determine target student based on UUID or Code
                let targetStudent = await prisma.student.findFirst({
                    where: { 
                        OR: [
                            { id: studentId.toString() },
                            { student_id: studentId.toString() }
                        ],
                        user: { schoolId: exam.schoolId }
                    },
                    include: { user: true }
                });

                if (!targetStudent) {
                    errors.push(`Ardayga ID-giisu yahay ${studentId} lama helin.`);
                    continue;
                }

                await prisma.examResult.upsert({
                    where: { examId_studentId: { examId, studentId: targetStudent.id } },
                    update: {
                        marks: marksVal,
                        grade: calculateGrade(marksVal, exam.totalMarks, gradingScales),
                        sectionId: targetStudent.sectionId || undefined
                    },
                    create: {
                        examId,
                        studentId: targetStudent.id,
                        sectionId: targetStudent.sectionId || null,
                        marks: marksVal,
                        grade: calculateGrade(marksVal, exam.totalMarks, gradingScales)
                    }
                });
                successCount++;
            } catch (err) {
                console.error(`Import Error for ${studentId}:`, err);
                errors.push(`Cillad ayaa ka dhacday keydinta ardayga ${studentId}.`);
            }
        }

        res.json({ 
            message: `${successCount} arday buundooyinkooda si sax ah ayaa loo keydiyey.`, 
            errors: errors.length > 0 ? errors : undefined 
        });

    } catch (err) {
        console.error('Import Marks Error:', err);
        res.status(500).json({ message: 'Cillad ayaa dhacday markii Excel la akhrinayey.' });
    }
});

module.exports = router;
