const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    // First, find all sequences of a backslash followed by three backticks: \`\`\`
    // In source code that looks like \\`\\`\\` or \\\`\`\` depending on how it was typed.
    // Actually, let's just do a string replacement to be extremely safe.
    content = content.replace(/\\\`\`\`/g, '\\`\\`\\`');
    content = content.replace(/\\\`\\\`\\\`/g, '\\`\\`\\`');

    // also fix any place that has \`\` that might be meant to be \`\`\`

    fs.writeFileSync(filePath, content);
    console.log('Fixed', filePath);
}

const files = [
    path.join(__dirname, 'prompts', 'megaPrompts.ts'),
    path.join(__dirname, 'prompts.ts')
];

for (const f of files) {
    if (fs.existsSync(f)) {
        fixFile(f);
    }
}
