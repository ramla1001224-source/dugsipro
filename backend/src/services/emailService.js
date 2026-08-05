const nodemailer = require('nodemailer');
const prisma = require('../prisma');
const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;

/**
 * Creates a Nodemailer transporter using OAuth2
 */
const createTransporter = async (emailSetting) => {
    try {
        const oauth2Client = new OAuth2(
            emailSetting.clientId,
            emailSetting.clientSecret,
            "https://developers.google.com/oauthplayground"
        );

        oauth2Client.setCredentials({
            refresh_token: emailSetting.refreshToken
        });

        const accessToken = await new Promise((resolve, reject) => {
            oauth2Client.getAccessToken((err, token) => {
                if (err) {
                    reject("Failed to create access token: " + err.message);
                }
                resolve(token);
            });
        });

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: emailSetting.gmailAddress,
                accessToken,
                clientId: emailSetting.clientId,
                clientSecret: emailSetting.clientSecret,
                refreshToken: emailSetting.refreshToken
            }
        });

        return transporter;
    } catch (err) {
        throw new Error("Failed to configure email transporter: " + err.message);
    }
};

/**
 * Universal Email Service
 */
const sendEmail = async (toEmail, subject, html, options = {}) => {
    const { schoolId, studentId, type = 'generic' } = options;
    let result = { success: false, error: null };

    try {
        if (!schoolId) {
            result.error = "School ID is required for sending emails.";
            return result;
        }

        // Fetch Email Configuration from Database
        const emailSetting = await prisma.emailSetting.findUnique({
            where: { schoolId }
        });

        if (!emailSetting || !emailSetting.isActive) {
            result.error = "Email service is not configured or disabled for this school.";
            console.log(`[EMAIL ERROR] ${result.error}`);
            return result;
        }

        if (!emailSetting.clientId || !emailSetting.clientSecret || !emailSetting.refreshToken || !emailSetting.gmailAddress) {
            result.error = "Incomplete Gmail OAuth2 configuration.";
            console.log(`[EMAIL ERROR] ${result.error}`);
            return result;
        }

        console.log(`[EMAIL] Dispatching to ${toEmail} from ${emailSetting.gmailAddress}...`);

        let success = false;
        let errorMsg = null;

        try {
            const transporter = await createTransporter(emailSetting);

            const mailOptions = {
                from: emailSetting.gmailAddress,
                to: toEmail,
                subject: subject,
                html: html
            };

            await transporter.sendMail(mailOptions);
            success = true;
            console.log(`[EMAIL] Sent successfully to ${toEmail}`);
        } catch (err) {
            errorMsg = err.message || JSON.stringify(err);
            console.error(`[EMAIL Error] ${toEmail} | ${errorMsg}`);
            result.error = errorMsg;
        }

        // Log for usage tracking/history
        await prisma.emailLog.create({
            data: {
                schoolId: schoolId,
                studentId: studentId || null,
                toEmail,
                subject,
                type: type || 'general',
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear(),
                status: success ? 'sent' : 'failed',
                errorMsg: errorMsg ? errorMsg.substring(0, 200) : null
            }
        });

        return { success, error: result.error };

    } catch (err) {
        console.error('[Email Service Fatal Error]:', err);
        return { success: false, error: err.message };
    }
};

module.exports = { sendEmail, createTransporter };
