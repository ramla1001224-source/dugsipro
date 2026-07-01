const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
require('dotenv').config();

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } }
});

async function main() {
  const school = await prisma.school.findFirst({ where: { name: '1' } });
  if (!school) return console.log("School '1' not found!");
  const schoolId = school.id;
  console.log(`School: ${school.name} (ID: ${schoolId})`);

  const year = await prisma.academicYear.findFirst({
    where: { schoolId, isCurrent: true },
    include: { Terms: true }
  });
  if (!year) return console.log("No current academic year!");
  const term = year.Terms[0];
  console.log(`Year: ${year.name}, Term: ${term?.name}`);

  const classes = await prisma.class.findMany({
    where: { schoolId },
    include: { Sections: true },
    orderBy: { class_name: 'asc' }
  });

  const subjects = await prisma.subject.findMany({ where: { schoolId } });
  
  const STUDENTS_PER_SECTION = 60;
  const hashedPwd = '$2b$10$YourHashedPasswordHere123456789012345678901234567890';
  let totalCreated = 0;

  for (const cls of classes) {
    if (cls.Sections.length === 0) continue;
    console.log(`\nClass: ${cls.class_name} (${cls.Sections.length} sections)`);

    for (const section of cls.Sections) {
      const existingStudents = await prisma.student.findMany({ 
        where: { sectionId: section.id },
        select: { student_id: true }
      });
      const existingIds = new Set(existingStudents.map(s => s.student_id));
      
      const needed = Math.max(0, STUDENTS_PER_SECTION - existingIds.size);
      if (needed === 0) {
        console.log(`  Section ${section.name}: full`);
        continue;
      }

      console.log(`  Section ${section.name}: adding ${needed} students (in parallel)...`);
      
      const newStudentsData = [];
      for (let i = existingIds.size; i < STUDENTS_PER_SECTION; i++) {
        const num = i + 1;
        const studentId = `${cls.class_name.replace(/[^a-zA-Z0-9]/g, '')}${section.name}${String(num).padStart(3, '0')}`.toLowerCase();
        const fullName = `Arday ${cls.class_name}-${section.name}-${num}`;
        
        if (existingIds.has(studentId)) continue;
        
        newStudentsData.push({ studentId, fullName, num });
      }

      // Process in batches of 20 to avoid overwhelming connection pool
      const batchSize = 20;
      for (let i = 0; i < newStudentsData.length; i += batchSize) {
        const batch = newStudentsData.slice(i, i + batchSize);
        await Promise.all(batch.map(async ({ studentId, fullName, num }) => {
          try {
            const user = await prisma.user.upsert({
              where: { username_schoolId: { username: studentId, schoolId } },
              update: {},
              create: {
                id: uuidv4(),
                username: studentId,
                password: hashedPwd,
                role: 'student',
                schoolId,
                name: fullName
              }
            });

            let studentRecord = await prisma.student.findFirst({ where: { userId: user.id } });
            if (!studentRecord) {
              studentRecord = await prisma.student.create({
                data: {
                  id: uuidv4(),
                  student_id: studentId,
                  classId: cls.id,
                  sectionId: section.id,
                  class: cls.class_name,
                  status: 'active',
                  userId: user.id,
                  gender: num % 2 === 0 ? 'male' : 'female',
                  dob: new Date('2010-01-01'),
                  phone: `06${String(Math.floor(Math.random() * 90000000) + 10000000)}`,
                }
              });
              totalCreated++;
            }

            await prisma.enrollment.upsert({
              where: { studentId_academicYearId: { studentId: studentRecord.id, academicYearId: year.id } },
              update: { classId: cls.id, sectionId: section.id, isCurrent: true },
              create: {
                id: uuidv4(),
                studentId: studentRecord.id,
                academicYearId: year.id,
                classId: cls.id,
                sectionId: section.id,
                schoolId,
                isCurrent: true,
                status: 'active',
                balance: 0
              }
            });
          } catch (e) {
            console.log(`    Error adding ${studentId}:`, e.message);
          }
        }));
      }
    }

    // After adding students, add exams & marks for this class
    if (!term) continue;
    const allStudentsInClass = await prisma.student.findMany({
      where: { classId: cls.id, status: 'active' },
      select: { id: true, sectionId: true }
    });

    for (const subject of subjects) {
      let exam = await prisma.exam.findFirst({
        where: { schoolId, classId: cls.id, subjectId: subject.id, termId: term.id }
      });

      if (!exam) {
        exam = await prisma.exam.create({
          data: {
            name: `${subject.name} - ${cls.class_name}`,
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
      }

      const existing = await prisma.examResult.findMany({ where: { examId: exam.id }, select: { studentId: true } });
      const existingSet = new Set(existing.map(r => r.studentId));
      const toMark = allStudentsInClass.filter(s => !existingSet.has(s.id));

      if (toMark.length > 0) {
        await prisma.examResult.createMany({
          data: toMark.map(s => ({
            id: uuidv4(),
            examId: exam.id,
            studentId: s.id,
            sectionId: s.sectionId,
            marks: Math.floor(Math.random() * 41) + 60,
            grade: 'A',
            remarks: 'Pass'
          })),
          skipDuplicates: true
        });
        console.log(`  Exam [${subject.name}]: ${toMark.length} marks added`);
      }
    }
  }

  console.log('\n=== DONE ===');
  console.log(`New Students Created in this run: ${totalCreated}`);
}

main()
  .catch(e => { console.error('FATAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
