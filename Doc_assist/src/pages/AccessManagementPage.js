import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useAppState } from '../context/AppStateContext';
import {
  createAccessKey,
  getAuthProfile,
  listAccessKeys,
  normalizePayloadData,
  revokeAccessKey,
} from '../utils/api';
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
  Select,
  PageDescription,
  PageTitle,
  PageTop,
  PrimaryButton,
  Button,
  StatusBadge,
  Table,
  TableWrap,
  InlineRow,
  WorkspacePage,
} from './PagePrimitives';

const scopeOptions = [
  { value: 'read', label: 'Read' },
  { value: 'generate', label: 'Generate' },
  { value: 'manage', label: 'Manage' },
  { value: 'admin', label: 'Admin' },
];

const roleTemplates = [
  {
    value: 'developer',
    label: 'Developer',
    description: 'Can read and generate documentation.',
    scopes: ['read', 'generate'],
  },
  {
    value: 'manager',
    label: 'Manager',
    description: 'Can read, generate, and manage API keys/projects.',
    scopes: ['read', 'generate', 'manage'],
  },
  {
    value: 'auditor',
    label: 'Auditor',
    description: 'Can inspect status, history, and quality.',
    scopes: ['read'],
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Full access including cache/admin operations.',
    scopes: ['read', 'generate', 'manage', 'admin'],
  },
  {
    value: 'custom',
    label: 'Custom',
    description: 'Select scopes manually.',
    scopes: ['read'],
  },
];

const AccessManagementPage = () => {
  const {
    backendConnected,
    isHydrating,
    logError,
    refreshBackendState,
  } = useAppState();

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [rememberOnDevice, setRememberOnDevice] = useState(false);
  const [message, setMessage] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  const [authDetails, setAuthDetails] = useState(null);
  const [keys, setKeys] = useState([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isCreatingServerKey, setIsCreatingServerKey] = useState(false);
  const [createdServerToken, setCreatedServerToken] = useState('');
  const [newKeyLabel, setNewKeyLabel] = useState('Frontend Managed Key');
  const [newKeyRole, setNewKeyRole] = useState('developer');
  const [newKeyScopes, setNewKeyScopes] = useState(['read', 'generate']);

  const activeApiKey = useMemo(() => getStoredApiKey(), [refreshTick]);
  const keyLocation = useMemo(() => getApiKeyLocation(), [refreshTick]);
  const activeRoleTemplate = useMemo(
    () => roleTemplates.find((template) => template.value === newKeyRole) || roleTemplates[0],
    [newKeyRole],
  );

  const canManageKeys = Boolean(authDetails?.permissions?.canManage);
  const isAdminKey = Boolean(authDetails?.permissions?.isAdmin);

  const loadServerAccessState = useCallback(async () => {
    const authResponse = await getAuthProfile();
    if (!authResponse.success) {
      setAuthDetails(null);
      setKeys([]);
      return false;
    }

    const profile = normalizePayloadData(authResponse);
    setAuthDetails(profile || null);

    if (!profile?.permissions?.canManage) {
      setKeys([]);
      return true;
    }

    setIsLoadingKeys(true);
    const keysResponse = await listAccessKeys();
    setIsLoadingKeys(false);

    if (!keysResponse.success) {
      logError({
        source: 'access-management',
        message: keysResponse.error || 'Unable to load backend API keys.',
        severity: 'warning',
      });
      setKeys([]);
      return false;
    }

    const payload = normalizePayloadData(keysResponse);
    setKeys(Array.isArray(payload) ? payload : []);
    return true;
  }, [logError]);

  useEffect(() => {
    loadServerAccessState();
  }, [loadServerAccessState, refreshTick]);

  const handleSave = async () => {
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

    setIsSavingKey(true);
    setStoredApiKey(apiKeyInput, rememberOnDevice);
    await refreshBackendState({ suppressErrors: true });
    const validated = await loadServerAccessState();

    setApiKeyInput('');
    setMessage(validated ? 'API key saved and validated with backend.' : 'API key saved, but backend rejected it.');
    setRefreshTick((prev) => prev + 1);
    setIsSavingKey(false);
  };

  const handleClear = async () => {
    clearStoredApiKey();
    await refreshBackendState({ suppressErrors: true });
    await loadServerAccessState();

    setMessage('API key removed.');
    setCreatedServerToken('');
    setRefreshTick((prev) => prev + 1);
  };

  const handleCreateServerKey = async () => {
    if (!canManageKeys) {
      setMessage('Current key does not have manage scope.');
      return;
    }

    const scopes = Array.from(new Set(newKeyScopes));
    if (scopes.length === 0) {
      setMessage('Select at least one scope before creating a key.');
      return;
    }

    setIsCreatingServerKey(true);
    const createResponse = await createAccessKey({
      label: newKeyLabel,
      scopes,
    });
    setIsCreatingServerKey(false);

    if (!createResponse.success) {
      setMessage(createResponse.error || 'Unable to create backend API key.');
      logError({
        source: 'access-management',
        message: createResponse.error || 'Unable to create backend API key.',
        severity: 'error',
      });
      return;
    }

    const payload = normalizePayloadData(createResponse);
    const token = payload?.token || '';
    setCreatedServerToken(token);
    setMessage(`Scoped backend API key created with: ${scopes.join(', ')}`);
    setRefreshTick((prev) => prev + 1);
  };

  const handleRoleChange = (nextRole) => {
    const role = roleTemplates.find((template) => template.value === nextRole);
    if (!role) {
      return;
    }

    setNewKeyRole(nextRole);
    setNewKeyScopes(role.scopes);
  };

  const toggleScope = (scope) => {
    setNewKeyScopes((previous) => {
      if (previous.includes(scope)) {
        if (previous.length === 1) {
          return previous;
        }
        return previous.filter((value) => value !== scope);
      }
      return [...previous, scope];
    });
  };

  const handleCopyCreatedKey = async () => {
    if (!createdServerToken || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(createdServerToken);
      setMessage('New key token copied to clipboard.');
    } catch {
      setMessage('Unable to copy token automatically. Copy it manually before leaving this page.');
    }
  };

  const handleRevokeKey = async (keyId) => {
    const revokeResponse = await revokeAccessKey(keyId);
    if (!revokeResponse.success) {
      setMessage(revokeResponse.error || 'Unable to revoke API key.');
      logError({
        source: 'access-management',
        message: revokeResponse.error || 'Unable to revoke backend API key.',
        severity: 'error',
      });
      return;
    }

    setMessage('API key revoked.');
    setRefreshTick((prev) => prev + 1);
  };

  const handleUseCreatedKey = async () => {
    if (!createdServerToken) {
      return;
    }

    setStoredApiKey(createdServerToken, rememberOnDevice);
    await refreshBackendState({ suppressErrors: true });
    await loadServerAccessState();
    setMessage('New backend key is now active in this client.');
    setRefreshTick((prev) => prev + 1);
  };

  return (
    <WorkspacePage>
      <PageTop>
        <PageTitle>API and Access Management</PageTitle>
        <PageDescription>
          Protect API access with controlled key storage and secure handling practices.
        </PageDescription>
        <MutedText>
          Backend auth sync: <strong>{backendConnected ? 'connected' : 'not authenticated'}</strong>
          {isHydrating ? ' (syncing...)' : ''}
        </MutedText>
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
          <PrimaryButton onClick={handleSave} disabled={isSavingKey}>
            {isSavingKey ? 'Validating...' : 'Save API Key'}
          </PrimaryButton>
          <Button onClick={handleClear}>Clear API Key</Button>
        </div>

        {message && <MutedText style={{ marginTop: '0.7rem' }}>{message}</MutedText>}

        <div style={{ marginTop: '1rem' }}>
          <MutedText>
            Authenticated scopes:{' '}
            <strong>{authDetails?.scopes?.length ? authDetails.scopes.join(', ') : 'none'}</strong>
          </MutedText>
          {authDetails?.permissions && (
            <InlineRow style={{ marginTop: '0.4rem' }}>
              <StatusBadge status={authDetails.permissions.canRead ? 'success' : 'warning'}>Read</StatusBadge>
              <StatusBadge status={authDetails.permissions.canGenerate ? 'success' : 'warning'}>Generate</StatusBadge>
              <StatusBadge status={authDetails.permissions.canManage ? 'success' : 'warning'}>Manage</StatusBadge>
              <StatusBadge status={authDetails.permissions.isAdmin ? 'success' : 'warning'}>Admin</StatusBadge>
            </InlineRow>
          )}
        </div>
      </Card>

      <Card style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Backend Scoped API Keys</h3>
        {!canManageKeys ? (
          <MutedText>
            Current key does not include manage scope. Use a key with manage/admin permissions to control backend keys.
          </MutedText>
        ) : (
          <>
            <InlineRow>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <Label htmlFor="new-key-label">Key Label</Label>
                <Input
                  id="new-key-label"
                  value={newKeyLabel}
                  onChange={(event) => setNewKeyLabel(event.target.value)}
                />
              </div>

              <div style={{ minWidth: '180px' }}>
                <Label htmlFor="new-key-role">Access Role</Label>
                <Select
                  id="new-key-role"
                  value={newKeyRole}
                  onChange={(event) => handleRoleChange(event.target.value)}
                >
                  {roleTemplates.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </Select>
              </div>

              <div style={{ alignSelf: 'end' }}>
                <PrimaryButton onClick={handleCreateServerKey} disabled={isCreatingServerKey}>
                  {isCreatingServerKey ? 'Creating...' : 'Create Backend Key'}
                </PrimaryButton>
              </div>
            </InlineRow>

            <MutedText style={{ marginTop: '0.6rem' }}>
              Template: <strong>{activeRoleTemplate.label}</strong> - {activeRoleTemplate.description}
            </MutedText>

            <div style={{ marginTop: '0.8rem' }}>
              <Label>Scopes</Label>
              <InlineRow>
                {scopeOptions.map((scope) => (
                  <CheckboxRow key={scope.value} style={{ marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      checked={newKeyScopes.includes(scope.value)}
                      onChange={() => toggleScope(scope.value)}
                      disabled={scope.value === 'admin' && !isAdminKey}
                    />
                    {scope.label}
                  </CheckboxRow>
                ))}
              </InlineRow>
              {!isAdminKey && (
                <MutedText style={{ marginTop: '0.4rem' }}>
                  Admin scope can only be created by a currently authenticated admin key.
                </MutedText>
              )}
            </div>

            {createdServerToken && (
              <div style={{ marginTop: '0.9rem' }}>
                <MutedText>
                  New key token (shown once): <strong>{createdServerToken}</strong>
                </MutedText>
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Button onClick={handleCopyCreatedKey}>Copy Token</Button>
                  <Button onClick={handleUseCreatedKey}>Use This Key Now</Button>
                </div>
              </div>
            )}

            <div style={{ marginTop: '1rem' }}>
              {isLoadingKeys ? (
                <MutedText>Loading backend keys...</MutedText>
              ) : keys.length === 0 ? (
                <MutedText>No managed backend keys found.</MutedText>
              ) : (
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <th>Label</th>
                        <th>Scopes</th>
                        <th>Source</th>
                        <th>Last Used</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map((item) => (
                        <tr key={item.id}>
                          <td>{item.label}</td>
                          <td>{Array.isArray(item.scopes) ? item.scopes.join(', ') : '-'}</td>
                          <td>{item.source || '-'}</td>
                          <td>{item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleString() : '-'}</td>
                          <td>
                            <Button
                              onClick={() => handleRevokeKey(item.id)}
                              disabled={item.source === 'environment'}
                            >
                              Revoke
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </div>
          </>
        )}
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
