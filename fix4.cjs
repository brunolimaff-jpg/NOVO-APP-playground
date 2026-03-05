const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'prompts', 'megaPrompts.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace ` \` ` with just ` ` ` at the start of strings
content = content.replace(/=\s*\\`/g, '= `');

// And replace ` \`; ` at the end with just ` `; `
content = content.replace(/\\`;/g, '`;');

// Write back
fs.writeFileSync(filePath, content);
console.log('Done fixing megaPrompts.ts');
