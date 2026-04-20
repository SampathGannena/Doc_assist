import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAppState } from '../context/AppStateContext';
import {
  Card,
  Grid,
  LinkButton,
  MutedText,
  PageDescription,
  PageTitle,
  PageTop,
  PrimaryButton,
  WorkspacePage,
} from './PagePrimitives';

const onboardingSteps = [
  {
    id: 'settings',
    title: 'Review settings',
    description: 'Set doc style, retries, and quality preferences for your team.',
    path: '/app/settings',
  },
  {
    id: 'access',
    title: 'Configure secure access',
    description: 'Add API key access with session or remembered storage.',
    path: '/app/access',
  },
  {
    id: 'workspace',
    title: 'Create your first project',
    description: 'Organize your generation workflow by project and language defaults.',
    path: '/app/workspace',
  },
  {
    id: 'status',
    title: 'Validate backend status',
    description: 'Confirm health, model readiness, and dependency state.',
    path: '/app/status',
  },
];

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { onboardingCompleted, markOnboardingComplete } = useAppState();
  const [checked, setChecked] = useState({});

  const progress = useMemo(() => {
    const completedCount = onboardingSteps.filter((step) => checked[step.id]).length;
    return Math.round((completedCount / onboardingSteps.length) * 100);
  }, [checked]);

  const allComplete = progress === 100;

  const handleToggle = (stepId) => {
    setChecked((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  const handleFinish = () => {
    markOnboardingComplete(true);
    navigate('/app/dashboard');
  };

  return (
    <WorkspacePage>
      <PageTop>
        <PageTitle>Onboarding</PageTitle>
        <PageDescription>
          Complete these starter tasks to make the project user friendly, secure, and ready for daily usage.
        </PageDescription>
      </PageTop>

      <Card>
        <MutedText>Progress: {progress}% {onboardingCompleted ? '(already completed once)' : ''}</MutedText>
      </Card>

      <Grid style={{ marginTop: '1rem' }}>
        {onboardingSteps.map((step) => (
          <Card key={step.id}>
            <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={Boolean(checked[step.id])}
                onChange={() => handleToggle(step.id)}
                style={{ marginTop: '0.2rem' }}
              />
              <div>
                <h3 style={{ margin: '0 0 0.4rem 0', color: '#f8fafc', fontSize: '1rem' }}>{step.title}</h3>
                <MutedText>{step.description}</MutedText>
              </div>
            </label>

            <div style={{ marginTop: '0.8rem' }}>
              <LinkButton as={Link} to={step.path}>Open Step</LinkButton>
            </div>
          </Card>
        ))}
      </Grid>

      <div style={{ marginTop: '1rem' }}>
        <PrimaryButton onClick={handleFinish} disabled={!allComplete}>
          Finish Onboarding
        </PrimaryButton>
      </div>
    </WorkspacePage>
  );
};

export default OnboardingPage;
