const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET /api/events - Get all events for the school
router.get('/', authenticateToken, async (req, res) => {
    try {
        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }

        // If schoolId is missing from token, recover from User record
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
          try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
          } catch (err) {
            console.error('Events Recovery Error:', err);
          }
        }

        if (!schoolId && !['super_admin', 'owner'].includes(req.user.role)) {
            return res.status(400).json({ message: 'School ID required' });
        }

        const events = await prisma.event.findMany({
            where: { schoolId },
            orderBy: { startDate: 'asc' }
        });
        res.json(events);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/events - Create a new event
router.post('/', authenticateToken, authorizeRoles('admin', 'super_admin'), async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        if (!schoolId) return res.status(403).json({ message: 'School ID required' });
        const { title, description, startDate, endDate, location, type } = req.body;

        if (!title || !startDate) {
            return res.status(400).json({ message: 'Title and Start Date are required' });
        }

        const event = await prisma.event.create({
            data: {
                title,
                description,
                startDate: new Date(startDate),
                endDate: endDate ? new Date(endDate) : null,
                location,
                type: type || 'event',
                schoolId
            }
        });
        res.status(201).json(event);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT /api/events/:id - Update an event
router.put('/:id', authenticateToken, authorizeRoles('admin', 'super_admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const schoolId = req.user.schoolId;
        const { title, description, startDate, endDate, location, type } = req.body;

        const existingEvent = await prisma.event.findFirst({
            where: { id, schoolId }
        });

        if (!existingEvent) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const updatedEvent = await prisma.event.update({
            where: { id },
            data: {
                title,
                description,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : null,
                location,
                type
            }
        });
        res.json(updatedEvent);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE /api/events/:id - Delete an event
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'super_admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const schoolId = req.user.schoolId;

        const existingEvent = await prisma.event.findFirst({
            where: { id, schoolId }
        });

        if (!existingEvent) {
            return res.status(404).json({ message: 'Event not found' });
        }

        await prisma.event.delete({ where: { id } });
        res.json({ message: 'Event deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
