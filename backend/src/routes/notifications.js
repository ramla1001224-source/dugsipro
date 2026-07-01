const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken } = require('../middleware/auth');

// Get user notifications (or school-wide audit log for admins)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { role } = req.user;
        let schoolId = req.user.schoolId;

        // If schoolId is missing from token, recover from User record
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
          try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
          } catch (err) {
            console.error('Notifications Recovery Error:', err);
          }
        }

        // Fetch exactly 5 latest notifications
        const notifications = await prisma.notification.findMany({
            where: { userId: req.user.id },
            include: { user: { select: { name: true, role: true } } },
            orderBy: { created_at: 'desc' },
            take: 5
        });

        // Asynchronously delete any older notifications from the database (User requested strict 5-retention)
        if (notifications.length === 5) {
            const fifthNotificationDate = notifications[4].created_at;
            prisma.notification.deleteMany({
                where: {
                    userId: req.user.id,
                    created_at: { lt: fifthNotificationDate }
                }
            }).catch(e => console.error("Error cleaning up old notifications:", e));
        }

        res.json(notifications);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get unread notification count
router.get('/unread-count', authenticateToken, async (req, res) => {
    try {
        const count = await prisma.notification.count({
            where: {
                userId: req.user.id,
                status: { in: ['sent', 'unread'] } // 'sent' is the default and acts as 'unread'
            }
        });
        res.json({ count });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Mark as read (Update status)
router.put('/:id/read', authenticateToken, async (req, res) => {
    try {
        await prisma.notification.update({
            where: { id: req.params.id, userId: req.user.id },
            data: { status: 'read' }
        });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
