const prisma = require('../prisma');
const { sendSMS } = require('../services/smsService');

/**
 * Unified notification system to handle SMS, In-App, and potentially Email
 */
const createNotification = async ({ userId, title, message, type = 'IN_APP', sendSms = false }) => {
    try {
        // 1. Create In-App Notification entry
        const notification = await prisma.notification.create({
            data: {
                userId,
                title,
                message,
                type,
                status: 'sent'
            }
        });

        // 2. If SMS requested, trigger SMS service
        if (sendSms) {
            const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
            if (user && user.phone) {
                await sendSMS(user.phone, `${title}: ${message}`);
            }
        }

        return notification;
    } catch (error) {
        console.error('Notification Error:', error);
        return null;
    }
};

/**
 * Notify Parent(s) of a student for specific events
 */
const notifyParents = async (studentId, title, message, sendSms = false) => {
    const parentStudents = await prisma.parentStudent.findMany({
        where: { studentId },
        include: { parent: { include: { user: true } } }
    });

    return Promise.all(parentStudents.map(ps =>
        createNotification({
            userId: ps.parent.userId,
            title,
            message,
            type: sendSms ? 'SMS' : 'IN_APP',
            sendSms
        })
    ));
};

module.exports = { createNotification, notifyParents };
