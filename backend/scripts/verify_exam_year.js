const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst({ where: { name: '1' } });
  const schoolId = school.id;

  const exams = await prisma.exam.findMany({
    where: { schoolId },
    include: {
      term: {
        include: { academicYear: true }
      }
    },
    take: 1
  });

  if (exams.length > 0) {
    console.log("Exam Term:", exams[0].term?.name);
    console.log("Exam Academic Year ID:", exams[0].term?.academicYearId);
    console.log("Exam Academic Year IsCurrent:", exams[0].term?.academicYear?.isCurrent);
  }

  const activeYear = await prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } });
  console.log("Expected Active Year ID:", activeYear.id);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
