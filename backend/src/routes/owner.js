const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// All routes here require the 'owner' role
router.use(authenticateToken);
router.use(authorizeRoles('owner'));

// GET all super admins
router.get('/super-admins', async (req, res) => {
    try {
        const admins = await prisma.user.findMany({
            where: { role: 'super_admin' },
            select: {
                id: true,
                name: true,
                username: true,
                role: true,
                shortCode: true,
                created_at: true,
                isActive: true,
                schoolName: true,
                SuperAdminSchools: {
                    select: {
                        id: true,
                        name: true,
                        logo: true,
                        institutionType: true
                    }
                },
                isSmsEnabled: true
            }
        });
        res.json(admins);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST create a new super admin
router.post('/super-admins', async (req, res) => {
    const { name, username, password, shortCode, schoolName, branchName, schoolLogo, phone, institutionType } = req.body;
    if (!name || !username || !password || !shortCode || !schoolName) {
        return res.status(400).json({ message: 'Maqan: Magaca, Username, Password, ShortCode iyo Magaca Dugsiga waa qasab.' });
    }

    try {
        const cleanUsername = username.trim().toLowerCase();
        const existing = await prisma.user.findFirst({ where: { username: cleanUsername, schoolId: null } });
        if (existing) return res.status(400).json({ message: 'Username already exists' });

        if (shortCode) {
            const existingShort = await prisma.user.findUnique({ where: { shortCode: shortCode.trim().toUpperCase() } });
            if (existingShort) return res.status(400).json({ message: 'Shortcode already taken' });
        }

        const hashed = await bcrypt.hash(password, 10);

        // Use a transaction to ensure both user and school are created together
        const result = await prisma.$transaction(async (tx) => {
            const admin = await tx.user.create({
                data: {
                    name,
                    username: cleanUsername,
                    password: hashed,
                    role: 'super_admin',
                    phone: phone || null,
                    schoolId: null,
                    shortCode: shortCode ? shortCode.trim().toUpperCase() : null,
                    schoolName: schoolName.trim()
                }
            });

            if (schoolName) {
                await tx.school.create({
                    data: {
                        name: branchName ? branchName.trim() : schoolName.trim(),
                        logo: schoolLogo || null,
                        superAdminId: admin.id,
                        institutionType: institutionType || 'school'
                    }
                });
            }

            return admin;
        }, {
            timeout: 20000
        });

        res.status(201).json({ id: result.id, name: result.name, username: result.username });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT update a super admin
router.put('/super-admins/:id', async (req, res) => {
    const { name, username, password, shortCode, schoolName, branchName, schoolLogo, isActive, phone, institutionType } = req.body;
    try {
        const data = {};
        if (name) data.name = name;
        if (phone) data.phone = phone;
        if (isActive !== undefined) data.isActive = isActive;
        if (schoolName !== undefined) data.schoolName = schoolName;
        if (username) {
            const cleanUsername = username.trim().toLowerCase();
            const existing = await prisma.user.findFirst({
                where: { username: cleanUsername, NOT: { id: req.params.id } }
            });
            if (existing) return res.status(400).json({ message: 'Username already exists' });
            data.username = cleanUsername;
        }
        if (password) {
            data.password = await bcrypt.hash(password, 10);
        }
        if (shortCode !== undefined) {
            if (shortCode) {
                const existingShort = await prisma.user.findFirst({
                    where: { shortCode: shortCode.trim().toUpperCase(), NOT: { id: req.params.id } }
                });
                if (existingShort) return res.status(400).json({ message: 'Shortcode already taken' });
                data.shortCode = shortCode.trim().toUpperCase();
            } else {
                data.shortCode = null;
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            const admin = await tx.user.update({
                where: { id: req.params.id },
                data: {
                    ...data,
                    isSmsEnabled: req.body.isSmsEnabled !== undefined ? (req.body.isSmsEnabled === 'true' || req.body.isSmsEnabled === true) : undefined
                }
            });

            if (branchName !== undefined || schoolLogo !== undefined || isActive !== undefined || institutionType !== undefined) {
                // Find all schools managed by this super admin
                const existingSchools = await tx.school.findMany({
                    where: { superAdminId: admin.id },
                    orderBy: { created_at: 'asc' }
                });

                if (existingSchools.length > 0) {
                    // Update logo, status, and institutionType for ALL schools (global branding/lock)
                    await tx.school.updateMany({
                        where: { superAdminId: admin.id },
                        data: {
                            ...(schoolLogo !== undefined && { logo: schoolLogo }),
                            ...(isActive !== undefined && { isActive: isActive }),
                            ...(institutionType !== undefined && { institutionType })
                        }
                    });

                    // Update name ONLY for the first (primary) school to avoid overwriting other branches
                    if (branchName !== undefined) {
                        await tx.school.update({
                            where: { id: existingSchools[0].id },
                            data: { name: branchName }
                        });
                    }
                } else if (branchName !== undefined) {
                    // Create if doesn't exist but branchName provided
                    await tx.school.create({
                        data: {
                            name: branchName,
                            logo: schoolLogo || null,
                            superAdminId: admin.id,
                            isActive: isActive !== undefined ? isActive : true,
                            institutionType: institutionType || 'school'
                        }
                    });
                }
            }
            return admin;
        }, {
            timeout: 20000
        });

        res.json({ id: result.id, name: result.name, username: result.username });
    } catch (err) {
        console.error('[Owner API] Error updating super admin:', err);
        res.status(500).json({ message: err.message });
    }
});

// DELETE a super admin
router.delete('/super-admins/:id', async (req, res) => {
    try {
        await prisma.user.delete({ where: { id: req.params.id } });
        res.json({ message: 'Super admin deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==================== GLOBAL SYSTEM CONFIG ====================
router.get('/global-config', async (req, res) => {
    try {
        const configs = await prisma.globalSetting.findMany();
        res.json(configs);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/global-config', async (req, res) => {
    try {
        const { configs } = req.body; // Array of { key, value }
        
        if (!Array.isArray(configs)) return res.status(400).json({ message: 'Invalid format' });

        await prisma.$transaction(
            configs.map(c => prisma.globalSetting.upsert({
                where: { key: c.key },
                update: { value: c.value, updated_at: new Date() },
                create: { key: c.key, value: c.value }
            }))
        );

        res.json({ message: 'Global configuration updated' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ==================== SMS STATS PER SUPER ADMIN ====================
// GET /api/owner/sms-stats
// Returns SMS usage grouped by super admin, each with their schools breakdown
router.get('/sms-stats', async (req, res) => {
    try {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // Get all super admins with their schools
        const superAdmins = await prisma.user.findMany({
            where: { role: 'super_admin' },
            select: {
                id: true,
                name: true,
                username: true,
                isSmsEnabled: true,
                isActive: true,
                SuperAdminSchools: {
                    select: { id: true, name: true, logo: true }
                }
            }
        });

        const allSchoolIds = superAdmins.flatMap(admin => admin.SuperAdminSchools.map(s => s.id));

        // Optimized Bulk Queries
        const [thisMonthCounts, activeYears] = await Promise.all([
            prisma.smsLog.groupBy({
                by: ['schoolId'],
                where: { schoolId: { in: allSchoolIds }, month: currentMonth, year: currentYear },
                _count: { id: true }
            }),
            prisma.academicYear.findMany({
                where: { schoolId: { in: allSchoolIds }, isCurrent: true },
                orderBy: [
                    { isCurrent: 'desc' },
                    { startDate: 'desc' }
                ]
            })
        ]);

        // Map counts for easy access
        const monthCountMap = Object.fromEntries(thisMonthCounts.map(c => [c.schoolId, c._count.id]));
        const activeYearMap = Object.fromEntries(activeYears.map(y => [y.schoolId, y]));

        // For the "All Time" (This Year) counts, we still need to do them, but let's see if we can optimize
        // Since academic years vary per school, we'll do them in parallel but more efficiently
        const stats = await Promise.all(superAdmins.map(async (admin) => {
            const schoolBreakdown = await Promise.all(admin.SuperAdminSchools.map(async (school) => {
                const thisMonth = monthCountMap[school.id] || 0;
                const activeYear = activeYearMap[school.id];
                
                let allTime = 0;
                if (activeYear) {
                    allTime = await prisma.smsLog.count({
                        where: {
                            schoolId: school.id,
                            created_at: {
                                gte: new Date(activeYear.startDate),
                                lte: new Date(activeYear.endDate)
                            }
                        }
                    });
                } else {
                    allTime = await prisma.smsLog.count({ where: { schoolId: school.id } });
                }

                return {
                    schoolId: school.id,
                    schoolName: school.name,
                    logo: school.logo,
                    thisMonth,
                    allTime
                };
            }));

            const totalSmsThisMonth = schoolBreakdown.reduce((sum, s) => sum + s.thisMonth, 0);
            const totalSmsAllTime = schoolBreakdown.reduce((sum, s) => sum + s.allTime, 0);

            return {
                id: admin.id,
                name: admin.name,
                username: admin.username,
                isSmsEnabled: admin.isSmsEnabled,
                isActive: admin.isActive,
                totalSmsThisMonth,
                totalSmsAllTime,
                schoolBreakdown
            };
        }));

        res.json({
            stats,
            currentMonth,
            currentYear,
            totalPlatformSmsThisMonth: stats.reduce((sum, a) => sum + a.totalSmsThisMonth, 0)
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==================== SYSTEM ERROR LOGS ====================

// GET /api/owner/system-errors  — Returns last 100 system errors (newest first)
router.get('/system-errors', async (req, res) => {
    try {
        const errors = await prisma.systemError.findMany({
            orderBy: { timestamp: 'desc' },
            take: 100
        });
        res.json(errors);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE /api/owner/system-errors/:id  — Delete a single error log entry
router.delete('/system-errors/:id', async (req, res) => {
    try {
        await prisma.systemError.delete({ where: { id: req.params.id } });
        res.json({ message: 'Error log removed' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE /api/owner/system-errors  — Clear ALL error logs
router.delete('/system-errors', async (req, res) => {
    try {
        const { count } = await prisma.systemError.deleteMany();
        res.json({ message: `Cleared ${count} error log(s)` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==================== IMPERSONATION ====================
// POST /api/owner/impersonate-super/:id
// Generates a JWT token for a specific super admin, allowing the owner to "launch" their dashboard
router.post('/impersonate-super/:id', async (req, res) => {
    try {
        const targetAdmin = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: { id: true, name: true, username: true, role: true }
        });

        if (!targetAdmin || targetAdmin.role !== 'super_admin') {
            return res.status(404).json({ message: 'Target super admin not found' });
        }

        // Generate token for the target admin — MUST use 'id' (not 'userId') to match auth middleware
        const token = jwt.sign(
            { 
                id: targetAdmin.id,              // matches req.user.id in all routes
                role: targetAdmin.role,
                name: targetAdmin.name,          // For impersonation banner display
                isImpersonatingSuper: true,      // Owner is viewing as this super admin
                impersonatedBy: req.user.id,     // Track who impersonated (use req.user.id to be consistent)
                originalRole: 'owner'           // Essential for permission checks
            },
            process.env.JWT_SECRET || 'dev-secret',
            { expiresIn: '2h' }
        );

        res.json({
            token,
            name: targetAdmin.name,
            username: targetAdmin.username,
            role: targetAdmin.role
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
