const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Configure Multer for homework attachments (Memory Storage)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for homework
});

// ==================== GET ALL HOMEWORK (Filtered by school/class) ====================
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { classId, sectionId, subjectId } = req.query;
        let schoolId = req.user.schoolId;

        // If schoolId is missing from token, recover from User record
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
          try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
          } catch (err) {
            console.error('Homework Recovery Error:', err);
          }
        }

        const where = {};
        if (subjectId) where.subjectId = subjectId;

        // For teachers: only show homework they created
        if (req.user.role === 'teacher') {
            const teacher = await prisma.teacher.findUnique({
                where: { userId: req.user.id }
            });
            if (teacher) {
                where.teacherId = teacher.id;
            }
        }

        // For students: fetch their student record and current enrollment to find their class/section
        if (req.user.role === 'student') {
            const enrollment = await prisma.enrollment.findFirst({
                where: { student: { userId: req.user.id }, isCurrent: true },
                select: { id: true, classId: true, sectionId: true, schoolId: true }
            });

            if (enrollment) {
                if (!schoolId) schoolId = enrollment.schoolId;
                
                // Fetch homework for student's section OR class-wide
                where.OR = [
                    { sectionId: enrollment.sectionId },
                    { sectionId: null, classId: enrollment.classId }
                ];
            }
        } else {
            // Non-student roles use explicit or token-based filters
            if (sectionId && sectionId !== 'all') {
                where.sectionId = sectionId;
            } else if (classId) {
                where.OR = [
                    { section: { classId } },
                    { classId, sectionId: null }
                ];
            }
        }

        // Apply schoolId filter at the end
        if (schoolId) {
            where.schoolId = schoolId;
        } else {
            where.schoolId = 'NONE_AUTHORIZED';
        }

        const homeworks = await prisma.homework.findMany({
            where,
            include: {
                section: { include: { class: true } },
                clss: true,
                subject: true,
                teacher: {
                    include: {
                        user: { select: { name: true } }
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        const normalized = homeworks.map(hw => ({
            ...hw,
            class_name: hw.section?.class?.class_name || hw.clss?.class_name || 'N/A',
            section_name: hw.section?.name || 'Dhammaan Qaybaha'
        }));
        res.json(normalized);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==================== CREATE HOMEWORK ====================
router.post('/create', authenticateToken, authorizeRoles('admin', 'teacher'), upload.single('attachment'), async (req, res) => {
    try {
        const { title, description, dueDate, classId, sectionId, subjectId } = req.body;
        if (!title || !dueDate || !subjectId) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const schoolId = req.user.schoolId;
        const isAllSections = sectionId === 'all';
        
        let attachmentUrl = req.body.attachmentUrl || null;
        if (req.file) {
            const { uploadFile } = require('../services/supabaseStorage');
            attachmentUrl = await uploadFile(req.file.buffer, req.file.mimetype, 'homework', req.file.originalname);
        }

        // Find teacher record for the current user
        const teacher = await prisma.teacher.findUnique({
            where: { userId: req.user.id }
        });

        if (!teacher && req.user.role === 'teacher') {
            return res.status(403).json({ message: 'Teacher record not found' });
        }

        // Authorization Guard for Teachers
        if (req.user.role === 'teacher') {
            if (!isAllSections) {
                const isAssignedSection = await prisma.section.findFirst({
                    where: {
                        id: sectionId,
                        schoolId,
                        OR: [
                            { teacherId: teacher.id },
                            { class: { teacherId: teacher.id } }
                        ]
                    }
                });

                const isAssignedSubject = await prisma.subjectAssignment.findFirst({
                    where: {
                        teacherId: teacher.id,
                        subjectId: subjectId,
                        OR: [
                            { sectionId: sectionId },
                            { sectionId: null }
                        ]
                    }
                });

                if (!isAssignedSection && !isAssignedSubject) {
                    return res.status(403).json({ message: 'Aad uma lihid fasalkaan ama qaybtan.' });
                }
            }
        }

        const homework = await prisma.homework.create({
            data: {
                title,
                description,
                attachmentUrl,
                dueDate: new Date(dueDate),
                sectionId: isAllSections ? null : sectionId,
                classId: classId || null,
                subjectId,
                teacherId: teacher ? teacher.id : req.body.teacherId,
                schoolId
            }
        });

        res.json(homework);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==================== DELETE HOMEWORK ====================
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'teacher'), async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const homework = await prisma.homework.findFirst({
            where: { id: req.params.id, schoolId }
        });

        if (!homework) return res.status(404).json({ message: 'Homework not found' });

        // Delete attachment from Storage (local or Supabase) if exists
        if (homework.attachmentUrl) {
            const { deleteFile } = require('../services/supabaseStorage');
            await deleteFile(homework.attachmentUrl);
        }

        await prisma.homework.delete({ where: { id: req.params.id } });
        res.json({ message: 'Homework deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
