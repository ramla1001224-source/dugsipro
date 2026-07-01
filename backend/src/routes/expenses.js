const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const prisma = require('../prisma');

// Get all expenses (Admin only, with optional month/year filtering)
router.get('/', authenticateToken, authorizeRoles('admin', 'owner', 'accountant'), async (req, res) => {
    try {
        const { month, year } = req.query;
        let schoolId = req.user.schoolId;

        // If schoolId is missing from token, recover from User record
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
          try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
          } catch (err) {
            console.error('Expenses Recovery Error:', err);
          }
        }

        let whereClause = { schoolId };

        if (month && year) {
            const startOfMonth = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
            const endOfMonth = new Date(Date.UTC(parseInt(year), parseInt(month), 0, 23, 59, 59, 999));
            whereClause.date = {
                gte: startOfMonth,
                lte: endOfMonth
            };
        }

        const expenses = await prisma.expense.findMany({
            where: whereClause,
            orderBy: { date: 'desc' }
        });
        res.json(expenses);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create an expense
router.post('/create', authenticateToken, authorizeRoles('admin', 'owner', 'accountant'), async (req, res) => {
    const { title, amount, category, date } = req.body;
    if (!title || !amount) return res.status(400).json({ message: 'Title and amount are required' });
    const schoolId = req.user.schoolId;
    try {
        const expense = await prisma.expense.create({
            data: {
                title,
                amount: Number(amount),
                category,
                date: date ? new Date(date) : undefined,
                schoolId
            }
        });
        res.json(expense);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete an expense
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'owner', 'accountant'), async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const expense = await prisma.expense.findFirst({
            where: { id: req.params.id, schoolId }
        });

        if (!expense) return res.status(404).json({ message: 'Expense not found' });

        await prisma.expense.delete({ where: { id: req.params.id } });
        res.json({ message: 'Expense deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
