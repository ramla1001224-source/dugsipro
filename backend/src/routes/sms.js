const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { getQueueStats } = require('../services/smsQueue');

/**
 * SMS Management Routes
 * GET  /api/sms/settings         - Retrieve SMS status for a school (read-only for admin)
 * GET  /api/sms/usage-history    - Aggregated monthly history per school
 * GET  /api/sms/usage-details    - Detailed logs for a specific month
 * GET  /api/sms/superadmin-stats - Aggregate stats across all schools (super admin / owner)
 */

// ==================== PUBLIC DEBUG LOGS (Temporary for debugging) ====================
router.get('/debug-logs', async (req, res) => {
    try {
        const logs = await prisma.smsLog.findMany({
            orderBy: { created_at: 'desc' },
            take: 10
        });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==================== SMS QUEUE STATS ====================
// Shows how many messages are currently queued and whether processing is active.
router.get('/queue-stats', authenticateToken, authorizeRoles('admin', 'owner', 'super_admin'), (req, res) => {
    const stats = getQueueStats();
    res.json({
        pending: stats.pending,
        isProcessing: stats.isProcessing,
        message: stats.isProcessing
            ? `SMS queue is active. ${stats.pending} messages waiting.`
            : stats.pending > 0
                ? `Queue is paused with ${stats.pending} messages waiting.`
                : 'Queue is empty. No pending messages.'
    });
});


// ==================== GET SMS SETTINGS (READ-ONLY for admin) ====================
router.get('/settings', authenticateToken, authorizeRoles('admin', 'owner', 'super_admin'), async (req, res) => {
    try {
        let schoolId = req.user.schoolId;
        if ((req.user.role === 'super_admin' || req.user.role === 'owner') && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }

        // If schoolId is missing from token, recover from User record
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
          try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
          } catch (err) {
            console.error('SMS Settings Recovery Error:', err);
          }
        }

        if (!schoolId) return res.status(400).json({ message: 'School ID required' });

        const school = await prisma.school.findUnique({
            where: { id: schoolId },
            include: { managedBy: true, SmsSettings: true }
        });

        const monthlyCount = await prisma.smsLog.count({
            where: {
                schoolId,
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear()
            }
        });

        res.json({
            schoolId,
            isActive: school?.managedBy?.isSmsEnabled || false,
            senderId: school?.SmsSettings?.senderId || 'DugsiPro',
            monthlyCount
        });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ==================== GET MONTHLY USAGE HISTORY ====================
router.get('/usage-history', authenticateToken, authorizeRoles('admin', 'owner', 'super_admin'), async (req, res) => {
    try {
        let schoolId = req.user.schoolId;
        if ((req.user.role === 'super_admin' || req.user.role === 'owner') && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }

        // If schoolId is missing from token, recover from User record
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
          try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
          } catch (err) {
            console.error('SMS History Recovery Error:', err);
          }
        }

        if (!schoolId) return res.status(400).json({ message: 'School ID required' });

        const history = await prisma.smsLog.groupBy({
            by: ['month', 'year'],
            where: { schoolId },
            _count: { id: true },
            orderBy: [{ year: 'desc' }, { month: 'desc' }]
        });

        res.json(history.map(item => ({
            month: item.month,
            year: item.year,
            count: item._count.id
        })));
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ==================== GET DETAILED LOGS FOR A MONTH ====================
router.get('/usage-details', authenticateToken, authorizeRoles('admin', 'owner', 'super_admin'), async (req, res) => {
    try {
        const { month, year } = req.query;
        let schoolId = req.user.schoolId;
        if ((req.user.role === 'super_admin' || req.user.role === 'owner') && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }

        // If schoolId is missing from token, recover from User record
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
          try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
          } catch (err) {
            console.error('SMS Details Recovery Error:', err);
          }
        }

        if (!schoolId || !month || !year) return res.status(400).json({ message: 'Invalid parameters' });

        const logs = await prisma.smsLog.findMany({
            where: { schoolId, month: parseInt(month), year: parseInt(year) },
            orderBy: { created_at: 'desc' },
            take: 100
        });

        res.json(logs);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ==================== SUPER ADMIN AGGREGATE SMS STATS ====================
// Returns all schools under this super admin with per-school SMS counts
router.get('/superadmin-stats', authenticateToken, authorizeRoles('super_admin', 'owner'), async (req, res) => {
    try {
        const userId = req.user.id;
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // 1. Determine which schools to fetch stats for
        let schools = [];
        let isSmsEnabledGlobal = false;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, isSmsEnabled: true, SuperAdminSchools: { select: { id: true, name: true, logo: true, isActive: true } } }
        });

        if (!user) return res.status(404).json({ message: 'User not found' });
        isSmsEnabledGlobal = user.isSmsEnabled;

        if (user.role === 'owner') {
            // Owners see ALL schools
            schools = await prisma.school.findMany({
                where: { isActive: true },
                select: { id: true, name: true, logo: true, isActive: true }
            });
        } else {
            // Super Admins only see their managed schools
            schools = user.SuperAdminSchools;
        }

        if (schools.length === 0) {
            return res.json({
                isSmsEnabled: isSmsEnabledGlobal,
                currentMonth,
                currentYear,
                totalThisMonth: 0,
                totalAllTime: 0,
                schoolStats: []
            });
        }

        const schoolIds = schools.map(s => s.id);
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

        // 2. Perform bulk aggregations for SMS logs
        const [thisMonthAgg, lastMonthAgg, allTimeAgg] = await Promise.all([
            prisma.smsLog.groupBy({
                by: ['schoolId'],
                where: { schoolId: { in: schoolIds }, month: currentMonth, year: currentYear },
                _count: { id: true }
            }),
            prisma.smsLog.groupBy({
                by: ['schoolId'],
                where: { schoolId: { in: schoolIds }, month: prevMonth, year: prevYear },
                _count: { id: true }
            }),
            prisma.smsLog.groupBy({
                by: ['schoolId'],
                where: { schoolId: { in: schoolIds } },
                _count: { id: true }
            })
        ]);

        // 3. Merge stats back to schools
        const schoolStats = schools.map(school => {
            const thisMonth = thisMonthAgg.find(a => a.schoolId === school.id)?._count?.id || 0;
            const lastMonth = lastMonthAgg.find(a => a.schoolId === school.id)?._count?.id || 0;
            const allTime = allTimeAgg.find(a => a.schoolId === school.id)?._count?.id || 0;

            return {
                schoolId: school.id,
                schoolName: school.name,
                logo: school.logo,
                isActive: school.isActive,
                thisMonth,
                lastMonth,
                allTime,
                trend: lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0
            };
        });

        res.json({
            isSmsEnabled: isSmsEnabledGlobal,
            currentMonth,
            currentYear,
            totalThisMonth: schoolStats.reduce((sum, s) => sum + s.thisMonth, 0),
            totalAllTime: schoolStats.reduce((sum, s) => sum + s.allTime, 0),
            schoolStats
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==================== GET DETAILED LOGS FOR ALL SCHOOLS UNDER SUPER ADMIN ====================
// Returns up to 1000 raw SMS logs across the super admin's network. Can filter by month and year.
router.get('/superadmin-logs', authenticateToken, authorizeRoles('super_admin', 'owner'), async (req, res) => {
    try {
        const userId = req.user.id;
        let { month, year } = req.query;

        // Get Super Admin's schools
        const superAdmin = await prisma.user.findUnique({
            where: { id: userId },
            select: { SuperAdminSchools: { select: { id: true, name: true } } }
        });

        if (!superAdmin) return res.status(404).json({ message: 'Super admin not found' });

        const schoolIds = superAdmin.SuperAdminSchools.map(s => s.id);
        const schoolMap = {};
        superAdmin.SuperAdminSchools.forEach(s => schoolMap[s.id] = s.name);

        const whereClause = { schoolId: { in: schoolIds } };
        
        // If "all" is passed, we skip month/year filtering
        if (month !== 'all' && year !== 'all') {
            if (!month || !year) {
                const now = new Date();
                month = now.getMonth() + 1;
                year = now.getFullYear();
            }
            whereClause.month = parseInt(month);
            whereClause.year = parseInt(year);
        }

        const logs = await prisma.smsLog.findMany({
            where: whereClause,
            orderBy: { created_at: 'desc' },
            take: 1000
        });

        const enhancedLogs = logs.map(log => ({
            ...log,
            schoolName: schoolMap[log.schoolId] || 'Unknown School'
        }));

        res.json(enhancedLogs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==================== TEST SMS SENDING ====================
router.post('/test', authenticateToken, authorizeRoles('admin', 'owner', 'super_admin'), async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        let schoolId = req.user.schoolId;
        
        if (!phoneNumber || !message) {
            return res.status(400).json({ message: 'phoneNumber and message are required' });
        }

        const { sendSMS } = require('../services/smsService');
        const result = await sendSMS(phoneNumber, message, { schoolId, type: 'test' });
        
        res.json({
            success: result.success,
            error: result.error,
            details: result.success ? 'Message sent successfully' : 'Failed to send message'
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==================== SEND BULK SMS TO PARENTS ====================
router.post('/bulk-parents', authenticateToken, authorizeRoles('admin', 'owner', 'super_admin'), async (req, res) => {
    try {
        const { classId, sectionId, message } = req.body;
        let schoolId = req.user.schoolId;

        // If schoolId is missing from token, recover from User record
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
        }

        if (!schoolId) return res.status(400).json({ message: 'School ID required' });
        if (!classId || !message) {
            return res.status(400).json({ message: 'classId and message are required' });
        }

        // Fetch school name to prepend to message
        const schoolData = await prisma.school.findUnique({
            where: { id: schoolId },
            select: { name: true, superAdminId: true, institutionType: true }
        });
        let schoolDisplayName = schoolData?.name || 'Schoolka';
        if (schoolData?.superAdminId) {
            const superAdminUser = await prisma.user.findUnique({
                where: { id: schoolData.superAdminId },
                select: { schoolName: true }
            });
            if (superAdminUser?.schoolName) schoolDisplayName = superAdminUser.schoolName;
        }
        // Prefix with institution type label removed as per request
        // const instPrefixSms = (schoolData?.institutionType || 'school').toLowerCase() === 'machad' ? 'Machad' : 'School';
        // schoolDisplayName = `${instPrefixSms}: ${schoolDisplayName}`;
        const fullMessage = `${schoolDisplayName}\n${message}`;

        // Fetch students and their parents for the given class/section
        const whereClause = {
            schoolId,
            isCurrent: true,
            status: 'active'
        };

        if (classId !== 'all') {
            whereClause.classId = classId;
            if (sectionId && sectionId !== 'all') {
                whereClause.sectionId = sectionId;
            }
        }

        const enrollments = await prisma.enrollment.findMany({
            where: whereClause,
            include: {
                student: {
                    include: {
                        user: true,
                        Parents: {
                            include: {
                                parent: true
                            }
                        }
                    }
                }
            }
        });

        if (enrollments.length === 0) {
            return res.status(404).json({ message: 'No active students found for this class/section' });
        }

        const { enqueueBulkSMS } = require('../services/smsQueue');
        const smsJobs = [];
        const processedParentPhones = new Set();

        enrollments.forEach(enc => {
            const student = enc.student;

            // ── Primary: Linked parent accounts ─────────────────────────────
            if (student.Parents && student.Parents.length > 0) {
                student.Parents.forEach(ps => {
                    const parent = ps.parent;
                    if (parent && parent.phone) {
                        const phone = parent.phone.replace(/\D/g, '');
                        if (phone.length >= 7) {
                            const dedupeKey = `${phone}:${message}`;
                            if (!processedParentPhones.has(dedupeKey)) {
                                smsJobs.push({
                                    phone: parent.phone,
                                    message: fullMessage,
                                    schoolId,
                                    studentId: student.id,
                                    studentName: student.user.name,
                                    type: 'parent_alert'
                                });
                                processedParentPhones.add(dedupeKey);
                            }
                        }
                    }
                });
            }
            // ── Fallback: student.parentPhone (no linked parent account) ────
            else if (student.parentPhone) {
                const phone = student.parentPhone.replace(/\D/g, '');
                if (phone.length >= 7) {
                    const dedupeKey = `${phone}:${message}`;
                    if (!processedParentPhones.has(dedupeKey)) {
                        smsJobs.push({
                            phone: student.parentPhone,
                            message: fullMessage,
                            schoolId,
                            studentId: student.id,
                            studentName: student.user.name,
                            type: 'parent_alert'
                        });
                        processedParentPhones.add(dedupeKey);
                    }
                }
            }
        });

        if (smsJobs.length === 0) {
            return res.status(400).json({ message: 'No parents with valid phone numbers found' });
        }

        enqueueBulkSMS(smsJobs);

        res.json({
            success: true,
            message: `Queued ${smsJobs.length} SMS messages for processing.`,
            count: smsJobs.length
        });

    } catch (err) {
        console.error('Bulk Parent SMS Error:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
