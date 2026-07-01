const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst({ where: { name: '1' } });
  const schoolId = school.id;

  // Get the current active year
  const activeYear = await prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } });
  console.log("Active Year:", activeYear.name, activeYear.id);

  // Get term for active year
  let activeTerm = await prisma.term.findFirst({ where: { academicYearId: activeYear.id } });
  if (!activeTerm) {
    activeTerm = await prisma.term.create({
      data: {
        name: 'Term 1',
        startDate: activeYear.startDate,
        endDate: activeYear.endDate,
        academicYearId: activeYear.id
      }
    });
    console.log("Created term for active year");
  }
  console.log("Active Term:", activeTerm.name, activeTerm.id);

  // Update ALL exams of this school to use the active term
  const result = await prisma.exam.updateMany({
    where: { schoolId },
    data: { termId: activeTerm.id }
  });
  console.log(`Updated ${result.count} exams to use active term`);

  // Verify
  const sample = await prisma.exam.findFirst({ where: { schoolId } });
  console.log("Sample exam termId:", sample.termId, "= Active termId:", activeTerm.id, "| Match:", sample.termId === activeTerm.id);
  console.log("\nDONE! All exams now linked to the current active academic year term.");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
