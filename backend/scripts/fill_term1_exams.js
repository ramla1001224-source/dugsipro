const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

async function main() {
  const school = await prisma.school.findFirst({ where: { name: '1' } });
  if (!school) { console.log("School '1' not found!"); return; }

  const schoolId = school.id;

  // Get current academic year
  const academicYear = await prisma.academicYear.findFirst({ 
    where: { schoolId, isCurrent: true },
    include: { Terms: true }
  });

  // Find or Create term1
  let term = academicYear.Terms.find(t => t.name.toLowerCase() === 'term1' || t.name.toLowerCase() === 'term 1');
  if (!term) {
    console.log("Term 1 not found. Creating Term 1...");
    term = await prisma.term.create({
      data: {
        name: 'Term1',
        startDate: new Date(),
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 4)), // 4 months later
        academicYearId: academicYear.id
      }
    });
  }
  
  console.log(`Using Term: ${term.name} (${term.id}) in Academic Year: ${academicYear.name}`);

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
  
  let newExamsCreated = 0;
  let newMarksCreated = 0;

  for (const cls of classes) {
    console.log(`\nClass: ${cls.class_name}`);

    for (const subject of subjects) {
      // Check if exam exists FOR THIS TERM AND SUBJECT
      let exam = await prisma.exam.findFirst({ 
        where: { schoolId, classId: cls.id, subjectId: subject.id, termId: term.id } 
      });

      if (!exam) {
        exam = await prisma.exam.create({
          data: {
            name: `Imtixaanka ${subject.name} - Term 1 - ${cls.class_name}`,
            type: 'midterm',
            subjectId: subject.id,
            classId: cls.id,
            termId: term.id,
            schoolId,
            totalMarks: 100,
            status: 'published',
            date: new Date()
          }
        });
        console.log(`  Created exam: ${exam.name}`);
        newExamsCreated++;
      } else {
        console.log(`  Exam exists: ${exam.name}`);
      }

      // Get all students in this class
      const allStudents = await prisma.student.findMany({
        where: { classId: cls.id, status: 'active', Enrollments: { some: { isCurrent: true, academicYearId: academicYear.id } } },
        select: { id: true, sectionId: true }
      });

      if (allStudents.length === 0) {
        console.log(`    No active students in class ${cls.class_name} for this year`);
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
        console.log(`    All ${allStudents.length} students already have marks for ${subject.name}`);
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
      newMarksCreated += marksData.length;
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`New Exams Created: ${newExamsCreated}`);
  console.log(`New Exam Results Created: ${newMarksCreated}`);
}

main()
  .catch(e => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
