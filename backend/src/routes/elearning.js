const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// ========== GET QUIZZES ==========
// Admin/Teacher: Gets all quizzes for their school/assignment
// Student: Gets quizzes assigned to their class/section
router.get('/quizzes', authenticateToken, async (req, res) => {
  try {
    let schoolId = req.user.schoolId || req.query.schoolId;

    // If schoolId is missing from token, recover from User record
    if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user) schoolId = user.schoolId;
      } catch (err) {
        console.error('E-Learning Recovery Error:', err);
      }
    }

    if (!schoolId && req.user.role !== 'super_admin' && req.user.role !== 'owner') {
      return res.status(400).json({ message: 'School ID required' });
    }

    let filter = { schoolId };

    if (req.user.role === 'student') {
      const enrollment = await prisma.enrollment.findFirst({
        where: { student: { userId: req.user.id }, isCurrent: true },
        select: { sectionId: true, classId: true }
      });

      if (enrollment) {
        filter = {
          schoolId,
          OR: [
            { classId: enrollment.classId, sectionId: enrollment.sectionId },
            { classId: enrollment.classId, sectionId: null },
            { classId: null, sectionId: null }
          ]
        };
      }
    }

    // If student, we need their own student record ID to fetch their specific results
    let studentId = null;
    if (req.user.role === 'student') {
      const studentRecord = await prisma.student.findFirst({ where: { userId: req.user.id } });
      if (studentRecord) studentId = studentRecord.id;
    }

    const quizzes = await prisma.quiz.findMany({
      where: filter,
      include: {
        _count: { select: { questions: true } },
        clss: { select: { class_name: true } },
        section: { select: { name: true } },
        subject: { select: { name: true } },
        teacher: { include: { user: { select: { name: true } } } },
        ...(req.user.role === 'student' && studentId ? {
          results: { where: { studentId: studentId } }
        } : {})
      },
      orderBy: { created_at: 'desc' }
    });

    res.json(quizzes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ========== CREATE QUIZ ==========
router.post('/quizzes', authenticateToken, authorizeRoles('admin', 'teacher', 'owner'), async (req, res) => {
  try {
    const { title, description, classId, sectionId, subjectId, schoolId: bodySchoolId, duration, isActive, questions } = req.body;
    const schoolId = req.user.schoolId || bodySchoolId;
    const isAllSections = sectionId === 'all';

    // Get teacherId if the user is a teacher
    let teacherId = null;
    const teacher = await prisma.teacher.findFirst({ where: { userId: req.user.id } });
    if (teacher) teacherId = teacher.id;

    if (req.user.role === 'teacher') {
      if (!teacher) return res.status(403).json({ message: 'Teacher record not found' });
      
      let isAssigned = false;
      if (!isAllSections && sectionId) {
        const assignment = await prisma.section.findFirst({
            where: {
              id: sectionId,
              schoolId,
              OR: [
                { teacherId: teacher.id },
                { class: { teacherId: teacher.id } },
                { Subjects: { some: { teacherId: teacher.id } } }
              ]
            }
        });
        if (assignment) isAssigned = true;
      } else if (subjectId) {
        const assignment = await prisma.subjectAssignment.findFirst({
            where: { teacherId: teacher.id, subjectId, subject: { schoolId } }
        });
        if (assignment) isAssigned = true;
      } else {
          isAssigned = true; // class-wide quiz is allowed
      }

      if (!isAssigned && !isAllSections) {
        return res.status(403).json({ message: 'Aad uma lihid fasalkaan ama maadadan.' });
      }
    }

    const quizData = {
      title,
      description,
      schoolId,
      teacherId,
      classId: classId || null,
      sectionId: isAllSections ? null : (sectionId || null),
      subjectId: subjectId || null,
      duration: duration || 30,
      isActive: isActive !== undefined ? isActive : true
    };

    if (questions && questions.length > 0) {
      quizData.questions = {
        create: questions.map(q => ({
          question: q.question,
          options: q.options,
          answer: q.correctAnswer !== undefined ? q.options[q.correctAnswer] : q.options[0],
          points: q.points ? parseInt(q.points) : 1
        }))
      };
    }

    const quiz = await prisma.quiz.create({
      data: quizData
    });

    res.json(quiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ========== GET SINGLE QUIZ FOR TEACHER (EDIT / RESULTS) ==========
router.get('/quizzes/:quizId', authenticateToken, authorizeRoles('admin', 'teacher', 'owner'), async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const schoolId = req.user.schoolId || req.query.schoolId;

    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, schoolId },
      include: {
        questions: true,
        results: {
          include: { student: { include: { user: true } } }
        }
      }
    });

    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ========== UPDATE QUIZ ==========
router.put('/quizzes/:quizId', authenticateToken, authorizeRoles('admin', 'teacher', 'owner'), async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const { title, description, classId, sectionId, subjectId, duration, isActive, questions } = req.body;
    const schoolId = req.user.schoolId;

    const quiz = await prisma.quiz.findFirst({ where: { id: quizId, schoolId } });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    await prisma.quizQuestion.deleteMany({ where: { quizId } });

    const quizData = {
      title,
      description,
      classId: classId || null,
      sectionId: sectionId || null,
      subjectId: subjectId || null,
      duration: duration || 30,
      isActive: isActive !== undefined ? isActive : true
    };

    if (questions && questions.length > 0) {
      quizData.questions = {
        create: questions.map(q => ({
          question: q.question,
          options: q.options,
          answer: q.correctAnswer !== undefined ? q.options[q.correctAnswer] : q.options[0],
          points: q.points ? parseInt(q.points) : 1
        }))
      };
    }

    const updatedQuiz = await prisma.quiz.update({
      where: { id: quizId },
      data: quizData
    });

    res.json(updatedQuiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ========== TOGGLE QUIZ STATUS ==========
router.put('/quizzes/:quizId/toggle-active', authenticateToken, authorizeRoles('admin', 'teacher', 'owner'), async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const { isActive } = req.body;
    const schoolId = req.user.schoolId;

    const quiz = await prisma.quiz.findFirst({ where: { id: quizId, schoolId } });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    // Raw query bypass for windows prisma client issues
    await prisma.$executeRawUnsafe(
      `UPDATE "Quiz" SET "isActive" = $1 WHERE id = $2`,
      isActive,
      quizId
    );
    
    res.json({ id: quizId, isActive });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ========== DELETE QUIZ ==========
router.delete('/quizzes/:quizId', authenticateToken, authorizeRoles('admin', 'teacher', 'owner'), async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const schoolId = req.user.schoolId;

    const quiz = await prisma.quiz.findFirst({ where: { id: quizId, schoolId } });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    // Explicitly wipe relations to avoid DB constraint failures if Cascade isn't built-in
    await prisma.quizResult.deleteMany({ where: { quizId } });
    await prisma.quizQuestion.deleteMany({ where: { quizId } });
    await prisma.quiz.delete({ where: { id: quizId } });

    res.json({ message: 'Quiz deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ========== ADD QUESTION TO QUIZ ==========
router.post('/quizzes/:quizId/questions', authenticateToken, authorizeRoles('admin', 'teacher', 'owner'), async (req, res) => {
  try {
    const { questions } = req.body; // Array of { question, options: [], answer, points }
    const quizId = req.params.quizId;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'Questions array is required' });
    }

    // Verify ownership
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz || quiz.schoolId !== req.user.schoolId) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const createdQuestions = await prisma.$transaction(
      questions.map(q => prisma.quizQuestion.create({
        data: {
          quizId,
          question: q.question,
          options: q.options,
          answer: q.answer,
          points: q.points || 1
        }
      }))
    );

    res.json(createdQuestions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ========== GET QUIZ QUESTIONS (FOR TAKING) ==========
router.get('/quizzes/:quizId/take', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const student = await prisma.student.findFirst({ where: { userId: req.user.id } });

    // Check if already taken
    const existingResult = await prisma.quizResult.findUnique({
      where: { quizId_studentId: { quizId, studentId: student.id } }
    });

    if (existingResult) {
      return res.status(403).json({ message: 'You have already completed this quiz.', result: existingResult });
    }

    // Fetch quiz without answers to send to client
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          select: { id: true, question: true, options: true, points: true }
        }
      }
    });

    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    res.json(quiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ========== SUBMIT QUIZ ANSWERS ==========
router.post('/quizzes/:quizId/submit', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const { answers } = req.body; // { questionId: "selected_answer", ... }
    
    const student = await prisma.student.findFirst({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Student record not found' });

    // Ensure not taken twice
    const existingResult = await prisma.quizResult.findUnique({
      where: { quizId_studentId: { quizId, studentId: student.id } }
    });
    if (existingResult) return res.status(400).json({ message: 'Multiple submissions not allowed' });

    // Grade the quiz
    const questions = await prisma.quizQuestion.findMany({ where: { quizId } });
    let score = 0;
    let totalPoints = 0;
    const graded = [];
    
    questions.forEach(q => {
      totalPoints += q.points || 1;
      const studentAnswer = answers[q.id] || "No Answer";
      const isCorrect = studentAnswer === q.answer;
      if (isCorrect) {
        score += q.points || 1;
      }
      graded.push({
        id: q.id,
        question: q.question,
        options: q.options,
        answer: q.answer,
        studentAnswer,
        isCorrect,
        points: q.points || 1
      });
    });

    const result = await prisma.quizResult.create({
      data: {
        quizId,
        studentId: student.id,
        score,
        totalQuestions: totalPoints
      }
    });

    res.json({ success: true, score, totalQuestions: totalPoints, result, grades: graded });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
