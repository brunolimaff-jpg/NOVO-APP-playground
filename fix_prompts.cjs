const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'prompts', 'megaPrompts.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace single backticks NOT at the start/end of the string with \\`
// This targets backticks inside the template literals
content = content.replace(/(?<!^)(?<!\n)`(?!\s*;$)(?!\s*const)/g, '\\`');

// Specifically fix the ones that are like ``` (triple backticks)
content = content.replace(/\\`\\`\\`/g, '\\`\\`\\`');

fs.writeFileSync(filePath, content);
console.log('Fixed backticks in megaPrompts.ts');
