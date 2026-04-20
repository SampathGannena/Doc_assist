import React, { useEffect, useState } from 'react';

import { useAppState } from '../context/AppStateContext';
import { isValidUrl } from '../utils/validators';
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
  WorkspacePage,
} from './PagePrimitives';

const IntegrationsPage = () => {
  const { integrations, updateIntegrations, logError } = useAppState();

  const [draft, setDraft] = useState(integrations);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setDraft(integrations);
  }, [integrations]);

  const handleSave = () => {
    if (draft.webhookUrl && !isValidUrl(draft.webhookUrl)) {
      setMessage('Webhook URL is invalid.');
      logError({
        source: 'integrations',
        message: 'Invalid webhook URL format.',
        severity: 'warning',
      });
      return;
    }

    updateIntegrations(draft);
    setMessage('Integration settings saved.');
  };

  return (
    <WorkspacePage>
      <PageTop>
        <PageTitle>Integrations</PageTitle>
        <PageDescription>
          Manage external integration readiness and secure webhook configuration.
        </PageDescription>
      </PageTop>

      <Card>
        <CheckboxRow>
          <input
            type="checkbox"
            checked={draft.vscodeConnected}
            onChange={(event) => setDraft((prev) => ({ ...prev, vscodeConnected: event.target.checked }))}
          />
          VS Code integration enabled
        </CheckboxRow>

        <CheckboxRow>
          <input
            type="checkbox"
            checked={draft.githubConnected}
            onChange={(event) => setDraft((prev) => ({ ...prev, githubConnected: event.target.checked }))}
          />
          GitHub integration enabled
        </CheckboxRow>

        <div style={{ marginTop: '0.9rem' }}>
          <Label htmlFor="integration-webhook">Webhook URL (optional)</Label>
          <Input
            id="integration-webhook"
            value={draft.webhookUrl}
            onChange={(event) => setDraft((prev) => ({ ...prev, webhookUrl: event.target.value.trim() }))}
            placeholder="https://example.com/webhook"
          />
        </div>

        <div style={{ marginTop: '1rem' }}>
          <PrimaryButton onClick={handleSave}>Save Integrations</PrimaryButton>
        </div>

        {message && <MutedText style={{ marginTop: '0.7rem' }}>{message}</MutedText>}
      </Card>
    </WorkspacePage>
  );
};

export default IntegrationsPage;
