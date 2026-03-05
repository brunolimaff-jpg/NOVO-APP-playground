const fs = require('fs');

function restoreSafely(sourcePath, targetPath) {
    if (!fs.existsSync(sourcePath)) return;
    const code = fs.readFileSync(sourcePath, 'utf8');
    try {
        // Encase the entire file contents in quotes to make it a valid JSON string
        // If there are unescaped double quotes, we need to escape them first
        const escapedQuotes = code.replace(/"/g, '\\"');
        const restored = JSON.parse('"' + escapedQuotes + '"');
        fs.writeFileSync(targetPath, restored, 'utf8');
        console.log("Safely restored", targetPath);
    } catch (e) {
        console.error("Failed to restore", sourcePath, e.message);
    }
}

// Restore AppCore.tsx from git HEAD first to ensure we don't double-parse
const { execSync } = require('child_process');
execSync('git restore AppCore.tsx');

// Now restore the literal \n into real newlines
restoreSafely('AppCore.tsx', 'AppCore.tsx');
