const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Student ID Repair Script ---');
    console.log('Goal: Convert unreadable S-UUID IDs into human-friendly Code (matching username)');

    const students = await prisma.student.findMany({
        where: {
            student_id: { startsWith: 'S-' },
            // only target the ones that look like S-UUID (more than 12 chars)
        },
        include: { user: true }
    });

    const targetStudents = students.filter(s => s.student_id.length > 12);

    console.log(`Found ${targetStudents.length} students with potentially garbled IDs.`);

    if (targetStudents.length === 0) {
        console.log('No garbled IDs found. System is clean.');
        return;
    }

    let repairedCount = 0;
    for (const student of targetStudents) {
        const username = student.user?.username;
        if (!username) continue;

        const newId = username.toUpperCase();
        
        console.log(`Repairing student: ${student.user.name}`);
        console.log(`  OLD ID: ${student.student_id}`);
        console.log(`  NEW ID: ${newId}`);

        try {
            await prisma.student.update({
                where: { id: student.id },
                data: { student_id: newId }
            });
            repairedCount++;
        } catch (err) {
            console.error(`  FAILED to update ${student.user.name}:`, err.message);
        }
    }

    console.log('--- Repair Complete ---');
    console.log(`Successfully repaired ${repairedCount} student IDs.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
