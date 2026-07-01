const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get leave requests
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
            console.error('Leaves Recovery Error:', err);
          }
        }

        let where = schoolId ? { schoolId } : { schoolId: 'NONE_AUTHORIZED' };
        if (req.user.role === 'teacher') {
            const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
            if (teacher) where.teacherId = teacher.id;
        } else if (req.user.role === 'staff' || req.user.role === 'accountant') {
            const staff = await prisma.staff.findUnique({ where: { userId: req.user.id } });
            if (staff) where.staffId = staff.id;
        }
        const leaves = await prisma.leaveRequest.findMany({
            where,
            include: { teacher: { include: { user: true } }, staff: { include: { user: true } } },
            orderBy: { created_at: 'desc' }
        });
        res.json(leaves);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Apply for leave
router.post('/', authenticateToken, async (req, res) => {
    const { startDate, endDate, reason } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ message: 'Dates required' });
    try {
        let data = { startDate: new Date(startDate), endDate: new Date(endDate), reason };
        if (req.user.role === 'teacher') {
            const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
            if (!teacher) return res.status(404).json({ message: 'Teacher record not found' });
            data.teacherId = teacher.id;
        } else if (req.user.role === 'staff' || req.user.role === 'accountant') {
            const staff = await prisma.staff.findUnique({ where: { userId: req.user.id } });
            if (!staff) return res.status(404).json({ message: 'Staff record not found' });
            data.staffId = staff.id;
        }
        const schoolId = req.user.schoolId;
        const leave = await prisma.leaveRequest.create({ data: { ...data, schoolId } });
        res.json(leave);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Approve/reject leave
router.patch('/:id', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const { status } = req.body;
    try {
        const schoolId = req.user.schoolId;
        await prisma.leaveRequest.update({ 
            where: { id: req.params.id, ...(schoolId ? { schoolId } : {}) }, 
            data: { status } 
        });
        res.json({ message: `Leave ${status}` });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
