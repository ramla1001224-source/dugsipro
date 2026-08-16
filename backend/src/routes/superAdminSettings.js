const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get Super Admin Custom SMS API Settings
router.get('/sms-api', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                customSmsApiKey: true,
                customSmsApiUrl: true,
                customSmsSenderId: true,
                customSmsProvider: true,
                useCustomSmsApi: true,
            }
        });

        if (!user) return res.status(404).json({ message: 'User not found' });

        res.json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update Super Admin Custom SMS API Settings
router.put('/sms-api', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
    try {
        const {
            customSmsApiKey,
            customSmsApiUrl,
            customSmsSenderId,
            customSmsProvider,
            useCustomSmsApi
        } = req.body;

        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                customSmsApiKey,
                customSmsApiUrl,
                customSmsSenderId,
                customSmsProvider: customSmsProvider || 'hormuud',
                useCustomSmsApi: !!useCustomSmsApi
            }
        });

        res.json({ message: 'SMS API Settings updated successfully', user: updatedUser });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
