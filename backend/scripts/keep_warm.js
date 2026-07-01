const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function keepWarm() {
    const startTime = Date.now();
    try {
        console.log(`[${new Date().toISOString()}] Heartbeat: Touching database...`);
        // Perform a minimal, fast query
        await prisma.$queryRaw`SELECT 1`;
        console.log(`[${new Date().toISOString()}] Heartbeat: Database is warm. Took ${Date.now() - startTime}ms`);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Heartbeat FAILED:`, err.message);
    } finally {
        await prisma.$disconnect();
    }
}

// If run directly
if (require.main === module) {
    keepWarm();
}

module.exports = keepWarm;
