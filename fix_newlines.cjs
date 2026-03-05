const fs = require('fs');

function fixFile(filepath) {
    if (!fs.existsSync(filepath)) return;
    let content = fs.readFileSync(filepath, 'utf8');
    // The literal '\n' string becomes a real newline
    // The literal '\r' string becomes a real carriage return
    // Wait, regex for literal backslash n is /\\n/g
    if (content.includes('\\n')) {
        content = content.replace(/\\n/g, '\n');
        fs.writeFileSync(filepath, content, 'utf8');
        console.log("Fixed newlines in", filepath);
    }
}

fixFile('AppCore.tsx');
fixFile('hooks/useChat.ts');
