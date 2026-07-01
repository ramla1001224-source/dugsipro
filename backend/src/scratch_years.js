const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const years = await prisma.academicYear.findMany({
        orderBy: { startDate: 'desc' },
        select: { id: true, name: true, startDate: true, isCurrent: true, schoolId: true }
    });
    console.log(JSON.stringify(years, null, 2));
}
main().finally(() => prisma.$disconnect());
