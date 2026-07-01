const cron = require('node-cron');
const { performBackup } = require('../services/backupService');

const startBackupJob = () => {
    /**
     * Schedule the backup job to run every night at 2:00 AM
     * Cron format: 'minute hour day_of_month month day_of_week'
     * '0 2 * * *' means 00:02 every day
     */
    cron.schedule('0 2 * * *', async () => {
        console.log(`[BACKUP JOB] ${new Date().toISOString()} - Starting scheduled backup...`);
        try {
            const result = await performBackup();
            if (result.success) {
                console.log(`[BACKUP JOB] ${new Date().toISOString()} - Backup completed successfully. File ID: ${result.fileId}`);
            }
        } catch (error) {
            console.error(`[BACKUP JOB] ${new Date().toISOString()} - Backup job failed:`, error);
            
            try {
                const { logError } = require('../services/errorLoggerService');
                const prisma = require('../prisma');
                const { sendPushNotification } = require('../services/notificationService');

                // 1. Log to DB
                await logError({
                    message: `Scheduled Backup Failed: ${error.message}`,
                    stack: error.stack,
                    source: 'backup_job'
                });

                // 2. Alert the Owner via Push Notification
                const owners = await prisma.user.findMany({
                    where: { role: 'owner', fcmToken: { not: null } },
                    select: { fcmToken: true }
                });

                if (owners.length > 0) {
                    const tokens = owners.map(o => o.fcmToken);
                    await sendPushNotification(
                        tokens,
                        '⚠️ Backup System Alert',
                        'Nidaamka backup-ka Google Drive wuxuu ku fashilmay inuu ordo caawa. Fadlan hubi token-ka Google.',
                        { type: 'system_alert' }
                    );
                    console.log(`[BACKUP JOB] Sent alert to ${owners.length} owner(s).`);
                }
            } catch (logErr) {
                console.error('[BACKUP JOB] Failed to log/notify backup error:', logErr.message);
            }
        }
    });

    console.log('[CRON] Google Drive nightly backup job scheduled for 2:00 AM.');
};

module.exports = startBackupJob;
