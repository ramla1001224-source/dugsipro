const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Trigger a manual Google Drive backup
router.post('/trigger', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    try {
        const { performBackup } = require('../services/backupService');
        const result = await performBackup();
        res.json({ message: 'Backup completed successfully', fileId: result.fileId });
    } catch (err) {
        console.error('[BACKUP ROUTE] Manual backup failed:', err);
        res.status(500).json({ message: err.message });
    }
});

// Generate JSON backup of school data
router.get('/export', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    try {
        const schoolId = req.user.schoolId;

        // Fetch data from major tables scoped to school
        const [students, teachers, enrollments, classes, sections, payments, fees, staff] = await Promise.all([
            prisma.student.findMany({ where: { user: { schoolId } }, include: { user: true } }),
            prisma.teacher.findMany({ where: { user: { schoolId } }, include: { user: true } }),
            prisma.enrollment.findMany({ where: { schoolId } }),
            prisma.class.findMany({ where: { schoolId } }),
            prisma.section.findMany({ where: { schoolId } }),
            prisma.payment.findMany({ where: { schoolId } }),
            prisma.feeStructure.findMany({ where: { schoolId } }),
            prisma.staff.findMany({ where: { user: { schoolId } }, include: { user: true } })
        ]);

        const backupData = {
            exportDate: new Date().toISOString(),
            schoolId,
            data: {
                students,
                teachers,
                enrollments,
                classes,
                sections,
                payments,
                fees,
                staff
            }
        };

        res.setHeader('Content-disposition', 'attachment; filename=school_backup.json');
        res.setHeader('Content-type', 'application/json');
        res.write(JSON.stringify(backupData, null, 2));
        res.end();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
