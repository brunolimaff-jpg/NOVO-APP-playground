# AGENTS.md

## Cursor Cloud specific instructions

### Overview

**Senior Scout 360** is an AI-powered sales intelligence platform for Brazilian agribusiness (React 19 + Vite 6 + TypeScript). It uses Clerk for auth, Google Gemini for AI, and Pinecone for RAG. Single-app (non-monorepo), no Docker, no traditional database.

### Standard commands

See `package.json` scripts:
- `npm run dev` — Vite dev server on port 3000
- `npm run test` — Vitest (25 tests across 4 files)
- `npm run typecheck` — TypeScript `tsc --noEmit`
- `npm run lint` — ESLint
- `npm run build` — production build
- `npm run preview` — serve production build on port 4173

### Known pre-existing issues

1. **ESLint v10 vs `.eslintrc.cjs`**: `npm run lint` fails because ESLint 10 requires flat config (`eslint.config.js`) but the repo uses the legacy `.eslintrc.cjs` format.

2. **Runtime TypeError in `prompts/megaPrompts.ts`**: The file contains `\``` (backslash + triple backticks) inside template literals intended to represent Markdown fenced code blocks. In JavaScript, `\`` only escapes one backtick; the remaining backticks close the template literal and start a tagged template, causing `Uncaught TypeError: "<prompt string>" is not a function`. This prevents React from rendering in both dev and production. The fix is to properly escape all three backticks (`\`\`\``).

### Environment variables

Copy `.env.example` to `.env`. The app has a hardcoded fallback Clerk test key (`pk_test_dG91Z2gta2l3aS05MS5jbGVyay5hY2NvdW50cy5kZXYk`). If `VITE_CLERK_PUBLISHABLE_KEY` is set to a non-empty placeholder value (like the example's `pk_test_your_clerk_key_here`), it overrides the valid fallback. Either remove it from `.env` or set it to the fallback key.

Required env vars for full functionality: `GEMINI_API_KEY`, `PINECONE_API_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`.

### Vite HMR WebSocket

In cloud/container environments, Vite's HMR WebSocket may fail to connect (`ws://localhost:3000`). This does not affect serving the app — only hot reload. You can configure `server.hmr` in `vite.config.ts` if needed.
