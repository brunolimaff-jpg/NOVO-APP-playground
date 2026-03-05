const fs = require('fs');

let content = fs.readFileSync('prompts/megaPrompts.ts', 'utf8');

// Regex explanation:
// 1. Matches the start of a template literal: `export const SOME_NAME = \``
// 2. Matches everything until the end of the template literal: `\`;`
// 3. The `[sS]` (any character including newline) with non-greedy `*?` ensures we match one prompt at a time.
// 4. In the replacement, we only escape backticks inside the matched group, avoiding the boundary backticks.

content = content.replace(/(export const \w+ = `)([\s\S]*?)(`;)/g, (match, p1, p2, p3) => {
    // Escape any backticks in p2 (the content) that aren't already escaped
    // We want to turn ` into \\`
    let escapedBody = p2.replace(/([^\\`])`/g, '$1\\`');
    // Also handle at the very start of the body
    if (escapedBody.startsWith('`')) {
        escapedBody = '\\' + escapedBody;
    }
    return p1 + escapedBody + p3;
});

fs.writeFileSync('prompts/megaPrompts.ts', content);
console.log("Successfully escaped inner backticks in megaPrompts.ts");
