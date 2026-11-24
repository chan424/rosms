import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { HashRouter } from 'react-router-dom';
import { theme } from './theme';
import { isFirebaseConfigured } from './firebaseConfig';
import SetupNotice from './pages/SetupNotice';
import App from './App';
import { AuthProvider } from './lib/AuthContext';
import { NotifyProvider } from './components/Notify';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {isFirebaseConfigured ? (
        <NotifyProvider>
          <AuthProvider>
            {/* HashRouter: works on GitHub Pages and any custom domain without server rewrites. */}
            <HashRouter>
              <App />
            </HashRouter>
          </AuthProvider>
        </NotifyProvider>
      ) : (
        <SetupNotice />
      )}
    </ThemeProvider>
  </React.StrictMode>,
);
