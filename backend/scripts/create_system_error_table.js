require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "SystemError" (
                id TEXT PRIMARY KEY,
                message TEXT NOT NULL,
                stack TEXT,
                source TEXT,
                path TEXT,
                method TEXT,
                timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        `);
        console.log('✅ SystemError table created (or already exists)');
    } catch (err) {
        console.error('❌ Failed:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
