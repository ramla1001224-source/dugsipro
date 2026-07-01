const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst({ where: { name: '1' } });
  console.log("School:", school?.id, school?.name);

  const years = await prisma.academicYear.findMany({ where: { schoolId: school.id } });
  console.log("\nAcademic Years:");
  years.forEach(y => console.log(`  ${y.id} | ${y.name} | isCurrent: ${y.isCurrent} | ${y.startDate.toISOString().slice(0,10)} - ${y.endDate.toISOString().slice(0,10)}`));

  const terms = await prisma.term.findMany({ where: { academicYear: { schoolId: school.id } } });
  console.log("\nTerms:");
  terms.forEach(t => console.log(`  ${t.id} | ${t.name} | yearId: ${t.academicYearId}`));

  const exams = await prisma.exam.findMany({ where: { schoolId: school.id }, select: { id: true, name: true, termId: true, status: true } });
  console.log("\nExams count:", exams.length);
  if (exams.length > 0) {
    console.log("Sample exam:", exams[0]);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
