const fs = require('fs');

let lines = fs.readFileSync('prompts/megaPrompts.ts', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('export const PROMPT_') && lines[i].endsWith('`')) continue;
    if (lines[i].trim() === '`;') continue;

    // Clean up any double-backslashes before backticks
    lines[i] = lines[i].replace(/\\\\`/g, '\\`');

    // Escape any remaining unescaped backticks
    let chars = lines[i].split('');
    for (let c = 0; c < chars.length; c++) {
        if (chars[c] === '`') {
            if (c === 0 || chars[c - 1] !== '\\') {
                chars[c] = '\\`';
            }
        }
    }
    lines[i] = chars.join('');
}

fs.writeFileSync('prompts/megaPrompts.ts', lines.join('\n'));
console.log("Fixed megaPrompts.ts perfectly");
