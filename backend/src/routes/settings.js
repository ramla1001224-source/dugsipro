const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const https = require('https');
const http = require('http');

// Get all settings for the school
router.get('/', authenticateToken, async (req, res) => {
    try {
        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }
        const where = schoolId ? { schoolId } : { schoolId: 'NONE_AUTHORIZED' };

        const settings = await prisma.schoolSettings.findMany({ where });
        const obj = {};
        settings.forEach(s => { obj[s.key] = s.value; });
        res.json(obj);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Update setting for the school
router.put('/', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const entries = Object.entries(req.body);
    const schoolId = req.user.schoolId;
    try {
        await Promise.all(entries.map(([key, value]) =>
            prisma.schoolSettings.upsert({
                where: { key_schoolId: { key, schoolId } },
                update: { value: String(value) },
                create: { key, value: String(value), schoolId }
            })
        ));

        // Sync tuition fee to all classes if changed within the same school
        const tuitionFeeEntry = entries.find(([k]) => k === 'tuition_fee');
        if (tuitionFeeEntry) {
            const amount = Number(tuitionFeeEntry[1]);
            if (!isNaN(amount)) {
                const classes = await prisma.class.findMany({ where: { schoolId } });
                await Promise.all(classes.map(cls =>
                    prisma.feeStructure.upsert({
                        where: {
                            classId_name_frequency: {
                                classId: cls.id,
                                name: 'Tuition Fee',
                                frequency: 'monthly'
                            }
                        },
                        update: { amount },
                        create: {
                            classId: cls.id,
                            name: 'Tuition Fee',
                            amount,
                            frequency: 'monthly',
                            schoolId
                        }
                    })
                ));
            }
        }

        res.json({ message: 'Settings updated' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get grading scale for the school
router.get('/grading', authenticateToken, async (req, res) => {
    try {
        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }
        const where = schoolId ? { schoolId } : { schoolId: 'NONE_AUTHORIZED' };

        const scales = await prisma.gradingScale.findMany({
            where,
            orderBy: { minScore: 'desc' }
        });
        res.json(scales);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Set grading scale for the school
router.post('/grading', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const { scales } = req.body;
    const schoolId = req.user.schoolId;
    try {
        await prisma.gradingScale.deleteMany({ where: { schoolId } });
        const created = await Promise.all(scales.map(s =>
            prisma.gradingScale.create({
                data: {
                    grade: s.grade,
                    minScore: Number(s.minScore),
                    maxScore: Number(s.maxScore),
                    gpa: s.gpa ? Number(s.gpa) : null,
                    schoolId
                }
            })
        ));
        res.json(created);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Audit log for the school
router.get('/audit', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    try {
        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }
        const where = schoolId ? { user: { schoolId } } : { user: { schoolId: 'NONE_AUTHORIZED' } };

        const logs = await prisma.auditLog.findMany({
            where,
            include: { user: { select: { name: true, role: true } } },
            orderBy: { created_at: 'desc' },
            take: 100
        });
        res.json(logs);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Test SMS Gateway connection
router.post('/test-sms', authenticateToken, async (req, res) => {
    const { provider, apiUrl: gatewayUrl, apiKey, senderId, phone } = req.body;

    if (!gatewayUrl || !apiKey || !phone) {
        return res.status(400).json({ message: 'API URL, API Key, iyo phone number waa waajib.' });
    }

    // Build a test SMS payload (generic POST body matching common Somali telco formats)
    const payload = JSON.stringify({
        api_key: apiKey,
        sender_id: senderId || 'DUGSIPRO',
        to: phone,
        message: `Dugsi Pro: Tani waa fariin tijaabo ah oo ka socota ${(senderId || 'DUGSIPRO')}. Haddaad hesho fariintaan, gateway-ga ${(provider || '').toUpperCase()} si sax ah ayuu u shaqaynayaa.`
    });

    try {
        const urlObj = new URL(gatewayUrl);
        const lib = urlObj.protocol === 'https:' ? https : http;

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'Authorization': `Bearer ${apiKey}`,
                'X-API-Key': apiKey
            },
            timeout: 8000
        };

        const providerRes = await new Promise((resolve, reject) => {
            const request = lib.request(options, (response) => {
                let data = '';
                response.on('data', chunk => { data += chunk; });
                response.on('end', () => resolve({ status: response.statusCode, body: data }));
            });
            request.on('timeout', () => { request.destroy(); reject(new Error('Request timed out (8s)')); });
            request.on('error', reject);
            request.write(payload);
            request.end();
        });

        if (providerRes.status >= 200 && providerRes.status < 300) {
            return res.json({
                success: true,
                message: `${provider?.toUpperCase() || 'Provider'} gateway wuxuu ku jawaabay ${providerRes.status}. SMS la diray!`,
                statusCode: providerRes.status
            });
        } else {
            return res.status(400).json({
                success: false,
                message: `Provider-ku jawaabay status ${providerRes.status}. Hubi API key-gaaga.`,
                statusCode: providerRes.status,
                body: providerRes.body?.substring(0, 200)
            });
        }
    } catch (err) {
        // If the URL is unreachable (demo/test mode), return a simulated success
        if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.message?.includes('timeout')) {
            return res.status(502).json({
                success: false,
                message: `Xiriirka ${provider?.toUpperCase() || 'provider'} API ma gaari karin. Hubi URL-ka iyo internet-ka. (${err.code || 'TIMEOUT'})`,
            });
        }
        return res.status(500).json({ message: err.message });
    }
});

// Cleanup endpoints
router.delete('/cleanup/:type', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const { type } = req.params;
    const schoolId = req.user.schoolId;

    if (!schoolId) return res.status(400).json({ message: 'School ID is required' });

    try {
        if (type === 'zoom') {
            const result = await prisma.virtualClass.deleteMany({
                where: { schoolId }
            });
            return res.json({ message: `Successfully cleared ${result.count} virtual class records.` });
        } else if (type === 'homework') {
            // Get homework with attachments first to clean up files
            const homeworks = await prisma.homework.findMany({
                where: { schoolId },
                select: { attachmentUrl: true }
            });

            // Delete files from Storage (local or Supabase)
            const { deleteFile } = require('../services/supabaseStorage');
            homeworks.forEach(hw => {
                if (hw.attachmentUrl) {
                    deleteFile(hw.attachmentUrl).catch(err => {
                        console.error(`Error deleting file ${hw.attachmentUrl}:`, err);
                    });
                }
            });

            // Delete submissions first (Cascade handles this usually, but being explicit)
            await prisma.homeworkSubmission.deleteMany({
                where: { homework: { schoolId } }
            });

            // Delete homework records
            const result = await prisma.homework.deleteMany({
                where: { schoolId }
            });

            return res.json({ message: `Successfully cleared ${result.count} homework records and associated files.` });
        } else {
            return res.status(400).json({ message: 'Invalid cleanup type. Use "zoom" or "homework".' });
        }
    } catch (err) {
        console.error(`Cleanup error (${type}):`, err);
        res.status(500).json({ message: 'Qalad ayaa ka dhacay tirtirista xogta: ' + err.message });
    }
});

module.exports = router;

