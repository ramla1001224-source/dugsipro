const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const bcrypt = require('bcrypt');

// Get all staff with user info
router.get('/', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
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
            console.error('Staff Recovery Error:', err);
          }
        }
        const staff = await prisma.staff.findMany({
            where: schoolId ? { user: { schoolId } } : { user: { schoolId: 'NONE_AUTHORIZED' } },
            include: { user: true }
        });
        res.json(staff);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get single staff by ID
router.get('/:id', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
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
            console.error('Staff Recovery Error:', err);
          }
        }
        const staff = await prisma.staff.findFirst({
            where: { id: req.params.id, ...(schoolId ? { user: { schoolId } } : {}) },
            include: { user: true }
        });
        if (!staff) return res.status(404).json({ message: 'Staff not found' });
        res.json(staff);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Create Staff (User + Staff record)
router.post('/', authenticateToken, authorizeRoles('admin', 'owner', 'super_admin'), async (req, res) => {
    const { name, username, password, position, role, salary } = req.body;
    if (!name || !username || !password || !role) return res.status(400).json({ message: 'Missing required fields' });

    try {
        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }
        // Check for existing username in this school
        const existingUser = await prisma.user.findFirst({
            where: { username: username.toLowerCase(), schoolId }
        });

        if (existingUser) {
            return res.status(400).json({
                message: `Username '${username}' already exists. It is used by ${existingUser.name} (${existingUser.role.toUpperCase()}).`
            });
        }

        const hashed = await bcrypt.hash(password, 10);
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    name,
                    username: username.toLowerCase(),
                    password: hashed,
                    role,
                    schoolId
                }
            });
            const staff = await tx.staff.create({
                data: {
                    userId: user.id,
                    position: position || role,
                    salary: Number(salary || 0)
                },
                include: { user: true }
            });
            return staff;
        });
        res.json(result);
    } catch (err) {
        if (err.code === 'P2002') {
            return res.status(400).json({ message: 'Username already exists. Please choose a different one.' });
        }
        res.status(500).json({ message: err.message });
    }
});

// Delete Staff
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    try {
        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }
        const staff = await prisma.staff.findFirst({
            where: { id: req.params.id, ...(schoolId ? { user: { schoolId } } : {}) }
        });
        if (!staff) return res.status(404).json({ message: 'Staff record not found in your school' });

        // Deleting the User record automatically deletes the Staff profile and all associated 
        // data (salary records, leave requests, etc.) through 'onDelete: Cascade' in the database.
        await prisma.user.delete({ where: { id: staff.userId } });
        res.json({ message: 'Shaqaalaha iyo xogtiisa waa la tirtiray si guul ah' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});



// Update Staff
router.put('/:id', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const { name, username, password, role, position, salary, phone } = req.body;
    try {
        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }
        const staff = await prisma.staff.findFirst({
            where: { id: req.params.id, ...(schoolId ? { user: { schoolId } } : {}) },
            include: { user: true }
        });
        if (!staff) return res.status(404).json({ message: 'Staff record not found in your school' });

        // Build user update data
        const userData = {};
        if (name) userData.name = name;
        if (username) userData.username = username;
        if (password) userData.password = await bcrypt.hash(password, 10);
        if (role) userData.role = role;

        // Build staff update data
        const staffData = {};
        if (position !== undefined) staffData.position = position || null;
        if (salary !== undefined) staffData.salary = salary ? Number(salary) : 0;
        if (phone !== undefined) staffData.phone = phone || null;

        const result = await prisma.$transaction(async (tx) => {
            const u = await tx.user.update({ where: { id: staff.userId }, data: userData });
            const s = await tx.staff.update({
                where: { id: req.params.id },
                data: staffData,
                include: { user: true }
            });

            // If salary changed, update all pending SalaryRecords
            if (salary !== undefined) {
                const newSalary = Number(salary || 0);
                const pendingRecords = await tx.salaryRecord.findMany({
                    where: { staffId: req.params.id, status: 'pending' }
                });

                for (const record of pendingRecords) {
                    const net = newSalary - record.deductions + record.bonus;
                    await tx.salaryRecord.update({
                        where: { id: record.id },
                        data: { baseSalary: newSalary, netSalary: net }
                    });
                }
            }
            return s;
        });

        res.json(result);
    } catch (err) {
        if (err.code === 'P2002') return res.status(400).json({ message: 'Username already exists' });
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
