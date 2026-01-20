const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'scripts/zigTsExports.ts');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const linesToInsert = [
  "          default:",
  "            readExpr = `readUint64(buf, ${offStr})`",
  "            break"
];

// Target 2: Line 799 (1-based), Index 798 is the line "break".
// We want to insert AFTER line 799. So at index 799.
if (lines[798].trim() !== 'break') {
    console.error('Line 799 mismatch:', lines[798]);
    process.exit(1);
}
lines.splice(799, 0, ...linesToInsert);

// Target 1: Line 660 (1-based), Index 659 is the line "break".
// We want to insert AFTER line 660. So at index 660.
if (lines[659].trim() !== 'break') {
    console.error('Line 660 mismatch:', lines[659]);
    process.exit(1);
}
lines.splice(660, 0, ...linesToInsert);

fs.writeFileSync(filePath, lines.join('\n'));
console.log('Patched successfully');
