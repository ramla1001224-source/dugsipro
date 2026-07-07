const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const xlsx = require('xlsx');
const multer = require('multer');
const fs = require('fs');
const upload = multer({ dest: 'uploads/' });

// Get grades (filtered by role)
router.get('/', authenticateToken, async (req, res) => {
    try {
        let schoolId = req.user.schoolId;
        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }

        // If schoolId is missing from token, recover from User record
        if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
          try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user) schoolId = user.schoolId;
          } catch (err) {
            console.error('Grades Recovery Error:', err);
          }
        }

        let where = schoolId ? { schoolId } : { schoolId: 'NONE_AUTHORIZED' };
        if (req.user.role === 'student') {
            const student = await prisma.student.findFirst({ where: { userId: req.user.id } });
            if (!student) return res.status(404).json({ message: 'Student record not found' });
            where = { studentId: student.id };
        } else if (req.user.role === 'parent') {
            const parent = await prisma.parent.findUnique({
                where: { userId: req.user.id },
                include: { Children: true }
            });
            if (!parent) return res.status(404).json({ message: 'Parent record not found' });
            const studentIds = parent.Children.map(c => c.studentId);
            where = { studentId: { in: studentIds } };
        } else if (req.user.role === 'teacher') {
            const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
            if (!teacher) return res.status(404).json({ message: 'Teacher record not found' });
            // Teachers see grades for students in their assigned sections
            where = { section: { teacherId: teacher.id } };
        }

        const { studentId, classId, sectionId, subject } = req.query;
        if (studentId && typeof studentId === 'string') {
            where.studentId = studentId;
        }
        if (sectionId) where.sectionId = sectionId;
        else if (classId) where.classId = classId;
        
        if (subject) where.subject = subject;

        const grades = await prisma.grade.findMany({
            where,
            include: { student: { include: { user: true } }, clss: true, section: true },
            orderBy: { date: 'desc' }
        });
        res.json(grades || []);
    } catch (err) {
        console.error('Grades fetch error:', err);
        res.status(500).json({ message: 'Internal server error while fetching grades' });
    }
});

// Create a grade
router.post('/create', authenticateToken, authorizeRoles('teacher', 'admin'), async (req, res) => {
    const { studentId, classId, sectionId, subject, score, grade } = req.body;
    if (!studentId || !sectionId || !subject || score === undefined) return res.status(400).json({ message: 'Missing fields' });
    try {
        const schoolId = req.user.schoolId;
        const g = await prisma.grade.create({
            data: { 
                studentId, 
                sectionId,
                classId: classId || null, 
                subject, 
                score: Number(score), 
                grade,
                schoolId
            }
        });
        res.json(g);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Download Excel Template for Grades
router.get('/export-template', authenticateToken, async (req, res) => {
    try {
        const { classId, subject } = req.query;
        let schoolId = req.user.schoolId;

        if (req.user.role === 'super_admin' && req.query.schoolId) {
            schoolId = req.query.schoolId;
        }

        if (!classId || !subject) {
            return res.status(400).json({ message: 'classId and subject are required' });
        }

        const enrollments = await prisma.enrollment.findMany({
            where: {
                classId,
                schoolId,
                isCurrent: true
            },
            include: {
                student: { include: { user: true } }
            }
        });

        const existingGrades = await prisma.grade.findMany({
            where: {
                classId,
                subject,
                studentId: { in: enrollments.map(e => e.studentId) }
            }
        });
        
        const existingMap = new Map();
        existingGrades.forEach(g => {
            existingMap.set(g.studentId, g);
        });

        // Sort enrollments by student ID (numerically)
        enrollments.sort((a, b) => {
            const idA = a.student?.student_id || a.studentId || '';
            const idB = b.student?.student_id || b.studentId || '';
            return String(idA).localeCompare(String(idB), undefined, { numeric: true, sensitivity: 'base' });
        });

        const data = enrollments.map(e => {
            const current = existingMap.get(e.studentId);
            return {
                'Student ID': e.student.student_id || e.studentId,
                'Student Name': e.student.user.name,
                'Score': current ? current.score : '',
                'Grade': current ? (current.grade || '') : ''
            };
        });

        const ws = xlsx.utils.json_to_sheet(data);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, "Grades");

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', 'attachment; filename="grades_template.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        console.error('Export Grades Template Error:', err);
        res.status(500).json({ message: 'Error exporting template' });
    }
});

// Import Grades from Excel
router.post('/import-marks', authenticateToken, authorizeRoles('admin', 'teacher'), upload.single('file'), async (req, res) => {
    try {
        const { classId, subject } = req.body;
        if (!req.file || !classId || !subject) {
            return res.status(400).json({ message: 'Faylka Excel, classId, iyo subject waa qasab.' });
        }

        const schoolId = req.user.schoolId;

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet);

        let successCount = 0;
        let errors = [];

        // Pre-fetch students to validate IDs
        const enrollments = await prisma.enrollment.findMany({
            where: { classId, schoolId, isCurrent: true },
            include: { student: true }
        });

        const studentMap = new Map();
        enrollments.forEach(e => {
            studentMap.set(e.student.student_id, e.student);
            studentMap.set(e.student.id, e.student); // support both reg ID and DB ID
        });

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rawId = row['Student ID'] || row['student_id'] || row['ID'];
            const scoreVal = row['Score'] || row['score'] || row['Marks'];
            const gradeVal = row['Grade'] || row['grade'] || '';

            if (!rawId) continue;
            if (scoreVal === undefined || scoreVal === null || scoreVal === '') continue;

            const student = studentMap.get(String(rawId)) || studentMap.get(rawId);
            if (!student) {
                errors.push(`Row ${i + 2}: Ardayga ID-giisu yahay ${rawId} lagama helin fasalkan.`);
                continue;
            }

            const parsedScore = parseFloat(scoreVal);
            if (isNaN(parsedScore)) {
                errors.push(`Row ${i + 2}: Score '${scoreVal}' ma ahan tiro sax ah.`);
                continue;
            }

            // Upsert grade
            // Find existing grade to update, or create new
            const existingGrade = await prisma.grade.findFirst({
                where: {
                    studentId: student.id,
                    classId,
                    subject
                }
            });

            if (existingGrade) {
                await prisma.grade.update({
                    where: { id: existingGrade.id },
                    data: { score: parsedScore, grade: String(gradeVal) }
                });
            } else {
                await prisma.grade.create({
                    data: {
                        studentId: student.id,
                        classId,
                        sectionId: student.sectionId || null,
                        subject,
                        score: parsedScore,
                        grade: String(gradeVal),
                        schoolId
                    }
                });
            }
            successCount++;
        }

        // Cleanup temp file
        if (req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.json({ message: `Waa la keydiyey! ${successCount} arday ayaa la geliyey.`, errors });
    } catch (err) {
        console.error('Import Grades Error:', err);
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ message: 'Cillad ayaa dhacday markii Excel-ka la akhriyey.' });
    }
});

module.exports = router;
