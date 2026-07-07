const axios = require('axios');
const prisma = require('../prisma');

/**
 * Universal SMS Service for Somali Gateways
 * Tracks usage per school and logs history.
 */
const sendSMS = async (phoneNumber, message, options = {}) => {
    const { schoolId, studentId, type = 'generic' } = options;
    
    // Default response object
    let result = { success: false, messageId: null, error: null };
    
    try {
        // 1. Fetch school and check Super Admin permission (Optional if schoolId not provided)
        if (schoolId) {
            const school = await prisma.school.findUnique({
                where: { id: schoolId },
                include: { managedBy: true }
            });

            if (!school) {
                console.log(`[SMS ERROR] School ${schoolId} not found.`);
                result.error = `School ${schoolId} not found`;
                // Proceed with global configs if school not found? No, better log it.
            } else if (!school.managedBy) {
                console.log(`[SMS ERROR] School ${schoolId} has no assigned Super Admin.`);
                result.error = "No Super Admin assigned to this school node.";
            } else if (!school.managedBy.isSmsEnabled) {
                console.log(`[SMS ERROR] Super Admin '${school.managedBy.username}' is NOT authorized for SMS.`);
                result.error = "SMS Authorization is DISABLED for this school node in Registry Control.";
                return { success: false, error: result.error };
            }
        }

        // 2. Fetch Global Configuration from Database
        const configs = await prisma.globalSetting.findMany();
        const getConf = (k) => configs.find(c => c.key === k)?.value;

        // Detect active provider
        const activeProvider = getConf('sms_active_provider') || 'hormuud';
        
        const GLOBAL_URL = getConf(`sms_gateway_url_${activeProvider}`) || getConf('sms_gateway_url');
        const GLOBAL_KEY = getConf(`sms_api_key_${activeProvider}`) || getConf('sms_api_key');
        const GLOBAL_SENDER = getConf(`sms_sender_id_${activeProvider}`) || getConf('sms_sender_id') || 'DugsiPro';

        if (!GLOBAL_KEY || !GLOBAL_URL) {
            result.error = `Missing credentials for ${activeProvider}. Check SMS Gateway Config.`;
            console.log(`[SMS ERROR] ${result.error}`);
        }

        let success = false;
        console.log(`[SMS] Dispatching to ${phoneNumber} via ${activeProvider.toUpperCase()} Gateway...`);

        // Perform real API call if a key is configured
        if (GLOBAL_KEY && GLOBAL_URL && GLOBAL_URL.startsWith('http')) {
            try {
                // Formatting payload based on provider standards
                // Ensure phone number is clean (remove +, spaces, etc)
                let cleanPhone = phoneNumber.replace(/\D/g, '');
                
                // Auto-format for Somalia (+252) if missing
                if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
                    cleanPhone = '252' + cleanPhone.substring(1);
                } else if (cleanPhone.length === 9) {
                    cleanPhone = '252' + cleanPhone;
                }
                let payload = {};
                let finalUrl = GLOBAL_URL;
                let headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
                
                if (activeProvider === 'golis') {
                    // Golis Dhambaal v3 standard: Uses Bearer Token in Headers
                    headers['Authorization'] = `Bearer ${GLOBAL_KEY}`;

                    // Auto-append 'sms/send' if it looks like a base v3 URL
                    if (!finalUrl.toLowerCase().includes('/sms/send')) {
                        finalUrl = finalUrl.endsWith('/') ? `${finalUrl}sms/send` : `${finalUrl}/sms/send`;
                    }

                    payload = {
                        recipient: cleanPhone,
                        message: message,
                        sender_id: GLOBAL_SENDER
                    };
                } else {
                    // Hormuud / Generic standard
                    payload = {
                        apiKey: GLOBAL_KEY,
                        to: cleanPhone,
                        message: message,
                        sender: GLOBAL_SENDER
                    };
                }

                const response = await axios.post(finalUrl, payload, { headers, timeout: 15000 });
                console.log(`[SMS] ${activeProvider.toUpperCase()} request to: ${finalUrl}`);
                console.log(`[SMS] ${activeProvider.toUpperCase()} response:`, response.data);
                
                // Check for common success indicators in Somali gateways
                const resStr = JSON.stringify(response.data).toLowerCase();
                if (resStr.includes('success') || resStr.includes('sent') || resStr.includes('"true"') || response.data?.success === true || response.status === 200) {
                    success = true;
                } else {
                    result.error = `API Response: ${resStr}`;
                }
            } catch (err) {
                const errorMsg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
                console.error(`[SMS API Error - ${activeProvider}]:`, errorMsg);
                result.error = errorMsg;
            }
        } else {
            console.log(`[SMS MOCK] Provider: ${activeProvider}, To: ${phoneNumber}, Msg: ${message}`);
            success = true; // Mock success for testing environments
            result.error = "Mocked (No API Key/URL)";
        }

        // 3. Log for usage tracking/billing
        await prisma.smsLog.create({
            data: {
                schoolId: schoolId || 'SYSTEM',
                studentId: studentId || null,
                phoneNumber,
                message,
                type: type || 'general',
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear(),
                status: success ? 'sent' : 'failed'
            }
        });

        return { success, error: result.error };

    } catch (err) {
        console.error('[SMS Service Fatal Error]:', err);
        return { success: false, error: err.message };
    }
}
;

module.exports = { sendSMS };
