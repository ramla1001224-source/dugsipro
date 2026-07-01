const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const multer = require('multer');

const upload = multer({ 
    storage: multer.memoryStorage(), 
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// GET custom ad configuration
router.get('/custom', async (req, res) => {
    try {
        const adSetting = await prisma.globalSetting.findUnique({
            where: { key: 'custom_ad' }
        });
        if (adSetting && adSetting.value) {
            return res.json(JSON.parse(adSetting.value));
        }
        res.json(null);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST update custom ad configuration
router.post('/custom', authenticateToken, authorizeRoles('owner', 'super_admin'), async (req, res) => {
    try {
        const { title, subtitle, imageUrl, ctaText, linkUrl, isActive, useGoogle } = req.body;
        const value = JSON.stringify({ title, subtitle, imageUrl, ctaText, linkUrl, isActive, useGoogle });
        
        const adSetting = await prisma.globalSetting.upsert({
            where: { key: 'custom_ad' },
            update: { value },
            create: { key: 'custom_ad', value, description: 'Custom Ad Configuration' }
        });

        res.json({ message: 'Custom Ad updated successfully', ad: JSON.parse(adSetting.value) });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST upload ad image
router.post('/upload-image', authenticateToken, authorizeRoles('owner', 'super_admin'), upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const { uploadFile } = require('../services/supabaseStorage');
        const imageUrl = await uploadFile(req.file.buffer, req.file.mimetype, 'ads', req.file.originalname);
        
        res.json({ imageUrl });
    } catch (err) {
        console.error('[Ad Image Upload Error]:', err);
        res.status(500).json({ message: 'Error uploading image: ' + err.message });
    }
});

module.exports = router;
