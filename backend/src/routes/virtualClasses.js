const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// ==================== GET ACTIVE VIRTUAL CLASSES ====================
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { classId, sectionId, status } = req.query;
        let schoolId = req.user.schoolId;

        // If schoolId is missing from token, recover from User record
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
          try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
          } catch (err) {
            console.error('VirtualClasses Recovery Error:', err);
          }
        }

        const where = {};
        if (status) where.status = status;

        // For students: fetch their current enrollment to find their class/section
        // For students: fetch their current enrollment to find their class/section
        if (req.user.role === 'student') {
            const enrollment = await prisma.enrollment.findFirst({
                where: { student: { userId: req.user.id }, isCurrent: true },
                select: { sectionId: true, classId: true, schoolId: true }
            });

            if (enrollment) {
                if (!schoolId) schoolId = enrollment.schoolId;
                
                // Fetch classes for the student's section OR class-wide (sectionId is null)
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
                // If sectionId is 'all' or not provided, but classId is, we filter by classId
                // and we include both section-specific items and class-wide items for that class
                where.OR = [
                    { section: { classId } },
                    { classId, sectionId: null }
                ];
            }
        }

        // Apply schoolId filter
        if (schoolId) {
            where.schoolId = schoolId;
        } else {
            where.schoolId = 'NONE_AUTHORIZED';
        }

        const classes = await prisma.virtualClass.findMany({
            where,
            include: {
                section: { include: { class: true } },
                clss: true,
                subject: true,
                teacher: { include: { user: true } }
            },
            orderBy: { startTime: 'desc' }
        });
        res.json(classes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==================== CREATE/SCHEDULE VIRTUAL CLASS ====================
router.post('/create', authenticateToken, authorizeRoles('admin', 'teacher'), async (req, res) => {
    let { title, meetingUrl, sectionId, classId, subjectId, startTime, endTime } = req.body;
    if (!title || !subjectId || !startTime) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const schoolId = req.user.schoolId;
        const isAllSections = sectionId === 'all';

        // Auto-generate Jitsi Link if not provided
        if (!meetingUrl) {
            const uniqueRoom = `DugsiPro_${schoolId.substring(0, 8)}_${Math.random().toString(36).substring(7)}`;
            meetingUrl = `https://meet.ffmuc.net/${uniqueRoom}`;
        }

        const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });

        // Authorization Guard for Teachers
        if (req.user.role === 'teacher') {
            if (!teacher) return res.status(403).json({ message: 'Teacher record not found' });
            
            // If it's a specific section, check assignment
            if (!isAllSections) {
                const isAssigned = await prisma.section.findFirst({
                    where: {
                        id: sectionId,
                        schoolId,
                        OR: [
                            { teacherId: teacher.id },
                            { class: { teacherId: teacher.id } },
                            { Subjects: { some: { teacherId: teacher.id } } }
                        ]
                    }
                });
                if (!isAssigned) {
                    return res.status(403).json({ message: 'Aad uma lihid fasalkaan ama qaybtan.' });
                }
            }
        }

        const virtualClass = await prisma.virtualClass.create({
            data: {
                title,
                meetingUrl,
                sectionId: isAllSections ? null : sectionId,
                classId: classId || null,
                subjectId,
                teacherId: teacher ? teacher.id : req.body.teacherId,
                schoolId,
                startTime: new Date(startTime),
                endTime: endTime ? new Date(endTime) : null,
                status: 'live' // Defaulting to live for immediate use
            }
        });

        res.json(virtualClass);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==================== UPDATE STATUS (Live/Ended) ====================
router.put('/:id/status', authenticateToken, authorizeRoles('admin', 'teacher'), async (req, res) => {
    const { status } = req.body;
    try {
        const updated = await prisma.virtualClass.update({
            where: { id: req.params.id },
            data: { status }
        });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==================== DELETE VIRTUAL CLASS ====================
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'teacher', 'owner', 'super_admin'), async (req, res) => {
    try {
        const meeting = await prisma.virtualClass.findUnique({ where: { id: req.params.id } });
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
        
        // Security check: ensure meeting belongs to the user's school
        if (meeting.schoolId !== req.user.schoolId && !['super_admin'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Aad uma lihid fasalkaan.' });
        }

        // Additional check for teachers: they can only delete their own meetings
        if (req.user.role === 'teacher') {
            const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
            if (!teacher || meeting.teacherId !== teacher.id) {
                return res.status(403).json({ message: 'Kaliya waxaad tirtiri kartaa kulamada aad adigu samaysay.' });
            }
        }

        await prisma.virtualClass.delete({
            where: { id: req.params.id }
        });
        res.json({ message: 'Meeting deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
