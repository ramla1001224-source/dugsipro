const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET all video lessons (filtered by class/section for students)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let schoolId = req.user.schoolId;

    // If schoolId is missing from token, recover from User record
    if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user) schoolId = user.schoolId;
      } catch (err) {
        console.error('Lessons Recovery Error:', err);
      }
    }

    let filter = schoolId ? { schoolId } : { schoolId: 'NONE_AUTHORIZED' };

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
    } else if (req.user.role === 'teacher') {
      // Teachers might only want to see their own lessons, or all school lessons?
      // Let's show all school lessons but highlight theirs if needed.
    }

    const lessons = await prisma.videoLesson.findMany({
      where: filter,
      include: {
        teacher: { include: { user: { select: { name: true } } } },
        clss: { select: { class_name: true } },
        section: { select: { name: true } },
        subject: { select: { name: true } }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json(lessons);
  } catch (err) {
    console.error('Error fetching lessons:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST a new video lesson (Admin or Teacher only)
router.post('/', authenticateToken, authorizeRoles('admin', 'teacher', 'owner'), async (req, res) => {
  try {
    const { title, description, videoUrl, classId, sectionId, subjectId, thumbnail } = req.body;
    const schoolId = req.user.schoolId;
    const isAllSections = sectionId === 'all';

    // Get teacherId if the user is a teacher
    let teacherId = null;
    if (req.user.role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
      if (!teacher) return res.status(404).json({ message: 'Teacher record not found' });
      teacherId = teacher.id;
    } else {
      const teacher = await prisma.teacher.findFirst({ where: { school: { id: schoolId } } });
      teacherId = teacher?.id;
    }

    if (!title || !videoUrl || !teacherId) {
      return res.status(400).json({ message: 'Title, Video URL, and Teacher ID are required.' });
    }

    // Authorization Guard for Teachers
    if (req.user.role === 'teacher' && teacherId) {
        let isAssigned = false;
        if (!isAllSections && sectionId) {
            const assignment = await prisma.section.findFirst({
                where: {
                    id: sectionId,
                    schoolId,
                    OR: [
                        { teacherId },
                        { class: { teacherId } },
                        { Subjects: { some: { teacherId } } }
                    ]
                }
            });
            if (assignment) isAssigned = true;
        } else if (subjectId) {
            const assignment = await prisma.subjectAssignment.findFirst({
                where: { teacherId, subjectId, subject: { schoolId } }
            });
            if (assignment) isAssigned = true;
        } else {
            // If neither section nor subject is provided, we check if teacher exists in school
            isAssigned = true; // They are already in the school if teacherId exists
        }

        if (!isAssigned && !isAllSections) {
            return res.status(403).json({ message: 'Aad uma lihid fasalkaan ama maadadan.' });
        }
    }

    const lesson = await prisma.videoLesson.create({
      data: {
        title,
        description,
        videoUrl,
        thumbnail,
        schoolId,
        teacherId,
        subjectId: subjectId || null,
        classId: classId || null,
        sectionId: isAllSections ? null : (sectionId || null),
        isActive: req.body.isActive !== undefined ? req.body.isActive : true
      }
    });

    res.json(lesson);
  } catch (err) {
    console.error('Error creating lesson:', err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE a video lesson
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'teacher', 'owner', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify ownership/school if not super_admin
    const lesson = await prisma.videoLesson.findUnique({ where: { id } });
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });
    
    if (req.user.role !== 'super_admin' && lesson.schoolId !== req.user.schoolId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    await prisma.videoLesson.delete({ where: { id } });
    res.json({ message: 'Lesson deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// TOGGLE active state
router.put('/:id/toggle-active', authenticateToken, authorizeRoles('admin', 'teacher', 'owner', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    const lesson = await prisma.videoLesson.findUnique({ where: { id } });
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });
    
    if (req.user.role !== 'super_admin' && lesson.schoolId !== req.user.schoolId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Using raw query to bypass prisma client sync issues on windows
    await prisma.$executeRawUnsafe(
      `UPDATE "VideoLesson" SET "isActive" = $1 WHERE id = $2`,
      isActive,
      id
    );
    
    res.json({ id, isActive });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
