const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'backend', 'src', 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
    const filePath = path.join(routesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // This is a custom replacer that finds the buggy query and wraps it
    let modified = false;

    // Pattern for exams.js studentRegId
    if (content.includes('student_id: { equals: studentRegId, mode: \'insensitive\' }')) {
        content = content.replace(
            /const relatedStudents = await prisma\.student\.findMany\(\{\s*where: \{\s*OR: \[\s*\{\s*userId: student\.userId\s*\},[\s\S]*?\]\s*\},([\s\S]*?)\}\);/g,
            `const orConditions = [{ id: student.id }];
        if (student.userId) orConditions.push({ userId: student.userId });
        if (studentRegId && studentRegId.trim() !== '') {
            orConditions.push({
                AND: [
                    { student_id: { equals: studentRegId, mode: 'insensitive' } },
                    {
                        OR: [
                            { user: { schoolId: schoolIdToUse } },
                            { clss: { schoolId: schoolIdToUse } }
                        ]
                    }
                ]
            });
        }
        const relatedStudents = await prisma.student.findMany({
            where: { OR: orConditions },$1});`
        );
        modified = true;
    }

    // Pattern for student.student_id (general)
    if (content.includes('student_id: { equals: student.student_id, mode: \'insensitive\' }')) {
        content = content.replace(
            /const relatedStudents = await (prisma\.student|studentModel)\.findMany\(\{\s*where: \{\s*OR: \[\s*\{\s*userId: student\.userId\s*\},([\s\S]*?)\{ student_id: \{ equals: student\.student_id, mode: 'insensitive' \} \}([\s\S]*?)\]\s*\},([\s\S]*?)\}\);/g,
            `const orConditions = [{ id: student.id }];
        if (student.userId) orConditions.push({ userId: student.userId });
        if (student.student_id && student.student_id.trim() !== '') {
            orConditions.push({
                AND: [
                    { student_id: { equals: student.student_id, mode: 'insensitive' } }$2
                ]
            });
        }
        const relatedStudents = await $1.findMany({
            where: { OR: orConditions },$3});`
        );
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed', file);
    }
});
