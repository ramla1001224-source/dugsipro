const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst({ where: { name: '1' } });
  
  const result = await prisma.exam.updateMany({
    where: { schoolId: school.id, type: 'Midterm' },
    data: { type: 'midterm' }
  });

  console.log(`Updated ${result.count} exams to have type 'midterm' instead of 'Midterm'`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
