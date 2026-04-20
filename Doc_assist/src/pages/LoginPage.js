import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAppState } from '../context/AppStateContext';
import {
  Button,
  Card,
  CheckboxRow,
  Input,
  Label,
  MutedText,
  PageDescription,
  PageTitle,
  PrimaryButton,
  WorkspacePage,
} from './PagePrimitives';

const LoginPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isHydrating, login } = useAppState();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberOnDevice, setRememberOnDevice] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isHydrating && isAuthenticated) {
      navigate('/app/dashboard', { replace: true });
    }
  }, [isAuthenticated, isHydrating, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const result = await login({
      email: email.trim(),
      password,
      rememberOnDevice,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Unable to sign in.');
      return;
    }

    navigate('/app/dashboard', { replace: true });
  };

  return (
    <WorkspacePage style={{ maxWidth: '520px', margin: '0 auto', paddingTop: '3.5rem' }}>
      <Card>
        <PageTitle style={{ marginBottom: '0.4rem' }}>Sign In</PageTitle>
        <PageDescription>
          Sign in to load your personal projects, history, settings, and API access scope.
        </PageDescription>

        <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
          <div>
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div style={{ marginTop: '0.8rem' }}>
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
            />
          </div>

          <div style={{ marginTop: '0.8rem' }}>
            <CheckboxRow>
              <input
                type="checkbox"
                checked={rememberOnDevice}
                onChange={(event) => setRememberOnDevice(event.target.checked)}
              />
              Keep me signed in on this device
            </CheckboxRow>
          </div>

          {error && <MutedText style={{ color: '#f87171' }}>{error}</MutedText>}

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <PrimaryButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </PrimaryButton>
            <Button as={Link} to="/auth/register">Create Account</Button>
            <Button as={Link} to="/">Back to Landing</Button>
          </div>
        </form>
      </Card>
    </WorkspacePage>
  );
};

export default LoginPage;
