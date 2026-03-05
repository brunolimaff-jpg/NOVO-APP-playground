const fs = require('fs');

function unescapeSafely(filename, outname) {
    if (!fs.existsSync(filename)) return;
    const raw = fs.readFileSync(filename, 'utf8');

    try {
        const parsed = JSON.parse('"' + raw.replace(/"/g, '\\"') + '"');
        fs.writeFileSync(outname, parsed, 'utf8');
        console.log("Success with", filename);
    } catch (e) {
        console.error("Failed JSON.parse for", filename, e.message);

        let result = '';
        for (let i = 0; i < raw.length; i++) {
            if (raw[i] === '\\' && i + 1 < raw.length) {
                const next = raw[i + 1];
                if (next === 'n') { result += '\n'; i++; }
                else if (next === 'r') { result += '\r'; i++; }
                else if (next === 't') { result += '\t'; i++; }
                else if (next === '"') { result += '"'; i++; }
                else if (next === '\\') { result += '\\'; i++; }
                else { result += raw[i]; }
            } else {
                result += raw[i];
            }
        }

        fs.writeFileSync(outname, result, 'utf8');
        console.log("Wrote fallback to", outname);
    }
}

unescapeSafely('old_appcore_utf8.tsx', 'AppCore.tsx');
