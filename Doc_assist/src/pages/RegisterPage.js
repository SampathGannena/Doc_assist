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

const RegisterPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isHydrating, register } = useAppState();

  const [name, setName] = useState('');
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

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Name, email, and password are required.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const result = await register({
      name: name.trim(),
      email: email.trim(),
      password,
      rememberOnDevice,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Unable to create account.');
      return;
    }

    navigate('/app/dashboard', { replace: true });
  };

  return (
    <WorkspacePage style={{ maxWidth: '520px', margin: '0 auto', paddingTop: '3.5rem' }}>
      <Card>
        <PageTitle style={{ marginBottom: '0.4rem' }}>Create Account</PageTitle>
        <PageDescription>
          Create your DOCAssist account to keep all projects and documentation progress linked to your user profile.
        </PageDescription>

        <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
          <div>
            <Label htmlFor="register-name">Name</Label>
            <Input
              id="register-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your full name"
            />
          </div>

          <div style={{ marginTop: '0.8rem' }}>
            <Label htmlFor="register-email">Email</Label>
            <Input
              id="register-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div style={{ marginTop: '0.8rem' }}>
            <Label htmlFor="register-password">Password</Label>
            <Input
              id="register-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 8 characters"
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
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </PrimaryButton>
            <Button as={Link} to="/auth/login">Sign In</Button>
            <Button as={Link} to="/">Back to Landing</Button>
          </div>
        </form>
      </Card>
    </WorkspacePage>
  );
};

export default RegisterPage;
