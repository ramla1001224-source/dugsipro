const prisma = require('../prisma');

async function createOrUpdateNotification({ userId, title, message, type, groupingWindowMs = 300000 }) { // Default 5 mins
    try {
        if (!userId || !title || !message) return null;

        const windowStart = new Date(Date.now() - groupingWindowMs);
        
        // Find a recent notification of same type for this user
        const recent = await prisma.notification.findFirst({
            where: {
                userId,
                type: type || 'IN_APP',
                created_at: { gte: windowStart }
            },
            orderBy: { created_at: 'desc' }
        });

        if (recent && type === 'EXAM') {
            // Bundle exam notifications to avoid spamming 10+ messages at once
            let newMessage = `Natiijooyinka imtixaannada dhowr maaddo ah ayaa la soo dhajiyey. Fadlan nidaamka ka hubi.`;
            
            return await prisma.notification.update({
                where: { id: recent.id },
                data: {
                    title: 'Natiijooyinka Imtixaanka (Multi)',
                    message: newMessage,
                    status: 'sent',
                    created_at: new Date() // Refresh timestamp so it pops up again in UI
                }
            });
        }

        return await prisma.notification.create({
            data: {
                userId,
                title,
                message,
                type: type || 'IN_APP',
                status: 'sent'
            }
        });
    } catch (error) {
        console.error('Error in createOrUpdateNotification:', error);
        return null;
    }
}

async function createNotification({ userId, title, message, type }) {
    return createOrUpdateNotification({ userId, title, message, type, groupingWindowMs: 0 });
}

module.exports = {
    createNotification,
    createOrUpdateNotification
};

