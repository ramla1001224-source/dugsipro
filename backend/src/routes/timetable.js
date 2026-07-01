const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get timetable (filtered by class/section or teacher)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { classId, sectionId, teacherId } = req.query;
        let schoolId = req.user.schoolId;

        // If schoolId is missing from token, recover from User record
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
          try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
          } catch (err) {
            console.error('Timetable Recovery Error:', err);
          }
        }

        if (!schoolId && !['super_admin', 'owner'].includes(req.user.role)) {
            return res.status(400).json({ message: 'School ID required' });
        }

        let where = schoolId ? { schoolId } : { schoolId: 'NONE_AUTHORIZED' };

        if (sectionId) {
            where.sectionId = sectionId;
        } else if (classId) {
            // Timetable model has no classId — look up sections that belong to this class
            const classSections = await prisma.section.findMany({
                where: { classId, ...(schoolId ? { schoolId } : {}) },
                select: { id: true }
            });
            const sectionIds = classSections.map(s => s.id);
            if (sectionIds.length === 0) return res.json([]);
            where.sectionId = { in: sectionIds };
        }

        if (req.query.shift) where.shift = req.query.shift;
        if (req.user.role === 'teacher') {
            const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
            if (teacher) where.teacherId = teacher.id;
        }
        if (req.user.role === 'student') {
            const enrollment = await prisma.enrollment.findFirst({
                where: { student: { userId: req.user.id }, isCurrent: true },
                select: { sectionId: true, classId: true, schoolId: true }
            });

            if (enrollment) {
                if (!schoolId) schoolId = enrollment.schoolId;
                if (enrollment.sectionId) {
                    where.sectionId = enrollment.sectionId;
                } else if (enrollment.classId) {
                    where.section = { classId: enrollment.classId };
                }
            }
        }
        if (teacherId) where.teacherId = teacherId;

        const timetable = await prisma.timetable.findMany({
            where,
            include: { section: { include: { class: true } }, subject: true, teacher: { include: { user: true } } },
            orderBy: [{ day: 'asc' }, { startTime: 'asc' }]
        });
        res.json(timetable);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Create timetable entry
router.post('/', authenticateToken, authorizeRoles('admin', 'owner', 'super_admin'), async (req, res) => {
    let { classId, sectionId, subjectId, teacherId, day, startTime, endTime, room, shift } = req.body;
    
    if (!subjectId || !day || !startTime || !endTime)
        return res.status(400).json({ message: 'subjectId, day, startTime, endTime are required' });

    if (!sectionId && !classId)
        return res.status(400).json({ message: 'Class or Section is required' });

    try {
        let schoolId = req.user.schoolId;
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
        }

        if (!sectionId && classId) {
            const firstSection = await prisma.section.findFirst({ where: { classId } });
            if (!firstSection) return res.status(400).json({ message: 'No sections found for this class' });
            sectionId = firstSection.id;
        }

        const entry = await prisma.timetable.create({
            data: {
                sectionId,
                subjectId,
                teacherId: teacherId || null,
                day,
                startTime,
                endTime,
                room: room || null,
                shift: shift || 'morning',
                schoolId: schoolId
            }
        });
        res.json(entry);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Bulk import: POST /api/timetable/bulk ────────────────────────────────────
// Body: { entries: [{ sectionId, subjectId, teacherId?, day, startTime, endTime, room?, shift }], clearFirst?: boolean }
router.post('/bulk', authenticateToken, authorizeRoles('admin', 'owner', 'super_admin'), async (req, res) => {
    const { entries, clearFirst } = req.body;
    if (!Array.isArray(entries) || entries.length === 0)
        return res.status(400).json({ message: 'entries array is required' });

    let schoolId = req.user.schoolId;
    if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
        try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
        } catch (err) {
            console.error('Timetable Bulk Recovery Error:', err);
        }
    }

    let inserted = 0;
    let skipped = 0;
    const errors = [];

    try {
        // Optional: clear existing entries per sectionId+shift before importing
        if (clearFirst) {
            const pairs = {};
            for (const e of entries) {
                const key = `${e.sectionId}__${e.shift || 'morning'}`;
                if (!pairs[key]) pairs[key] = { sectionId: e.sectionId, shift: e.shift || 'morning' };
            }
            for (const pair of Object.values(pairs)) {
                await prisma.timetable.deleteMany({
                    where: { sectionId: pair.sectionId, shift: pair.shift, schoolId }
                });
            }
        }

        for (const e of entries) {
            if (!e.sectionId || !e.subjectId || !e.day || !e.startTime || !e.endTime) {
                skipped++;
                errors.push(`Missing fields: ${JSON.stringify(e)}`);
                continue;
            }
            try {
                await prisma.timetable.create({
                    data: {
                        sectionId: e.sectionId,
                        subjectId: e.subjectId,
                        teacherId: e.teacherId || null,
                        day: e.day,
                        startTime: e.startTime,
                        endTime: e.endTime,
                        room: e.room || null,
                        shift: e.shift || 'morning',
                        schoolId
                    }
                });
                inserted++;
            } catch (err) {
                skipped++;
                errors.push(`${e.day}/${e.startTime} [${e.sectionId}]: ${err.message}`);
            }
        }

        res.json({ inserted, skipped, errors });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete timetable entry
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'owner', 'super_admin'), async (req, res) => {
    try {
        await prisma.timetable.delete({ where: { id: req.params.id } });
        res.json({ message: 'Entry deleted' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
