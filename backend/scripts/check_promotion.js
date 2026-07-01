const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } }
});

async function check() {
  const school = await prisma.school.findFirst({ where: { name: '1' } });
  if (!school) return console.log("School '1' not found!");
  
  const years = await prisma.academicYear.findMany({ where: { schoolId: school.id } });
  console.log('Academic Years:');
  for (const y of years) {
    const enrollments = await prisma.enrollment.count({ where: { academicYearId: y.id } });
    console.log(`- ${y.name} (isCurrent: ${y.isCurrent}, ID: ${y.id}): ${enrollments} enrollments`);
  }

  // Count current enrollments
  const currentEnrolls = await prisma.enrollment.count({ where: { schoolId: school.id, isCurrent: true } });
  console.log(`\nTotal Current Enrollments: ${currentEnrolls}`);

  // Count old active enrollments
  const oldActiveEnrolls = await prisma.enrollment.count({ where: { schoolId: school.id, status: 'active', isCurrent: false } });
  console.log(`Old active enrollments (not current): ${oldActiveEnrolls}`);
}

check().catch(console.error).finally(() => prisma.$disconnect());
