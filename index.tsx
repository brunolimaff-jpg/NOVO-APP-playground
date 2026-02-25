import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ModeProvider } from './contexts/ModeContext';
import { CRMProvider } from './contexts/CRMContext';
import ErrorBoundary from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <ModeProvider>
          <CRMProvider>
            <App />
          </CRMProvider>
        </ModeProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
