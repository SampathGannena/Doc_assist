import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import styled, { ThemeProvider, createGlobalStyle } from 'styled-components';

import Header from './components/Header/Header';
import Demo from './components/Demo/Demo';
import Features from './components/Features/Features';
import VSCodeSectionComponent from './components/VSCode/VSCodeSection';
import Examples from './components/Examples/Examples';
import Footer from './components/Footer/Footer';

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

function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Router>
        <AppContainer>
          <Header />
          <MainContent>
            <Demo />
            <Features />
            <VSCodeSectionComponent />
            <Examples />
          </MainContent>
          <Footer />
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