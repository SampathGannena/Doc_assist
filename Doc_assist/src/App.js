import React from 'react';
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import styled, { ThemeProvider, createGlobalStyle } from 'styled-components';

import { useAppState } from './context/AppStateContext';
import AppShell from './pages/AppShell';
import AccessManagementPage from './pages/AccessManagementPage';
import DashboardPage from './pages/DashboardPage';
import ErrorCenterPage from './pages/ErrorCenterPage';
import GenerationHistoryPage from './pages/GenerationHistoryPage';
import IntegrationsPage from './pages/IntegrationsPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import ProjectWorkspacePage from './pages/ProjectWorkspacePage';
import QualityInsightsPage from './pages/QualityInsightsPage';
import RegisterPage from './pages/RegisterPage';
import ReviewDiffPage from './pages/ReviewDiffPage';
import SettingsPage from './pages/SettingsPage';
import SystemStatusPage from './pages/SystemStatusPage';

const theme = {
  colors: {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    background: {
      main: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
      card: 'rgba(255, 255, 255, 0.05)',
      input: 'rgba(0, 0, 0, 0.3)',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#cbd5e1',
      muted: '#94a3b8',
      disabled: '#64748b',
    },
    border: 'rgba(255, 255, 255, 0.1)',
    shadow: 'rgba(0, 0, 0, 0.3)',
  },
  fonts: {
    main: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', 'Courier New', monospace",
  },
  breakpoints: {
    mobile: '768px',
    tablet: '1024px',
    desktop: '1200px',
  },
};

const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html {
    scroll-behavior: smooth;
  }

  body {
    font-family: ${props => props.theme.fonts.main};
    line-height: 1.6;
    color: ${props => props.theme.colors.text.secondary};
    background: ${props => props.theme.colors.background.main};
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* Custom scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
  }

  ::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
  }

  ::-webkit-scrollbar-thumb {
    background: linear-gradient(135deg, ${props => props.theme.colors.primary}, ${props => props.theme.colors.secondary});
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(135deg, ${props => props.theme.colors.secondary}, ${props => props.theme.colors.primary});
  }

  /* Selection styles */
  ::selection {
    background: rgba(59, 130, 246, 0.3);
    color: ${props => props.theme.colors.text.primary};
  }

  /* Focus styles */
  *:focus {
    outline: none;
  }

  *:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 2px;
  }
`;

const AppContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
`;

const MainContent = styled.main`
  flex: 1;
`;

const FullPageCenter = styled.div`
  min-height: 70vh;
  display: grid;
  place-items: center;
  color: #cbd5e1;
  font-size: 1rem;
`;

const RequireAuth = ({ children }) => {
  const { isAuthenticated, isHydrating } = useAppState();

  if (isHydrating) {
    return <FullPageCenter>Checking your session...</FullPageCenter>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  return children;
};

const GuestOnly = ({ children }) => {
  const { isAuthenticated, isHydrating } = useAppState();

  if (isHydrating) {
    return <FullPageCenter>Preparing authentication...</FullPageCenter>;
  }

  if (isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return children;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Router>
        <AppContainer>
          <MainContent>
            <Routes>
              <Route path="/" element={<LandingPage />} />

              <Route
                path="/auth/login"
                element={(
                  <GuestOnly>
                    <LoginPage />
                  </GuestOnly>
                )}
              />
              <Route
                path="/auth/register"
                element={(
                  <GuestOnly>
                    <RegisterPage />
                  </GuestOnly>
                )}
              />

              <Route
                path="/app"
                element={(
                  <RequireAuth>
                    <AppShell />
                  </RequireAuth>
                )}
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="onboarding" element={<OnboardingPage />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="workspace" element={<ProjectWorkspacePage />} />
                <Route path="history" element={<GenerationHistoryPage />} />
                <Route path="review" element={<ReviewDiffPage />} />
                <Route path="insights" element={<QualityInsightsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="integrations" element={<IntegrationsPage />} />
                <Route path="access" element={<AccessManagementPage />} />
                <Route path="status" element={<SystemStatusPage />} />
                <Route path="errors" element={<ErrorCenterPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/auth/login" replace />} />
            </Routes>
          </MainContent>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: 'rgba(15, 15, 35, 0.95)',
                color: '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '0.5rem',
                backdropFilter: 'blur(10px)',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#f8fafc',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#f8fafc',
                },
              },
            }}
          />
        </AppContainer>
      </Router>
    </ThemeProvider>
  );
}

export default App;