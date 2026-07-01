const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting academic seed...');

    const adminPassword = await bcrypt.hash('admin123', 10);
    const accountantPassword = await bcrypt.hash('accountant123', 10);

    // 1. Ensure Admin and Accountant
    await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: { name: 'Administrator', username: 'admin', password: adminPassword, role: 'admin' }
    });

    await prisma.user.upsert({
        where: { username: 'accountant' },
        update: {},
        create: { name: 'School Accountant', username: 'accountant', password: accountantPassword, role: 'accountant' }
    });

    // 2. Create Classes
    const classNames = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'];
    const createdClasses = [];
    for (const name of classNames) {
        const cls = await prisma.class.upsert({
            where: { id: `cls-${name.replace(' ', '-')}` }, // deterministic ID for seeding
            update: {},
            create: { id: `cls-${name.replace(' ', '-')}`, class_name: name, section: 'A' }
        });
        createdClasses.push(cls);
    }
    console.log(`Ensured ${createdClasses.length} classes.`);

    // 3. Create Subjects
    const subjectData = [
        { name: 'Arabic', code: 'AR101' },
        { name: 'Math', code: 'MA101' },
        { name: 'English', code: 'EN101' },
        { name: 'Islamic', code: 'IS101' },
        { name: 'Science', code: 'SC101' }
    ];
    for (const s of subjectData) {
        await prisma.subject.upsert({
            where: { id: `sub-${s.code}` },
            update: {},
            create: { id: `sub-${s.code}`, name: s.name, code: s.code }
        });
    }
    console.log(`Ensured ${subjectData.length} subjects.`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
