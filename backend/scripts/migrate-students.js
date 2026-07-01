const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting migration: Student ID as Username...');

    const students = await prisma.student.findMany({
        include: { user: true }
    });

    console.log(`Found ${students.length} students to process.`);

    for (const student of students) {
        if (student.user.username !== student.student_id) {
            console.log(`Updating student: ${student.user.name} (${student.student_id})`);
            await prisma.user.update({
                where: { id: student.userId },
                data: { username: student.student_id }
            });
        }
    }

    console.log('Migration complete!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
