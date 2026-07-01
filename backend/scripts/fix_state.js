const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

async function fix() {
  const schoolId = '1f4b6ac3-ab43-4c6f-8996-43c311e558aa'; 
  
  const targetYear = await prisma.academicYear.findFirst({ where: { schoolId, name: 'sanad' } });
  const oldYear = await prisma.academicYear.findFirst({ where: { schoolId, name: 'sdvdfbf' } });

  console.log(`Setting old year (${oldYear.name}) to not current...`);
  await prisma.academicYear.update({ where: { id: oldYear.id }, data: { isCurrent: false } });
  
  console.log(`Setting target year (${targetYear.name}) to current...`);
  await prisma.academicYear.update({ where: { id: targetYear.id }, data: { isCurrent: true } });

  console.log('Marking old year enrollments as not current...');
  await prisma.enrollment.updateMany({ 
    where: { schoolId, academicYearId: oldYear.id }, 
    data: { isCurrent: false, status: 'promoted' } 
  });

  console.log('Marking target year enrollments as current...');
  await prisma.enrollment.updateMany({ 
    where: { schoolId, academicYearId: targetYear.id }, 
    data: { isCurrent: true, status: 'active' } 
  });

  // Ensure all students in school 1 are active
  await prisma.student.updateMany({
      where: { schoolId },
      data: { status: 'active' }
  });

  console.log('Done!');
}

fix().catch(console.error).finally(() => prisma.$disconnect());
