const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get all vehicles
router.get('/vehicles', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    try {
        let schoolId = req.user.schoolId;

        // If schoolId is missing from token, recover from User record
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
          try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
          } catch (err) {
            console.error('Vehicles Recovery Error:', err);
          }
        }
        const vehicles = await prisma.vehicle.findMany({ 
            where: schoolId ? { schoolId } : { schoolId: 'NONE_AUTHORIZED' },
            include: { Routes: true } 
        });
        res.json(vehicles);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Create vehicle
router.post('/vehicles', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const { plateNumber, driverName, driverPhone, capacity } = req.body;
    if (!plateNumber) return res.status(400).json({ message: 'Plate number required' });
    const schoolId = req.user.schoolId;
    try {
        const vehicle = await prisma.vehicle.create({ 
            data: { 
                plateNumber, 
                driverName, 
                driverPhone, 
                capacity: capacity ? Number(capacity) : null,
                schoolId
            } 
        });
        res.json(vehicle);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get all routes
router.get('/routes', authenticateToken, async (req, res) => {
    try {
        let schoolId = req.user.schoolId;

        // If schoolId is missing from token, recover from User record
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
          try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
          } catch (err) {
            console.error('Routes Recovery Error:', err);
          }
        }
        const routes = await prisma.route.findMany({
            where: schoolId ? { schoolId } : { schoolId: 'NONE_AUTHORIZED' },
            include: { vehicle: true, Stops: { orderBy: { order: 'asc' } }, _count: { select: { Assignments: true } } }
        });
        res.json(routes);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Create route
router.post('/routes', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const { name, vehicleId, stops } = req.body;
    if (!name) return res.status(400).json({ message: 'Route name required' });
    const schoolId = req.user.schoolId;
    try {
        const route = await prisma.route.create({
            data: {
                name, vehicleId, schoolId,
                Stops: stops ? { create: stops.map((s, i) => ({ name: s.name, order: i + 1, time: s.time })) } : undefined
            },
            include: { Stops: true }
        });
        res.json(route);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Assign student to route
router.post('/assign', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const { studentId, routeId } = req.body;
    if (!studentId || !routeId) return res.status(400).json({ message: 'Student and route required' });
    const schoolId = req.user.schoolId;
    try {
        const assignment = await prisma.routeAssignment.upsert({
            where: { studentId },
            update: { routeId },
            create: { studentId, routeId, schoolId }
        });
        res.json(assignment);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
