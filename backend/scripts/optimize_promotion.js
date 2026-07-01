const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/routes/academicYears.js');
let content = fs.readFileSync(targetFile, 'utf8');

const startMarker = `// --- Smart Promotion Publish ---`;
const endMarker = `// Promote students from one class to another (Year-End)`;

if (!content.includes(startMarker) || !content.includes(endMarker)) {
  console.error('Markers not found!');
  process.exit(1);
}

const newRoute = `// --- Smart Promotion Publish ---
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

    // Check if target year has old data or is older than source year
    const targetYearObj = await prisma.academicYear.findUnique({ 
        where: { id: targetYearId },
        include: { _count: { select: { Enrollments: true } } }
    });
    if (targetYearObj) {
        if (new Date(targetYearObj.startDate) <= new Date(sourceYear.startDate)) {
            return res.status(400).json({ message: \`Sanadka \${targetYearObj.name} ma ahan sanad mustaqbal ah. Ma dallacsiin kartid arday sanad dugsiyeed hore.\` });
        }
        if (targetYearObj._count.Enrollments > 0) {
            return res.status(400).json({ message: \`Sanadka \${targetYearObj.name} horay ayaa loo isticmaalay oo xog ayaa ku jirta. Fadlan dooro sanad cusub oo madhan.\` });
        }
    }

    const schoolId = sourceYear.schoolId;
    let totalProcessed = 0;
    const targetYearCache = new Map();
    const classCache = new Map();
    const sectionCache = new Map();

    try {
        // PRE-FETCH ALL ENROLLMENTS FOR SPEED
        const enrollmentIds = studentDecisions.map(d => d.enrollmentId);
        const allOldEnrolls = await prisma.enrollment.findMany({
            where: { id: { in: enrollmentIds }, schoolId },
            include: { section: true, student: { include: { user: true } } }
        });
        const oldEnrollMap = new Map(allOldEnrolls.map(e => [e.id, e]));

        // PRE-FETCH ALL CLASSES
        const allClasses = await prisma.class.findMany();
        const classesById = new Map(allClasses.map(c => [c.id, c]));

        // PRE-FETCH ALL SECTIONS FOR THIS SCHOOL
        const allSections = await prisma.section.findMany({ where: { schoolId } });
        allSections.forEach(s => sectionCache.set(\`\${s.classId}_\${s.name.toLowerCase()}\`, s.id));

        // Create transaction operations array
        const txOperations = [];
        let studentsProcessed = 0;

        for (const decision of studentDecisions) {
            const { enrollmentId, studentId, action, targetClassId, targetSectionId: explicitSectionId, targetSchoolId: dTargetSchoolId } = decision;
            
            // A. Determine Target School with Auto-Detection
            let finalTargetSchoolId = dTargetSchoolId || globalTargetSchoolId || schoolId;
            
            // If promoting to a specific class, strictly use that class's school branch
            if (action === 'promote' && targetClassId && targetClassId !== 'graduate') {
                const targetClassRecord = classesById.get(targetClassId);
                if (targetClassRecord) {
                    finalTargetSchoolId = targetClassRecord.schoolId;
                }
            } else if (action === 'retain') {
                // Retention is always local to the student's current school branch unless specifically overridden
                finalTargetSchoolId = dTargetSchoolId || schoolId;
            }

            const effectiveTargetSchoolId = finalTargetSchoolId;
            const isCrossSchool = effectiveTargetSchoolId !== schoolId;

            // B. Resolve Target Academic Year
            let targetYear = targetYearCache.get(effectiveTargetSchoolId);
            if (!targetYear) {
                targetYear = await prisma.academicYear.findFirst({ where: { id: targetYearId, schoolId: effectiveTargetSchoolId } });
                
                if (!targetYear) {
                    const refYear = await prisma.academicYear.findUnique({ where: { id: targetYearId } });
                    if (refYear) {
                        targetYear = await prisma.academicYear.findFirst({ 
                            where: { name: refYear.name, schoolId: effectiveTargetSchoolId, id: { not: sourceYearId } } 
                        });
                    }
                }

                if (!targetYear) {
                    targetYear = await prisma.academicYear.findFirst({
                        where: { schoolId: effectiveTargetSchoolId, startDate: { gte: sourceYear.startDate }, id: { not: sourceYearId } },
                        orderBy: { startDate: 'asc' }
                    });
                }

                if (!targetYear) {
                    targetYear = await prisma.academicYear.findFirst({ 
                        where: { schoolId: effectiveTargetSchoolId, isCurrent: true, id: { not: sourceYearId } } 
                    });
                }

                if (targetYear) targetYearCache.set(effectiveTargetSchoolId, targetYear);
            }

            if (!targetYear) {
                return res.status(400).json({ 
                    message: \`Ma helin sanad ku habboon school-ka \${effectiveTargetSchoolId}. Fadlan marka hore samee sanadka xiga.\` 
                });
            }

            // C. Load Old Enrollment Data
            const oldEnroll = oldEnrollMap.get(enrollmentId);
            if (!oldEnroll || oldEnroll.studentId !== studentId) continue;

            // D. Handle Graduation
            if (action === 'graduate' || targetClassId === 'graduate') {
                txOperations.push(prisma.enrollment.update({ where: { id: enrollmentId }, data: { isCurrent: false, status: 'graduated' } }));
                txOperations.push(prisma.student.update({ where: { id: studentId }, data: { status: 'graduated', classId: null, sectionId: null } }));
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
                if (!classCache.has(\`\${effectiveTargetSchoolId}_\${oldEnroll.classId}\`)) {
                    const sourceClass = classesById.get(oldEnroll.classId);
                    if (sourceClass) {
                        const tClass = await prisma.class.findFirst({ 
                            where: { schoolId: effectiveTargetSchoolId, class_name: { equals: sourceClass.class_name, mode: 'insensitive' } } 
                        });
                        classCache.set(\`\${effectiveTargetSchoolId}_\${oldEnroll.classId}\`, tClass?.id || targetClassId);
                    }
                }
                if (action === 'retain' || isCrossSchool) {
                    resolvedTargetClassId = classCache.get(\`\${effectiveTargetSchoolId}_\${oldEnroll.classId}\`);
                }
            }

            // F. Resolve/Create Section
            if (!resolvedTargetSectionId && resolvedTargetClassId && resolvedTargetClassId !== 'graduate') {
                const secName = (oldEnroll.section?.name || 'A').trim();
                const cacheKey = \`\${resolvedTargetClassId}_\${secName.toLowerCase()}\`;
                
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

            // G. Final Updates
            const finalStudentId = oldEnroll.student.student_id;
            const newStatus = action === 'promote' ? 'promoted' : 'retained';

            // 1. Mark ALL previous enrollments NOT current
            txOperations.push(prisma.enrollment.updateMany({ 
                where: { studentId: studentId, isCurrent: true }, 
                data: { isCurrent: false } 
            }));

            // 2. Mark the specific source enrollment as processed
            txOperations.push(prisma.enrollment.update({ 
                where: { id: enrollmentId }, 
                data: { isCurrent: false, status: newStatus } 
            }));

            // 3. Upsert the NEW enrollment
            txOperations.push(prisma.enrollment.upsert({
                where: { studentId_academicYearId: { studentId, academicYearId: targetYear.id } },
                update: { classId: resolvedTargetClassId, sectionId: resolvedTargetSectionId, schoolId: effectiveTargetSchoolId, isCurrent: true, status: 'active' },
                create: { studentId: studentId, academicYearId: targetYear.id, classId: resolvedTargetClassId, sectionId: resolvedTargetSectionId, schoolId: effectiveTargetSchoolId, balance: oldEnroll.balance || 0, isCurrent: true, status: 'active' }
            }));

            // 4. Update the User
            if (oldEnroll.student.userId) {
                txOperations.push(prisma.user.update({ 
                    where: { id: oldEnroll.student.userId }, 
                    data: { schoolId: effectiveTargetSchoolId, username: finalStudentId.toLowerCase() } 
                }));
            }
            
            // 5. Sync the Student's legacy fields
            const tClassRecordName = classesById.get(resolvedTargetClassId)?.class_name;
            txOperations.push(prisma.student.update({ 
                where: { id: studentId }, 
                data: { classId: resolvedTargetClassId, sectionId: resolvedTargetSectionId, class: tClassRecordName, status: 'active' } 
            }));
            
            studentsProcessed++;
        }

        // EXECUTE BATCHED TRANSACTIONS IN CHUNKS OF 50 STUDENTS TO PREVENT TIMEOUTS
        // Since each student has ~5 operations, 50 students = 250 operations per transaction chunk
        const chunkSize = 250;
        for (let i = 0; i < txOperations.length; i += chunkSize) {
            const chunk = txOperations.slice(i, i + chunkSize);
            await prisma.$transaction(chunk);
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

        // 5. AUTO-DELETE: Remove attendance and SMS logs for the FINISHED year
        if (schoolId && sourceYear.startDate && sourceYear.endDate) {
            try {
                const pDateRange = { gte: new Date(sourceYear.startDate), lte: new Date(sourceYear.endDate) };
                await Promise.all([
                    prisma.attendance.deleteMany({ where: { schoolId, date: pDateRange } }),
                    prisma.smsLog.deleteMany({ where: { schoolId, created_at: pDateRange } }),
                    prisma.homework.deleteMany({ where: { schoolId, created_at: pDateRange } }),
                    prisma.quiz.deleteMany({ where: { schoolId, created_at: pDateRange } }),
                    prisma.virtualClass.deleteMany({ where: { schoolId, created_at: pDateRange } })
                ]);
                console.log(\`[AUTO-CLEANUP] Deleted data for year \${sourceYear.name} (School: \${schoolId})\`);
            } catch (e) {
                console.error('[AUTO-CLEANUP ERROR]:', e);
            }
        }

        return res.json({ 
            message: \`Si guul ah ayaa loo dallacsiiyey \${totalProcessed} arday. Sanadkani hadda waa \${yearToActivate?.name || 'la xidhay'}.\`, 
            totalProcessed,
            nextYear: yearToActivate?.name
        });
    } catch (err) {
        console.error('[PROMOTE PUBLISH ERROR]:', err);
        return res.status(500).json({ message: err.message });
    }
});

`;

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

const newContent = content.slice(0, startIndex) + newRoute + content.slice(endIndex);

fs.writeFileSync(targetFile, newContent, 'utf8');
console.log('Successfully updated promote-publish route!');
