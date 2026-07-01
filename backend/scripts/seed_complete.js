const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst({
    where: { name: '1' },
    include: {
      Classes: {
        include: { Sections: true }
      }
    }
  });

  if (!school) { console.log("School '1' not found!"); return; }
  console.log(`School: ${school.name} | Classes: ${school.Classes.length}`);

  const schoolId = school.id;
  const hashedPassword = await bcrypt.hash('Test1234', 10);
  const STUDENTS_PER_SECTION = 60;

  // === Ensure Academic Year ===
  let academicYear = await prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } });
  if (!academicYear) {
    academicYear = await prisma.academicYear.create({
      data: { name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30'), isCurrent: true, schoolId }
    });
    console.log('Created academic year.');
  }

  // === Ensure Term ===
  let term = await prisma.term.findFirst({ where: { academicYearId: academicYear.id } });
  if (!term) {
    term = await prisma.term.create({
      data: { name: 'Term 1', startDate: new Date('2025-09-01'), endDate: new Date('2026-01-31'), academicYearId: academicYear.id }
    });
    console.log('Created term.');
  }

  // === Ensure 2 Subjects ===
  const subjectNames = ['Xisaab', 'Af Soomaali'];
  const subjects = [];
  for (const sName of subjectNames) {
    let sub = await prisma.subject.findFirst({ where: { schoolId, name: sName } });
    if (!sub) {
      sub = await prisma.subject.create({
        data: { name: sName, code: sName.replace(/\s/g, '-').toUpperCase().substring(0, 10), schoolId }
      });
      console.log(`Created subject: ${sName}`);
    }
    subjects.push(sub);
  }

  // === Loop through each Class ===
  for (const cls of school.Classes) {
    console.log(`\nProcessing class: ${cls.class_name} (${cls.Sections.length} sections)`);

    // Ensure exam for each subject for this class
    const exams = [];
    for (const sub of subjects) {
      let exam = await prisma.exam.findFirst({ where: { schoolId, classId: cls.id, subjectId: sub.id } });
      if (!exam) {
        exam = await prisma.exam.create({
          data: {
            name: `Imtixaanka ${sub.name} - ${cls.class_name}`,
            type: 'Midterm',
            subjectId: sub.id,
            classId: cls.id,
            termId: term.id,
            schoolId,
            totalMarks: 100,
            status: 'published',
            date: new Date('2026-03-15')
          }
        });
        console.log(`  Created exam: ${exam.name}`);
      }
      exams.push({ exam, subject: sub });
    }

    // === Loop through each Section ===
    for (const section of cls.Sections) {
      console.log(`  Section: ${section.name}`);

      const existing = await prisma.student.count({ where: { classId: cls.id, sectionId: section.id } });
      const toCreate = Math.max(0, STUDENTS_PER_SECTION - existing);
      console.log(`    Existing: ${existing}, Creating: ${toCreate}`);

      let sectionStudents = [];
      if (toCreate > 0) {
        // Create users in bulk
        const usersData = [];
        for (let i = 0; i < toCreate; i++) {
          const uid = uuidv4();
          usersData.push({
            id: uid,
            name: `${cls.class_name} ${section.name} Arday ${existing + i + 1}`,
            username: `s_${cls.id.substring(0,4)}${section.id.substring(0,4)}_${existing + i + 1}`,
            password: hashedPassword,
            role: 'student',
            schoolId,
            isActive: true
          });
        }

        await prisma.user.createMany({ data: usersData, skipDuplicates: true });

        const createdUsers = await prisma.user.findMany({
          where: { 
            schoolId, 
            username: { startsWith: `s_${cls.id.substring(0,4)}${section.id.substring(0,4)}_` }
          }
        });

        const studentsData = createdUsers.map((u, i) => ({
          id: uuidv4(),
          userId: u.id,
          student_id: `${cls.class_name}-${section.name}-${i + 1}`,
          classId: cls.id,
          sectionId: section.id,
          status: 'active'
        }));

        if (studentsData.length > 0) {
          await prisma.student.createMany({ data: studentsData, skipDuplicates: true });
        }
        console.log(`    Created ${studentsData.length} students`);
      }

      // Get all students in this section
      sectionStudents = await prisma.student.findMany({ where: { classId: cls.id, sectionId: section.id } });

      // Assign marks for each exam
      for (const { exam, subject } of exams) {
        const marks = sectionStudents.map(student => ({
          id: uuidv4(),
          examId: exam.id,
          studentId: student.id,
          sectionId: section.id,
          marks: Math.floor(Math.random() * 41) + 60, // 60 - 100
          grade: 'A',
          remarks: 'Pass'
        }));

        if (marks.length > 0) {
          await prisma.examResult.createMany({ data: marks, skipDuplicates: true });
          console.log(`    Assigned marks for ${marks.length} students | Exam: ${exam.name}`);
        }
      }
    }
  }

  console.log('\n=== Seeding Complete! ===');

  // Summary
  const totalStudents = await prisma.student.count({ where: { schoolId } });
  const totalExams = await prisma.exam.count({ where: { schoolId } });
  const totalResults = await prisma.examResult.count();
  console.log(`Total Students: ${totalStudents}`);
  console.log(`Total Exams: ${totalExams}`);
  console.log(`Total Exam Results: ${totalResults}`);
}

main()
  .catch(e => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
