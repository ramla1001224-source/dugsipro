const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { sendPushNotification } = require('../services/notificationService');

// GET /targets — returns classes (with sections) for the target UI
router.get('/targets', authenticateToken, authorizeRoles('admin', 'owner', 'super_admin'), async (req, res) => {
    try {
        let schoolId = req.user.schoolId;
        if (!schoolId) {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
        }
        if (!schoolId) return res.json({ classes: [] });
        const classes = await prisma.class.findMany({
            where: { schoolId },
            include: { Sections: { select: { id: true, name: true, shift: true } } },
            orderBy: { level: 'asc' }
        });
        res.json({ classes });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /  — all announcements for this school (filtered by target)
router.get('/', authenticateToken, async (req, res) => {
    try {
        let schoolId = req.user.schoolId;
        const userRole = (req.user.role || '').toLowerCase();
        
        if (!schoolId && !['super_admin', 'owner'].includes(userRole)) {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
        }

        if (!schoolId) return res.json([]);

        // For non-admins, only show announcements targeted at them
        let whereClause = { schoolId };
        
        if (!['admin', 'super_admin', 'owner'].includes(userRole)) {
            whereClause.Targets = {
                some: {
                    OR: [
                        { targetType: 'all' },
                        { targetType: userRole === 'teacher' ? 'teachers' : 
                                      userRole === 'student' ? 'students' : 
                                      userRole === 'parent' ? 'parents' : 'none' },
                        // For students/parents, also show class-targeted ones if we had that logic here
                        // But for now, school-wide + role-wide is the core
                    ]
                }
            };
        }

        const announcements = await prisma.announcement.findMany({
            where: whereClause,
            include: { Targets: true },
            orderBy: { created_at: 'desc' },
            take: 3 // Limit to 3 most recent announcements
        });

        // Asynchronously delete any older announcements for this school
        if (announcements.length === 5) {
            const fifthDate = announcements[4].created_at;
            prisma.announcement.deleteMany({
                where: {
                    schoolId,
                    created_at: { lt: fifthDate }
                }
            }).catch(e => console.error("Error cleaning up old announcements:", e));
        }

        return res.json(announcements);
    } catch (err) {
        return res.status(500).json({ message: 'Qalad ayaa ka dhacay keenista ogeysiisyada', error: err.message });
    }
});

// POST /  — create announcement + fire notifications
router.post('/', authenticateToken, authorizeRoles('admin', 'owner', 'super_admin'), async (req, res) => {
    const { title, content, priority, targets } = req.body;
    if (!title || !content) return res.status(400).json({ message: 'Title and content required' });
    let schoolId = req.user.schoolId;
    if (!schoolId) {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user) schoolId = user.schoolId;
    }
    if (!schoolId) return res.status(400).json({ message: 'School not found' });
    try {
        const announcement = await prisma.announcement.create({
            data: {
                title, content, priority: priority || 'normal', authorId: req.user.id, schoolId,
                Targets: targets ? {
                    create: targets.map(t => ({
                        targetType: t.targetType,
                        targetId: t.targetId || null,
                        classId: t.classId || null,
                        sectionId: t.sectionId || null
                    }))
                } : undefined
            },
            include: { Targets: true }
        });
        res.json(announcement);

        // ── Async notification dispatch ──
        (async () => {
            try {
                let targetTokens = [];
                let recipientUserIds = new Set();

                const schoolInfo = await prisma.school.findUnique({
                    where: { id: schoolId },
                    select: { institutionType: true }
                });
                const instLabel = (schoolInfo?.institutionType || 'school').toLowerCase() === 'machad' ? 'machadka' : 'schoolka';

                const collectUsers = (users) => {
                    users.forEach(u => {
                        recipientUserIds.add(u.id);
                        if (u.fcmToken) targetTokens.push(u.fcmToken);
                    });
                };

                if (!targets || targets.some(t => t.targetType === 'all')) {
                    // Send to everyone in the school
                    const users = await prisma.user.findMany({
                        where: { schoolId },
                        select: { id: true, fcmToken: true }
                    });
                    collectUsers(users);
                } else {
                    for (const t of targets) {
                        let users = [];
                        if (t.targetType === 'students') {
                            users = await prisma.user.findMany({ where: { schoolId, role: 'student' }, select: { id: true, fcmToken: true } });
                        } else if (t.targetType === 'teachers') {
                            users = await prisma.user.findMany({ where: { schoolId, role: 'teacher' }, select: { id: true, fcmToken: true } });
                        } else if (t.targetType === 'parents') {
                            users = await prisma.user.findMany({ where: { schoolId, role: 'parent' }, select: { id: true, fcmToken: true } });
                        } else if (t.targetType === 'class' && t.classId) {
                            users = await prisma.user.findMany({
                                where: { schoolId, Student: { classId: t.classId } },
                                select: { id: true, fcmToken: true }
                            });
                            // Also notify parents of students in this class
                            const studentIds = await prisma.student.findMany({ where: { classId: t.classId }, select: { userId: true } });
                            const parentLinks = await prisma.parentStudent.findMany({
                                where: { studentId: { in: studentIds.map(s => s.userId) } },
                                include: { parent: { include: { user: { select: { id: true, fcmToken: true } } } } }
                            });
                            parentLinks.forEach(pl => collectUsers([pl.parent.user]));
                        } else if (t.targetType === 'section' && t.sectionId) {
                            users = await prisma.user.findMany({
                                where: { schoolId, Student: { sectionId: t.sectionId } },
                                select: { id: true, fcmToken: true }
                            });
                        }
                        collectUsers(users);
                    }
                }

                const finalTitle = `📢 Ogeysiis ka yimid ${instLabel}: ${title}`;
                const finalBody = content.length > 120 ? content.substring(0, 117) + '...' : content;

                // Push notifications (mobile)
                const uniqueTokens = [...new Set(targetTokens.filter(Boolean))];
                if (uniqueTokens.length > 0) {
                    await sendPushNotification(uniqueTokens, finalTitle, finalBody, { type: 'announcement', id: announcement.id });
                }

                // In-app DB notifications (web + mobile bell)
                const recipients = Array.from(recipientUserIds);
                if (recipients.length > 0) {
                    // Create in batches of 100 to avoid DB limits
                    const batchSize = 100;
                    for (let i = 0; i < recipients.length; i += batchSize) {
                        const batch = recipients.slice(i, i + batchSize);
                        await prisma.notification.createMany({
                            data: batch.map(uId => ({
                                userId: uId,
                                title: finalTitle,
                                message: finalBody,
                                type: 'ANNOUNCEMENT',
                                status: 'sent'
                            })),
                            skipDuplicates: true
                        });
                    }
                }
                console.log(`[Announcement] Sent to ${recipients.length} users | ${uniqueTokens.length} push tokens`);
            } catch (err) {
                console.error('[AnnouncementNotify] Error:', err);
            }
        })();
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /:id
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'owner', 'super_admin'), async (req, res) => {
    try {
        let schoolId = req.user.schoolId;
        if (!schoolId) {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
        }
        const existing = await prisma.announcement.findFirst({ where: { id: req.params.id, schoolId } });
        if (!existing) return res.status(404).json({ message: 'Announcement not found' });
        await prisma.announcementTarget.deleteMany({ where: { announcementId: req.params.id } });
        await prisma.announcement.delete({ where: { id: req.params.id } });
        res.json({ message: 'Announcement deleted' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
