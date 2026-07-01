const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find the school named "1"
  const school = await prisma.school.findFirst({
    where: { name: '1' },
    include: {
      Classes: {
        include: { Sections: true }
      }
    }
  });

  if (!school) { console.log("School '1' not found!"); return; }

  console.log(`School: ${school.name} (${school.id})`);
  console.log(`Classes: ${school.Classes.length}`);

  for (const cls of school.Classes) {
    console.log(`  Class: ${cls.class_name} - Sections: ${cls.Sections.length}`);
    for (const sec of cls.Sections) {
      const count = await prisma.student.count({ where: { classId: cls.id, sectionId: sec.id } });
      console.log(`    Section: ${sec.name} - Students: ${count}`);
    }
  }

  const subjects = await prisma.subject.findMany({ where: { schoolId: school.id } });
  console.log(`Subjects: ${subjects.length}`, subjects.map(s => s.name));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
