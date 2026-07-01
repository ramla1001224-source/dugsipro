const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get grades (filtered by role)
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
            console.error('Grades Recovery Error:', err);
          }
        }

        let where = schoolId ? { schoolId } : { schoolId: 'NONE_AUTHORIZED' };
        if (req.user.role === 'student') {
            const student = await prisma.student.findFirst({ where: { userId: req.user.id } });
            if (!student) return res.status(404).json({ message: 'Student record not found' });
            where = { studentId: student.id };
        } else if (req.user.role === 'parent') {
            const parent = await prisma.parent.findUnique({
                where: { userId: req.user.id },
                include: { Children: true }
            });
            if (!parent) return res.status(404).json({ message: 'Parent record not found' });
            const studentIds = parent.Children.map(c => c.studentId);
            where = { studentId: { in: studentIds } };
        } else if (req.user.role === 'teacher') {
            const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
            if (!teacher) return res.status(404).json({ message: 'Teacher record not found' });
            // Teachers see grades for students in their assigned sections
            where = { section: { teacherId: teacher.id } };
        }

        const { studentId, classId, sectionId, subject } = req.query;
        if (studentId && typeof studentId === 'string') {
            where.studentId = studentId;
        }
        if (sectionId) where.sectionId = sectionId;
        else if (classId) where.classId = classId;
        
        if (subject) where.subject = subject;

        const grades = await prisma.grade.findMany({
            where,
            include: { student: { include: { user: true } }, clss: true, section: true },
            orderBy: { date: 'desc' }
        });
        res.json(grades || []);
    } catch (err) {
        console.error('Grades fetch error:', err);
        res.status(500).json({ message: 'Internal server error while fetching grades' });
    }
});

// Create a grade
router.post('/create', authenticateToken, authorizeRoles('teacher', 'admin'), async (req, res) => {
    const { studentId, classId, sectionId, subject, score, grade } = req.body;
    if (!studentId || !sectionId || !subject || score === undefined) return res.status(400).json({ message: 'Missing fields' });
    try {
        const schoolId = req.user.schoolId;
        const g = await prisma.grade.create({
            data: { 
                studentId, 
                sectionId,
                classId: classId || null, 
                subject, 
                score: Number(score), 
                grade,
                schoolId
            }
        });
        res.json(g);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
