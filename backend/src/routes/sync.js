const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken } = require('../middleware/auth');

// ========== BULK PULL: Download all data for offline use ==========
router.get('/pull', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const userId = req.user.id;
    const role = req.user.role;

    let data = {
      timestamp: new Date().toISOString(),
      schoolId,
      role
    };

    if (role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({
        where: { userId },
        include: {
          Sections: {
            include: { class: true, Students: { include: { user: true } } }
          }
        }
      });

      if (!teacher) return res.status(404).json({ message: 'Teacher record not found' });

      // Pull teacher-specific data
      data.teacher = teacher;
      data.sections = teacher.Sections;
      
      // Pull subjects assigned to this teacher
      data.subjects = await prisma.subjectAssignment.findMany({
        where: { teacherId: teacher.id },
        include: { subject: true, section: true }
      });

      // Pull recent attendance for their sections
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      data.recentAttendance = await prisma.attendance.findMany({
        where: {
          sectionId: { in: teacher.Sections.map(s => s.id) },
          date: { gte: weekAgo }
        }
      });

    } else if (role === 'student') {
      const student = await prisma.student.findUnique({
        where: { userId },
        include: { user: true, clss: true, section: true }
      });

      if (!student) return res.status(404).json({ message: 'Student record not found' });

      data.student = student;
      data.attendance = await prisma.attendance.findMany({ where: { studentId: student.id } });
      data.examResults = await prisma.examResult.findMany({ where: { studentId: student.id }, include: { exam: true } });
      data.payments = await prisma.payment.findMany({ where: { studentId: student.id } });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ========== BULK PUSH: Sync offline changes to server ==========
router.post('/push', authenticateToken, async (req, res) => {
  try {
    const { attendanceBatch, examResultsBatch } = req.body;
    const schoolId = req.user.schoolId;
    const results = { attendance: { success: 0, failed: 0 }, exams: { success: 0, failed: 0 } };

    // 1. Process Attendance Batch
    if (Array.isArray(attendanceBatch)) {
      for (const item of attendanceBatch) {
        try {
          const date = new Date(item.date);
          date.setUTCHours(0,0,0,0);
          
          await prisma.attendance.upsert({
            where: {
              studentId_sectionId_date_session_shift: {
                studentId: item.studentId,
                sectionId: item.sectionId,
                date,
                session: item.session,
                shift: item.shift || 'morning'
              }
            },
            update: { status: item.status },
            create: {
              ...item,
              date,
              schoolId
            }
          });
          results.attendance.success++;
        } catch (e) {
          results.attendance.failed++;
        }
      }
    }

    // 2. Process Exam Results Batch
    if (Array.isArray(examResultsBatch)) {
      for (const item of examResultsBatch) {
        try {
          await prisma.examResult.upsert({
            where: {
              studentId_examId: {
                studentId: item.studentId,
                examId: item.examId
              }
            },
            update: { marks: item.marks, remarks: item.remarks },
            create: {
              studentId: item.studentId,
              examId: item.examId,
              marks: item.marks,
              remarks: item.remarks
            }
          });
          results.exams.success++;
        } catch (e) {
          results.exams.failed++;
        }
      }
    }

    res.json({
      message: 'Batch sync completed',
      results
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
