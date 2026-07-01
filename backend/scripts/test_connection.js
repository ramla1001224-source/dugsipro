const { PrismaClient } = require('@prisma/client');

// Try direct connection
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

prisma.$queryRaw`SELECT 1`
  .then(() => console.log('Connected via DIRECT_URL!'))
  .catch(e => console.log('Error:', e.message))
  .finally(() => prisma.$disconnect());
