const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles, requireSchoolAccess } = require('../middleware/auth');
const responseHelper = require('../utils/responseHelper');
const cacheMiddleware = require('../middleware/cacheMiddleware');


// Get all classes
router.get('/', authenticateToken, authorizeRoles('admin', 'teacher', 'accountant', 'librarian', 'super_admin', 'owner'), requireSchoolAccess(true), async (req, res) => {
  try {
    let schoolId = req.query.schoolId || req.user.schoolId;

    // If schoolId is missing from token, recover from User record
    if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user) schoolId = user.schoolId;
      } catch (err) {
        console.error('Classes Recovery Error:', err);
      }
    }

    let where = {};
    let teacher = null; // declared outside so it's accessible throughout

    if (req.user.role === 'teacher') {
      teacher = await prisma.teacher.findFirst({
        where: { userId: req.user.id }
      });

      if (!teacher) return res.status(404).json({ message: 'Teacher record not found' });

      // Filter for classes where the teacher is either:
      // 1. The Class Teacher (Grade head)
      // 2. Head of at least one Section
      // 3. Teaches at least one Subject in any Section
      where = {
        OR: [
          { teacherId: teacher.id },
          { Sections: { some: { teacherId: teacher.id } } },
          { Sections: { some: { Subjects: { some: { teacherId: teacher.id } } } } }
        ]
      };
      if (schoolId) where.schoolId = schoolId;
      else where.schoolId = 'NONE_AUTHORIZED';
    } else {
      if (schoolId) where.schoolId = schoolId;
      else where.schoolId = 'NONE_AUTHORIZED';
    }

    if (!schoolId && !['super_admin', 'owner'].includes(req.user.role)) {
      console.warn('No schoolId found for user:', req.user.id);
    }

    const classes = await prisma.class.findMany({
      where,
      include: {
        Sections: {
          where: (req.user.role === 'teacher' && teacher) ? {
            OR: [
              { teacherId: teacher.id },
              { Subjects: { some: { teacherId: teacher.id } } },
              { class: { teacherId: teacher.id } } // Class Teacher sees all sections
            ]
          } : {},
          include: {
            teacher: { include: { user: true } },
            Subjects: {
              where: (req.user.role === 'teacher' && teacher) ? { teacherId: teacher.id } : {},
              include: { subject: true }
            },
            _count: { select: { Students: true } }
          }
        },
        _count: { select: { Students: true } }
      },
      orderBy: { class_name: 'asc' }
    });

    // Note: For teachers, we already filtered the nested Sections and Subjects in findMany.
    // We return the classes as is (hierarchical) to maintain consistency with other roles
    // and ensure frontend filters like class.Sections work correctly.
    return res.json(classes);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
});

// Create a class/grade and its sections
router.post('/create', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
  const { class_name, section, sections, shift, teacherId, level } = req.body;
  
  if (!class_name) return res.status(400).json({ message: 'Class name is required' });
  const schoolId = req.user.schoolId;

  try {
    const finalSections = sections || (section && section.includes(',') 
      ? section.split(',').map(s => ({ name: s.trim(), shift: shift || 'morning', teacherId: teacherId || null }))
      : [{ name: section || 'General', shift: shift || 'morning', teacherId: teacherId || null }]);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Find or Create the parent Class (Grade)
      let parentClass = await tx.class.findFirst({
        where: { class_name, schoolId }
      });

      if (!parentClass) {
        parentClass = await tx.class.create({
          data: {
            class_name,
            schoolId,
            level: level || 1
          }
        });
      }

      const createdSections = [];
      
      for (const s of finalSections) {
        // 2. Create the Section
        const newSection = await tx.section.create({
          data: {
            name: s.name,
            classId: parentClass.id,
            schoolId,
            teacherId: s.teacherId || null,
            shift: s.shift || 'morning'
          }
        });
        createdSections.push(newSection);
      }

      // 3. Automatically create Tuition Fee record for the CLASS from settings
      const setting = await tx.schoolSettings.findUnique({ 
        where: { key_schoolId: { key: 'tuition_fee', schoolId } } 
      });

      if (setting) {
        const amount = Number(setting.value);
        // Only create if it doesn't exist for the class
        const existingFee = await tx.feeStructure.findFirst({
          where: { classId: parentClass.id, sectionId: null, name: 'Tuition Fee', schoolId }
        });

        if (!existingFee) {
          await tx.feeStructure.create({
            data: {
              name: 'Tuition Fee',
              amount,
              frequency: 'monthly',
              classId: parentClass.id,
              sectionId: null,
              schoolId
            }
          });
        }
      }
      return { parentClass, sections: createdSections };
    });

    return res.json({ 
        message: `Created ${result.sections.length} sections for ${class_name}`, 
        class: result.parentClass,
        sections: result.sections 
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
});

// ==================== ADD SECTION TO EXISTING CLASS ====================
router.post('/:id/sections', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
  const { id } = req.params; // classId
  const { name, teacherId, shift } = req.body;
  const schoolId = req.user.schoolId;

  if (!name) return res.status(400).json({ message: 'Section name is required' });

  try {
    // Verify class belongs to this school
    const parentClass = await prisma.class.findFirst({ where: { id, schoolId } });
    if (!parentClass) return res.status(404).json({ message: 'Class not found' });

    const newSection = await prisma.$transaction(async (tx) => {
      const section = await tx.section.create({
        data: {
          name,
          classId: id,
          schoolId,
          teacherId: teacherId || null,
          shift: shift || 'morning'
        }
      });

      // Auto-create fee structure for CLASS from school settings (if not exists)
      const setting = await tx.schoolSettings.findUnique({
        where: { key_schoolId: { key: 'tuition_fee', schoolId } }
      });
      if (setting) {
        const existingClassFee = await tx.feeStructure.findFirst({
            where: { classId: id, sectionId: null, name: 'Tuition Fee', schoolId }
        });
        if (!existingClassFee) {
            await tx.feeStructure.create({
                data: {
                    name: 'Tuition Fee',
                    amount: Number(setting.value),
                    frequency: 'monthly',
                    classId: id,
                    sectionId: null,
                    schoolId
                }
            });
        }
      }
      return section;
    });

    return res.json({ message: `Section '${name}' added to ${parentClass.class_name}`, section: newSection });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
});

// Update a class (Grade name)
router.put('/:id', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
  const { class_name, level } = req.body;
  const schoolId = req.user.schoolId;
  try {
    const updatedClass = await prisma.class.update({
      where: { id: req.params.id, schoolId },
      data: {
        class_name,
        level: level || undefined
      }
    });
    return res.json(updatedClass);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
});

// Update a section
router.put('/section/:sectionId', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const { name, shift, teacherId } = req.body;
    const { sectionId } = req.params;
    const schoolId = req.user.schoolId;
    try {
      const updatedSection = await prisma.section.update({
        where: { id: sectionId, schoolId },
        data: {
          name,
          shift,
          teacherId: teacherId || null
        }
      });
      return res.json(updatedSection);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: err.message });
    }
  });

// Delete a section
router.delete('/section/:sectionId', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    const { sectionId } = req.params;
    const schoolId = req.user.schoolId;
    try {
      await prisma.$transaction(async (tx) => {
        // Cascade deletion for section specific data
        await tx.attendance.deleteMany({ where: { sectionId } });
        await tx.examResult.deleteMany({ where: { sectionId } });
        await tx.grade.deleteMany({ where: { sectionId } });
        await tx.announcementTarget.deleteMany({ where: { sectionId } });
        await tx.homeworkSubmission.deleteMany({ where: { homework: { sectionId } } });
        await tx.homework.deleteMany({ where: { sectionId } });
        await tx.timetable.deleteMany({ where: { sectionId } });
        await tx.virtualClass.deleteMany({ where: { sectionId } });
        await tx.subjectAssignment.deleteMany({ where: { sectionId } });
        
        // Handle students - move to null or another section? 
        // For now, let's just delete the section if it is empty or as requested.
        // User usually deletes empty sections or knows what they are doing.
        // To be safe, we could prevent deletion if students exist.
        const studentCount = await tx.student.count({ where: { sectionId } });
        if (studentCount > 0) throw new Error('Cannot delete section with students. Move students first.');

        await tx.feeStructure.deleteMany({ where: { sectionId } });
        await tx.section.delete({ where: { id: sectionId, schoolId } });
      });
      return res.json({ message: 'Section deleted successfully' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: err.message });
    }
  });

// Delete a class (Grade) and all its sections/students
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
  const { id } = req.params; // classId
  try {
    const schoolId = req.user.schoolId;
    console.log(`Starting massive deletion for class ${id} in school ${schoolId}...`);
    
    await prisma.$transaction(async (tx) => {
      // 0. Verify class ownership
      const cls = await tx.class.findFirst({ where: { id, schoolId } });
      if (!cls) throw new Error("Class not found or unauthorized");

      // 1. Get all students and related user IDs first
      const students = await tx.student.findMany({
        where: { classId: id },
        select: { userId: true }
      });
      const userIds = students.map(s => s.userId);

      // 2. Clear massive logs/messages related to these users (not cascaded)
      if (userIds.length > 0) {
        await tx.message.deleteMany({ where: { OR: [{ senderId: { in: userIds } }, { receiverId: { in: userIds } }] } });
        await tx.notification.deleteMany({ where: { userId: { in: userIds } } });
        await tx.auditLog.deleteMany({ where: { userId: { in: userIds } } });
      }

      // 2.5 Clear relations that might not have ON DELETE CASCADE in schema
      const sections = await tx.section.findMany({ where: { classId: id }, select: { id: true } });
      const sectionIds = sections.map(s => s.id);

      // AnnouncementTargets
      await tx.announcementTarget.deleteMany({ 
        where: { OR: [{ classId: id }, { sectionId: { in: sectionIds } }] } 
      });

      // Homework and Submissions (not all have cascade)
      await tx.homeworkSubmission.deleteMany({ where: { homework: { sectionId: { in: sectionIds } } } });
      await tx.homework.deleteMany({ where: { sectionId: { in: sectionIds } } });

      // Virtual Classes
      await tx.virtualClass.deleteMany({ where: { sectionId: { in: sectionIds } } });

      // Exams and Results (Ensure everything is gone)
      await tx.examResult.deleteMany({ where: { sectionId: { in: sectionIds } } });
      await tx.exam.deleteMany({ where: { OR: [{ classId: id }, { sectionId: { in: sectionIds } }] } });
      
      // Timetables
      await tx.timetable.deleteMany({ where: { sectionId: { in: sectionIds } } });

      // FeeStructures
      await tx.feeStructure.deleteMany({ where: { OR: [{ classId: id }, { sectionId: { in: sectionIds } }] } });

      // 3. Delete the Class itself. 
      // Because we added 'onDelete: Cascade' in schema.prisma, this will automatically delete:
      // - Sections
      // - Students
      // - Attendance
      // - Exams
      // - FeeStructures
      await tx.class.delete({ where: { id, schoolId } });

      // 4. Finally, delete the User records.
      // We do this AFTER deleting the class/students to avoid foreign key issues in some DB setups,
      // although Prisma's cascade handles it.
      if (userIds.length > 0) {
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      }
      
      console.log(`Deletion complete for class ${id}. Deleted ${userIds.length} students/users.`);
    }, { timeout: 60000 });

    return res.json({ message: 'Grade and all its sections/students deleted successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
