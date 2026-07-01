const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const responseHelper = require('../utils/responseHelper');

// Get all subjects
router.get('/', authenticateToken, async (req, res) => {
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
            console.error('Subjects Recovery Error:', err);
          }
        }

        let teacher = null;
        if (req.user.role === 'teacher') {
            teacher = await prisma.teacher.findFirst({
                where: { userId: req.user.id }
            });
        }

        let where = {};
        if (req.user.role === 'teacher' && teacher) {
            where.Assignments = { some: { teacherId: teacher.id } };
        }

        if (schoolId) where.schoolId = schoolId;
        else where.schoolId = 'NONE_AUTHORIZED';

        const subjects = await prisma.subject.findMany({
            where,
            include: {
                Assignments: {
                    where: req.user.role === 'teacher' && teacher ? { teacherId: teacher.id } : {},
                    include: { section: { include: { class: true } } }
                }
            },
            orderBy: { name: 'asc' }
        });
        return res.json(subjects);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
});

// Create subject
router.post('/', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const { name, code, description, classIds } = req.body;
    const schoolId = req.user.schoolId;
    if (!name || !code) return res.status(400).json({ message: 'Name and Code are required' });
    try {
        const subject = await prisma.subject.create({ 
            data: { 
                name, 
                code, 
                description, 
                schoolId 
            } 
        });

        // If classIds provided, create assignments for all sections in those classes
        if (classIds && Array.isArray(classIds) && classIds.length > 0) {
            const sections = await prisma.section.findMany({
                where: {
                    classId: { in: classIds },
                    schoolId
                }
            });

            if (sections.length > 0) {
                await prisma.subjectAssignment.createMany({
                    data: sections.map(section => ({
                        subjectId: subject.id,
                        sectionId: section.id,
                        teacherId: null // Optional now
                    })),
                    skipDuplicates: true
                });
            }
        }

        return res.json({ message: 'Subject created with assignments', data: subject });
    } catch (err) {
        if (err.code === 'P2002') return res.status(400).json({ message: 'Subject code already exists' });
        console.error('Create Subject Error:', err);
        return res.status(500).json({ message: err.message });
    }
});

// Assign subject to section with teacher
router.post('/assign', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const { subjectId, classId, sectionId, teacherId } = req.body;
    if (!subjectId || !sectionId || !teacherId) return res.status(400).json({ message: 'All fields required' });
    try {
        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }
        
        // Ownership checks
        const subject = await prisma.subject.findFirst({ where: { id: subjectId, ...(schoolId ? { schoolId } : {}) } });
        const targetSection = await prisma.section.findFirst({ where: { id: sectionId, ...(schoolId ? { schoolId } : {}) } });
        const teacherWhere = { id: teacherId };
        if (schoolId) teacherWhere.user = { schoolId };
        const teacher = await prisma.teacher.findFirst({ where: teacherWhere });

        if (!subject || !targetSection || !teacher) {
            return res.status(403).json({ message: 'Aukumad ayaa dhacay: Hubi in subject, section iyo teacher ay isku iskuul yihiin.' });
        }

        const assignment = await prisma.subjectAssignment.create({
            data: { 
                subjectId, 
                sectionId,
                teacherId 
            }
        });
        return res.json({ message: 'Subject assigned', data: assignment });
    } catch (err) {
        if (err.code === 'P2002') return res.status(400).json({ message: 'This subject is already assigned to this section' });
        return res.status(500).json({ message: err.message });
    }
});

// Update subject
router.put('/:id', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const { name, code, description, classIds } = req.body;
    const schoolId = req.user.schoolId;
    try {
        const updated = await prisma.subject.update({
            where: { id: req.params.id, schoolId },
            data: { name, code, description }
        });

        // Sync class assignments if classIds provided
        if (classIds && Array.isArray(classIds)) {
            // 1. Get all sections for the selected classes
            const targetSections = await prisma.section.findMany({
                where: {
                    classId: { in: classIds },
                    schoolId
                }
            });
            const targetSectionIds = targetSections.map(s => s.id);

            // 2. Remove assignments for sections NOT in the target classes
            // only if they don't have a teacher (or just remove all if requested, but let's be careful)
            // For now, let's follow the user's intent: "Edit" means these are the classes that HAVE the subject.
            await prisma.subjectAssignment.deleteMany({
                where: {
                    subjectId: updated.id,
                    section: {
                        classId: { notIn: classIds },
                        schoolId
                    }
                }
            });

            // 3. Add new assignments for sections that don't have them yet
            if (targetSectionIds.length > 0) {
                await prisma.subjectAssignment.createMany({
                    data: targetSectionIds.map(sid => ({
                        subjectId: updated.id,
                        sectionId: sid,
                        teacherId: null
                    })),
                    skipDuplicates: true
                });
            }
        }

        return res.json({ message: 'Subject updated with assignments', data: updated });
    } catch (err) {
        console.error('Update Subject Error:', err);
        return res.status(500).json({ message: err.message });
    }
});

// Delete subject
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        await prisma.subject.delete({ where: { id: req.params.id, schoolId } });
        return res.json({ message: 'Subject deleted successfully' });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
});

module.exports = router;
