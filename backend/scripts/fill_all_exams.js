const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst({ where: { name: '1' } });
  if (!school) { console.log("School '1' not found!"); return; }

  const schoolId = school.id;

  // Get academic year and term
  const academicYear = await prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } });
  const term = await prisma.term.findFirst({ where: { academicYearId: academicYear.id } });

  // Get all subjects
  const subjects = await prisma.subject.findMany({ where: { schoolId } });
  console.log(`Subjects: ${subjects.map(s => s.name).join(', ')}`);

  // Get all classes with sections and students
  const classes = await prisma.class.findMany({
    where: { schoolId },
    include: {
      Sections: {
        include: {
          Students: { select: { id: true } }
        }
      }
    }
  });

  console.log(`Classes: ${classes.length}`);

  for (const cls of classes) {
    console.log(`\nClass: ${cls.class_name}`);

    for (const subject of subjects) {
      // Check if exam exists
      let exam = await prisma.exam.findFirst({ 
        where: { schoolId, classId: cls.id, subjectId: subject.id } 
      });

      if (!exam) {
        exam = await prisma.exam.create({
          data: {
            name: `Imtixaanka ${subject.name} - ${cls.class_name}`,
            type: 'Midterm',
            subjectId: subject.id,
            classId: cls.id,
            termId: term.id,
            schoolId,
            totalMarks: 100,
            status: 'published',
            date: new Date('2026-03-15')
          }
        });
        console.log(`  Created exam: ${exam.name}`);
      } else {
        console.log(`  Exam exists: ${exam.name}`);
      }

      // Get all students in this class (across all sections)
      const allStudents = await prisma.student.findMany({
        where: { classId: cls.id, status: 'active' },
        select: { id: true, sectionId: true }
      });

      if (allStudents.length === 0) {
        console.log(`    No students in class ${cls.class_name}`);
        continue;
      }

      // Get existing results for this exam
      const existingResults = await prisma.examResult.findMany({
        where: { examId: exam.id },
        select: { studentId: true }
      });
      const existingStudentIds = new Set(existingResults.map(r => r.studentId));

      // Students without marks
      const studentsToMark = allStudents.filter(s => !existingStudentIds.has(s.id));

      if (studentsToMark.length === 0) {
        console.log(`    All ${allStudents.length} students already have marks`);
        continue;
      }

      // Create marks in bulk
      const marksData = studentsToMark.map(student => ({
        id: uuidv4(),
        examId: exam.id,
        studentId: student.id,
        sectionId: student.sectionId,
        marks: Math.floor(Math.random() * 41) + 60, // 60-100
        grade: 'A',
        remarks: 'Pass'
      }));

      await prisma.examResult.createMany({ data: marksData, skipDuplicates: true });
      console.log(`  Assigned marks to ${marksData.length} students for ${subject.name}`);
    }
  }

  // Final summary
  const totalExams = await prisma.exam.count({ where: { schoolId } });
  const totalResults = await prisma.examResult.count({
    where: { exam: { schoolId } }
  });
  console.log(`\n=== DONE ===`);
  console.log(`Total Exams: ${totalExams}`);
  console.log(`Total Exam Results: ${totalResults}`);
}

main()
  .catch(e => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
