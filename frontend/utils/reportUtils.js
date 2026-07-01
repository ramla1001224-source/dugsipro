import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getImageUrl } from './imageHelper';

export const exportToExcel = (data, fileName) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportToPDF = async (headers, data, fileName, title, schoolInfo = {}) => {
    const doc = new jsPDF();
    const schoolName = schoolInfo.name || 'Dugsi Pro System';

    let headerX = 14;

    // Add branding
    if (schoolInfo.logo) {
        try {
            const logoUrl = getImageUrl(schoolInfo.logo);
            
            // Create an image element to ensure it's loaded
            const img = new Image();
            img.src = logoUrl;
            img.crossOrigin = 'Anonymous';
            
            await new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve; // Continue even if logo fails
                setTimeout(resolve, 2000); // Timeout after 2s
            });

            if (img.complete && img.naturalWidth > 0) {
                doc.addImage(img, 'PNG', 14, 10, 20, 20);
                headerX = 38;
            }
        } catch (e) { 
            console.warn('PDF Logo Error:', e);
        }
    }

    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text(schoolName, headerX, 22);

    doc.setFontSize(14);
    doc.text(title, 14, 40);

    doc.setFontSize(9);
    doc.setTextColor(100);

    // Add date
    const date = new Date().toLocaleDateString();
    doc.text(`Generated on: ${date}`, 14, 47);

    const numberedHeaders = ['#', ...headers];
    const numberedData = data.map((row, i) => [i + 1, ...row]);

    autoTable(doc, {
        head: [numberedHeaders],
        body: numberedData,
        startY: 52,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 41, 59] }, // slate-900 color
        columnStyles: { 0: { halign: 'center', cellWidth: 12 } },
    });

    doc.save(`${fileName}.pdf`);
};
