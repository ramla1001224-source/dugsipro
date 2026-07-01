const fs = require('fs');

let content = fs.readFileSync('schema.prisma', 'utf8');

// 1. Add onDelete: Cascade for School relations where missing
content = content.replace(/(@relation\(\[?\"?[^)]*fields:\s*\[schoolId\][^)]*\))/g, (match) => {
    if (match.includes('onDelete: Cascade')) return match;
    return match.replace(/\)$/, ', onDelete: Cascade)');
});

// 2. Add onDelete: Cascade for superAdmin (managedBy)
content = content.replace(/(managedBy\s+User\?\s+@relation\(\"SuperAdminSchools\",\s*fields:\s*\[superAdminId\],\s*references:\s*\[id\])(\))/, '$1, onDelete: Cascade)');

// 3. User Messages
content = content.replace(/(receiver\s+User\s+@relation\(\"ReceivedMessages\",\s*fields:\s*\[receiverId\],\s*references:\s*\[id\])(\))/, '$1, onDelete: Cascade)');
content = content.replace(/(sender\s+User\s+@relation\(\"SentMessages\",\s*fields:\s*\[senderId\],\s*references:\s*\[id\])(\))/, '$1, onDelete: Cascade)');

// 4. BookIssue to Student
content = content.replace(/(student\s+Student\?\s+@relation\(\s*fields:\s*\[studentId\],\s*references:\s*\[id\])(\))/, '$1, onDelete: Cascade)');

// 5. Invoices and Payments missing cascades
content = content.replace(/(fee\s+FeeStructure\s+@relation\(\s*fields:\s*\[feeId\],\s*references:\s*\[id\])(\))/, '$1, onDelete: Cascade)');
content = content.replace(/(invoice\s+Invoice\?\s+@relation\(\s*fields:\s*\[invoiceId\],\s*references:\s*\[id\])(\))/, '$1, onDelete: Cascade)');

fs.writeFileSync('schema.prisma', content);
console.log('Regex patch complete.');
