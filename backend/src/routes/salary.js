const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get salary records
router.get('/', authenticateToken, authorizeRoles('admin', 'owner', 'accountant'), async (req, res) => {
    try {
        const { month, teacherId, staffId } = req.query;
        let schoolId = req.user.schoolId;

        // Standard schoolId recovery from User or Staff record
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
          try {
            // Priority 1: User table
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user?.schoolId) {
                schoolId = user.schoolId;
            } else {
                // Priority 2: Staff table
                const staff = await prisma.staff.findFirst({
                    where: { userId: req.user.id }
                });
                if (staff) schoolId = staff.schoolId;
            }
          } catch (err) {
            console.error('Salary Recovery Error:', err);
          }
        }

        if ((req.user.role || '').toLowerCase() === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }

        let where = schoolId ? { schoolId } : { schoolId: 'NONE_AUTHORIZED' };
        if (month) where.month = month;
        if (teacherId) where.teacherId = teacherId;
        if (staffId) where.staffId = staffId;
        const records = await prisma.salaryRecord.findMany({
            where,
            include: {
                teacher: { include: { user: true } },
                staff: { include: { user: true } }
            },
            orderBy: { created_at: 'desc' }
        });
        res.json(records);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Process salary (Manual)
router.post('/', authenticateToken, authorizeRoles('admin', 'owner', 'accountant'), async (req, res) => {
    const { teacherId, staffId, month, baseSalary, deductions, bonus } = req.body;
    if ((!teacherId && !staffId) || !month || !baseSalary) return res.status(400).json({ message: 'Employee, month, and base salary required' });

    try {
        let schoolId = req.user.schoolId;
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
          try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user?.schoolId) {
                schoolId = user.schoolId;
            } else {
                const staff = await prisma.staff.findFirst({ where: { userId: req.user.id } });
                if (staff) schoolId = staff.schoolId;
            }
          } catch (err) {
            console.error('Salary POST Recovery Error:', err);
          }
        }

        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();
        const [reqYear, reqMonth] = month.split('-').map(Number);
        if (reqYear > currentYear || (reqYear === currentYear && reqMonth > currentMonth)) {
            return res.status(400).json({ message: 'Cannot process salary for future months' });
        }

        const net = Number(baseSalary) - Number(deductions || 0) + Number(bonus || 0);
        const record = await prisma.salaryRecord.create({
            data: {
                teacherId: teacherId || null,
                staffId: staffId || null,
                month,
                baseSalary: Number(baseSalary),
                deductions: Number(deductions || 0),
                bonus: Number(bonus || 0),
                netSalary: net,
                status: 'pending',
                schoolId: schoolId
            }
        });
        res.json(record);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Mark as paid
router.patch('/:id/pay', authenticateToken, authorizeRoles('admin', 'owner', 'accountant'), async (req, res) => {
    try {
        let schoolId = req.user.schoolId;
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
          try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user?.schoolId) {
                schoolId = user.schoolId;
            } else {
                const staff = await prisma.staff.findFirst({ where: { userId: req.user.id } });
                if (staff) schoolId = staff.schoolId;
            }
          } catch (err) {
            console.error('Salary PAY Recovery Error:', err);
          }
        }

        if ((req.user.role || '').toLowerCase() === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }
        const record = await prisma.salaryRecord.findFirst({
            where: { id: req.params.id, schoolId }
        });
        if (!record) return res.status(404).json({ message: 'Salary record not found' });

        await prisma.salaryRecord.update({ where: { id: req.params.id }, data: { status: 'paid', paidDate: new Date() } });
        res.json({ message: 'Salary marked as paid' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Bulk generate salary records for all teachers and staff
router.post('/generate', authenticateToken, authorizeRoles('admin', 'owner', 'accountant'), async (req, res) => {
    const { month } = req.body;
    if (!month) return res.status(400).json({ message: 'Month is required' });

    try {
        let schoolId = req.user.schoolId;
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
          try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user?.schoolId) {
                schoolId = user.schoolId;
            } else {
                const staff = await prisma.staff.findFirst({ where: { userId: req.user.id } });
                if (staff) schoolId = staff.schoolId;
            }
          } catch (err) {
            console.error('Salary GEN Recovery Error:', err);
          }
        }

        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();
        const [reqYear, reqMonth] = month.split('-').map(Number);
        if (reqYear > currentYear || (reqYear === currentYear && reqMonth > currentMonth)) {
            return res.status(400).json({ message: 'Cannot process salary for future months' });
        }

        const [teachers, staff] = await Promise.all([
            prisma.teacher.findMany({ where: { user: { schoolId } } }),
            prisma.staff.findMany({
                where: {
                    user: { schoolId }
                }
            })
        ]);

        const employees = [
            ...teachers.map(t => ({ id: t.id, type: 'teacher', salary: t.salary })),
            ...staff.map(s => ({ id: s.id, type: 'staff', salary: s.salary }))
        ];

        const results = await prisma.$transaction(async (tx) => {
            const created = [];
            for (const emp of employees) {
                // Check if record already exists for this employee and month
                const existing = await tx.salaryRecord.findFirst({
                    where: {
                        OR: [
                            { teacherId: emp.id, month },
                            { staffId: emp.id, month }
                        ],
                        schoolId
                    }
                });

                if (!existing) {
                    const baseSalary = emp.salary || 0;
                    const record = await tx.salaryRecord.create({
                        data: {
                            teacherId: emp.type === 'teacher' ? emp.id : null,
                            staffId: emp.type === 'staff' ? emp.id : null,
                            month,
                            baseSalary,
                            deductions: 0,
                            bonus: 0,
                            netSalary: baseSalary,
                            status: 'pending',
                            schoolId
                        }
                    });
                    created.push(record);
                } else if (existing.status === 'pending') {
                    // Update existing pending record if salary changed
                    const currentSalary = emp.salary || 0;
                    if (existing.baseSalary !== currentSalary) {
                        const net = currentSalary - existing.deductions + existing.bonus;
                        await tx.salaryRecord.update({
                            where: { id: existing.id },
                            data: { baseSalary: currentSalary, netSalary: net }
                        });
                        created.push(existing);
                    }
                }
            }
            return created;
        });
        res.json({ message: `Generated ${results.length} salary records`, records: results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
