const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst({ where: { name: '1' } });
  if (!school) { console.log("School '1' not found!"); return; }
  console.log(`School: ${school.name}`);

  // Get active academic year
  const academicYear = await prisma.academicYear.findFirst({ 
    where: { schoolId: school.id, isCurrent: true } 
  });
  if (!academicYear) { console.log("No active academic year!"); return; }
  console.log(`Academic Year: ${academicYear.name}`);

  // Get all students in this school with their class and section
  const students = await prisma.student.findMany({
    where: { 
      clss: { schoolId: school.id },
      classId: { not: null },
      sectionId: { not: null }
    },
    select: { id: true, classId: true, sectionId: true }
  });

  console.log(`Total students found: ${students.length}`);

  // Check existing enrollments
  const existingEnrollments = await prisma.enrollment.findMany({
    where: { schoolId: school.id, academicYearId: academicYear.id },
    select: { studentId: true }
  });
  const enrolledStudentIds = new Set(existingEnrollments.map(e => e.studentId));
  console.log(`Already enrolled: ${enrolledStudentIds.size}`);

  // Create enrollments for students not yet enrolled
  const toEnroll = students.filter(s => !enrolledStudentIds.has(s.id));
  console.log(`Need to enroll: ${toEnroll.length}`);

  if (toEnroll.length === 0) {
    console.log("All students already enrolled!");
    return;
  }

  const enrollmentsData = toEnroll.map(s => ({
    id: uuidv4(),
    studentId: s.id,
    classId: s.classId,
    sectionId: s.sectionId,
    academicYearId: academicYear.id,
    schoolId: school.id,
    status: 'active',
    isCurrent: true
  }));

  // Batch insert
  const batchSize = 100;
  let created = 0;
  for (let i = 0; i < enrollmentsData.length; i += batchSize) {
    const batch = enrollmentsData.slice(i, i + batchSize);
    await prisma.enrollment.createMany({ data: batch, skipDuplicates: true });
    created += batch.length;
    console.log(`Enrolled ${created}/${toEnroll.length}...`);
  }

  console.log(`\n=== Done! Created ${created} enrollments ===`);

  // Verify
  const totalEnrolled = await prisma.enrollment.count({ 
    where: { schoolId: school.id, academicYearId: academicYear.id, isCurrent: true } 
  });
  console.log(`Total active enrollments: ${totalEnrolled}`);
}

main()
  .catch(e => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
