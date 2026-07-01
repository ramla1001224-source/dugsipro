import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Report Card Generator Utility
 * Generates a professional PDF with student details, marks, grades, and school branding.
 */
export const generateReportCard = (student, examResults, schoolInfo = {}) => {
    const doc = new jsPDF()
    const { name: schoolName = 'Dugsi Pro System', address = 'Garowe, Puntland, Somalia' } = schoolInfo

    // --- Header ---
    if (schoolInfo.logo) {
        try {
            doc.addImage(schoolInfo.logo, 'PNG', 20, 10, 20, 20)
        } catch (e) {
            console.error('Error adding logo to PDF', e)
        }
    }

    doc.setFontSize(22)
    doc.setTextColor(15, 23, 42) // Slate-900
    doc.text(schoolName, 105, 20, { align: 'center' })

    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(address, 105, 26, { align: 'center' })

    doc.setDrawColor(200)
    doc.line(20, 32, 190, 32)

    // --- Student Info Section ---
    const studentName = student.user?.name || student.name || 'Arday';
    const className = student.clss?.class_name ? `${student.clss.class_name} ${student.clss.section || ''}` : (student.class || 'N/A');

    doc.setFontSize(14)
    doc.setTextColor(30, 41, 59)
    doc.text('OFFICIAL REPORT CARD', 105, 45, { align: 'center' })

    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Student Name:`, 20, 60)
    doc.setTextColor(0)
    doc.setFont(undefined, 'bold')
    doc.text(studentName, 50, 60)

    doc.setFont(undefined, 'normal')
    doc.setTextColor(100)
    doc.text(`Student ID:`, 20, 66)
    doc.setTextColor(0)
    doc.text(student.student_id || 'N/A', 50, 66)

    doc.setTextColor(100)
    doc.text(`Class:`, 130, 60)
    doc.setTextColor(0)
    doc.text(className, 150, 60)

    doc.setTextColor(100)
    doc.text(`Date:`, 130, 66)
    doc.setTextColor(0)
    doc.text(new Date().toLocaleDateString(), 150, 66)

    // --- Results Table ---
    // Group results by subject
    const subjectResults = {}
    examResults.forEach(res => {
        const subName = res.exam?.subject?.name || 'N/A'
        if (!subjectResults[subName]) {
            subjectResults[subName] = { monthly_1: '-', midterm: '-', monthly_2: '-', final: '-', total: 0, count: 0 }
        }
        const type = res.exam?.type
        const marks = res.marks || 0
        if (['monthly_1', 'midterm', 'monthly_2', 'final'].includes(type)) {
            subjectResults[subName][type] = marks
            subjectResults[subName].total += marks
            subjectResults[subName].count++
        }
    })

    const tableHeaders = [['Subject', 'Bile 1', 'Midterm', 'Bile 2', 'Final', 'Total', 'Grade']]
    const tableData = Object.entries(subjectResults).map(([subName, results]) => {
        const total = results.total
        // Simplified grading: Pass if attempted all or has good total
        const grade = total >= 150 ? 'A' : total >= 100 ? 'B' : total >= 50 ? 'C' : 'D'
        return [
            subName,
            results.monthly_1,
            results.midterm,
            results.monthly_2,
            results.final,
            total,
            grade
        ]
    })

    autoTable(doc, {
        startY: 75,
        head: tableHeaders,
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 9, cellPadding: 4, halign: 'center' },
        columnStyles: {
            0: { fontStyle: 'bold', halign: 'left', cellWidth: 40 },
            5: { fontStyle: 'bold', fillColor: [248, 250, 252] },
            6: { fontStyle: 'bold' }
        }
    })

    // --- Footer / Signatures ---
    const finalY = (doc.lastAutoTable?.finalY || 100) + 30

    doc.line(20, finalY, 70, finalY)
    doc.text('Class Teacher Signature', 25, finalY + 5)

    doc.line(140, finalY, 190, finalY)
    doc.text('Principal Signature', 150, finalY + 5)

    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text('This is a computer-generated report card.', 105, 285, { align: 'center' })

    const safeFileName = studentName.replace(/\s+/g, '_');
    doc.save(`${safeFileName}_Report_Card.pdf`)
}
