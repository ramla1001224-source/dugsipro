const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin — supports both local file and Railway env variable
if (!admin.apps.length) {
    try {
        let credential;

        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            // ✅ Railway / Production: Read from environment variable
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            credential = admin.credential.cert(serviceAccount);
            console.log(`[NotificationService] Firebase Admin initialized. Project ID: ${serviceAccount.project_id}`);
        } else {
            // 🔄 Local development: Try to read from file
            const serviceAccountPath = path.join(__dirname, '../../service-account.json');
            if (fs.existsSync(serviceAccountPath)) {
                credential = admin.credential.cert(require(serviceAccountPath));
                console.log('[NotificationService] Firebase Admin initialized from service-account.json file.');
            } else {
                console.warn('[NotificationService] No Firebase credentials found. Push notifications will be disabled.');
                console.warn('[NotificationService] Set FIREBASE_SERVICE_ACCOUNT env variable on Railway to enable push notifications.');
            }
        }

        if (credential) {
            admin.initializeApp({ credential });
        }
    } catch (error) {
        console.error('[NotificationService] Failed to initialize Firebase Admin:', error.message);
    }
}

/**
 * Send push notification to multiple users
 * @param {string[]} userFCMTokens - Array of user FCM tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Optional data payload
 */
const sendPushNotification = async (userFCMTokens, title, body, data = {}) => {
    if (!admin.apps.length) return;

    // Filter out null/undefined tokens
    const tokens = userFCMTokens.filter(t => t && typeof t === 'string');
    console.log(`[NotificationService] Attempting to send to ${tokens.length} tokens. Title: "${title}"`);
    
    if (tokens.length === 0) {
        console.warn('[NotificationService] No valid FCM tokens provided. Skipping send.');
        return;
    }

    const message = {
        notification: { title, body },
        data: {
            ...Object.fromEntries(
                Object.entries(data).map(([key, value]) => [key, String(value)])
            ),
            title,
            body,
            click_action: 'FLUTTER_NOTIFICATION_CLICK'
        },
        tokens: tokens,
        android: {
            priority: 'high',
            notification: {
                title,
                body,
                channelId: 'dugsipro_high_importance',
                sound: 'default',
                priority: 'max',
                visibility: 'public'
            }
        },
        apns: {
            payload: {
                aps: {
                    alert: { title, body },
                    sound: 'default',
                    contentAvailable: true
                }
            }
        }
    };

    try {
        console.log(`[NotificationService] Sending to tokens:`, tokens);
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`[NotificationService] Multicast Result: ${response.successCount} success, ${response.failureCount} failure.`);
        
        if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    console.error(`[NotificationService] Token Error [${idx}] (${tokens[idx]}):`, resp.error.code, resp.error.message);
                }
            });
        }
    } catch (error) {
        console.error('[NotificationService] Critical Error sending notification:', error);
    }
};

module.exports = { sendPushNotification };
