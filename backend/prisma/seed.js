const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
	const password = await bcrypt.hash('admin123', 10);
	const adminUser = await prisma.user.upsert({
		where: { username: 'admin' },
		update: {},
		create: {
			name: 'Administrator',
			username: 'admin',
			password,
			role: 'admin'
		}
	});
	console.log('Admin user ensured:', adminUser.username);
}

main()
	.catch(e => { console.error(e); process.exit(1); })
	.finally(() => prisma.$disconnect());
