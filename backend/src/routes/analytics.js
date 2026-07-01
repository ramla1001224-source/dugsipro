const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET /api/analytics/student-predictions
router.get('/student-predictions', authenticateToken, authorizeRoles('admin', 'teacher', 'owner'), async (req, res) => {
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
            console.error('Analytics Recovery Error:', err);
          }
        }

        if (!schoolId && !['super_admin', 'owner'].includes(req.user.role)) {
            return res.status(400).json({ message: 'School ID is required' });
        }

        // Fetch only students enrolled in the current academic year
        const enrollments = await prisma.enrollment.findMany({
            where: { schoolId, isCurrent: true, status: 'active' },
            include: {
                student: {
                    include: {
                        user: true,
                        ExamResults: {
                            orderBy: { exam: { date: 'desc' } },
                            take: 5
                        },
                        Attendance: {
                            take: 30,
                            orderBy: { date: 'desc' }
                        }
                    }
                },
                clss: true,
                section: true
            }
        });

        // Map enrollments to the student structure expected by the prediction logic
        const students = enrollments.map(e => ({
            ...e.student,
            clss: e.clss,
            section: e.section
        }));

        const predictions = students.map(student => {
            if (!student.user || !student.user.name) {
                console.error(`Missing user or name for student ID: ${student.id}`);
            }

            const avgMarks = student.ExamResults.length > 0
                ? student.ExamResults.reduce((sum, r) => sum + r.marks, 0) / student.ExamResults.length
                : null;

            const attendanceRate = student.Attendance.length > 0
                ? (student.Attendance.filter(a => a.status === 'Present').length / student.Attendance.length) * 100
                : null;

            let status = 'Stable';
            let reasoning = 'Performing within normal parameters.';

            if (avgMarks !== null && avgMarks < 50) {
                status = 'At Risk';
                reasoning = 'Low exam scores detected in recent assessments.';
            } else if (attendanceRate !== null && attendanceRate < 70) {
                status = 'At Risk';
                reasoning = 'Frequent absenteeism may impact academic progress.';
            } else if (avgMarks !== null && avgMarks > 85) {
                status = 'Excellent';
                reasoning = 'Consistently high academic performance.';
            }

            return {
                id: student.id,
                name: student.user?.name || 'Unknown Student',
                class: student.clss?.class_name || 'N/A',
                section: student.section?.name || 'N/A',
                status,
                reasoning,
                avgMarks,
                attendanceRate
            };
        });
        console.log(`Generated ${predictions.length} predictions for school ${schoolId}`);

        res.json(predictions);
    } catch (err) {
        console.error('Prediction Error:', err);
        res.status(500).json({ message: 'Failed to generate predictions' });
    }
});

// GET /api/analytics/revenue-forecast
router.get('/revenue-forecast', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
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
            console.error('Revenue Forecast Recovery Error:', err);
          }
        }

        if (!schoolId && !['super_admin', 'owner'].includes(req.user.role)) {
            return res.status(400).json({ message: 'School ID is required' });
        }

        const today = new Date();
        const year = today.getFullYear();

        const payments = await prisma.payment.groupBy({
            by: ['month'],
            _sum: { amount: true },
            where: { schoolId, year }
        });

        // Simple linear trend
        const monthlyData = Array(12).fill(0);
        payments.forEach(p => {
            if (p.month >= 1 && p.month <= 12) {
                monthlyData[p.month - 1] = p._sum.amount || 0;
            }
        });

        const currentMonth = today.getMonth();
        const pastMonthsData = monthlyData.slice(0, currentMonth);
        const avgRevenue = pastMonthsData.length > 0
            ? pastMonthsData.reduce((a, b) => a + b, 0) / pastMonthsData.length
            : 0;

        res.json({
            averageMonthlyRevenue: avgRevenue,
            forecastNextMonth: avgRevenue * 1.05, // Assumes 5% growth
            trend: pastMonthsData
        });
    } catch (err) {
        console.error('Forecast Error:', err);
        res.status(500).json({ message: 'Failed to generate forecast' });
    }
});

module.exports = router;
