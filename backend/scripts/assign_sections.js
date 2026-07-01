const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const classes = await prisma.class.findMany({
    include: { Sections: true }
  });

  for (const cls of classes) {
    if (cls.Sections.length > 0) {
      const firstSectionId = cls.Sections[0].id;
      
      const res = await prisma.student.updateMany({
        where: { classId: cls.id, sectionId: null },
        data: { sectionId: firstSectionId }
      });
      
      console.log(`Updated ${res.count} students in class ${cls.class_name} to section ${cls.Sections[0].name}`);

      // Also update ExamResults sectionId if necessary
      await prisma.examResult.updateMany({
        where: { student: { classId: cls.id } },
        data: { sectionId: firstSectionId }
      });
    }
  }

  console.log("Section IDs assigned successfully!");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
