const fs = require('fs');
const content = fs.readFileSync('prompts/megaPrompts.ts', 'utf8');
console.log(content.substring(0, 1500));
