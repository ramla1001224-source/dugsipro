const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst({ where: { name: '1' } });
  if (!school) return console.log("School 1 not found");
  
  const currentYear = await prisma.academicYear.findFirst({
    where: { schoolId: school.id, isCurrent: true },
    include: { Terms: true, Enrollments: true }
  });
  
  if (!currentYear) return console.log("No current year found.");
  
  console.log("Current Year:", currentYear.name, currentYear.id);
  console.log("Terms:");
  currentYear.Terms.forEach(t => console.log(`  - ${t.name} (ID: ${t.id})`));
  
  console.log("Total Enrollments in Current Year:", currentYear.Enrollments.length);
  
  // also let's look for term1
  const term1 = currentYear.Terms.find(t => t.name.toLowerCase() === 'term1' || t.name.toLowerCase() === 'term 1');
  if (term1) console.log("Term 1 ID is:", term1.id);
  else console.log("term1 not found in current year terms.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
