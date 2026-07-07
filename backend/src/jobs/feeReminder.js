const cron = require('node-cron');
const prisma = require('../prisma');
const { sendGolisSMS } = require('../utils/smsHelper');

const startFeeReminderJob = () => {
    // Schedule job to run on the 5th of every month at 9:00 AM
    // Minutes: 0, Hours: 9, Day of Month: 5, Month: *, Day of Week: *
    cron.schedule('0 9 5 * *', async () => {
        console.log('[FEE REMINDER] Running the 5th-of-the-month automated fee reminder job...');
        
        try {
            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();

            // Find all students with 'unpaid' MonthlyPaymentRecord for the current month
            // We include ParentStudent to get the parent's phone number
            const unpaidRecords = await prisma.monthlyPaymentRecord.findMany({
                where: {
                    month: currentMonth,
                    year: currentYear,
                    status: 'unpaid',
                    OR: [
                        { academicYear: { isCurrent: true } },
                        { academicYearId: null }
                    ]
                },
                select: {
                    id: true,
                    studentId: true,
                    month: true,
                    year: true,
                    status: true,
                    student: {
                        include: {
                            user: true,
                            clss: true,
                            Parents: {
                                include: {
                                    parent: true
                                }
                            }
                        }
                    }
                }
            });

            console.log(`[FEE REMINDER] Found ${unpaidRecords.length} unpaid records for ${currentMonth}/${currentYear}.`);

            for (const record of unpaidRecords) {
                const student = record.student;
                if (!student) continue;

                // Attempt to get the parent's phone number
                const parentStudentRelation = student.Parents && student.Parents.length > 0 ? student.Parents[0] : null;
                const parentPhone = (parentStudentRelation && parentStudentRelation.parent ? parentStudentRelation.parent.phone : null) || student.parentPhone;

                if (parentPhone) {
                    const studentName = student.user?.name || "Ardaygaaga";
                    const monthName = new Date(currentYear, currentMonth - 1, 1).toLocaleString('so-SO', { month: 'long' }) || currentMonth;
                    
                    const message = `Asc Waalidka mudan, fadlan bixi lacagta diiwaanka iskuulka ee bisha ${monthName} ee ardaygaagu yahay ${studentName}. Mahadsanid, Maamulka Iskuulka.`;
                    
                    // Send SMS
                    await sendGolisSMS(parentPhone, message);
                } else {
                    console.log(`[FEE REMINDER] Skipped SMS for ${student.user?.name} - No parent phone number found.`);
                }
            }

            console.log('[FEE REMINDER] Automated fee reminder job completed successfully.');
        } catch (error) {
            console.error('[FEE REMINDER] Error running automated fee reminder job:', error);
        }
    });

    console.log('[CRON] Fee reminder job scheduled for the 5th of every month at 9:00 AM.');
};

module.exports = startFeeReminderJob;
