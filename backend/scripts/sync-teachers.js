const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncTeachers() {
  console.log('--- Starting Teacher Synchronization ---');
  try {
    // 1. Find all users with role 'teacher'
    const teachers = await prisma.user.findMany({
      where: { role: 'teacher' },
      include: { Teacher: true }
    });

    console.log(`Found ${teachers.length} teacher users.`);
    let fixedCount = 0;

    for (const user of teachers) {
      if (!user.Teacher) {
        console.log(`Fixing missing Teacher profile for: ${user.username} (${user.name})`);
        await prisma.teacher.create({
          data: {
            userId: user.id,
            subject: 'General',
            phone: user.phone || null,
            salary: 0
          }
        });
        fixedCount++;
      }
    }

    console.log(`--- Sync Complete ---`);
    console.log(`Fixed ${fixedCount} missing teacher profiles.`);
  } catch (err) {
    console.error('Error during synchronization:', err);
  } finally {
    await prisma.$disconnect();
  }
}

syncTeachers();
