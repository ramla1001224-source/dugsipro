const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Cleaning existing data...');
    // Delete in reverse order of dependencies
    await prisma.enrollment.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.attendance.deleteMany();
    await prisma.student.deleteMany();
    await prisma.teacher.deleteMany();
    await prisma.section.deleteMany();
    await prisma.subjectAssignment.deleteMany();
    await prisma.subject.deleteMany();
    await prisma.academicYear.deleteMany();
    await prisma.school.deleteMany();
    await prisma.user.deleteMany();

    console.log('🚀 Creating Owner Account...');

    // 1. Create a School
    const school = await prisma.school.create({
        data: {
            name: 'Smart School Pro Test',
            address: 'Hargeisa, Somaliland',
            phone: '+252-63-000000',
            email: 'test@smartschool.so'
        }
    });

    // 2. Create an Academic Year
    const academicYear = await prisma.academicYear.create({
        data: {
            name: '2025-2026',
            startDate: new Date('2025-01-01'),
            endDate: new Date('2025-12-31'),
            isCurrent: true,
            schoolId: school.id
        }
    });

    // 3. Create the Owner User
    const password = await bcrypt.hash(process.env.OWNER_PASS || Math.random().toString(36).slice(-8), 10);
    const user = await prisma.user.create({
        data: {
            name: 'Hanad Owner',
            username: 'Hanad',
            password: password,
            role: 'owner',
            schoolId: school.id
        }
    });

    // 4. Set as School SuperAdmin
    await prisma.school.update({
        where: { id: school.id },
        data: { superAdminId: user.id }
    });

    console.log('✅ Owner Account Created Successfully!');
    console.log('Username: Hanad');
    console.log('Password: wllhanad3311@');
    console.log('School ID:', school.id);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
