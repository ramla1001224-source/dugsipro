const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { sendEmail, createTransporter } = require('../services/emailService');

// ==================== GET EMAIL SETTINGS ====================
router.get('/settings', authenticateToken, authorizeRoles('admin', 'owner', 'super_admin'), async (req, res) => {
    try {
        let schoolId = req.user.schoolId;
        if ((req.user.role === 'super_admin' || req.user.role === 'owner') && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }

        if (!schoolId) return res.status(400).json({ message: 'School ID required' });

        let settings = await prisma.emailSetting.findUnique({
            where: { schoolId }
        });

        if (!settings) {
            settings = {
                gmailAddress: '',
                clientId: '',
                clientSecret: '',
                refreshToken: '',
                isActive: false
            };
        }

        res.json(settings);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ==================== SAVE EMAIL SETTINGS ====================
router.post('/settings', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    try {
        let schoolId = req.user.schoolId;
        const { gmailAddress, clientId, clientSecret, refreshToken, isActive } = req.body;

        if (!schoolId) return res.status(400).json({ message: 'School ID required' });

        const settings = await prisma.emailSetting.upsert({
            where: { schoolId },
            update: {
                gmailAddress,
                clientId,
                clientSecret,
                refreshToken,
                isActive
            },
            create: {
                schoolId,
                gmailAddress,
                clientId,
                clientSecret,
                refreshToken,
                isActive
            }
        });

        res.json({ message: 'Email settings saved successfully', settings });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ==================== TEST EMAIL CONNECTION ====================
router.post('/test', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    try {
        const { toEmail, gmailAddress, clientId, clientSecret, refreshToken } = req.body;

        if (!toEmail || !gmailAddress || !clientId || !clientSecret || !refreshToken) {
            return res.status(400).json({ message: 'All email settings and a test email address are required' });
        }

        const emailSetting = {
            gmailAddress,
            clientId,
            clientSecret,
            refreshToken
        };

        const transporter = await createTransporter(emailSetting);

        const mailOptions = {
            from: gmailAddress,
            to: toEmail,
            subject: 'Test Email - Dugsi Pro',
            html: '<p>Haddad fariintaan aragto, Email System-ka Dugsi Pro si fiican ayuu u shaqaynayaa!</p>'
        };

        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: 'Test email sent successfully!' });
    } catch (err) {
        console.error('Test Email Error:', err);
        res.status(500).json({ success: false, message: 'Failed to send test email: ' + err.message });
    }
});

// ==================== SEND BULK EMAILS TO PARENTS ====================
router.post('/bulk-parents', authenticateToken, authorizeRoles('admin', 'owner', 'super_admin'), async (req, res) => {
    try {
        const { classId, sectionId, subject, message } = req.body;
        let schoolId = req.user.schoolId;

        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
        }

        if (!schoolId) return res.status(400).json({ message: 'School ID required' });
        if (!classId || !subject || !message) {
            return res.status(400).json({ message: 'classId, subject, and message are required' });
        }

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
                                parent: {
                                    include: {
                                        user: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (enrollments.length === 0) {
            return res.status(404).json({ message: 'No active students found for this class/section' });
        }

        const emailJobs = [];
        const processedEmails = new Set();

        enrollments.forEach(enc => {
            const student = enc.student;

            if (student.Parents && student.Parents.length > 0) {
                student.Parents.forEach(ps => {
                    const parent = ps.parent;
                    const email = parent?.email || parent?.user?.email;
                    
                    if (email) {
                        const dedupeKey = `${email}:${subject}`;
                        if (!processedEmails.has(dedupeKey)) {
                            emailJobs.push({
                                toEmail: email,
                                studentName: student.user.name,
                                studentId: student.id
                            });
                            processedEmails.add(dedupeKey);
                        }
                    }
                });
            }
        });

        if (emailJobs.length === 0) {
            return res.status(400).json({ message: 'No parents with valid email addresses found' });
        }

        // Ideally this should use a queue for a large number of emails, 
        // but we'll do it synchronously or in background async for now
        
        let sentCount = 0;
        let failedCount = 0;

        // Process emails asynchronously so we don't block the HTTP response
        setImmediate(async () => {
            for (const job of emailJobs) {
                try {
                    // Simple personalization
                    const personalizedMessage = message.replace(/{student_name}/g, job.studentName);
                    
                    await sendEmail(job.toEmail, subject, personalizedMessage, {
                        schoolId,
                        studentId: job.studentId,
                        type: 'bulk_notice'
                    });
                    sentCount++;
                } catch (e) {
                    failedCount++;
                    console.error(`Failed to send bulk email to ${job.toEmail}:`, e);
                }
            }
            console.log(`[BULK EMAIL COMPLETED] Sent: ${sentCount}, Failed: ${failedCount}`);
        });

        res.json({
            success: true,
            message: `Queued ${emailJobs.length} emails for processing.`,
            count: emailJobs.length
        });

    } catch (err) {
        console.error('Bulk Parent Email Error:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
