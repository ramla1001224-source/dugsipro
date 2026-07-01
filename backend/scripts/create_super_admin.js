/**
 * CREATE SUPER ADMIN
 * Run: node scripts/create_super_admin.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
    const username = 'superadmin';
    const password = 'SuperAdmin@2025';
    const name = 'Super Admin';

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
        console.log('✅ Super admin already exists:', existing.username);
        return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
        data: {
            name,
            username,
            password: hashed,
            role: 'super_admin',
            schoolId: null, // Super admin has no school
        }
    });

    console.log('✅ Super Admin created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Username :', user.username);
    console.log('  Password :', password);
    console.log('  Role     :', user.role);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  Change the password after first login!');
}

main()
    .catch(e => { console.error('❌ Error:', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
