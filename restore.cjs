const fs = require('fs');

let useChatCode = fs.readFileSync('hooks/useChat.ts', 'utf8');
let appCoreCode = fs.readFileSync('AppCore.tsx', 'utf8');

const funcsToExtract = [
    { name: 'handleExportPDF', type: 'async function' },
    { name: 'handleExportConversation', type: 'const' },
    { name: 'handleSendEmail', type: 'async function' },
    { name: 'handleScheduleFollowUp', type: 'async function' }
];

let extractedCode = '';

// Find handleExportPDF
const exportPdfStart = useChatCode.indexOf('async function handleExportPDF() {');
const exportConvStart = useChatCode.indexOf('const handleExportConversation =');
const sendEmailStart = useChatCode.indexOf('async function handleSendEmail() {');
const scheduleStart = useChatCode.indexOf('async function handleScheduleFollowUp() {');
const feedbackStart = useChatCode.indexOf('const handleFeedback =');

if (exportPdfStart !== -1 && feedbackStart !== -1) {
    const toExtract = useChatCode.substring(exportPdfStart, feedbackStart);
    extractedCode = toExtract;

    // Remove from useChatCode
    useChatCode = useChatCode.substring(0, exportPdfStart) + useChatCode.substring(feedbackStart);
}

// Write back to useChat.ts
fs.writeFileSync('hooks/useChat.ts', useChatCode, 'utf8');

// Now add extractedCode to AppCore.tsx
// Find where to insert in AppCore.tsx (e.g. before `  const handleOpenKanban = () => { setActiveView('crm'); setSelectedCRMCardId(null); };`)

const insertPoint = appCoreCode.indexOf('const handleOpenKanban');
if (insertPoint !== -1) {
    appCoreCode = appCoreCode.substring(0, insertPoint) + extractedCode + '\n  ' + appCoreCode.substring(insertPoint);
} else {
    // If not found, put it before renderUserHeader
    const altInsert = appCoreCode.indexOf('const renderUserHeader');
    appCoreCode = appCoreCode.substring(0, altInsert) + extractedCode + '\n  ' + appCoreCode.substring(altInsert);
}

// Wait! simpleMarkdownToHtml, collectFullReport, detectInconsistencies are in useChat.ts but NOT exported!
// We need to export them from useChat.ts or move them to utils.
// Actually, AppCore.tsx needs them. Let's export them from useChat.ts.
useChatCode = useChatCode.replace('function collectFullReport', 'export function collectFullReport');
useChatCode = useChatCode.replace('function detectInconsistencies', 'export function detectInconsistencies');
useChatCode = useChatCode.replace('function simpleMarkdownToHtml', 'export function simpleMarkdownToHtml');
useChatCode = useChatCode.replace('function extractCompanyName', 'export function extractCompanyName');
fs.writeFileSync('hooks/useChat.ts', useChatCode, 'utf8');

// Add imports to AppCore.tsx
const importPoint = appCoreCode.indexOf('import { useChat } from');
const importsToAdd = `import { useChat, collectFullReport, detectInconsistencies, simpleMarkdownToHtml, extractCompanyName } from './hooks/useChat';\n`;
appCoreCode = appCoreCode.replace(`import { useChat } from './hooks/useChat';`, importsToAdd);

fs.writeFileSync('AppCore.tsx', appCoreCode, 'utf8');
console.log('Restored functions and updated imports');
