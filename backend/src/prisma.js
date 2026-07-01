require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prismaBase = new PrismaClient({
    log: ['error', 'warn'],
});

// GLOBAL DEFENSIVE PROXY:
// This handles Prisma Client casing inconsistencies (e.g. academicYear vs AcademicYear)
// by automatically checking for PascalCase variants if a camelCase property is missing.
// This prevents 'Cannot read properties of undefined (reading findFirst)' crashes.
const prisma = new Proxy(prismaBase, {
    get(target, prop) {
        // Only proxy model-like property accesses
        if (typeof prop === 'string' && !prop.startsWith('$') && prop !== 'then' && prop !== 'catch') {
            if (target[prop]) return target[prop];
            const pascalProp = prop.charAt(0).toUpperCase() + prop.slice(1);
            if (target[pascalProp]) {
                console.log(`[Defensive Prisma] Map: ${prop} -> ${pascalProp}`);
                return target[pascalProp];
            }
        }
        return target[prop];
    }
});

prisma.$connect()
    .then(() => console.log('[Dugsi Pro System] Database connected successfully'))
    .catch((err) => {
        console.error('[Dugsi Pro System] Failed to connect to database:', err.message);
    });

module.exports = prisma;
