const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
const prisma = new PrismaClient();

async function main() {
  const schools = await prisma.school.findMany({
    include: { Classes: true }
  });

  const allClasses = schools.flatMap(s => s.Classes);
  console.log(`Found ${allClasses.length} classes globally.`);

  const hashedPassword = await bcrypt.hash('password123', 10);
  const studentsPerClass = 60;

  for (const cls of allClasses) {
    const schoolId = cls.schoolId;
    console.log(`Processing class ${cls.class_name}...`);

    let academicYear = await prisma.academicYear.findFirst({ where: { schoolId } });
    if (!academicYear) {
      academicYear = await prisma.academicYear.create({
        data: { name: '2026-2027', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), isCurrent: true, schoolId }
      });
    }

    let term = await prisma.term.findFirst({ where: { academicYearId: academicYear.id } });
    if (!term) {
      term = await prisma.term.create({
        data: { name: 'Term 1', startDate: new Date('2026-01-01'), endDate: new Date('2026-05-31'), academicYearId: academicYear.id }
      });
    }

    let subject = await prisma.subject.findFirst({ where: { schoolId } });
    if (!subject) {
      subject = await prisma.subject.create({
        data: { name: 'Test Subject', code: `TEST-${cls.id.substring(0, 5)}`, schoolId }
      });
    }

    const existingStudentsCount = await prisma.student.count({ where: { classId: cls.id } });
    const studentsToCreate = Math.max(0, studentsPerClass - existingStudentsCount);

    if (studentsToCreate > 0) {
      console.log(`Creating ${studentsToCreate} students for class ${cls.class_name}...`);
      const usersData = [];
      for (let i = 0; i < studentsToCreate; i++) {
        const uid = uuidv4();
        usersData.push({
          id: uid,
          name: `Student ${cls.class_name} ${i + 1}`,
          username: `student_${cls.id.substring(0, 5)}_${i + 1}`,
          password: hashedPassword,
          role: 'student',
          schoolId,
          isActive: true
        });
      }

      await prisma.user.createMany({ data: usersData, skipDuplicates: true });

      const newUsers = await prisma.user.findMany({
        where: { schoolId, username: { startsWith: `student_${cls.id.substring(0, 5)}_` } }
      });

      const studentsData = newUsers.map((u, i) => ({
        id: uuidv4(),
        userId: u.id,
        student_id: `STU-${cls.id.substring(0, 5)}-${i + 1}`,
        classId: cls.id,
        status: 'active'
      }));

      if (studentsData.length > 0) {
        await prisma.student.createMany({ data: studentsData, skipDuplicates: true });
      }
    }

    const allStudentsInClass = await prisma.student.findMany({ where: { classId: cls.id } });

    let exam = await prisma.exam.findFirst({ where: { schoolId, classId: cls.id, subjectId: subject.id } });
    if (!exam) {
      exam = await prisma.exam.create({
        data: {
          name: `Final Exam - ${cls.class_name}`,
          type: 'Final',
          subjectId: subject.id,
          classId: cls.id,
          termId: term.id,
          schoolId,
          totalMarks: 100,
          status: 'published'
        }
      });
      console.log(`Created exam for class ${cls.class_name}`);
    }

    console.log(`Assigning marks for ${allStudentsInClass.length} students in class ${cls.class_name}...`);
    const resultsData = allStudentsInClass.map(student => ({
      id: uuidv4(),
      examId: exam.id,
      studentId: student.id,
      marks: Math.floor(Math.random() * 41) + 60,
      grade: 'A',
      remarks: 'Good'
    }));

    if (resultsData.length > 0) {
      await prisma.examResult.createMany({ data: resultsData, skipDuplicates: true });
    }
  }

  console.log("Seeding completed successfully!");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
