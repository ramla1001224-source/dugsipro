const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.post('/academic', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        if (!schoolId) return res.status(403).json({ message: 'No school associated with your account.' });

        // 1. CLEAR EXISTING DATA (Scoped to THIS school only)
        await prisma.timetable.deleteMany({ where: { schoolId } });
        await prisma.attendance.deleteMany({ where: { schoolId } });

        // 2. SEED TIMETABLE
        const classes = await prisma.class.findMany({ 
            where: { schoolId },
            include: { Sections: { include: { Subjects: true } } } 
        });
        const subjects = await prisma.subject.findMany({ where: { schoolId } });
        const teachers = await prisma.teacher.findMany({ 
            where: { user: { schoolId } },
            include: { user: true } 
        });

        if (classes.length === 0) {
            return res.status(400).json({ message: 'No classes found to seed. Create classes first.' });
        }

        const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
        const slots = [
            { start: '08:00', end: '08:45' },
            { start: '08:45', end: '09:30' },
            { start: '09:45', end: '10:30' }, // Break
            { start: '10:30', end: '11:15' },
            { start: '11:15', end: '12:00' }
        ];

        const timetableEntries = [];

        for (const cls of classes) {
            for (const day of days) {
                for (const slot of slots) {
                    let subjectId, teacherId;
                    const allSubjects = cls.Sections?.reduce((acc, sec) => acc.concat(sec.Subjects || []), []) || [];
                    
                    if (allSubjects.length > 0 && Math.random() > 0.3) {
                        const assignment = allSubjects[Math.floor(Math.random() * allSubjects.length)];
                        subjectId = assignment.subjectId;
                        teacherId = assignment.teacherId;
                    } else if (subjects.length > 0) {
                        const subj = subjects[Math.floor(Math.random() * subjects.length)];
                        subjectId = subj.id;
                        if (teachers.length > 0) {
                            teacherId = teachers[Math.floor(Math.random() * teachers.length)].id;
                        }
                    }

                    if (subjectId && teacherId) {
                        timetableEntries.push({
                            schoolId,
                            classId: cls.id,
                            subjectId,
                            teacherId,
                            day,
                            startTime: slot.start,
                            endTime: slot.end,
                            room: cls.class_name
                        });
                    }
                }
            }
        }

        if (timetableEntries.length > 0) {
            await prisma.timetable.createMany({ data: timetableEntries });
        }

        // 3. SEED ATTENDANCE
        const students = await prisma.student.findMany({ where: { user: { schoolId } } });

        const attendanceEntries = [];
        const today = new Date();

        for (let i = 0; i < 14; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            if (date.getDay() === 5) continue;

            for (const student of students) {
                if (!student.classId && !student.class) continue;

                const studentClassId = student.classId || classes.find(c => 
                    c.class_name.toLowerCase().includes(student.class?.toLowerCase())
                )?.id;

                if (studentClassId) {
                    const rand = Math.random();
                    let status = 'Present';
                    if (rand > 0.95) status = 'Absent';
                    else if (rand > 0.90) status = 'Late';

                    attendanceEntries.push({
                        schoolId,
                        studentId: student.id,
                        classId: studentClassId,
                        sectionId: student.sectionId,
                        date: date,
                        status
                    });
                }
            }
        }

        if (attendanceEntries.length > 0) {
            await prisma.attendance.createMany({ data: attendanceEntries });
        }

        // 4. SEED EXAMS & RESULTS
        if (subjects.length > 0) {
            const examTypes = ['midterm', 'final', 'quiz'];
            for (const subj of subjects) {
                for (const type of examTypes) {
                    const exam = await prisma.exam.create({
                        data: {
                            name: `${subj.name} ${type.charAt(0).toUpperCase() + type.slice(1)}`,
                            type,
                            subjectId: subj.id,
                            totalMarks: type === 'quiz' ? 20 : 100,
                            date: new Date(),
                            schoolId
                        }
                    });

                    const targetClasses = classes.slice(0, 2);
                    for (const cls of targetClasses) {
                        const clsStudents = students.filter(s => s.classId === cls.id);
                        const results = clsStudents.map(s => ({
                            examId: exam.id,
                            studentId: s.id,
                            sectionId: s.sectionId || null,
                            marks: Math.floor(Math.random() * exam.totalMarks * 0.4) + (exam.totalMarks * 0.6),
                            remarks: 'Good progress'
                        }));

                        if (results.length > 0) {
                            await prisma.examResult.createMany({ data: results });
                        }
                    }
                }
            }
        }
        // 5. SEED ACCOUNTANT USER
        const accountantExists = await prisma.user.findFirst({ where: { username: 'accountant' } });
        if (!accountantExists) {
            const bcrypt = require('bcrypt');
            const hashed = await bcrypt.hash('accountant123', 10);
            await prisma.user.create({
                data: {
                    name: 'School Accountant',
                    username: 'accountant',
                    password: hashed,
                    role: 'accountant'
                }
            });
        }

        res.json({ message: "Seeding complete", time: new Date() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
