const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken } = require('../middleware/auth');

// GET all sections (filtered by classId and schoolId)
router.get('/', authenticateToken, async (req, res) => {
  const { classId } = req.query;
  let schoolId = req.user.schoolId;
  if ((req.user.role === 'super_admin' || req.user.role === 'owner') && req.query.schoolId) {
    schoolId = req.query.schoolId;
  }

  // If schoolId is missing from token, recover from User record
  if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (user) schoolId = user.schoolId;
    } catch (err) {
      console.error('Sections Recovery Error:', err);
    }
  }

  if (!schoolId && !['super_admin', 'owner'].includes(req.user.role)) {
    return res.status(400).json({ message: 'School ID required' });
  }

  try {
    const sections = await prisma.section.findMany({
      where: {
        schoolId,
        ...(classId ? { classId } : {})
      },
      include: {
        teacher: { include: { user: true } },
        _count: { select: { Students: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(sections);
  } catch (err) {
    console.error('Error fetching sections:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
