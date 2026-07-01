const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

async function moveEnrollments() {
  const school = await prisma.school.findFirst({ where: { name: '1' } });
  
  const sanad = await prisma.academicYear.findFirst({ where: { name: 'sanad', schoolId: school.id } });
  const hanad = await prisma.academicYear.findFirst({ where: { name: 'hanad', schoolId: school.id, isCurrent: true } });

  console.log('Sanad ID:', sanad?.id);
  console.log('Hanad ID:', hanad?.id);

  if (sanad && hanad) {
    // Only update enrollments that belong to the old sanad
    const updated = await prisma.enrollment.updateMany({
      where: { academicYearId: sanad.id },
      data: { academicYearId: hanad.id, isCurrent: true }
    });
    console.log(`Moved ${updated.count} enrollments to hanad`);
  } else {
    console.log("Could not find sanad or hanad for school 1");
  }
}

moveEnrollments()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
