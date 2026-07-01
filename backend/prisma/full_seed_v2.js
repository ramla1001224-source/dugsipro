const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Comprehensive Full System Seed...');

    // 1. CLEANUP (Robust cleanup with both quoted and unquoted names)
    console.log('🧹 Cleaning existing data...');
    const tablenames = ['Attendance', 'ExamResult', 'Exam', 'Timetable', 'Grade', 'MonthlyPaymentRecord', 'Payment', 'Invoice', 'FeeStructure', 'SubjectAssignment', 'Student', 'Teacher', 'Staff', 'ParentStudent', 'Parent', 'Class', 'Subject', 'User', 'Enrollment'];
    for (const tablename of tablenames) {
        try {
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
        } catch (e) {
            try {
                await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tablename} CASCADE;`);
            } catch (e2) {
                console.log(`Table ${tablename} skip.`);
            }
        }
    }

    // 2. SCHOOL & ACADEMIC YEAR
    const school = await prisma.school.create({
        data: { name: 'Smart School Pro', address: 'Garowe, Somalia', phone: '+252-000-000', email: 'info@smartschool.so' }
    });
    const academicYear = await prisma.academicYear.create({
        data: { name: '2023-2024', startDate: new Date('2023-01-01'), endDate: new Date('2023-12-31'), isCurrent: true, schoolId: school.id }
    });

    // 3. USERS (Admin & Accountant)
    const password = await bcrypt.hash('admin123', 10);
    const accountantPass = await bcrypt.hash('accountant123', 10);

    await prisma.user.create({ data: { name: 'Administrator', username: 'admin', password: password, role: 'admin', schoolId: school.id } });
    await prisma.user.create({ data: { name: 'School Accountant', username: 'accountant', password: accountantPass, role: 'accountant', schoolId: school.id } });

    // 4. SUBJECTS (10 Subjects)
    const subjects = [
        { name: 'Mathematics', code: 'MATH101' },
        { name: 'Physics', code: 'PHYS101' },
        { name: 'Chemistry', code: 'CHEM101' },
        { name: 'Biology', code: 'BIOL101' },
        { name: 'English', code: 'ENGL101' },
        { name: 'Arabic', code: 'ARAB101' },
        { name: 'Islamic Studies', code: 'ISLM101' },
        { name: 'Geography', code: 'GEOG101' },
        { name: 'History', code: 'HIST101' },
        { name: 'ICT', code: 'ICT101' }
    ];
    const createdSubjects = [];
    for (const s of subjects) {
        const sub = await prisma.subject.create({ data: { ...s, schoolId: school.id } });
        createdSubjects.push(sub);
    }

    // 4. TEACHERS (10 Teachers)
    const createdTeachers = [];
    for (let i = 1; i <= 10; i++) {
        const u = await prisma.user.create({
            data: { name: `Teacher ${i}`, username: `teacher${i}`, password: password, role: 'teacher', schoolId: school.id }
        });
        const t = await prisma.teacher.create({
            data: { userId: u.id, subject: createdSubjects[i - 1].name, phone: `+252-61-${1000000 + i}`, salary: 300, schoolId: school.id }
        });
        createdTeachers.push(t);
    }
    // 5. CLASSES (Form 1, 2, 3, 4 with Sections A & B)
    const classNames = ['Form One', 'Form Two', 'Form Three', 'Form Four'];
    const sections = ['A', 'B'];
    const createdClasses = [];
    let teacherIdx = 0;

    for (const name of classNames) {
        // Create the Class first (without a section name)
        const cls = await prisma.class.create({
            data: { class_name: name, teacherId: createdTeachers[teacherIdx % 10].id, schoolId: school.id }
        });
        createdClasses.push(cls);

        for (const sectionName of sections) {
            const sec = await prisma.section.create({
                data: { name: sectionName, classId: cls.id, teacherId: createdTeachers[teacherIdx % 10].id, schoolId: school.id }
            });
            teacherIdx++;

            // Create Fee Structure for this class (once per section or once per class? Usually once per class)
            await prisma.feeStructure.create({
                data: { classId: cls.id, name: `Tuition Fee ${sectionName}`, amount: 50, frequency: 'monthly', schoolId: school.id }
            });

            // Assign all subjects to this class
            for (let j = 0; j < createdSubjects.length; j++) {
                await prisma.subjectAssignment.create({
                    data: { subjectId: createdSubjects[j].id, classId: cls.id, teacherId: createdTeachers[j % 10].id, schoolId: school.id }
                });
            }
        }
    }

    // 6. STUDENTS (200 Students)
    console.log('👤 Seeding 200 Students...');
    const students = [];
    // Get all sections created above
    const allSections = await prisma.section.findMany({ include: { clss: true } });

    for (let i = 1; i <= 200; i++) {
        const sectionIdx = Math.floor((i - 1) / 25); // 25 students per section (8 sections * 25 = 200)
        const targetSection = allSections[sectionIdx];
        
        const u = await prisma.user.create({
            data: { name: `Student ${i}`, username: `student${i}`, password: password, role: 'student', schoolId: school.id }
        });
        const s = await prisma.student.create({
            data: {
                userId: u.id,
                student_id: `STU${1000 + i}`,
                class: targetSection.clss.class_name, 
                classId: targetSection.classId, 
                sectionId: targetSection.id,
                gender: i % 2 === 0 ? 'Male' : 'Female',
                schoolId: school.id
            }
        });
        const e = await prisma.enrollment.create({
            data: {
                studentId: s.id,
                classId: targetSection.classId,
                sectionId: targetSection.id,
                academicYearId: academicYear.id,
                schoolId: school.id,
                isCurrent: true
            }
        });
        students.push({ ...s, classId: targetSection.classId });
    }

    // 7. PAYMENTS (Seed some payments for Dashboard)
    console.log('💰 Seeding 150 Payments...');
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    for (let i = 0; i < 150; i++) {
        const student = students[i];
        // Create Monthly Record
        await prisma.monthlyPaymentRecord.create({
            data: { studentId: student.id, month, year, status: 'paid' }
        });
        // Create actual Payment
        await prisma.payment.create({
            data: { studentId: student.id, amount: 50, payment_method: 'Cash', description: `Tuition Fee for ${month}/${year}`, date: today }
        });
    }

    // 8. TIMETABLE
    console.log('📅 Seeding Timetable...');
    const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
    const periods = [
        { start: '08:00', end: '08:40' },
        { start: '08:40', end: '09:20' },
        { start: '09:20', end: '10:00' },
        { start: '10:40', end: '11:20' },
        { start: '11:20', end: '12:00' },
        { start: '12:00', end: '12:40' }
    ];

    for (const cls of createdClasses) {
        for (const day of days) {
            const numPeriods = (day === 'Thursday') ? 4 : 6;
            for (let p = 0; p < numPeriods; p++) {
                const subjIdx = (p + createdClasses.indexOf(cls)) % createdSubjects.length;
                await prisma.timetable.create({
                    data: {
                        classId: cls.id,
                        subjectId: createdSubjects[subjIdx].id,
                        teacherId: createdTeachers[subjIdx % 10].id,
                        day: day,
                        startTime: periods[p].start,
                        endTime: periods[p].end,
                        room: cls.class_name
                    }
                });
            }
        }
    }

    // 9. ATTENDANCE HISTORY (14 Days, 2 Sessions)
    console.log('📝 Seeding Attendance History...');
    for (let i = 0; i < 7; i++) { // Reduced to 7 days for faster seeding
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        if (date.getDay() === 5) continue; // Skip Friday

        for (const s of students) {
            await prisma.attendance.create({
                data: { studentId: s.id, classId: s.classId, date: date, status: Math.random() > 0.1 ? 'Present' : 'Absent', session: 'Break 1' }
            });
            await prisma.attendance.create({
                data: { studentId: s.id, classId: s.classId, date: date, status: Math.random() > 0.1 ? 'Present' : 'Absent', session: 'Break 2' }
            });
        }
    }

    console.log('✅ Full System Seed Complete!');
    console.log('Expected Dashboard Stats:');
    console.log('- Total Student Payments: $7,500 (150 students * $50)');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
