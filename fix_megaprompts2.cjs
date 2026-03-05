const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'prompts', 'megaPrompts.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/=\s*\\`/g, '= `');
content = content.replace(/\\`;/g, '`;');

fs.writeFileSync(filePath, content);
console.log('Fixed export syntax in megaPrompts.ts');
