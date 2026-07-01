const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const fs = require('fs');
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const logger = require('../utils/logger');


// Get all users (Authenticated only)
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    let schoolId = req.user.schoolId;

    // If schoolId is missing from token, recover from User record
    if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
      try {
        const u = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (u) schoolId = u.schoolId;
      } catch (err) {
        console.error('Users Recovery Error:', err);
      }
    }

    const where = schoolId ? { schoolId } : {};
    const users = await prisma.user.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        phone: true,
        created_at: true
      }
    });
    res.json(users);
  } catch (err) { next(err); }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, username: true, role: true, phone: true }
    });
    res.json(user);
  } catch (err) { next(err); }
});

// Update current user profile
router.put('/profile', authenticateToken, async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, phone }
    });
    res.json({ message: 'Profile updated', user: { name: user.name, phone: user.phone } });
  } catch (err) { next(err); }
});


router.post('/create', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res, next) => {
  try {
    const { name, username, password, role, phone } = req.body;
    if (!name || !username || !password || !role) return res.status(400).json({ message: 'Missing fields' });
    let schoolId = req.user.schoolId;
    if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
      try {
        const u = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (u) schoolId = u.schoolId;
      } catch (err) { console.error('User Create Recovery Error:', err); }
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { name, username, password: hashed, role, schoolId, phone: phone || null } });
    res.json({ id: user.id, username: user.username, role: user.role });
  } catch (err) { next(err); }
});

// Self change password
router.post('/change-password', authenticateToken, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ message: 'Missing fields' });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) return res.status(401).json({ message: 'Old password incorrect' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    res.json({ message: 'Password changed' });
  } catch (err) { next(err); }
});

// Admin: reset any user's password by username
router.post('/admin-reset', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res, next) => {
  try {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) return res.status(400).json({ message: 'Missing fields' });
    let schoolId = req.user.schoolId;
    if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
      try {
        const u = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (u) schoolId = u.schoolId;
      } catch (err) { console.error('Admin Reset Recovery Error:', err); }
    }
    const user = await prisma.user.findFirst({ where: { username, schoolId } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    logger.info('Admin %s reset password for %s', req.user.username, username);
    res.json({ message: 'Password reset' });
  } catch (err) { next(err); }
});

// Delete user
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res, next) => {
  try {
    let schoolId = req.user.schoolId;
    if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
      try {
        const u = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (u) schoolId = u.schoolId;
      } catch (err) { console.error('User Delete Recovery Error:', err); }
    }
    const user = await prisma.user.findFirst({ 
      where: { id: req.params.id, ...(schoolId ? { schoolId } : {}) } 
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ message: 'Cannot delete admin' });

    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'User deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
