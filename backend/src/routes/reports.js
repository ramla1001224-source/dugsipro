const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');


// Generate Student Report Card PDF
router.get('/student-report/:studentId', authenticateToken, async (req, res) => {
  try {
    let schoolId = req.user.schoolId;

    // If schoolId is missing from token, recover from User record
    if (!schoolId && !['super_admin', 'owner'].includes((req.user.role || '').toLowerCase())) {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user) schoolId = user.schoolId;
      } catch (err) {
        console.error('Reports Recovery Error:', err);
      }
    }
    const { academicYearId } = req.query;

    const rawStudentId = req.params.studentId;

    // --- RESILIENT IDENTITY FINDER ---
    const studentCheck = await prisma.student.findFirst({
      where: {
        OR: [
          { id: rawStudentId },
          { userId: rawStudentId },
          { student_id: { equals: rawStudentId, mode: 'insensitive' } }
        ]
      }
    });

    if (!studentCheck) return res.status(404).json({ message: 'Ardayga lama helin.' });

    // Find all related IDs to merge historical data
    const isAdmin = ['admin', 'super_admin', 'owner'].includes((req.user?.role || '').toLowerCase());
    const orConditions = [{ id: studentCheck.id }];
    if (studentCheck.userId) orConditions.push({ userId: studentCheck.userId });
    if (studentCheck.student_id && studentCheck.student_id.trim() !== '') {
      orConditions.push({
        AND: [
          { student_id: { equals: studentCheck.student_id, mode: 'insensitive' } },
          isAdmin ? {} : { user: { schoolId } }
        ]
      });
    }
    const relatedStudents = await prisma.student.findMany({
      where: { OR: orConditions },
      select: { id: true }
    });
    const relatedIds = relatedStudents.map(rs => rs.id);

    const student = await prisma.student.findFirst({
      where: { id: studentCheck.id, ...(schoolId ? { user: { schoolId } } : {}) },
      select: {
        id: true,
        student_id: true,
        aiInsights: true,
        user: { select: { id: true, name: true, phone: true } },
        clss: { select: { id: true, class_name: true } },
        section: { select: { id: true, name: true } },
        ExamResults: {
          where: academicYearId ? 
            { exam: { term: { academicYearId } }, studentId: { in: relatedIds } } : 
            { exam: { status: { in: ['published', 'locked'] } }, studentId: { in: relatedIds } },
          include: {
            exam: {
              select: {
                id: true,
                name: true,
                type: true,
                totalMarks: true,
                subject: { select: { id: true, name: true } },
                term: { select: { id: true, name: true } }
              }
            }
          }
        }
      }
    });

    if (!student) return res.status(404).json({ message: 'Ardayga lama helin (Fadlan u sheeg maamulka).' });

    const school = schoolId ? await prisma.school.findUnique({ where: { id: schoolId } }) : null;

    const gradingScales = await prisma.gradingScale.findMany({
      where: { schoolId },
      orderBy: { minScore: 'desc' }
    });

    const calculateGrade = (marks, totalMarks) => {
      const percentage = Math.round((marks / (totalMarks || 100)) * 100);
      if (gradingScales.length > 0) {
        // We already have gradingScales sorted DESC via findMany orderBy
        for (const scale of gradingScales) {
          if (percentage >= scale.minScore) {
            return scale.grade;
          }
        }
      }
      // Standard Universal Fallback
      if (percentage >= 90) return 'A+';
      if (percentage >= 85) return 'B++';
      if (percentage >= 80) return 'B-';
      if (percentage >= 75) return 'C+';
      if (percentage >= 70) return 'C';
      if (percentage >= 60) return 'D';
      return 'F';
    };

    let displayClass = student.clss?.class_name;
    let displaySection = student.section?.name;

    if (academicYearId) {
      const enrollment = await prisma.enrollment.findFirst({
        where: { studentId: { in: relatedIds }, academicYearId },
        include: { clss: true, section: true }
      });
      if (enrollment) {
        displayClass = enrollment.clss?.class_name;
        displaySection = enrollment.section?.name;
      }
    }

    // Group results by Subject
    const subjectResults = {};
    student.ExamResults.forEach(res => {
      const subName = res.exam.subject?.name || 'Maadada Kale';
      if (!subjectResults[subName]) {
        subjectResults[subName] = { bile1: null, bile2: null, bile3: null, final: null, total: 0, totalMax: 0 };
      }

      subjectResults[subName].totalMax += res.exam.totalMarks || 100;

      const type = (res.exam.type || '').toLowerCase();
      const name = (res.exam.name || '').toLowerCase();

      // Optimized Mapping based on consistent types
      if (type === 'monthly_1' || name.includes('bile 1')) {
        subjectResults[subName].bile1 = (subjectResults[subName].bile1 || 0) + res.marks;
      } else if (type === 'monthly_2' || name.includes('bile 2')) {
        subjectResults[subName].bile2 = (subjectResults[subName].bile2 || 0) + res.marks;
      } else if (type === 'midterm' || type === 'term_1' || name.includes('midterm')) {
        // Put midterm in bile 3 or final depending on school preference
        // Standardizing: midterms are handled as mid-period assessments
        subjectResults[subName].bile3 = (subjectResults[subName].bile3 || 0) + res.marks;
      } else if (type === 'final' || type === 'final_term' || name.includes('final') || name.includes('imtikaan')) {
        subjectResults[subName].final = (subjectResults[subName].final || 0) + res.marks;
      } else {
        // Fallback for types like 'monthly_3' 
        if (type === 'monthly_3' || name.includes('bile 3')) {
          subjectResults[subName].bile3 = (subjectResults[subName].bile3 || 0) + res.marks;
        } else if (subjectResults[subName].bile1 === null) {
          subjectResults[subName].bile1 = res.marks;
        } else if (subjectResults[subName].bile2 === null) {
          subjectResults[subName].bile2 = res.marks;
        } else {
          subjectResults[subName].final = (subjectResults[subName].final || 0) + res.marks;
        }
      }
    });

    // Calculate totals for each subject
    Object.keys(subjectResults).forEach(sub => {
      const sr = subjectResults[sub];
      sr.total = (sr.bile1 || 0) + (sr.bile2 || 0) + (sr.bile3 || 0) + (sr.final || 0);
    });

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    let filename = `Report_${student.user.name.replace(/\s+/g, '_')}.pdf`;

    res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    // --- Header ---
    if (school?.logo) {
      try {
        if (school.logo.startsWith('data:image/')) {
          const base64Data = school.logo.split(';base64,').pop();
          const imgBuffer = Buffer.from(base64Data, 'base64');
          doc.image(imgBuffer, 40, 45, { width: 60 });
        } else {
          const cleanLogoPath = school.logo.startsWith('public/') ? school.logo.replace('public/', '') : school.logo;
          
          // Try multiple path resolutions
          const pathsToTry = [
            path.join(process.cwd(), cleanLogoPath),
            path.join(process.cwd(), 'backend', cleanLogoPath),
            path.join(__dirname, '../../', cleanLogoPath),
            path.join(__dirname, '../../../', cleanLogoPath)
          ];

          let logoPath = null;
          for (const p of pathsToTry) {
            if (fs.existsSync(p)) {
              logoPath = p;
              break;
            }
          }

          if (logoPath) {
            doc.image(logoPath, 40, 45, { width: 60 });
          } else {
            console.warn('[PDF-Report] Logo not found at any of these paths:', pathsToTry);
          }
        }
      } catch (err) {
        console.error('[PDF-Report] Logo Error:', err);
      }
    }


    doc.fillColor('#1e293b').fontSize(22).text(school?.name?.toUpperCase() || 'DUGSI PRO SYSTEM', { align: 'center', wordSpacing: 2 });
    doc.fontSize(10).fillColor('#64748b').text(school?.address || 'Report Card Official', { align: 'center' });
    if (school?.phone) doc.text(`Tel: ${school.phone}`, { align: 'center' });
    doc.moveDown(1.5);

    // Blue separator
    doc.rect(40, doc.y, 515, 2).fill('#3b82f6');
    doc.moveDown(1);

    doc.fillColor('#1e293b').fontSize(16).text('WARQADDA NATIIJADA (REPORT CARD)', { align: 'center', underline: true });
    doc.moveDown(1);

    // Student Info Grid
    const startY = doc.y;
    doc.fontSize(10).fillColor('#475569');
    doc.text(`Magaca: `, 50, startY, { continued: true }).fillColor('#000').text(student.user.name.toUpperCase());
    doc.fillColor('#475569').text(`ID-ga: `, 50, startY + 15, { continued: true }).fillColor('#000').text(student.student_id);

    doc.fillColor('#475569').text(`Fasalka: `, 300, startY, { continued: true }).fillColor('#000').text(displayClass || 'N/A');
    doc.fillColor('#475569').text(`Section-ka: `, 300, startY + 15, { continued: true }).fillColor('#000').text(displaySection || 'N/A');

    doc.moveDown(3);

    // --- Table Rendering ---
    const tableTop = doc.y;
    const colSubject = 45;
    const colB1 = 175;
    const colB2 = 215;
    const colB3 = 255;
    const colFinal = 295;
    const colTotal = 365;
    const colGrade = 475;

    // Header Background
    doc.rect(40, tableTop - 5, 515, 25).fill('#f1f5f9');
    doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold');
    doc.text('MAADADA (SUBJECT)', colSubject, tableTop);
    doc.text('B1', colB1, tableTop);
    doc.text('B2', colB2, tableTop);
    doc.text('B3', colB3, tableTop);
    doc.text('FINAL', colFinal, tableTop);
    doc.text('TOTAL', colTotal, tableTop);
    doc.text('GD', colGrade, tableTop);

    let currentY = tableTop + 25;
    doc.font('Helvetica').fontSize(10).fillColor('#334155');

    let grandTotal = 0;
    let grandMax = 0;
    let subjectCount = 0;

    Object.keys(subjectResults).sort().forEach((sub, index) => {
      const sr = subjectResults[sub];

      // Row background
      if (index % 2 === 0) {
        doc.rect(40, currentY - 5, 515, 25).fill('#fafafa');
      }

      doc.fillColor('#000');
      doc.text(sub.toUpperCase(), colSubject, currentY, { width: 120, height: 15, ellipsis: true });
      doc.text(sr.bile1 !== null ? sr.bile1 : '-', colB1, currentY);
      doc.text(sr.bile2 !== null ? sr.bile2 : '-', colB2, currentY);
      doc.text(sr.bile3 !== null ? sr.bile3 : '-', colB3, currentY);
      doc.text(sr.final !== null ? sr.final : '-', colFinal, currentY);
      doc.font('Helvetica-Bold').text(`${sr.total}/${sr.totalMax}`, colTotal, currentY);
      
      // Percentage-based Grade Logic
      const grade = calculateGrade(sr.total, sr.totalMax);
      doc.fillColor('#000').text(grade, colGrade, currentY);
      doc.font('Helvetica');

      grandTotal += sr.total;
      grandMax += sr.totalMax;
      subjectCount++;
      currentY += 25;

      // Page break logic if needed
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }
    });

    // Summary Row
    doc.moveDown(1);
    doc.rect(40, currentY, 515, 2).fill('#e2e8f0');
    currentY += 10;
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(11);
    doc.text(`WADARTA GUUD (GRAND TOTAL): `, colSubject, currentY, { continued: true }).text(`${grandTotal}/${grandMax}`);
    currentY += 15;
    doc.text(`CELCELISKA: ${Number.isFinite(grandTotal) ? (grandTotal / 2).toFixed(1).replace(/\.0$/, '') : 0}`, colSubject, currentY);

    // Calculate global percentage based on actual marks instead of arbitrary count
    let avg = 0;
    if (grandMax > 0) {
      avg = ((grandTotal / grandMax) * 100).toFixed(1);
    }

    // Give global grade
    const grandGrade = calculateGrade(grandTotal, grandMax);
    doc.text(`Natiijada (GRADE): `, 330, currentY, { continued: true }).text(`${grandGrade} (${avg}%)`);

    // --- AI Insights / Remarks ---
    if (student.aiInsights) {
      doc.moveDown(3);
      doc.rect(40, doc.y, 515, 60).stroke('#e2e8f0');
      doc.fontSize(12).font('Helvetica-Bold').text(' TALOOYINKA (INSIGHTS):', 50, doc.y + 10);
      doc.fontSize(9).font('Helvetica-Oblique').fillColor('#64748b').text(student.aiInsights.substring(0, 300), 50, doc.y + 5, { width: 490 });
    }

    // --- Footer Signatures ---
    doc.moveDown(4);
    const footerY = doc.y;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b');
    doc.text('TIREECKA MAAMULAHA', 50, footerY);
    doc.text('---------------------------', 50, footerY + 15);

    doc.text('SAXEEXA WAALIDKA', 350, footerY);
    doc.text('---------------------------', 350, footerY + 15);

    doc.fontSize(8).fillColor('#94a3b8').text(`La soo saaray: ${new Date().toLocaleDateString()}`, { align: 'center', baseline: 'bottom' });

    doc.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
