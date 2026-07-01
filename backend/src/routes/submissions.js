const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Configure Multer for homework submissions (Memory Storage)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ==================== SUBMIT HOMEWORK (Student) ====================
router.post('/submit', authenticateToken, authorizeRoles('student'), upload.single('attachment'), async (req, res) => {
    const { homeworkId, content } = req.body;
    if (!homeworkId) return res.status(400).json({ message: 'Homework ID is required' });

    try {
        let schoolId = req.user.schoolId;

        // If schoolId is missing from token, recover from User record
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
          try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
          } catch (err) {
            console.error('Submissions Recovery Error:', err);
          }
        }
        const student = await prisma.student.findFirst({ 
            where: { userId: req.user.id, ...(schoolId ? { user: { schoolId } } : {}) } 
        });
        if (!student) return res.status(404).json({ message: 'Student record not found' });

        let attachmentUrl = null;
        if (req.file) {
            const { uploadFile } = require('../services/supabaseStorage');
            attachmentUrl = await uploadFile(req.file.buffer, req.file.mimetype, 'submissions', req.file.originalname);
        }

        const submission = await prisma.homeworkSubmission.upsert({
            where: { homeworkId_studentId: { homeworkId, studentId: student.id } },
            update: { attachmentUrl, content, submittedAt: new Date(), status: 'pending' },
            create: {
                homeworkId,
                studentId: student.id,
                attachmentUrl,
                content,
                status: 'pending'
            }
        });

        res.json(submission);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==================== GET SUBMISSIONS (Teacher/Admin) ====================
router.get('/homework/:homeworkId', authenticateToken, authorizeRoles('admin', 'teacher'), async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const submissions = await prisma.homeworkSubmission.findMany({
            where: { 
                homeworkId: req.params.homeworkId,
                homework: schoolId ? { schoolId } : {}
            },
            include: { student: { include: { user: true } } },
            orderBy: { submittedAt: 'desc' }
        });
        res.json(submissions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==================== GRADE SUBMISSION (Teacher) ====================
router.put('/:id/grade', authenticateToken, authorizeRoles('teacher'), async (req, res) => {
    const { status, grade, feedback } = req.body;
    try {
        const submission = await prisma.homeworkSubmission.update({
            where: { id: req.params.id },
            data: { status, grade, feedback }
        });
        res.json(submission);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==================== GET MY SUBMISSIONS (Student) ====================
router.get('/my', authenticateToken, authorizeRoles('student'), async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const student = await prisma.student.findFirst({ 
            where: { userId: req.user.id, ...(schoolId ? { user: { schoolId } } : {}) } 
        });
        if (!student) return res.json([]); // Return empty list instead of crashing

        const submissions = await prisma.homeworkSubmission.findMany({
            where: { studentId: student.id },
            include: { 
                homework: {
                    include: {
                        teacher: { include: { user: { select: { name: true } } } },
                        subject: { select: { name: true } }
                    }
                }
            }
        });
        res.json(submissions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
