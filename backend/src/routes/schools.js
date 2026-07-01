const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Configure Multer for school logo uploads (Memory Storage)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware to ensure a super_admin only accesses their own school
async function verifySchoolOwnership(req, res, next) {
    // Owner can ALWAYS access any school, even when impersonating
    if (req.user.role === 'owner' || req.user.originalRole === 'owner') return next();

    const schoolId = req.params.id;
    const school = await prisma.school.findUnique({ where: { id: schoolId } });

    if (!school) return res.status(404).json({ message: 'School not found' });
    if (school.superAdminId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied: You do not manage this school' });
    }
    next();
}

// ---- All routes require super_admin ----

// GET all schools (Accessible by owner, super_admin, and sibling admins)
router.get('/', authenticateToken, authorizeRoles('super_admin', 'owner', 'admin'), async (req, res) => {
    try {
        const { academicYearId } = req.query;
        const where = {};
        
        if (req.user.role === 'super_admin') {
            where.superAdminId = req.user.id;
        } else if (req.user.role === 'admin') {
            if (!req.user.schoolId) return res.json([]);
            const currentSchool = await prisma.school.findUnique({ 
                where: { id: req.user.schoolId }, 
                select: { superAdminId: true } 
            });
            if (!currentSchool || !currentSchool.superAdminId) return res.json([]);
            where.superAdminId = currentSchool.superAdminId;
        }

        const schools = await prisma.school.findMany({
            where,
            include: {
                managedBy: { select: { id: true, name: true, isActive: true } }
            },
            orderBy: { created_at: 'desc' }
        });

        const schoolIds = schools.map(s => s.id);
        if (schoolIds.length === 0) return res.json([]);

        // If the user is a basic admin, return simplified data
        if (req.user.role === 'admin') {
            return res.json(schools.map(s => ({
                id: s.id, name: s.name, logo: s.logo, shortCode: s.shortCode, isActive: s.isActive
            })));
        }

        // 1. Resolve Year Range for Revenue
        let startFilter = null, endFilter = null;
        if (academicYearId) {
            const yearRec = await prisma.academicYear.findUnique({ where: { id: academicYearId } });
            if (yearRec) {
                startFilter = new Date(yearRec.startDate);
                endFilter = new Date(yearRec.endDate);
                endFilter.setUTCHours(23, 59, 59, 999);
            }
        }

        // 2. Parallel Bulk Aggregations
        const [studentCounts, teacherCounts, classCounts, revenueAgg] = await Promise.all([
            prisma.enrollment.groupBy({
                by: ['schoolId'],
                where: { 
                    schoolId: { in: schoolIds }, 
                    ...(academicYearId ? { academicYearId } : { isCurrent: true }),
                    status: { in: ['active', 'promoted', 'retained'] }
                },
                _count: { id: true }
            }),
            prisma.user.groupBy({
                by: ['schoolId'],
                where: { schoolId: { in: schoolIds }, role: 'teacher' },
                _count: { id: true }
            }),
            prisma.class.groupBy({
                by: ['schoolId'],
                where: { schoolId: { in: schoolIds } },
                _count: { id: true }
            }),
            prisma.payment.groupBy({
                by: ['schoolId'],
                where: { 
                    schoolId: { in: schoolIds }, 
                    ...(startFilter && endFilter ? { date: { gte: startFilter, lte: endFilter } } : { year: new Date().getFullYear() })
                },
                _sum: { amount: true }
            })
        ]);

        // 3. Merge bulk results
        const enriched = schools.map(school => {
            return {
                ...school,
                students: studentCounts.find(c => c.schoolId === school.id)?._count?.id || 0,
                teachers: teacherCounts.find(c => c.schoolId === school.id)?._count?.id || 0,
                classes: classCounts.find(c => c.schoolId === school.id)?._count?.id || 0,
                revenue: revenueAgg.find(r => r.schoolId === school.id)?._sum?.amount || 0
            };
        });

        res.json(enriched);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET single school (Accessible by owner and super_admin)
router.get('/:id', authenticateToken, authorizeRoles('super_admin', 'owner'), verifySchoolOwnership, async (req, res) => {
    try {
        const school = await prisma.school.findUnique({ where: { id: req.params.id } });
        if (!school) return res.status(404).json({ message: 'School not found' });
        res.json(school);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST create school (Restricted to owner OR owner impersonating super_admin)
router.post('/', authenticateToken, async (req, res) => {
    // Only 'owner' or an owner impersonating a super_admin can create schools
    const isOwner = req.user.role === 'owner' || req.user.isImpersonatingSuper;
    if (!isOwner) return res.status(403).json({ message: 'Only System Owner can create schools' });

    const { name, shortCode, address, phone, email, logo } = req.body;
    if (!name) return res.status(400).json({ message: 'Magaca dugsiga waa qasab' });
    // shortCode is now optional

    try {
        if (shortCode && shortCode.trim()) {
            const existingShort = await prisma.school.findUnique({ where: { shortCode: shortCode.trim().toUpperCase() } });
            if (existingShort) return res.status(400).json({ message: 'ShortCode-kan waa la isticmaalay hore, fadlan mid kale dooro' });
        }

        // Determine who the school belongs to
        let superAdminId = null;
        if (req.user.role === 'super_admin') {
            superAdminId = req.user.id;
        } else if (req.user.isImpersonatingSuper) {
            superAdminId = req.user.id;
        }

        let finalLogo = logo || '';
        let finalInstitutionType = 'school';

        // Automatically inherit logo and institutionType from an existing branch of the super admin
        if (superAdminId) {
            const existingSchool = await prisma.school.findFirst({
                where: { superAdminId },
                orderBy: { created_at: 'asc' }
            });
            
            if (existingSchool) {
                if (!finalLogo && existingSchool.logo) {
                    finalLogo = existingSchool.logo;
                }
                if (existingSchool.institutionType) {
                    finalInstitutionType = existingSchool.institutionType;
                }
            }
        }

        const school = await prisma.school.create({
            data: {
                name,
                shortCode: (shortCode && shortCode.trim()) ? shortCode.trim().toUpperCase() : null,
                address,
                phone,
                email,
                logo: finalLogo,
                superAdminId,
                institutionType: finalInstitutionType
            }
        });
        res.status(201).json(school);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT update school (Accessible by owner and super_admin)
router.put('/:id', authenticateToken, authorizeRoles('super_admin', 'owner'), verifySchoolOwnership, async (req, res) => {
    const { name, shortCode, address, phone, email, logo, isActive } = req.body;
    try {
        const schoolId = req.params.id;
        
        // Fetch current school to get superAdminId
        const currentSchool = await prisma.school.findUnique({ 
            where: { id: schoolId },
            select: { superAdminId: true }
        });

        // 🛑 If isActive is provided, update the Super Admin user status
        // This locks ALL schools belonging to this Super Admin
        if (isActive !== undefined && currentSchool.superAdminId) {
            await prisma.user.update({
                where: { id: currentSchool.superAdminId },
                data: { isActive: !!isActive }
            });
        }

        const school = await prisma.school.update({
            where: { id: schoolId },
            data: { 
                name, 
                shortCode: shortCode !== undefined ? (shortCode ? shortCode.trim().toUpperCase() : null) : undefined, 
                address, 
                phone, 
                email, 
                logo, 
                isActive: isActive !== undefined ? !!isActive : undefined
            }
        });

        res.json(school);
    } catch (err) {
        console.error('Update School Error:', err);
        res.status(500).json({ message: err.message });
    }
});

// DELETE school (Restricted to System Owner ONLY)
router.delete('/:id', authenticateToken, authorizeRoles('owner', 'super_admin'), verifySchoolOwnership, async (req, res) => {
    // Only 'owner' or an owner impersonating a super admin can delete
    const isOwner = req.user.role === 'owner' || req.user.originalRole === 'owner' || req.user.isImpersonatingSuper;
    if (!isOwner) return res.status(403).json({ message: 'Fadlan la xiriir Maamulaha Sare (System Owner) si dugsiga loo tirtiro.' });

    try {
        const schoolId = req.params.id;

        // Thanks to 'onDelete: Cascade' in schema.prisma, deleting the school safely deletes
        // all connected records (students, classes, invoices, etc) without timing out
        await prisma.school.delete({ where: { id: schoolId } });

        res.json({ message: 'Dugsiga iyo dhammaan xogtiisa waa la tirtiray si guul ah' });
    } catch (err) {
        console.error('Delete School Error:', err);
        res.status(500).json({ message: 'Tirtirka dugsigu wuu fashilmay: ' + err.message });
    }
});

// POST create admin for a school (Accessible by owner and super_admin)
router.post('/:id/admin', authenticateToken, authorizeRoles('super_admin', 'owner'), verifySchoolOwnership, async (req, res) => {
    const { name, username, password } = req.body;
    if (!name || !username || !password) return res.status(400).json({ message: 'Missing fields' });

    try {
        const schoolId = req.params.id;

        // Verify school exists
        const school = await prisma.school.findUnique({ where: { id: schoolId } });
        if (!school) return res.status(404).json({ message: 'School not found' });

        // Check if an admin already exists for this school
        const existingAdmin = await prisma.user.findFirst({
            where: { schoolId, role: 'admin' }
        });
        if (existingAdmin) return res.status(400).json({ message: 'Dugsigan hore ayuu admin u lahaa. Fadlan cusboonaysii kan jira.' });

        // Check username not taken in this school
        const cleanUsername = username.trim().toLowerCase();
        const existingUsername = await prisma.user.findFirst({ where: { username: cleanUsername, schoolId } });
        if (existingUsername) return res.status(400).json({ message: 'Username-kan hore ayaa loo qaatay' });

        const hashed = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                name,
                username: cleanUsername,
                password: hashed,
                role: 'admin',
                schoolId,
            }
        });

        res.status(201).json({ id: user.id, name: user.name, username: user.username, role: user.role, schoolId });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT update admin for a school (Accessible by owner and super_admin)
router.put('/:id/admin/:userId', authenticateToken, authorizeRoles('super_admin', 'owner'), verifySchoolOwnership, async (req, res) => {
    const { name, username, password } = req.body;
    try {
        const { userId } = req.params;

        const data = {};
        if (name) data.name = name;
        if (username) {
            const cleanUsername = username.trim().toLowerCase();
            const existing = await prisma.user.findFirst({
                where: { username: cleanUsername, NOT: { id: userId } }
            });
            if (existing) return res.status(400).json({ message: 'Username hore ayaa loo qaatay' });
            data.username = cleanUsername;
        }
        if (password) {
            data.password = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data
        });

        res.json({ id: user.id, name: user.name, username: user.username });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE admin for a school (Accessible by owner and super_admin)
router.delete('/:id/admin/:userId', authenticateToken, authorizeRoles('super_admin', 'owner'), verifySchoolOwnership, async (req, res) => {
    try {
        const { userId } = req.params;
        const schoolId = req.params.id;

        // Verify the user is an admin of THIS school
        const user = await prisma.user.findFirst({
            where: { id: userId, schoolId, role: 'admin' }
        });

        if (!user) return res.status(404).json({ message: 'Admin lama helin dugsigan' });

        await prisma.user.delete({ where: { id: userId } });
        res.json({ message: 'Admin-ka waa la tirtiray' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET admins for a school (Accessible by owner and super_admin)
router.get('/:id/admins', authenticateToken, authorizeRoles('super_admin', 'owner'), verifySchoolOwnership, async (req, res) => {
    try {
        const admins = await prisma.user.findMany({
            where: { schoolId: req.params.id, role: 'admin' },
            select: { id: true, name: true, username: true, role: true, created_at: true }
        });
        res.json(admins);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET school dashboard stats (Accessible by owner and super_admin)
router.get('/:id/stats', authenticateToken, authorizeRoles('super_admin', 'owner'), verifySchoolOwnership, async (req, res) => {
    try {
        const schoolId = req.params.id;
        const [students, teachers, staff, classes, revenue] = await Promise.all([
            prisma.student.count({ where: { user: { schoolId } } }),
            prisma.teacher.count({ where: { user: { schoolId } } }),
            prisma.staff.count({ where: { user: { schoolId } } }),
            prisma.class.count({ where: { schoolId } }),
            prisma.payment.aggregate({
                where: { student: { user: { schoolId } } },
                _sum: { amount: true }
            })
        ]);
        res.json({
            students, teachers, staff, classes,
            revenue: revenue._sum.amount || 0
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST impersonate a school (Accessible by owner and super_admin)
router.post('/impersonate/:id', authenticateToken, authorizeRoles('super_admin', 'owner'), verifySchoolOwnership, async (req, res) => {
    try {
        const schoolId = req.params.id;
        const school = await prisma.school.findUnique({ where: { id: schoolId } });
        if (!school) return res.status(404).json({ message: 'School not found' });

        const jwt = require('jsonwebtoken');
        // Generate a token that looks like a school admin but has impersonation flags
        const payload = {
            id: req.user.id, // Keep the super admin's user ID
            username: req.user.username,
            role: 'admin',
            schoolId: schoolId,
            isImpersonating: true,
            originalRole: req.user.role,
            schoolName: school.name
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '2h' });

        res.json({ token, schoolName: school.name });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Public route to find the Group Owner (Super Admin) by shortcode
router.get('/by-code/:code', async (req, res) => {
    try {
        const normalized = req.params.code.trim().toUpperCase();

        console.log(`[Schools] Looking up branding by code: ${normalized}`);
        
        // 1. Check if the code belongs to a specific School (Column-safe lookup)
        let school = null;
        try {
            school = await prisma.school.findFirst({
                where: { shortCode: { equals: normalized, mode: 'insensitive' } },
                select: { id: true, name: true, logo: true, superAdminId: true, isActive: true }
            });
        } catch (colErr) {
            console.warn(`[Schools] School.shortCode column might be missing: ${colErr.message}`);
        }

        if (school) {
            // Find sibling schools if this school belongs to a super admin
            if (school.superAdminId) {
                const superAdmin = await prisma.user.findUnique({
                    where: { id: school.superAdminId },
                    select: { id: true, name: true, schoolName: true, isActive: true }
                });

                const schools = await prisma.school.findMany({
                    where: { superAdminId: school.superAdminId },
                    orderBy: { created_at: 'asc' },
                    select: { id: true, name: true, logo: true, shortCode: true, isActive: true }
                });
                
                // If there's 1 or more schools, return as super_admin type to trigger picker
                if (schools.length >= 1 && superAdmin) {
                    // Use the first school's name as the group/school name for display
                    const primarySchool = schools[0];
                    return res.json({
                        id: superAdmin.id,
                        name: superAdmin.name,
                        schoolName: superAdmin.schoolName || primarySchool.name,
                        logo: school.logo || primarySchool.logo,
                        shortCode: normalized,
                        type: 'super_admin',
                        isActive: superAdmin.isActive,
                        schools: schools
                    });
                }
            }

            return res.json({
                id: school.id,
                name: school.name,
                logo: school.logo,
                shortCode: normalized,
                type: 'school',
                isActive: school.isActive
            });
        }

        // 2. Fallback: Check if the code belongs to a Super Admin (Group login)
        const superAdmin = await prisma.user.findUnique({
            where: { shortCode: normalized },
            select: { id: true, name: true, schoolName: true, shortCode: true, role: true, isActive: true }
        });

        if (superAdmin && ['super_admin', 'owner'].includes(superAdmin.role.toLowerCase())) {
            const schools = await prisma.school.findMany({
                where: { superAdminId: superAdmin.id },
                orderBy: [
                    { shortCode: 'desc' }, // Put schools with codes first (assuming codes are not null)
                    { created_at: 'desc' }
                ],
                select: { id: true, name: true, logo: true, shortCode: true, isActive: true }
            });

            // Deduplicate by name, keeping the one with a shortCode or the most recent
            const uniqueSchoolsMap = new Map();
            for (const s of schools) {
                if (!uniqueSchoolsMap.has(s.name)) {
                    uniqueSchoolsMap.set(s.name, s);
                } else {
                    // If we already have one, but this one has a shortCode and the existing one doesn't, swap
                    const existing = uniqueSchoolsMap.get(s.name);
                    if (!existing.shortCode && s.shortCode) {
                        uniqueSchoolsMap.set(s.name, s);
                    }
                }
            }

            const schoolsList = Array.from(uniqueSchoolsMap.values());
            // Pick the logo from the first school that has one
            const firstLogoSchool = schoolsList.find(s => s.logo);
            return res.json({
                id: superAdmin.id,
                name: superAdmin.name,
                schoolName: superAdmin.schoolName || schoolsList[0]?.name || superAdmin.name,
                logo: firstLogoSchool?.logo || null,
                shortCode: superAdmin.shortCode,
                type: 'super_admin',
                isActive: superAdmin.isActive,
                schools: schoolsList
            });
        }

        return res.status(404).json({ message: 'Koodkan lama helin. Fadlan hubi koodka.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST upload school logo (Supabase Storage)
router.post('/upload-logo', authenticateToken, authorizeRoles('super_admin', 'owner'), upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
        
        const { uploadFile } = require('../services/supabaseStorage');
        const logoUrl = await uploadFile(req.file.buffer, req.file.mimetype, 'logos', req.file.originalname);
        res.json({ logoUrl });
    } catch (err) {
        console.error('[School Logo Upload Error]:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
