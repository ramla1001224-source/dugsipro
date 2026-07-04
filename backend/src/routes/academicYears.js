const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles, requireSchoolAccess } = require('../middleware/auth');
const responseHelper = require('../utils/responseHelper');

// Get academic years
router.get('/', authenticateToken, requireSchoolAccess(true), async (req, res) => {
    try {
        let schoolId = req.query.schoolId || req.user.schoolId;

        let where = schoolId ? { schoolId } : { schoolId: 'NONE_AUTHORIZED' };

        // SuperAdmin/Owner special case: Get global year context if no schoolId specified
        if (!schoolId && ['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
            const allYears = await prisma.academicYear.findMany({
                orderBy: [
                    { isCurrent: 'desc' },
                    { startDate: 'desc' }
                ]
            });
            // UNIQUE BY NAME — returns unique year spans across all schools
            const uniqueYears = [];
            const seen = new Set();
            for (const y of allYears) {
                if (!seen.has(y.name)) {
                    uniqueYears.push(y);
                    seen.add(y.name);
                }
            }
            return res.json(uniqueYears);
        }

        if (req.query.onlyCurrent === 'true') {
            where.isCurrent = true;
        }

        const years = await prisma.academicYear.findMany({
            where,
            include: { 
                Terms: { orderBy: { startDate: 'asc' } },
                _count: { select: { Enrollments: true } }
            },
            orderBy: [
                { isCurrent: 'desc' },
                { startDate: 'desc' }
            ]
        });
        return res.json(years);
    } catch (err) { return res.status(500).json({ message: err.message }); }
});

// Create academic year
router.post('/', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const { name, startDate, endDate, isCurrent, schoolId: bodySchoolId } = req.body;
    if (!name || !startDate || !endDate) return res.status(400).json({ message: 'All fields required' });
    
    let schoolId = req.user.schoolId || bodySchoolId || req.query.schoolId;
    
    try {
        const where = {};
        if (schoolId) where.schoolId = schoolId;

        // Hubi haddii uu jiro sanad hadda socda (isCurrent: true)
        const existingCurrent = await prisma.academicYear.findFirst({
            where: { ...where, isCurrent: true }
        });

        // Haddii uusan jirin sanad socda, kan cusub si automatic ah uga dhig mid socda
        let finalIsCurrent = isCurrent;
        if (!existingCurrent) {
            finalIsCurrent = true;
        }

        if (finalIsCurrent) {
            await prisma.academicYear.updateMany({ where, data: { isCurrent: false } });
        }

        const year = await prisma.academicYear.create({
            data: { name, startDate: new Date(startDate), endDate: new Date(endDate), isCurrent: finalIsCurrent || false, schoolId }
        });
        return res.json({ message: 'Academic year created', data: year });
    } catch (err) { return res.status(500).json({ message: err.message }); }
});

// Update academic year
router.put('/:id', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const { id } = req.params;
    const { name, startDate, endDate } = req.body;
    const schoolId = req.user.schoolId;

    if (!name || !startDate || !endDate) return res.status(400).json({ message: 'All fields required' });

    try {
        const yearWhere = { id };
        if (schoolId) yearWhere.schoolId = schoolId;

        const year = await prisma.academicYear.findFirst({ where: yearWhere });
        if (!year) return res.status(404).json({ message: 'Academic year not found' });

        const updatedYear = await prisma.academicYear.update({
            where: { id },
            data: { name, startDate: new Date(startDate), endDate: new Date(endDate) }
        });

        return res.json({ message: 'Academic year updated', data: updatedYear });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
});

// Create term
router.post('/terms', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const { name, startDate, endDate, academicYearId } = req.body;
    if (!name || !startDate || !endDate || !academicYearId) return res.status(400).json({ message: 'All fields required' });
    const schoolId = req.user.schoolId;
    try {
        // Verify ownership of academicYear
        const yearWhere = { id: academicYearId };
        if (schoolId) yearWhere.schoolId = schoolId;
        const year = await prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId: schoolId } }); // simplified check
        if (!year && schoolId) return responseHelper.error(res, 'Academic year not found in your school', null, 403);

        const term = await prisma.term.create({
            data: { name, startDate: new Date(startDate), endDate: new Date(endDate), academicYearId }
        });
        return res.json({ message: 'Term created', data: term });
    } catch (err) { return res.status(500).json({ message: err.message }); }
});

// Set academic year as current (DISABLED: Use Promotion workflow instead)
router.patch('/:id/set-current', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    return res.status(400).json({ 
        message: 'Lama oggola in sanadka si gacan ah (manual) loo badalo. Fadlan isticmaal qaybta "Promote Students" si aad sanad cusub u bilowdo.' 
    });
});

// Delete academic year
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const schoolId = req.user.schoolId;
    try {
        const year = await prisma.academicYear.findFirst({ where: { id: req.params.id, schoolId } });
        if (!year) return res.status(404).json({ message: 'Academic year not found' });
        await prisma.term.deleteMany({ where: { academicYearId: req.params.id } });
        await prisma.academicYear.delete({ where: { id: req.params.id } });
        return res.json({ message: 'Academic year deleted' });
    } catch (err) { return res.status(500).json({ message: err.message }); }
});

// Delete term
router.delete('/terms/:id', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const schoolId = req.user.schoolId;
    try {
        const term = await prisma.term.findFirst({
            where: { id: req.params.id },
            include: { academicYear: true }
        });
        if (!term) return res.status(404).json({ message: 'Term not found' });
        if (term.academicYear?.schoolId !== schoolId && schoolId) return res.status(403).json({ message: 'Access denied' });
        await prisma.term.delete({ where: { id: req.params.id } });
        return res.json({ message: 'Term deleted' });
    } catch (err) { return res.status(500).json({ message: err.message }); }
});

// Year-end summary for a specific academic year
router.get('/:id/year-end-summary', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const schoolId = req.user.schoolId;
    try {
        const year = await prisma.academicYear.findFirst({
            where: { id: req.params.id, schoolId },
            include: { Terms: true }
        });
        if (!year) return res.status(404).json({ message: 'Academic year not found' });

        const termIds = year.Terms.map(t => t.id);

        const exams = await prisma.exam.findMany({
            where: { schoolId, termId: { in: termIds } },
            include: { _count: { select: { Results: true } } }
        });

        const results = await prisma.examResult.findMany({
            where: { exam: { schoolId, termId: { in: termIds } } },
            include: {
                student: { include: { user: { select: { name: true } } } },
                exam: { select: { totalMarks: true, subjectId: true } }
            }
        });

        const studentMap = {};
        results.forEach(r => {
            if (!studentMap[r.studentId]) {
                studentMap[r.studentId] = {
                    id: r.studentId,
                    name: r.student?.user?.name || 'Unknown',
                    totalMarks: 0,
                    maxMarks: 0,
                    count: 0
                };
            }
            studentMap[r.studentId].totalMarks += r.marks || 0;
            studentMap[r.studentId].maxMarks += r.exam?.totalMarks || 100;
            studentMap[r.studentId].count += 1;
        });

        const students = Object.values(studentMap).map(s => ({
            ...s,
            percentage: s.maxMarks > 0 ? Math.round((s.totalMarks / s.maxMarks) * 100) : 0
        })).sort((a, b) => b.percentage - a.percentage);

        const totalStudents = await prisma.student.count({ where: { status: 'active', ...(schoolId ? { user: { schoolId } } : {}) } });
        const totalExams = exams.length;
        const totalResults = results.length;
        const passCount = students.filter(s => s.percentage >= 50).length;

        return res.json({
            year,
            stats: { totalStudents, totalExams, totalResults, passCount, failCount: students.length - passCount },
            topStudents: students.slice(0, 10),
            allStudents: students
        });
    } catch (err) { return res.status(500).json({ message: err.message }); }
});

// --- Smart Promotion Preview ---
router.post('/:id/promote-preview', authenticateToken, authorizeRoles('admin', 'owner'), requireSchoolAccess(true), async (req, res) => {
    const { classMappings, targetYearId } = req.body;
    const sourceYear = await prisma.academicYear.findUnique({ where: { id: req.params.id } });
    if (!sourceYear) return res.status(404).json({ message: 'Source year not found' });
    
    if (!sourceYear.isCurrent) {
        return res.status(400).json({ message: 'Sanadkan mar hore ayaa la xidhay (Already Finished/Closed). Ma oggola nidaamku inaad mar kale dallacsiin ka samayso sanad dhamaaday.' });
    }

    const schoolId = sourceYear.schoolId;

    try {
        const sourceYearWithTerms = await prisma.academicYear.findFirst({ 
            where: { id: req.params.id }, 
            include: { Terms: true } 
        });
        if (!sourceYearWithTerms) return res.status(404).json({ message: 'Source year not found' });
        
        const termIds = sourceYearWithTerms.Terms.map(t => t.id);

        let previewStudents = [];

        for (const mapping of classMappings) {
            if (!mapping.fromClassId) continue;
            
            if (mapping.targetSchoolId && mapping.targetSchoolId !== schoolId) {
                 const isSuperAdminOrOwner = ['super_admin', 'owner'].includes(req.user.role);
                 if (!isSuperAdminOrOwner) {
                     const [reqSchool, ownSchool] = await Promise.all([
                         prisma.school.findUnique({ where: { id: mapping.targetSchoolId }, select: { superAdminId: true } }),
                         prisma.school.findUnique({ where: { id: schoolId }, select: { superAdminId: true } })
                     ]);
                     if (!reqSchool || !ownSchool || reqSchool.superAdminId !== ownSchool.superAdminId) continue;
                 }
            }

            const allEnrollments = await prisma.enrollment.findMany({
                where: { 
                    OR: [
                        { academicYearId: sourceYear.id },
                        { schoolId: sourceYear.schoolId, isCurrent: true }
                    ],
                    classId: mapping.fromClassId, 
                    status: { in: ['active', 'promoted', 'retained'] }, 
                    schoolId: sourceYear.schoolId 
                },
                include: { student: { include: { user: { select: { name: true } } } }, clss: true, section: true }
            });

            // Avoid duplicates: prioritize enrollment from sourceYear.id
            const enrollmentMap = new Map();
            for (const enroll of allEnrollments) {
                const existing = enrollmentMap.get(enroll.studentId);
                if (!existing || enroll.academicYearId === sourceYear.id) {
                    enrollmentMap.set(enroll.studentId, enroll);
                }
            }
            const enrollments = Array.from(enrollmentMap.values());
            
            if (enrollments.length === 0) continue;
            
            const studentIds = enrollments.map(e => e.studentId);
            
            const results = await prisma.examResult.findMany({
                where: {
                    studentId: { in: studentIds },
                    exam: { schoolId: sourceYear.schoolId, termId: { in: termIds } }
                },
                include: { exam: { select: { totalMarks: true } } }
            });
            
            const studentMarksMap = {};
            studentIds.forEach(id => { studentMarksMap[id] = { total: 0, max: 0 }; });
            
            results.forEach(r => {
                studentMarksMap[r.studentId].total += (r.marks || 0);
                studentMarksMap[r.studentId].max += (r.exam?.totalMarks || 100);
            });
            
            for (const enroll of enrollments) {
                const markInfo = studentMarksMap[enroll.studentId];
                const percentage = markInfo.max > 0 ? Math.round((markInfo.total / markInfo.max) * 100) : 0;
                
                const suggestedAction = (percentage >= 50) ? 'promote' : 'retain';
                let targetClassId = null;
                
                if (suggestedAction === 'promote') {
                    if (mapping.toClassId === 'graduate') targetClassId = 'graduate';
                    else targetClassId = mapping.toClassId; 
                } else if (suggestedAction === 'retain') {
                    targetClassId = enroll.classId; 
                }

                previewStudents.push({
                    enrollmentId: enroll.id,
                    studentId: enroll.studentId,
                    studentName: enroll.student.user?.name || 'Unknown',
                    student_id: enroll.student.student_id,
                    currentClassId: enroll.classId,
                    currentClassName: enroll.clss?.class_name,
                    currentSectionName: enroll.section?.name || '',
                    percentage,
                    suggestedAction,
                    targetClassId,
                    targetSectionId: (suggestedAction === 'promote') ? mapping.toSectionId : undefined,
                    targetSchoolId: (suggestedAction === 'promote') ? (mapping.targetSchoolId || undefined) : undefined
                });
            }
        }
        
        return res.json({ preview: previewStudents });
    } catch (err) {
        console.error('[PROMOTE PREVIEW ERROR]:', err);
        return res.status(500).json({ message: err.message });
    }
});

// --- Smart Promotion Publish ---
router.post('/:id/promote-publish', authenticateToken, authorizeRoles('admin', 'owner'), requireSchoolAccess(true), async (req, res) => {
    const { targetYearId, studentDecisions, targetSchoolId: globalTargetSchoolId } = req.body; 
    const sourceYearId = req.params.id;
    
    // 1. Initial Validations
    const sourceYear = await prisma.academicYear.findUnique({ where: { id: sourceYearId } });
    if (!sourceYear) return res.status(404).json({ message: 'Source academic year not found' });
    if (!sourceYear.isCurrent) {
        return res.status(400).json({ message: 'Sanadkan mar hore ayaa la xidhay (Closed). Ma dallacsiin kartid arday sanad dhammaaday.' });
    }
    if (!targetYearId || !studentDecisions || !Array.isArray(studentDecisions)) {
        return res.status(400).json({ message: 'targetYearId and studentDecisions are required' });
    }
    if (targetYearId === sourceYearId) {
        return res.status(400).json({ message: 'Lama oggola in ardayda lagu dallacsiiyo isla sanadkii ay markaas joogeen.' });
    }

    // Check if target year is older than source year (don't block if it has enrollments - that's expected for multi-school)
    const targetYearObj = await prisma.academicYear.findUnique({ 
        where: { id: targetYearId }
    });
    if (targetYearObj) {
        if (new Date(targetYearObj.startDate) <= new Date(sourceYear.startDate)) {
            return res.status(400).json({ message: `Sanadka ${targetYearObj.name} ma ahan sanad mustaqbal ah. Ma dallacsiin kartid arday sanad dugsiyeed hore.` });
        }
    }

    const schoolId = sourceYear.schoolId;
    let totalProcessed = 0;
    const targetYearCache = new Map();
    const classCache = new Map();
    const sectionCache = new Map();

    try {
        // PRE-FETCH ALL DATA BEFORE THE LOOP (eliminates sequential DB calls per student)
        const enrollmentIds = studentDecisions.map(d => d.enrollmentId);
        const [allOldEnrolls, allClasses, allSections, allFutureYears] = await Promise.all([
            prisma.enrollment.findMany({
                where: { id: { in: enrollmentIds }, schoolId },
                include: { section: true, student: { include: { user: true } } }
            }),
            prisma.class.findMany(),
            prisma.section.findMany({ where: { schoolId } }),
            prisma.academicYear.findMany({ 
                where: { id: { not: sourceYearId } } 
            })
        ]);

        const oldEnrollMap = new Map(allOldEnrolls.map(e => [e.id, e]));
        const classesById = new Map(allClasses.map(c => [c.id, c]));
        allSections.forEach(s => sectionCache.set(`${s.classId}_${s.name.toLowerCase()}`, s.id));

        // Pre-resolve target year per school using fetched data (no more DB calls in loop)
        const refYear = allFutureYears.find(y => y.id === targetYearId);
        // Pass 1: exact ID match
        for (const yr of allFutureYears) {
            if (yr.id === targetYearId && !targetYearCache.has(yr.schoolId)) {
                targetYearCache.set(yr.schoolId, yr);
            }
        }
        // Pass 2: name match for other school branches
        if (refYear) {
            for (const yr of allFutureYears) {
                if (!targetYearCache.has(yr.schoolId) && yr.name === refYear.name) {
                    targetYearCache.set(yr.schoolId, yr);
                }
            }
        }
        // Pass 3: fallback - earliest future year per school
        for (const yr of allFutureYears) {
            if (!targetYearCache.has(yr.schoolId)) {
                targetYearCache.set(yr.schoolId, yr);
            }
        }

        let studentsProcessed = 0;
        const newEnrollmentsData = [];
        const studentUpdatesByClassSection = {}; // key: 'classId|sectionId|className|schoolId', value: [studentIds]
        const promoteIds = [];
        const retainIds = [];
        const gradIds = [];
        const gradStudentIds = [];
        const allStudentIds = [];

        for (const decision of studentDecisions) {
            const { enrollmentId, studentId, action, targetClassId, targetSectionId: explicitSectionId, targetSchoolId: dTargetSchoolId } = decision;
            allStudentIds.push(studentId);
            
            // A. Determine Target School with Auto-Detection
            let finalTargetSchoolId = dTargetSchoolId || globalTargetSchoolId || schoolId;
            if (action === 'promote' && targetClassId && targetClassId !== 'graduate') {
                const targetClassRecord = classesById.get(targetClassId);
                if (targetClassRecord) finalTargetSchoolId = targetClassRecord.schoolId;
            } else if (action === 'retain') {
                finalTargetSchoolId = dTargetSchoolId || schoolId;
            }
            const effectiveTargetSchoolId = finalTargetSchoolId;
            const isCrossSchool = effectiveTargetSchoolId !== schoolId;

            // B. Resolve Target Academic Year
            const targetYear = targetYearCache.get(effectiveTargetSchoolId);
            if (!targetYear) {
                return res.status(400).json({ message: `Ma helin sanad ku habboon school-ka ${effectiveTargetSchoolId}. Fadlan marka hore samee sanadka xiga.` });
            }

            // C. Load Old Enrollment Data
            const oldEnroll = oldEnrollMap.get(enrollmentId);
            if (!oldEnroll || oldEnroll.studentId !== studentId) continue;

            // D. Handle Graduation
            if (action === 'graduate' || targetClassId === 'graduate') {
                gradIds.push(enrollmentId);
                gradStudentIds.push(studentId);
                studentsProcessed++;
                continue;
            }

            // E. Resolve Target Class & Section
            let resolvedTargetClassId = targetClassId;
            let resolvedTargetSectionId = explicitSectionId || null;

            if (action === 'retain' && !isCrossSchool) {
                resolvedTargetClassId = oldEnroll.classId;
                resolvedTargetSectionId = oldEnroll.sectionId;
            } else if (isCrossSchool || (action === 'promote' && targetClassId === oldEnroll.classId)) {
                if (!classCache.has(`${effectiveTargetSchoolId}_${oldEnroll.classId}`)) {
                    const sourceClass = classesById.get(oldEnroll.classId);
                    if (sourceClass) {
                        const tClass = await prisma.class.findFirst({ 
                            where: { schoolId: effectiveTargetSchoolId, class_name: { equals: sourceClass.class_name, mode: 'insensitive' } } 
                        });
                        classCache.set(`${effectiveTargetSchoolId}_${oldEnroll.classId}`, tClass?.id || targetClassId);
                    }
                }
                if (action === 'retain' || isCrossSchool) {
                    resolvedTargetClassId = classCache.get(`${effectiveTargetSchoolId}_${oldEnroll.classId}`);
                }
            }

            // F. Resolve/Create Section
            if (!resolvedTargetSectionId && resolvedTargetClassId && resolvedTargetClassId !== 'graduate') {
                const secName = (oldEnroll.section?.name || 'A').trim();
                const cacheKey = `${resolvedTargetClassId}_${secName.toLowerCase()}`;
                if (!sectionCache.has(cacheKey)) {
                    const existingSec = await prisma.section.findFirst({ 
                        where: { classId: resolvedTargetClassId, name: { equals: secName, mode: 'insensitive' }, schoolId: effectiveTargetSchoolId } 
                    });
                    if (existingSec) {
                        sectionCache.set(cacheKey, existingSec.id);
                    } else {
                        const newSec = await prisma.section.create({
                            data: { name: secName, classId: resolvedTargetClassId, schoolId: effectiveTargetSchoolId, shift: oldEnroll.section?.shift || 'morning' }
                        });
                        sectionCache.set(cacheKey, newSec.id);
                    }
                }
                resolvedTargetSectionId = sectionCache.get(cacheKey);
            }

            // Group Student Updates
            const tClassRecordName = classesById.get(resolvedTargetClassId)?.class_name || '';
            const groupKey = `${resolvedTargetClassId}|${resolvedTargetSectionId}|${tClassRecordName}|${effectiveTargetSchoolId}`;
            if (!studentUpdatesByClassSection[groupKey]) studentUpdatesByClassSection[groupKey] = [];
            studentUpdatesByClassSection[groupKey].push(studentId);

            // Action lists
            if (action === 'promote') promoteIds.push(enrollmentId);
            else if (action === 'retain') retainIds.push(enrollmentId);

            // New Enrollments
            newEnrollmentsData.push({
                studentId: studentId,
                academicYearId: targetYear.id,
                classId: resolvedTargetClassId,
                sectionId: resolvedTargetSectionId,
                schoolId: effectiveTargetSchoolId,
                balance: oldEnroll.balance || 0,
                isCurrent: true,
                status: 'active'
            });

            studentsProcessed++;
        }

        // ===================== BULK EXECUTION ===================== //
        // 1. Mark ALL previous enrollments of these students as NOT current
        if (allStudentIds.length > 0) {
            await prisma.enrollment.updateMany({
                where: { studentId: { in: allStudentIds }, isCurrent: true },
                data: { isCurrent: false }
            });
        }

        // 2. Mark specific source enrollments as processed
        if (promoteIds.length > 0) await prisma.enrollment.updateMany({ where: { id: { in: promoteIds } }, data: { status: 'promoted' } });
        if (retainIds.length > 0) await prisma.enrollment.updateMany({ where: { id: { in: retainIds } }, data: { status: 'retained' } });
        if (gradIds.length > 0) await prisma.enrollment.updateMany({ where: { id: { in: gradIds } }, data: { status: 'graduated' } });

        // 3. Update graduated students
        if (gradStudentIds.length > 0) {
            await prisma.student.updateMany({ where: { id: { in: gradStudentIds } }, data: { status: 'graduated', classId: null, sectionId: null } });
        }

        // 4. Update active students by groups
        for (const [key, stdIds] of Object.entries(studentUpdatesByClassSection)) {
            if (stdIds.length === 0) continue;
            const [cId, sId, cName] = key.split('|');
            await prisma.student.updateMany({
                where: { id: { in: stdIds } },
                data: { classId: cId, sectionId: sId, class: cName, status: 'active' }
            });
        }

        // 5. Create new enrollments in bulk
        if (newEnrollmentsData.length > 0) {
            try {
                await prisma.enrollment.createMany({
                    data: newEnrollmentsData,
                    skipDuplicates: true // Safely ignores if student is already promoted (e.g. retry after partial failure)
                });
            } catch (e) {
                console.warn("createMany failed, falling back to sequential upserts", e);
                const chunkSize = 250;
                for (let i = 0; i < newEnrollmentsData.length; i += chunkSize) {
                    const chunk = newEnrollmentsData.slice(i, i + chunkSize);
                    await prisma.$transaction(
                        chunk.map(enroll => prisma.enrollment.upsert({
                            where: { studentId_academicYearId: { studentId: enroll.studentId, academicYearId: enroll.academicYearId } },
                            update: { classId: enroll.classId, sectionId: enroll.sectionId, isCurrent: true, status: 'active' },
                            create: enroll
                        }))
                    );
                }
            }
        }

        totalProcessed = studentsProcessed;

        // 1. Mark source year as NOT current
        await prisma.academicYear.update({ where: { id: sourceYearId }, data: { isCurrent: false } });
        
        // 2. Determine which year to ACTIVATE for the source school
        let yearToActivate = targetYearCache.get(schoolId);
        
        if (!yearToActivate) {
            yearToActivate = await prisma.academicYear.findFirst({
                where: { schoolId, startDate: { gte: sourceYear.startDate }, id: { not: sourceYearId } },
                orderBy: { startDate: 'asc' }
            });
            
            if (!yearToActivate) {
                const refYear = await prisma.academicYear.findUnique({ where: { id: targetYearId } });
                if (refYear) {
                    yearToActivate = await prisma.academicYear.findFirst({ 
                        where: { name: refYear.name, schoolId, id: { not: sourceYearId } } 
                    });
                }
            }
        }

        // 3. Activate the next year
        if (yearToActivate) {
            await prisma.academicYear.updateMany({ where: { schoolId, id: { not: yearToActivate.id } }, data: { isCurrent: false } });
            await prisma.academicYear.update({ where: { id: yearToActivate.id }, data: { isCurrent: true } });

            // 4. CRITICAL CLEANUP: Mark ALL enrollments in this school as NOT current EXCEPT the new year
            await prisma.enrollment.updateMany({ 
                where: { schoolId, isCurrent: true, academicYearId: { not: yearToActivate.id } }, 
                data: { isCurrent: false } 
            });
        }

        // 5. AUTO-DELETE: Remove attendance, SMS logs and announcements for the FINISHED year
        if (schoolId && sourceYear.startDate && sourceYear.endDate) {
            try {
                const pDateRange = { gte: new Date(sourceYear.startDate), lte: new Date(sourceYear.endDate) };

                // Delete AnnouncementTargets first (FK constraint), then Announcements
                const oldAnnouncements = await prisma.announcement.findMany({
                    where: { schoolId },
                    select: { id: true }
                });
                const oldAnnouncementIds = oldAnnouncements.map(a => a.id);
                if (oldAnnouncementIds.length > 0) {
                    await prisma.announcementTarget.deleteMany({ where: { announcementId: { in: oldAnnouncementIds } } });
                    await prisma.announcement.deleteMany({ where: { id: { in: oldAnnouncementIds } } });
                }

                await Promise.all([
                    prisma.attendance.deleteMany({ where: { schoolId, date: pDateRange } }),
                    prisma.smsLog.deleteMany({ where: { schoolId, created_at: pDateRange } }),
                    prisma.homework.deleteMany({ where: { schoolId, created_at: pDateRange } }),
                    prisma.quiz.deleteMany({ where: { schoolId, created_at: pDateRange } }),
                    prisma.virtualClass.deleteMany({ where: { schoolId, created_at: pDateRange } })
                ]);
                console.log(`[AUTO-CLEANUP] Deleted data + ${oldAnnouncementIds.length} announcements for year ${sourceYear.name} (School: ${schoolId})`);
            } catch (e) {
                console.error('[AUTO-CLEANUP ERROR]:', e);
            }
        }

        return res.json({ 
            message: `Si guul ah ayaa loo dallacsiiyey ${totalProcessed} arday. Sanadkani hadda waa ${yearToActivate?.name || 'la xidhay'}.`, 
            totalProcessed,
            nextYear: yearToActivate?.name
        });
    } catch (err) {
        console.error('[PROMOTE PUBLISH ERROR]:', err);
        return res.status(500).json({ message: err.message });
    }
});

// Promote students from one class to another (Year-End)
router.post('/:id/promote-students', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    let schoolId = req.user.schoolId;
    const requestedSchoolId = req.query.schoolId;

    if (requestedSchoolId && requestedSchoolId !== schoolId) {
        if (['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
            schoolId = requestedSchoolId;
        } else if (req.user.role === 'admin') {
            const [reqSchool, ownSchool] = await Promise.all([
                prisma.school.findUnique({ where: { id: requestedSchoolId }, select: { superAdminId: true } }),
                prisma.school.findUnique({ where: { id: req.user.schoolId }, select: { superAdminId: true } })
            ]);
            if (reqSchool && ownSchool && reqSchool.superAdminId === ownSchool.superAdminId) {
                schoolId = requestedSchoolId;
            }
        }
    }
    const { promotions, targetYearId } = req.body; 
    if (!promotions || !Array.isArray(promotions)) return res.status(400).json({ message: 'promotions array required' });

    try {
        const sourceYear = await prisma.academicYear.findFirst({ where: { id: req.params.id, schoolId } });
        if (!sourceYear) return res.status(404).json({ message: 'Source academic year not found' });

        let targetYear = null;
        if (targetYearId) {
            targetYear = await prisma.academicYear.findFirst({ where: { id: targetYearId, schoolId } });
        }
        
        if (!targetYear) {
            targetYear = await prisma.academicYear.findFirst({
                where: { isCurrent: true, id: { not: sourceYear.id }, schoolId }
            });

            if (!targetYear) {
                targetYear = await prisma.academicYear.findFirst({
                    where: { startDate: { gte: sourceYear.endDate }, schoolId },
                    orderBy: { startDate: 'asc' }
                });
            }
        }

        if (!targetYear) {
            return res.status(400).json({ message: 'No target academic year found. Please create the next academic year (e.g. 2026-2027) first.' });
        }

        let totalProcessed = 0;
        const details = [];
        const scanResults = [];
        const localNewSections = new Map();

        for (const { fromClassId, toClassId } of promotions) {
            if (!fromClassId) continue;
            const currentEnrollments = await prisma.enrollment.findMany({
                where: {
                    academicYearId: sourceYear.id,
                    classId: fromClassId,
                    status: 'active',
                    schoolId
                },
                include: { student: true, section: true }
            });
            if (currentEnrollments.length === 0) continue;
            scanResults.push({ fromClassId, toClassId, enrollments: currentEnrollments });
        }

        for (const action of scanResults) {
            const { fromClassId, toClassId, enrollments } = action;

            if (toClassId === 'graduate') {
                for (const enroll of enrollments) {
                    await prisma.enrollment.update({ where: { id: enroll.id }, data: { isCurrent: false, status: 'graduated' } });
                    await prisma.student.update({ where: { id: enroll.studentId }, data: { status: 'graduated', classId: null, sectionId: null } });
                    totalProcessed++;
                }
                details.push({ fromClassId, toClassId: 'graduated', count: enrollments.length });
            } else if (toClassId) {
                const targetClass = await prisma.class.findUnique({ where: { id: toClassId } });
                const targetSections = await prisma.section.findMany({ where: { classId: toClassId, schoolId } });

                for (const enroll of enrollments) {
                    const secName = enroll.section?.name || 'A';
                    let targetSectionId = null;
                    const existing = targetSections.find(s => s.name === secName);
                    if (existing) {
                        targetSectionId = existing.id;
                    } else if (localNewSections.has(`${toClassId}_${secName}`)) {
                        targetSectionId = localNewSections.get(`${toClassId}_${secName}`);
                    } else {
                        try {
                            const newSec = await prisma.section.create({
                                data: { name: secName, classId: toClassId, schoolId, shift: enroll.section?.shift || 'morning' }
                            });
                            targetSectionId = newSec.id;
                            localNewSections.set(`${toClassId}_${secName}`, newSec.id);
                            targetSections.push(newSec);
                        } catch (err) {
                            if (targetSections.length > 0) targetSectionId = targetSections[0].id;
                        }
                    }

                    try {
                        await prisma.enrollment.update({ where: { id: enroll.id }, data: { isCurrent: false, status: 'promoted' } });
                        await prisma.enrollment.create({
                            data: {
                                studentId: enroll.studentId,
                                academicYearId: targetYear.id,
                                classId: toClassId,
                                sectionId: targetSectionId,
                                schoolId,
                                balance: enroll.balance || 0,
                                isCurrent: true,
                                status: 'active'
                            }
                        });
                        await prisma.student.update({
                            where: { id: enroll.studentId },
                            data: { classId: toClassId, sectionId: targetSectionId, class: targetClass ? targetClass.class_name : undefined }
                        });
                        totalProcessed++;
                    } catch (err) {}
                }
                details.push({ fromClassId, toClassId, count: enrollments.length });
            }
        }

        await prisma.academicYear.update({ where: { id: sourceYear.id }, data: { isCurrent: false } });
        await prisma.academicYear.update({ where: { id: targetYear.id }, data: { isCurrent: true } });

        if (schoolId && sourceYear.startDate && sourceYear.endDate) {
            try {
                // Delete all announcements for this school when new year starts
                const oldAnnouncements = await prisma.announcement.findMany({
                    where: { schoolId },
                    select: { id: true }
                });
                const oldAnnouncementIds = oldAnnouncements.map(a => a.id);
                if (oldAnnouncementIds.length > 0) {
                    await prisma.announcementTarget.deleteMany({ where: { announcementId: { in: oldAnnouncementIds } } });
                    await prisma.announcement.deleteMany({ where: { id: { in: oldAnnouncementIds } } });
                }

                await prisma.attendance.deleteMany({
                    where: { schoolId, date: { gte: new Date(sourceYear.startDate), lte: new Date(sourceYear.endDate) } }
                });
                await prisma.smsLog.deleteMany({
                    where: { schoolId, created_at: { gte: new Date(sourceYear.startDate), lte: new Date(sourceYear.endDate) } }
                });

                // E-Learning Cleanup (Homework, Quizzes, Lessons, Zoom)
                await prisma.homework.deleteMany({
                    where: { schoolId, created_at: { gte: new Date(sourceYear.startDate), lte: new Date(sourceYear.endDate) } }
                });
                await prisma.quiz.deleteMany({
                    where: { schoolId, created_at: { gte: new Date(sourceYear.startDate), lte: new Date(sourceYear.endDate) } }
                });
                await prisma.virtualClass.deleteMany({
                    where: { schoolId, created_at: { gte: new Date(sourceYear.startDate), lte: new Date(sourceYear.endDate) } }
                });
                console.log(`[AUTO-CLEANUP] Deleted ${oldAnnouncementIds.length} announcements for school ${schoolId}`);
            } catch (e) { console.error('[AUTO-CLEANUP ERROR]:', e); }
        }

        return res.json({
            message: `${totalProcessed} students processed successfully. Current year is now ${targetYear.name}.`,
            totalProcessed,
            targetYear: targetYear.name,
            details
        });
    } catch (err) {
        console.error('[PROMOTION ERROR]:', err);
        return res.status(500).json({ message: err.message });
    }
});

module.exports = router;
