const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles, requireSchoolAccess } = require('../middleware/auth');

// Get all fee structures
router.get('/', authenticateToken, authorizeRoles('admin', 'accountant'), requireSchoolAccess(), async (req, res) => {
    try {
        let schoolId = req.query.schoolId || req.user.schoolId;

        // If schoolId is missing from token, recover from User record
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
          try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
          } catch (err) {
            console.error('Fees Recovery Error:', err);
          }
        }
        const fees = await prisma.feeStructure.findMany({
            where: { schoolId },
            include: { clss: true, section: true }
        });
        res.json(fees);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Create or update fee structure for a section or an entire class
router.post('/upsert', authenticateToken, authorizeRoles('admin', 'owner', 'accountant'), async (req, res, next) => {
    // Permission check for accountants
    if (req.user.role === 'accountant') {
        const { authorizePermission } = require('../middleware/auth');
        return authorizePermission('perm_acc_edit_fees')(req, res, next);
    }
    next();
}, async (req, res) => {
    const { classId, sectionId, amount, name = 'Tuition Fee', frequency = 'monthly' } = req.body;
    
    // Validate: at least one of sectionId or classId must be present
    if ((!sectionId && !classId) || amount === undefined) {
        return res.status(400).json({ message: 'Missing fields: sectionId or classId, and amount' });
    }

    const schoolId = req.user.schoolId;
    const numericAmount = parseFloat(amount);

    try {
        let results = [];

        if (sectionId) {
            // Case 1: Specific Section
            const existing = await prisma.feeStructure.findFirst({
                where: { sectionId, name, schoolId }
            });

            if (existing) {
                const updated = await prisma.feeStructure.update({
                    where: { id: existing.id },
                    data: { amount: numericAmount }
                });
                results.push(updated);
            } else {
                const created = await prisma.feeStructure.create({
                    data: {
                        sectionId,
                        classId: classId || null,
                        amount: numericAmount,
                        name,
                        frequency,
                        schoolId
                    }
                });
                results.push(created);
            }
        } else if (classId) {
            // Case 2: Entire Class (Generic Fee without Section binding)
            // Delete any legacy section-specific fees with the exact same name for this class to avoid duplicates
            await prisma.feeStructure.deleteMany({
                where: { classId, name, schoolId, sectionId: { not: null } }
            });

            const existing = await prisma.feeStructure.findFirst({
                where: { classId, sectionId: null, name, schoolId }
            });

            if (existing) {
                const updated = await prisma.feeStructure.update({
                    where: { id: existing.id },
                    data: { amount: numericAmount }
                });
                results.push(updated);
            } else {
                const created = await prisma.feeStructure.create({
                    data: {
                        sectionId: null,
                        classId: classId,
                        amount: numericAmount,
                        name,
                        frequency,
                        schoolId
                    }
                });
                results.push(created);
            }
        }

        res.json({ message: 'Fee updated successfully', results });
    } catch (err) { 
        console.error('Fee upsert error:', err);
        res.status(500).json({ message: err.message }); 
    }
});

module.exports = router;
