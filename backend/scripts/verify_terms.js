const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst({ where: { name: '1' } });
  const schoolId = school.id;

  const activeYear = await prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } });
  console.log("Active Year:", activeYear.name, activeYear.id);

  const activeTerm = await prisma.term.findFirst({ where: { academicYearId: activeYear.id } });
  console.log("Active Term:", activeTerm.name, activeTerm.id);

  const examsWithTerm = await prisma.exam.count({ where: { schoolId, termId: activeTerm.id } });
  const examsNoTerm = await prisma.exam.count({ where: { schoolId, termId: null } });
  const examsTotal = await prisma.exam.count({ where: { schoolId } });

  console.log("\nExams with active term:", examsWithTerm);
  console.log("Exams with NO term:", examsNoTerm);
  console.log("Total exams:", examsTotal);

  // Show what termIds exist in exams
  const termIds = await prisma.exam.findMany({ 
    where: { schoolId }, 
    select: { termId: true },
    distinct: ['termId']
  });
  console.log("\nDistinct termIds in exams:", termIds.map(e => e.termId));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
