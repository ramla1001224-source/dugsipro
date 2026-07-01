const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log('Starting migration to populate academicYearId for existing records...');

  // 1. Migrate MonthlyPaymentRecord
  const records = await prisma.monthlyPaymentRecord.findMany({
    where: { academicYearId: null },
    include: {
      student: {
        include: {
          Enrollments: {
            include: { academicYear: true }
          }
        }
      }
    }
  });

  console.log(`Found ${records.length} MonthlyPaymentRecords to migrate.`);

  for (const record of records) {
    if (!record.student || !record.student.Enrollments.length) continue;

    const recordDate = new Date(record.year, record.month - 1, 15);
    const enrollment = record.student.Enrollments.find(e => {
      if (!e.academicYear) return false;
      return new Date(e.academicYear.startDate) <= recordDate && new Date(e.academicYear.endDate) >= recordDate;
    }) || record.student.Enrollments.find(e => e.isCurrent) || record.student.Enrollments[0];

    if (enrollment && enrollment.academicYearId) {
      await prisma.monthlyPaymentRecord.update({
        where: { id: record.id },
        data: { academicYearId: enrollment.academicYearId }
      });
    }
  }

  // 2. Migrate Payment
  const payments = await prisma.payment.findMany({
    where: { academicYearId: null },
    include: {
      student: {
        include: {
          Enrollments: {
            include: { academicYear: true }
          }
        }
      }
    }
  });

  console.log(`Found ${payments.length} Payments to migrate.`);

  for (const payment of payments) {
    if (!payment.student || !payment.student.Enrollments.length) continue;

    // Use payment date or month/year if available
    let dateToUse = payment.date;
    if (payment.month && payment.year) {
      dateToUse = new Date(payment.year, payment.month - 1, 15);
    }

    const enrollment = payment.student.Enrollments.find(e => {
      if (!e.academicYear) return false;
      return new Date(e.academicYear.startDate) <= dateToUse && new Date(e.academicYear.endDate) >= dateToUse;
    }) || payment.student.Enrollments.find(e => e.isCurrent) || payment.student.Enrollments[0];

    if (enrollment && enrollment.academicYearId) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { academicYearId: enrollment.academicYearId }
      });
    }
  }

  console.log('Migration completed successfully.');
}

migrate()
  .catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
