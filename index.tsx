import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { ModeProvider } from './contexts/ModeContext';
import { CRMProvider } from './contexts/CRMContext';
import ErrorBoundary from './components/ErrorBoundary';
import { ClerkProvider } from '@clerk/clerk-react';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY — configure it in your .env file")
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={{ variables: { colorPrimary: '#059669' } }}>
        <AuthProvider>
          <ModeProvider>
            <CRMProvider>
              <App />
            </CRMProvider>
          </ModeProvider>
        </AuthProvider>
      </ClerkProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
