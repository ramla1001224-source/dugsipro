const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Helper to get schoolId for non-admin/non-owner roles
async function getEffectiveSchoolId(req) {
  let schoolId = req.user.schoolId;
  
  // If schoolId is missing from token, try multiple fallbacks
  if (!schoolId && req.user.role !== 'super_admin') {
    // 1. Try User table directly (covers librarian, accountant, etc.)
    try {
      const userRecord = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { schoolId: true }
      });
      if (userRecord?.schoolId) {
        schoolId = userRecord.schoolId;
        console.log(`[Library] Recovered schoolId from User table for ${req.user.role}: ${schoolId}`);
      }
    } catch (e) {
      console.error('[Library] User table schoolId lookup error:', e.message);
    }

    // 2. Try Staff table as secondary fallback
    if (!schoolId) {
      try {
        const staff = await prisma.staff.findFirst({
          where: { userId: req.user.id },
          include: { user: true }
        });
        if (staff) {
          schoolId = staff.schoolId || (staff.user ? staff.user.schoolId : null);
          if (schoolId) console.log(`[Library] Recovered schoolId from Staff table: ${schoolId}`);
        }
      } catch (e) {
        console.error('[Library] Staff table schoolId lookup error:', e.message);
      }
    }
  }

  // Superadmin can override with query param
  if (req.user.role === 'super_admin' && req.query.schoolId) {
    schoolId = req.query.schoolId;
  }

  return schoolId;
}

// ==================== BOOKS CRUD ====================

// Get all books
router.get('/books', authenticateToken, async (req, res) => {
  try {
    const schoolId = await getEffectiveSchoolId(req);
    console.log(`[Library/GET] User ${req.user.id} (${req.user.role}) fetching books for schoolId: ${schoolId}`);

    const books = await prisma.book.findMany({
      where: schoolId ? { schoolId } : { schoolId: 'NONE_AUTHORIZED' },
      include: { _count: { select: { Issues: { where: { status: 'issued' } } } } }
    });
    res.json(books);
  } catch (err) { 
    console.error('[Library/GET] Error:', err.message);
    res.status(500).json({ message: err.message }); 
  }
});

// Add a book
router.post('/books', authenticateToken, authorizeRoles('admin', 'owner', 'librarian'), async (req, res) => {
  const { title, author, isbn, category, quantity } = req.body;
  try {
    const schoolId = await getEffectiveSchoolId(req);
    
    if (!schoolId && req.user.role !== 'super_admin') {
        return res.status(403).json({ message: 'No schoolId associated.' });
    }

    const book = await prisma.book.create({
      data: {
        title,
        author,
        isbn,
        category,
        quantity: Number(quantity || 1),
        available: Number(quantity || 1),
        schoolId
      }
    });
    res.json(book);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Update a book
router.put('/books/:id', authenticateToken, authorizeRoles('admin', 'owner', 'librarian'), async (req, res) => {
  const { title, author, isbn, category, quantity, available } = req.body;
  try {
    const schoolId = await getEffectiveSchoolId(req);

    // Security check: ensure book belongs to this school
    const existing = await prisma.book.findFirst({
      where: { id: req.params.id, ...(schoolId && req.user.role !== 'super_admin' ? { schoolId } : {}) }
    });
    if (!existing) return res.status(404).json({ message: 'Book not found in your school' });

    const book = await prisma.book.update({
      where: { id: req.params.id },
      data: {
        title,
        author,
        isbn,
        category,
        quantity: quantity !== undefined ? Number(quantity) : undefined,
        available: available !== undefined ? Number(available) : undefined
      }
    });
    res.json(book);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete a book
router.delete('/books/:id', authenticateToken, authorizeRoles('admin', 'owner', 'librarian'), async (req, res) => {
  try {
    const schoolId = await getEffectiveSchoolId(req);

    // Security check
    const existing = await prisma.book.findFirst({
      where: { id: req.params.id, ...(schoolId && req.user.role !== 'super_admin' ? { schoolId } : {}) }
    });
    if (!existing) return res.status(404).json({ message: 'Book not found in your school' });

    await prisma.book.delete({ where: { id: req.params.id } });
    res.json({ message: 'Book deleted successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ==================== BOOK ISSUING ====================

// Issue a book
router.post('/issue', authenticateToken, authorizeRoles('admin', 'owner', 'librarian'), async (req, res) => {
  const { bookId, studentId, staffId, dueDate } = req.body;
  try {
    const schoolId = await getEffectiveSchoolId(req);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Check availability and ownership
      const book = await tx.book.findFirst({ 
        where: { id: bookId, ...(schoolId && req.user.role !== 'super_admin' ? { schoolId } : {}) } 
      });
      if (!book) throw new Error('Buuggan laga ma heli karo dugsigaaga.');
      if (book.available <= 0) throw new Error('Buuggan laga ma heli karo hadda qof kale ayaa qaba.');

      // 2. Create Issue record
      const issue = await tx.bookIssue.create({
        data: {
          bookId,
          studentId,
          staffId,
          dueDate: new Date(dueDate),
          status: 'issued'
        }
      });

      // 3. Decrement availability
      await tx.book.update({
        where: { id: bookId },
        data: { available: { decrement: 1 } }
      });

      return issue;
    });
    res.json(result);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Return a book
router.post('/return/:issueId', authenticateToken, authorizeRoles('admin', 'owner', 'librarian'), async (req, res) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const issue = await tx.bookIssue.findUnique({ 
        where: { id: req.params.issueId },
        include: { book: true }
      });
      if (!issue || issue.status === 'returned') throw new Error('Record-kan horay ayaa loo soo celiyay ama ma jiro.');

      // 1. Update issue record
      const updatedIssue = await tx.bookIssue.update({
        where: { id: req.params.issueId },
        data: {
          returnDate: new Date(),
          status: 'returned'
        }
      });

      // 2. Increment availability
      await tx.book.update({
        where: { id: issue.bookId },
        data: { available: { increment: 1 } }
      });

      return updatedIssue;
    });
    res.json(result);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Get all issued books (History/Current)
router.get('/issues', authenticateToken, async (req, res) => {
  try {
    const schoolId = await getEffectiveSchoolId(req);

    const issues = await prisma.bookIssue.findMany({
      where: schoolId ? { book: { schoolId } } : { book: { schoolId: 'NONE_AUTHORIZED' } },
      include: {
        book: true,
        student: { 
          include: { 
            user: true,
            clss: true,
            section: true,
            Enrollments: {
              where: { isCurrent: true },
              include: { clss: true, section: true }
            }
          } 
        },
        staff: { include: { user: true } }
      },
      orderBy: { issueDate: 'desc' }
    });
    res.json(issues);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get library statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const schoolId = await getEffectiveSchoolId(req);

    const where = schoolId ? { schoolId } : { schoolId: 'NONE_AUTHORIZED' };
    const issueWhere = schoolId ? { book: { schoolId } } : { book: { schoolId: 'NONE_AUTHORIZED' } };

    const [totalBooks, activeIssues, totalCategories, overdueIssues] = await Promise.all([
      prisma.book.aggregate({
        _sum: { quantity: true },
        where
      }),
      prisma.bookIssue.count({
        where: { ...issueWhere, status: 'issued' }
      }),
      prisma.book.findMany({
        where,
        distinct: ['category'],
        select: { category: true }
      }),
      prisma.bookIssue.count({
        where: { 
          ...issueWhere, 
          status: 'issued', 
          dueDate: { lt: new Date() } 
        }
      })
    ]);

    res.json({
      totalBooks: totalBooks._sum.quantity || 0,
      activeIssues,
      totalCategories: totalCategories.length,
      overdueIssues
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
