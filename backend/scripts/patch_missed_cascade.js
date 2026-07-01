const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let content = fs.readFileSync(schemaPath, 'utf8');

// Regex to find all relations like `@relation(fields: [xId], references: [id])`
// and append `, onDelete: Cascade` if it's missing.
const rgx = /(@relation\([^()]*fields:\s*\[[a-zA-Z0-9_]+\][^()]*references:\s*\[[a-zA-Z0-9_]+\][^()]*?)(\))/g;

content = content.replace(rgx, (match, prefix, suffix) => {
    if (prefix.includes('onDelete:')) {
        return match; // Already has an onDelete rule
    }
    return `${prefix}, onDelete: Cascade${suffix}`;
});

fs.writeFileSync(schemaPath, content);
console.log('Missed cascades patched successfully.');
