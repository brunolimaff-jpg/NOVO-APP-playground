# AGENTS.md

## Cursor Cloud specific instructions

**Senior Scout 360** is a React + Vite + TypeScript SPA (single-page application) for agribusiness sales intelligence, running on port 3000.

### Quick reference

| Action | Command |
|--------|---------|
| Dev server | `npm run dev` (port 3000, host 0.0.0.0) |
| Tests | `npm run test` (vitest, 37 tests) |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Build | `npm run build` |
| Format | `npm run format` |

### Known caveats

- **ESLint v10 + `.eslintrc.cjs` incompatibility**: The project pins ESLint ^10 but uses the legacy `.eslintrc.cjs` config format. ESLint 10 requires flat config (`eslint.config.js`). `npm run lint` will fail with a config-not-found error. This is a pre-existing issue.
- **Typecheck noise from legacy files**: `npm run typecheck` reports thousands of errors from `old.tsx` and `old_appcore_utf8.tsx` (legacy backup files not excluded from `tsconfig.json`). These are pre-existing and do not affect the app.
- **Clerk auth fallback key**: The `.env.example` has placeholder keys. For local dev, leave `VITE_CLERK_PUBLISHABLE_KEY` empty (or unset) to use the hardcoded fallback dev key in `index.tsx`. Setting it to any non-empty invalid value will crash the app.
- **External services degrade gracefully**: Gemini API, Pinecone, and Google Apps Script backends all have fallback behavior. The app runs without real API keys but AI features will not work.
- **No Docker or database required**: This is a pure frontend SPA with serverless API proxies.
