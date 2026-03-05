# AGENTS.md

## Cursor Cloud specific instructions

### Overview

**Senior Scout 360** is a React 19 + TypeScript + Vite commercial intelligence web app (Portuguese language UI). See `README.md` for full architecture and scripts.

### Running the dev server

```bash
npm run dev
```

App runs at `http://localhost:3000`. The Vite config binds to `0.0.0.0`.

### Available scripts

All standard scripts are in `package.json`: `dev`, `build`, `test`, `lint`, `typecheck`, `format`.

### Known pre-existing issues

- **ESLint v10 / flat config mismatch:** The project installs ESLint 10 but uses `.eslintrc.cjs` (legacy format). Running `npm run lint` fails with "ESLint couldn't find an eslint.config.(js|mjs|cjs) file." This is a pre-existing issue in the codebase.
- **TypeScript errors from `old.tsx`:** The file `old.tsx` at the repo root is a single-line minified backup of `App.tsx`. It is not excluded from `tsconfig.json`, so `npm run typecheck` reports thousands of errors from this file. Errors from other source files should be reviewed separately.
- **Clerk auth required:** The app requires a valid `VITE_CLERK_PUBLISHABLE_KEY` in `.env` to render the main UI. Without it, the app shows an error boundary page. The Clerk sign-in modal appears before the chat interface is accessible.

### External services (all SaaS, no Docker needed)

| Service | Env var | Required for |
|---------|---------|-------------|
| Clerk | `VITE_CLERK_PUBLISHABLE_KEY` | Authentication (blocks UI without valid key) |
| Google Gemini | `GEMINI_API_KEY` | AI chat, content generation |
| Pinecone | `PINECONE_API_KEY` | RAG context retrieval |

### API functions

The `api/*.ts` files are Vercel serverless functions. They do **not** run with `npm run dev` (Vite only). The deployed production app at `scoutagro.vercel.app` serves these endpoints. For local development, the Gemini AI chat works via the deployed Vercel backend (the frontend calls the production API URLs).

### Clerk authentication

The app has a hardcoded fallback Clerk publishable key in `index.tsx` (line 16). The Clerk instance is in **development mode** and requires real email verification for sign-up -- there is no test-code bypass. To test the full app, you need a Clerk account with the configured instance, or the user must log in via the Desktop pane.

### Tests

All 37 tests pass with `npm run test` (Vitest). Tests are in `tests/` and do not require API keys or external services.
