const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const prisma = require('../prisma');

// Get messages for current user
router.get('/', authenticateToken, async (req, res) => {
    try {
        let schoolId = req.user.schoolId;

        // If schoolId is missing from token, recover from User record
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
          try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
          } catch (err) {
            console.error('Messages Recovery Error:', err);
          }
        }
        const { search } = req.query;
        const messages = await prisma.message.findMany({
            where: { 
                OR: [{ senderId: req.user.id }, { receiverId: req.user.id }],
                ...(schoolId ? { sender: { schoolId } } : {}),
                ...(search ? { content: { contains: search, mode: 'insensitive' } } : {})
            },
            include: {
                sender: { select: { id: true, name: true, role: true } },
                receiver: { select: { id: true, name: true, role: true } }
            },
            orderBy: { created_at: 'desc' },
            take: 100 // Optimization: don't pull all history at once
        });
        res.json(messages);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Send message
router.post('/', authenticateToken, async (req, res) => {
    const { receiverId, content } = req.body;
    if (!receiverId || !content) return res.status(400).json({ message: 'Receiver and content required' });
    const schoolId = req.user.schoolId;
    try {
        // Ensure receiver is in the same school
        const receiver = await prisma.user.findFirst({
            where: { id: receiverId, ...(schoolId ? { schoolId } : {}) }
        });
        if (!receiver) return res.status(403).json({ message: 'Receiver not found in your school' });

        const message = await prisma.message.create({
            data: { senderId: req.user.id, receiverId, content }
        });
        res.json(message);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Mark as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
    try {
        await prisma.message.update({ where: { id: req.params.id }, data: { isRead: true } });
        res.json({ message: 'Marked as read' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get possible contacts (Teachers for Parents, Parents for Teachers)
router.get('/contacts', authenticateToken, async (req, res) => {
    try {
        let schoolId = req.user.schoolId;

        // If schoolId is missing from token, recover from User record
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
          try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
          } catch (err) {
            console.error('Contacts Recovery Error:', err);
          }
        }

        if (!schoolId && !['super_admin', 'owner'].includes(req.user.role)) {
            return res.status(400).json({ message: 'School ID required' });
        }

        const { search } = req.query;
        if (req.user.role === 'parent') {
            // Find all teachers in the same school
            const teachers = await prisma.user.findMany({
                where: { 
                    schoolId, role: 'teacher',
                    ...(search ? { name: { contains: search, mode: 'insensitive' } } : {})
                },
                select: { id: true, name: true, role: true },
                take: 100
            });
            return res.json(teachers);
        } else if (req.user.role === 'teacher') {
            // Find all parents of students in the teacher's sections
            const teacher = await prisma.teacher.findUnique({
                where: { userId: req.user.id },
                include: { Sections: true }
            });
            
            if (!teacher) return res.json([]);
            
            const sectionIds = teacher.Sections.map(s => s.id);
            const parents = await prisma.parent.findMany({
                where: {
                    Children: {
                        some: { student: { sectionId: { in: sectionIds } } }
                    },
                    ...(search ? { user: { name: { contains: search, mode: 'insensitive' } } } : {})
                },
                include: { user: { select: { id: true, name: true, role: true } } },
                take: 100
            });

            return res.json(parents.map(p => p.user));
        } else {
            // Admin can see everyone? For now, let's just return all users in school
            const users = await prisma.user.findMany({
                where: { 
                    schoolId, id: { not: req.user.id },
                    ...(search ? { name: { contains: search, mode: 'insensitive' } } : {})
                },
                select: { id: true, name: true, role: true },
                take: 100 // Optimization: prevent pulling 10k users
            });
            return res.json(users);
        }
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
