const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  const newPassword = process.argv[2] || 'admin123';
  const hashed = await bcrypt.hash(newPassword, 10);
  const user = await prisma.user.updateMany({ where: { username: 'admin' }, data: { password: hashed } });
  console.log('Reset result:', user);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
