import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAppState } from '../context/AppStateContext';
import { getStoredApiKey } from '../utils/security';

const Shell = styled.div`
  min-height: 100vh;
  display: grid;
  grid-template-columns: 250px 1fr;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
  }
`;

const Sidebar = styled.aside`
  border-right: 1px solid ${props => props.theme.colors.border};
  background: rgba(0, 0, 0, 0.2);
  padding: 1rem;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    border-right: none;
    border-bottom: 1px solid ${props => props.theme.colors.border};
  }
`;

const Brand = styled(Link)`
  display: block;
  color: ${props => props.theme.colors.text.primary};
  text-decoration: none;
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 1rem;
`;

const NavGroup = styled.nav`
  display: grid;
  gap: 0.4rem;
`;

const NavItem = styled(NavLink)`
  color: ${props => props.theme.colors.text.secondary};
  text-decoration: none;
  border: 1px solid transparent;
  border-radius: 0.5rem;
  padding: 0.55rem 0.65rem;
  font-size: 0.9rem;

  &:hover {
    border-color: ${props => props.theme.colors.border};
    color: ${props => props.theme.colors.text.primary};
  }

  &.active {
    border-color: rgba(59, 130, 246, 0.45);
    background: rgba(59, 130, 246, 0.14);
    color: ${props => props.theme.colors.text.primary};
  }
`;

const Main = styled.div`
  min-width: 0;
`;

const TopBar = styled.header`
  border-bottom: 1px solid ${props => props.theme.colors.border};
  padding: 0.9rem 1.2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
`;

const TopMeta = styled.div`
  color: ${props => props.theme.colors.text.muted};
  font-size: 0.9rem;
`;

const TopActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const TopLink = styled(Link)`
  text-decoration: none;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 0.5rem;
  padding: 0.4rem 0.7rem;
  color: ${props => props.theme.colors.text.primary};
  font-size: 0.85rem;
`;

const TopButton = styled.button`
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 0.5rem;
  padding: 0.4rem 0.7rem;
  color: ${props => props.theme.colors.text.primary};
  font-size: 0.85rem;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
`;

const SecurityBadge = styled.span`
  border-radius: 999px;
  padding: 0.3rem 0.65rem;
  font-size: 0.78rem;
  font-weight: 600;
  background: ${props => (props.secure ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.22)')};
  color: ${props => (props.secure ? '#34d399' : '#fbbf24')};
`;

const navItems = [
  { to: '/app/onboarding', label: 'Onboarding' },
  { to: '/app/dashboard', label: 'Dashboard' },
  { to: '/app/workspace', label: 'Project Workspace' },
  { to: '/app/review', label: 'Review and Diff' },
  { to: '/app/history', label: 'Generation History' },
  { to: '/app/insights', label: 'Quality Insights' },
  { to: '/app/settings', label: 'Settings' },
  { to: '/app/integrations', label: 'Integrations' },
  { to: '/app/access', label: 'Access Management' },
  { to: '/app/status', label: 'System Status' },
  { to: '/app/errors', label: 'Error Center' },
];

const AppShell = () => {
  const navigate = useNavigate();
  const {
    authProfile,
    backendConnected,
    currentProject,
    logout,
  } = useAppState();
  const [, setAccessTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleAccessUpdate = () => {
      setAccessTick((tick) => tick + 1);
    };

    window.addEventListener('docassist:access-updated', handleAccessUpdate);
    return () => {
      window.removeEventListener('docassist:access-updated', handleAccessUpdate);
    };
  }, []);

  const secureMode = Boolean(getStoredApiKey()) && backendConnected;
  const activeScopes = Array.isArray(authProfile?.scopes) ? authProfile.scopes : [];
  const userName = authProfile?.user?.name || authProfile?.user?.email || 'Unknown User';

  const handleSignOut = async () => {
    await logout();
    navigate('/auth/login', { replace: true });
  };

  return (
    <Shell>
      <Sidebar>
        <Brand to="/">Code Documentation Assistant</Brand>
        <NavGroup>
          {navItems.map((item) => (
            <NavItem key={item.to} to={item.to}>
              {item.label}
            </NavItem>
          ))}
        </NavGroup>
      </Sidebar>

      <Main>
        <TopBar>
          <TopMeta>
            Signed in as: <strong>{userName}</strong> | Active project: <strong>{currentProject?.name || 'None selected'}</strong>
          </TopMeta>

          <TopActions>
            <TopLink to="/">Open Landing</TopLink>
            <TopButton type="button" onClick={handleSignOut}>Sign Out</TopButton>
            <SecurityBadge secure={secureMode}>
              {secureMode
                ? `Secure Mode (${activeScopes.join(', ') || 'scoped'})`
                : 'No Verified API Key'}
            </SecurityBadge>
          </TopActions>
        </TopBar>

        <Outlet />
      </Main>
    </Shell>
  );
};

export default AppShell;
