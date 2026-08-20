const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const crypto = require('crypto');
const { resolveStudentTuitionFeeByStudentId } = require('../utils/paymentHelper');

// ========== GET PAYMENT GATEWAY SETTING ==========
router.get('/', authenticateToken, authorizeRoles('admin', 'owner', 'parent'), async (req, res) => {
  try {
    let schoolId = req.user.schoolId;
    if (req.user.role === 'super_admin' && req.query.schoolId) {
      schoolId = req.query.schoolId;
    }

    const setting = await prisma.paymentGatewaySetting.findUnique({
      where: { schoolId }
    });

    // Return empty object if not set, instead of 404
    res.json(setting || {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ========== SAVE/UPDATE PAYMENT GATEWAY SETTING ==========
router.post('/', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
  try {
    const { provider, merchantUid, apiUserId, apiKey, isActive } = req.body;
    let schoolId = req.user.schoolId;
    if (req.user.role === 'super_admin' && req.query.schoolId) {
      schoolId = req.query.schoolId;
    }

    if (!provider || !merchantUid || !apiUserId || !apiKey) {
      return res.status(400).json({ message: 'All gateway credentials are required' });
    }

    const setting = await prisma.paymentGatewaySetting.upsert({
      where: { schoolId },
      update: { provider, merchantUid, apiUserId, apiKey, isActive: isActive !== false },
      create: { schoolId, provider, merchantUid, apiUserId, apiKey, isActive: isActive !== false }
    });

    res.json(setting);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ========== INITIATE MOBILE MONEY PAYMENT ==========
router.post('/initiate', authenticateToken, authorizeRoles('parent', 'student', 'admin'), async (req, res) => {
  try {
    const { studentId, amount, phoneNumber, month, year, description, name } = req.body;
    let schoolId = req.user.schoolId;

    // 1. Get school's gateway setting
    const gateway = await prisma.paymentGatewaySetting.findUnique({ where: { schoolId } });
    if (!gateway || !gateway.isActive) {
      return res.status(400).json({ message: 'Mobile Money is not configured for this school' });
    }

    // 2. Format phone number (E-Dahab / Zaad standard check)
    if (!phoneNumber || phoneNumber.length < 9) {
      return res.status(400).json({ message: 'Fadlan gali lambar sax ah (e.g. 090xxxxxx)' });
    }

    // 3. Create a pending payment record
    // Append name to description if provided
    const finalDescription = name 
      ? `Paid by ${name}${description ? `: ${description}` : ''}`
      : (description || 'Mobile Money Payment');

    const payment = await prisma.payment.create({
      data: {
        amount: Number(amount),
        studentId,
        schoolId,
        month,
        year,
        phoneNumber,
        description: finalDescription,
        payment_method: gateway.provider,
        transactionId: `TXN-${Date.now()}` // Mock TXN ID, in real life this comes from gateway
      }
    });

    // 4. (MOCK) Call the actual Mobile Money API here (e.g. Waafi, Telesom)
    // For now, we simulate a successful prompt sent to the phone.

    res.json({
      success: true,
      message: 'Fariin USSD ah ayaa loo diray lambarkaaga. Fadlan gali PIN-ka si lacagtu u dhacdo.',
      paymentId: payment.id,
      transactionId: payment.transactionId
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ========== PAYMENT CALLBACK / WEBHOOK ==========
router.post('/callback', async (req, res) => {
  // Normally this would be insecure without IP whitelisting or signature verification from Gateway
  try {
    const { transactionId, status, gatewayResponse } = req.body;

    if (!transactionId || status !== 'SUCCESS') {
      return res.status(400).json({ message: 'Invalid callback data' });
    }

    const payment = await prisma.payment.findFirst({
      where: { transactionId }
    });

    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    // Update payment record to reflect success
    await prisma.payment.update({
      where: { id: payment.id },
      data: { gatewayResponse: JSON.stringify(gatewayResponse) || 'SUCCESS' }
    });

    // Auto-verify MonthlyPaymentRecord
    if (payment.month && payment.year) {
      const expectedAmount = await resolveStudentTuitionFeeByStudentId(prisma, payment.studentId, payment.month, payment.year);

      const existingRecord = await prisma.monthlyPaymentRecord.findFirst({
        where: {
          studentId: payment.studentId,
          month: payment.month,
          year: payment.year
        }
      });

      let currentPaid = (existingRecord?.amountPaid || 0) + payment.amount;
      // If already paid in the past, or if the user is paying a previous balance that pushes them over
      if (existingRecord?.status === 'paid' || currentPaid >= expectedAmount) {
          currentPaid = expectedAmount;
      }

      let newStatus = 'unpaid';
      if (currentPaid >= expectedAmount) {
        newStatus = 'paid';
      } else if (currentPaid > 0) {
        newStatus = 'partial';
      }

      const recordId = existingRecord?.id || crypto.randomUUID();

      await prisma.$executeRawUnsafe(`
        INSERT INTO "MonthlyPaymentRecord" (id, "studentId", month, year, status, "amountPaid", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT ("studentId", month, year) 
        DO UPDATE SET status = EXCLUDED.status, "amountPaid" = EXCLUDED."amountPaid", "updatedAt" = NOW()
      `, recordId, payment.studentId, payment.month, payment.year, newStatus, currentPaid);
    }

    res.json({ success: true, message: 'Payment verified and updated automatically.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
