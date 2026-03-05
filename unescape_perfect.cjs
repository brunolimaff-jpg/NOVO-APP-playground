const fs = require('fs');

function unescapePerfectly(filename) {
    if (!fs.existsSync(filename)) {
        console.error("File not found");
        return;
    }
    const raw = fs.readFileSync(filename, 'utf8');

    // We want to replace \n with actual newline, \r with actual carriage return
    // \t with tab, \" with ", and \\ with \
    let result = '';
    for (let i = 0; i < raw.length; i++) {
        if (raw[i] === '\\' && i + 1 < raw.length) {
            const next = raw[i + 1];
            if (next === 'n') { result += '\n'; i++; }
            else if (next === 'r') { result += '\r'; i++; }
            else if (next === 't') { result += '\t'; i++; }
            else if (next === '"') { result += '"'; i++; }
            else if (next === '\\') { result += '\\'; i++; }
            else if (next === "'") { result += "'"; i++; }
            else if (next === '`') { result += '`'; i++; }
            else { result += raw[i]; }
        } else {
            result += raw[i];
        }
    }

    fs.writeFileSync(filename, result, 'utf8');
    console.log("Successfully unescaped", filename);
}

unescapePerfectly('AppCore.tsx');
