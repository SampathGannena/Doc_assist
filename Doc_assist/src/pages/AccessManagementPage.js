import React, { useMemo, useState } from 'react';

import { useAppState } from '../context/AppStateContext';
import {
  clearStoredApiKey,
  getApiKeyLocation,
  getStoredApiKey,
  maskApiKey,
  setStoredApiKey,
} from '../utils/security';
import { validateApiKey } from '../utils/validators';
import {
  Card,
  CheckboxRow,
  Input,
  Label,
  MutedText,
  PageDescription,
  PageTitle,
  PageTop,
  PrimaryButton,
  Button,
  WorkspacePage,
} from './PagePrimitives';

const AccessManagementPage = () => {
  const { logError } = useAppState();

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [rememberOnDevice, setRememberOnDevice] = useState(false);
  const [message, setMessage] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  const activeApiKey = useMemo(() => getStoredApiKey(), [refreshTick]);
  const keyLocation = useMemo(() => getApiKeyLocation(), [refreshTick]);

  const handleSave = () => {
    const validation = validateApiKey(apiKeyInput);

    if (!validation.isValid) {
      setMessage(validation.error);
      logError({
        source: 'access-management',
        message: validation.error,
        severity: 'warning',
      });
      return;
    }

    setStoredApiKey(apiKeyInput, rememberOnDevice);
    setApiKeyInput('');
    setMessage('API key saved securely.');
    setRefreshTick((prev) => prev + 1);
  };

  const handleClear = () => {
    clearStoredApiKey();
    setMessage('API key removed.');
    setRefreshTick((prev) => prev + 1);
  };

  return (
    <WorkspacePage>
      <PageTop>
        <PageTitle>API and Access Management</PageTitle>
        <PageDescription>
          Protect API access with controlled key storage and secure handling practices.
        </PageDescription>
      </PageTop>

      <Card>
        <MutedText>
          Current key: <strong>{maskApiKey(activeApiKey)}</strong>
        </MutedText>
        <MutedText>
          Storage location: <strong>{keyLocation}</strong>
        </MutedText>

        <div style={{ marginTop: '1rem' }}>
          <Label htmlFor="api-key-input">Set API Key</Label>
          <Input
            id="api-key-input"
            type="password"
            value={apiKeyInput}
            onChange={(event) => setApiKeyInput(event.target.value)}
            placeholder="Paste your API key"
          />
        </div>

        <div style={{ marginTop: '0.7rem' }}>
          <CheckboxRow>
            <input
              type="checkbox"
              checked={rememberOnDevice}
              onChange={(event) => setRememberOnDevice(event.target.checked)}
            />
            Remember on this device (uses local storage)
          </CheckboxRow>
        </div>

        <div style={{ marginTop: '0.9rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <PrimaryButton onClick={handleSave}>Save API Key</PrimaryButton>
          <Button onClick={handleClear}>Clear API Key</Button>
        </div>

        {message && <MutedText style={{ marginTop: '0.7rem' }}>{message}</MutedText>}
      </Card>

      <Card style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Security Guidance</h3>
        <MutedText>- Prefer session storage on shared devices.</MutedText>
        <MutedText>- Rotate API keys regularly and clear stale keys.</MutedText>
        <MutedText>- Do not paste production keys into public screenshots or logs.</MutedText>
      </Card>
    </WorkspacePage>
  );
};

export default AccessManagementPage;
