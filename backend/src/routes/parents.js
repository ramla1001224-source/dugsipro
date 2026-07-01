const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const bcrypt = require('bcrypt');
const responseHelper = require('../utils/responseHelper');
const cacheMiddleware = require('../middleware/cacheMiddleware');
const crypto = require('crypto');
const { resolveStudentTuitionFee } = require('../utils/paymentHelper');
const multer = require('multer');
const XLSX = require('xlsx');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });


const formatSomaliNumber = (phoneNumber) => {
    if (!phoneNumber) return phoneNumber;
    let cleaned = phoneNumber.replace(/\D/g, ''); // Only digits
    if (cleaned.startsWith('0')) {
        cleaned = '252' + cleaned.substring(1);
    } else if (!cleaned.startsWith('252') && (cleaned.startsWith('90') || cleaned.startsWith('61') || cleaned.startsWith('68') || cleaned.startsWith('77')) && cleaned.length === 9) {
        cleaned = '252' + cleaned;
    }
    return cleaned;
};


// Get all parents
router.get('/', authenticateToken, authorizeRoles('admin', 'super_admin', 'owner'), async (req, res) => {
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
            console.error('Parents Recovery Error:', err);
          }
        }
        const parents = await prisma.parent.findMany({
            where: schoolId ? { user: { schoolId } } : { user: { schoolId: 'NONE_AUTHORIZED' } },
            include: { user: true, Children: { include: { student: { include: { user: true } } } } }
        });
        res.json(parents);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Create parent account
router.post('/', authenticateToken, authorizeRoles('admin', 'super_admin', 'owner'), async (req, res) => {
    const { name, username, password, phone, address, occupation, studentIds } = req.body;
    if (!name || !username || !password) return res.status(400).json({ message: 'Name, username and password required' });
    try {
        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && (req.query.schoolId || req.body.schoolId)) {
            schoolId = req.query.schoolId || req.body.schoolId;
        }

        // If schoolId is missing from token, recover from User record
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
          try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
          } catch (err) {
            console.error('Parent Create Recovery Error:', err);
          }
        }
        const formattedPhone = formatSomaliNumber(phone);
        const hashed = await bcrypt.hash(password, 10);

        // Check username is unique within THIS SCHOOL only
        const existingUser = await prisma.user.findFirst({
            where: { username: username.toLowerCase(), schoolId }
        });
        if (existingUser) {
            return res.status(400).json({ message: `Username '${username}' waxaa isticmaalaya qof kale dugsigu (${existingUser.name}).` });
        }

        if (studentIds && studentIds.length > 0) {
            const validStudents = await prisma.student.count({
                where: { id: { in: studentIds }, ...(schoolId ? { user: { schoolId } } : {}) }
            });
            if (validStudents !== studentIds.length) {
                return res.status(403).json({ message: 'One or more students not found in your school' });
            }
        }
        
        const user = await prisma.user.create({ data: { name, username, password: hashed, role: 'parent', schoolId } });
        const parent = await prisma.parent.create({
            data: {
                userId: user.id, phone: formattedPhone, address, occupation,
                Children: studentIds ? { create: studentIds.map(sid => ({ studentId: sid })) } : undefined
            },
            include: { user: true, Children: true }
        });
        res.json(parent);
    } catch (err) {
        if (err.code === 'P2002') return res.status(400).json({ message: 'Username is already taken' });
        res.status(500).json({ message: err.message });
    }
});

// Link child to parent
router.post('/link-child', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const { parentId, studentId, relation } = req.body;
    const schoolId = req.user.schoolId;
    try {
        // Verify both parent and student belong to the same school
        const [parent, student] = await Promise.all([
            prisma.parent.findFirst({ where: { id: parentId, ...(schoolId ? { user: { schoolId } } : {}) } }),
            prisma.student.findFirst({ where: { id: studentId, ...(schoolId ? { user: { schoolId } } : {}) } })
        ]);

        if (!parent || !student) {
            return res.status(403).json({ message: 'Parent or Student not found in your school' });
        }

        const link = await prisma.parentStudent.upsert({
            where: { parentId_studentId: { parentId, studentId } },
            update: { relation },
            create: { parentId, studentId, relation }
        });
        res.json(link);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get my children (for parents)
router.get('/my-children', authenticateToken, authorizeRoles('parent'), cacheMiddleware(60), async (req, res) => {
    try {
        const today = new Date();
        const month = today.getMonth() + 1;
        const year = today.getFullYear();

        const parentRecord = await prisma.parent.findUnique({
            where: { userId: req.user.id },
            include: { Children: true }
        });
        
        if (parentRecord) {
            for (const child of parentRecord.Children) {
                try {
                    // Check if record exists first to avoid constraint errors
                    const existing = await prisma.monthlyPaymentRecord.findFirst({
                        where: {
                            studentId: child.studentId,
                            month: month,
                            year: year
                        }
                    });

                    if (!existing) {
                        await prisma.monthlyPaymentRecord.create({
                            data: {
                                studentId: child.studentId,
                                month: month,
                                year: year,
                                status: 'unpaid'
                            }
                        });
                    }
                } catch (e) {
                    console.error(`[DEBUG-PARENTS] Failed to ensure payment record for child ${child.studentId}:`, e.message);
                }
            }
        }

        const parent = await prisma.parent.findUnique({
            where: { userId: req.user.id },
            include: {
                Children: {
                    include: {
                        student: {
                            include: {
                                user: { select: { name: true } },
                                clss: true,
                                section: {
                                    include: {
                                        FeeStructures: {
                                            where: { OR: [{ name: 'Tuition Fee' }, { name: 'Waxbarashada (Tuition)' }] },
                                            take: 1
                                        }
                                    }
                                },
                                Enrollments: {
                                    where: { isCurrent: true },
                                    include: { 
                                        clss: true, 
                                        section: {
                                            include: {
                                                FeeStructures: {
                                                    where: { OR: [{ name: 'Tuition Fee' }, { name: 'Waxbarashada (Tuition)' }] },
                                                    take: 1
                                                }
                                            }
                                        } 
                                    }
                                },
                                MonthlyPaymentRecord: {
                                    where: { month, year },
                                    select: {
                                        id: true,
                                        studentId: true,
                                        month: true,
                                        year: true,
                                        status: true,
                                        updatedAt: true
                                        // amountPaid and paymentDate are omitted as they are missing in the current DB
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        console.log(`[DEBUG-V2] Fetching children for USER ID: ${req.user.id} (${req.user.username})`);
        if (!parent) {
            return res.status(404).json({ message: 'Parent record not found' });
        }
        
        const children = await Promise.all(parent.Children.map(async (c) => {
            if (!c.student) return null;
            const enrollment = c.student.Enrollments?.[0];
            
            // Prioritize enrollment for class/section info (handles promoted students correctly)
            const resolvedClass = enrollment?.clss || c.student.clss;
            const resolvedSection = enrollment?.section || c.student.section;
            const resolvedClassId = enrollment?.classId || c.student.classId;
            const resolvedSectionId = enrollment?.sectionId || c.student.sectionId;
            const fallbackEnrollment = enrollment || {
                classId: c.student.classId,
                sectionId: c.student.sectionId,
                schoolId: c.student.user?.schoolId
            };
            
            const expectedFee = await resolveStudentTuitionFee(prisma, fallbackEnrollment, c.student);

            return {
                ...c.student,
                // Override class/section with enrollment data
                clss: resolvedClass,
                section: resolvedSection,
                classId: resolvedClassId,
                sectionId: resolvedSectionId,
                enrollmentId: enrollment?.id || null,
                academicYearId: enrollment?.academicYearId || null,
                expectedFee,
                currentMonthStatus: c.student.MonthlyPaymentRecord[0]?.status || 'unpaid'
            };
        }));
        
        const filteredChildren = children.filter(Boolean);

        // Resolve schoolId: Prioritize token, then parent's user record, then first child
        let resolvedSchoolId = req.user.schoolId;
        if (!resolvedSchoolId) {
            const parentUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { schoolId: true } });
            resolvedSchoolId = parentUser?.schoolId || parent.Children[0]?.student?.schoolId || parent.Children[0]?.student?.user?.schoolId;
        }

        const currentYearRecord = await prisma.academicYear.findFirst({
            where: { 
                schoolId: resolvedSchoolId || 'NONE', 
                isCurrent: true 
            }
        });

        return res.json({
            data: filteredChildren,
            currentYear: currentYearRecord
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get parents with unpaid children for reminders
router.get('/unpaid-reminders', authenticateToken, authorizeRoles('admin', 'accountant'), async (req, res) => {
    try {
        const today = new Date();
        const month = today.getMonth() + 1;
        const year = today.getFullYear();

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
            console.error('Unpaid Reminders Recovery Error:', err);
          }
        }
        const parents = await prisma.parent.findMany({
            where: schoolId ? { user: { schoolId } } : { user: { schoolId: 'NONE_AUTHORIZED' } },
            include: {
                user: { select: { name: true } },
                Children: {
                    include: {
                        student: {
                            include: {
                                user: { select: { name: true } },
                                MonthlyPaymentRecord: {
                                    where: { month, year },
                                    select: { id: true, studentId: true, month: true, year: true, status: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        const unpaidParents = parents.map(p => {
            const unpaidStudents = p.Children
                .filter(c => {
                    const status = c.student.MonthlyPaymentRecord[0]?.status || 'unpaid';
                    return status === 'unpaid';
                })
                .map(c => c.student.user.name);

            if (unpaidStudents.length > 0) {
                return {
                    id: p.id,
                    name: p.user.name,
                    phone: p.phone,
                    unpaidStudents
                };
            }
            return null;
        }).filter(p => p !== null);

        res.json(unpaidParents);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update parent account
router.put('/:id', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const { id } = req.params;
    const { name, username, password, phone, address, occupation, studentIds } = req.body;

    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Get Parent to find userId
            const parent = await tx.parent.findUnique({ where: { id }, include: { user: true } });
            if (!parent) throw new Error('Parent not found');

            const userData = {};
            if (name) userData.name = name;
            
            // Check and update username
            if (username && username.toLowerCase() !== parent.user.username.toLowerCase()) {
                const existingUser = await tx.user.findFirst({
                    where: { username: username.toLowerCase(), schoolId: parent.user.schoolId }
                });
                if (existingUser) {
                    throw new Error(`Username '${username}' waxaa isticmaalaya qof kale dugsigu (${existingUser.name}).`);
                }
                userData.username = username.toLowerCase();
            }

            // Update password if provided
            if (password && password.trim() !== '') {
                userData.password = await bcrypt.hash(password, 10);
            }

            // 2. Update User
            if (Object.keys(userData).length > 0) {
                await tx.user.update({
                    where: { id: parent.userId },
                    data: userData
                });
            }

            // 3. Update Parent Info
            const updatedParent = await tx.parent.update({
                where: { id },
                data: { phone: formatSomaliNumber(phone), address, occupation },
                include: { user: true }
            });

            // 4. Sync Children if studentIds provided
            if (studentIds && Array.isArray(studentIds)) {
                // Remove old links
                await tx.parentStudent.deleteMany({ where: { parentId: id } });
                // Create new links
                if (studentIds.length > 0) {
                    await tx.parentStudent.createMany({
                        data: studentIds.map(sid => ({ parentId: id, studentId: sid }))
                    });
                }
            }

            return updatedParent;
        });

        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete parent account
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const { id } = req.params;
    try {
        const parent = await prisma.parent.findUnique({ where: { id } });
        if (!parent) return res.status(404).json({ message: 'Parent not found' });

        await prisma.$transaction([
            prisma.parentStudent.deleteMany({ where: { parentId: id } }),
            prisma.parent.delete({ where: { id } }),
            prisma.user.delete({ where: { id: parent.userId } })
        ]);

        res.json({ message: 'Parent deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Bulk WhatsApp Fee Reminders
router.post('/bulk-whatsapp-reminders', authenticateToken, authorizeRoles('admin', 'accountant'), async (req, res) => {
    try {
        const today = new Date();
        const month = today.getMonth() + 1;
        const year = today.getFullYear();

        const schoolId = req.user.schoolId;
        const parents = await prisma.parent.findMany({
            where: { user: { schoolId } },
            include: {
                user: { select: { name: true } },
                Children: {
                    include: {
                        student: {
                            include: {
                                user: { select: { name: true } },
                                MonthlyPaymentRecord: { 
                                    where: { month, year },
                                    select: { id: true, studentId: true, month: true, year: true, status: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        const sent = [];
        parents.forEach(p => {
            const unpaid = p.Children.filter(c => (c.student.MonthlyPaymentRecord[0]?.status || 'unpaid') === 'unpaid');
            if (unpaid.length > 0 && p.phone) {
                const message = `Salaam ${p.user.name}, reminder: Fees for ${unpaid.map(c => c.student.user.name).join(', ')} for ${today.toLocaleString('default', { month: 'long' })} are still unpaid. Please clear them soon.`;
                // Logic to trigger real WhatsApp API would go here
                sent.push({ phone: p.phone, message });
            }
        });

        res.json({ message: `Queued ${sent.length} notifications`, notifications: sent });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Daily Attendance Summary to Parents via WhatsApp
router.post('/daily-attendance-summary', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    try {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

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
            console.error('Daily Attendance Summary Recovery Error:', err);
          }
        }
        const parents = await prisma.parent.findMany({
            where: schoolId ? { user: { schoolId } } : { user: { schoolId: 'NONE_AUTHORIZED' } },
            include: {
                user: { select: { name: true } },
                Children: {
                    include: {
                        student: {
                            include: {
                                user: { select: { name: true } },
                                Attendance: { where: { date: today } }
                            }
                        }
                    }
                }
            }
        });

        const notifications = [];
        parents.forEach(p => {
            if (!p.phone) return;
            p.Children.forEach(c => {
                const att = c.student.Attendance[0];
                const status = att ? att.status : 'Unmarked';
                const message = `Salaam ${p.user.name}, your child ${c.student.user.name}'s attendance for today (${today.toDateString()}) is: ${status}.`;
                notifications.push({ phone: p.phone, message });
            });
        });

        res.json({ message: `Generated ${notifications.length} attendance updates`, notifications });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ==================== DOWNLOAD EXCEL TEMPLATE ====================
router.get('/template', authenticateToken, authorizeRoles('admin', 'owner'), (req, res) => {
    const wb = XLSX.utils.book_new();
    const headers = [['Name', 'Phone', 'Occupation', 'Student IDs (Optional)']];
    headers.push(['Mohamed Ahmed', '0612345678', 'Teacher', 'S-1234, S-5678']);
    const ws = XLSX.utils.aoa_to_sheet(headers);

    ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Parents');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=parents_template.xlsx');
    res.send(buffer);
});

// ==================== BULK IMPORT FROM EXCEL ====================
router.post('/import', authenticateToken, authorizeRoles('admin', 'owner'), upload.single('file'), async (req, res) => {
    const schoolId = req.user.schoolId;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    try {
        const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);
        
        if (!rows.length) return res.status(400).json({ message: 'Excel file is empty' });

        const results = { success: 0, errors: [] };
        const defaultPassword = '123';

        for (const [index, row] of rows.entries()) {
            const rowNum = index + 2;
            const name = row.Name || row['Magaca'] || row['Full Name'];
            const phone = String(row.Phone || row['Telefoonka'] || row['Telefoon'] || '').trim();
            const occupation = row.Occupation || row['Shaqada'];
            const studentIdsRaw = row['Student IDs (Optional)'] || row['Carruurta'] || row['Students'];

            if (!name) {
                results.errors.push({ row: rowNum, message: `Laf-dhabaatada ${rowNum}: Magaca waalidka waa maqan yahay.` });
                continue;
            }

            try {
                // Generate username from phone or random string
                const username = phone ? phone.replace(/\+/g, '') : `p${Math.floor(100000 + Math.random() * 900000)}`;
                const hashed = await bcrypt.hash(defaultPassword, 10);

                // Check for duplicate username in this school
                const existing = await prisma.user.findFirst({
                    where: { username: username.toLowerCase(), schoolId }
                });
                if (existing) {
                    results.errors.push({ row: rowNum, message: `Laf-dhabaatada ${rowNum}: Username '${username}' mar hore ayaa la isticmaalay.` });
                    continue;
                }

                // Find students to link
                let linkStudentIds = [];
                if (studentIdsRaw) {
                    const codes = String(studentIdsRaw).split(/[,;]/).map(c => c.trim()).filter(Boolean);
                    const students = await prisma.student.findMany({
                        where: { student_id: { in: codes }, user: { schoolId } },
                        select: { id: true }
                    });
                    linkStudentIds = students.map(s => s.id);
                }

                await prisma.$transaction(async (tx) => {
                    const user = await tx.user.create({
                        data: {
                            name,
                            username: username.toLowerCase(),
                            password: hashed,
                            role: 'parent',
                            schoolId
                        }
                    });

                    await tx.parent.create({
                        data: {
                            userId: user.id,
                            phone: formatSomaliNumber(phone),
                            occupation,
                            Children: {
                                create: linkStudentIds.map(sid => ({ studentId: sid }))
                            }
                        }
                    });
                });
                results.success++;
            } catch (err) {
                results.errors.push({ row: rowNum, message: `Laf-dhabaatada ${rowNum}: ${err.message}` });
            }
        }

        res.json({
            message: `Soo gelinta waa dhammaatay: ${results.success} waalid ayaa lagu daray.`,
            success: results.success,
            total: rows.length,
            errors: results.errors
        });
    } catch (err) {
        console.error('Parents Import Error:', err);
        res.status(500).json({ message: `Import failed: ${err.message}` });
    }
});

module.exports = router;
