import React from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { CRMProvider } from './contexts/CRMContext';
import { ModeProvider } from './contexts/ModeContext';
import './index.css';
import { resolveClerkPublishableKey } from './utils/clerk';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const PUBLISHABLE_KEY = resolveClerkPublishableKey({
  publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  frontendApiUrl: import.meta.env.VITE_CLERK_FRONTEND_API_URL,
});
const AUTH_REDIRECT_PATH = '/';

if (!PUBLISHABLE_KEY) {
  throw new Error(
    'Missing Clerk configuration — set VITE_CLERK_PUBLISHABLE_KEY or VITE_CLERK_FRONTEND_API_URL in your .env file',
  );
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ClerkProvider
        publishableKey={PUBLISHABLE_KEY}
        appearance={{ variables: { colorPrimary: '#059669' } }}
        signInForceRedirectUrl={AUTH_REDIRECT_PATH}
        signUpForceRedirectUrl={AUTH_REDIRECT_PATH}
        afterSignOutUrl={AUTH_REDIRECT_PATH}
      >
        <AuthProvider>
          <ModeProvider>
            <CRMProvider>
              <App />
            </CRMProvider>
          </ModeProvider>
        </AuthProvider>
      </ClerkProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
