const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  const newUsername = process.argv[2];
  const newPassword = process.argv[3];
  if (!newUsername || !newPassword) {
    console.error('Usage: node setAdminCreds.js <username> <password>');
    process.exit(1);
  }

  const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (!admin) {
    console.error('No admin user found');
    process.exit(1);
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  const updated = await prisma.user.update({ where: { id: admin.id }, data: { username: newUsername, password: hashed } });
  console.log('Admin credentials updated:', { id: updated.id, username: updated.username });
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
