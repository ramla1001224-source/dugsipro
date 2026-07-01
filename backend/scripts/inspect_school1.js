const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } }
});

async function main() {
  const school = await prisma.school.findFirst({ where: { name: '1' } });
  if (!school) return console.log("School '1' not found!");
  console.log(`School: ${school.name} (ID: ${school.id})`);

  const year = await prisma.academicYear.findFirst({
    where: { schoolId: school.id, isCurrent: true },
    include: { Terms: true }
  });
  console.log(`Current Year: ${year?.name} (ID: ${year?.id})`);
  console.log(`Terms: ${year?.Terms.map(t => t.name).join(', ')}`);

  const classes = await prisma.class.findMany({
    where: { schoolId: school.id },
    include: { Sections: true },
    orderBy: { class_name: 'asc' }
  });

  console.log(`\nTotal Classes: ${classes.length}`);
  for (const cls of classes) {
    const studentCount = await prisma.student.count({ where: { classId: cls.id } });
    console.log(`  ${cls.class_name}: ${cls.Sections.length} sections [${cls.Sections.map(s => s.name).join(', ')}] - ${studentCount} students`);
  }

  const subjects = await prisma.subject.findMany({ where: { schoolId: school.id } });
  console.log(`\nSubjects (${subjects.length}): ${subjects.map(s => s.name).join(', ')}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
