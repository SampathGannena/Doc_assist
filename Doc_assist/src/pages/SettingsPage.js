import React, { useEffect, useState } from 'react';

import { DEFAULT_SETTINGS, useAppState } from '../context/AppStateContext';
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
  Select,
  InlineRow,
  Button,
  WorkspacePage,
} from './PagePrimitives';

const SettingsPage = () => {
  const { settings, updateSettings, resetSettings } = useAppState();

  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const handleSave = () => {
    updateSettings({
      ...draft,
      timeoutMs: Number(draft.timeoutMs),
      retryAttempts: Number(draft.retryAttempts),
    });
    setSaved(true);
  };

  const handleReset = () => {
    resetSettings();
    setDraft(DEFAULT_SETTINGS);
    setSaved(false);
  };

  return (
    <WorkspacePage>
      <PageTop>
        <PageTitle>Settings</PageTitle>
        <PageDescription>
          Configure generation quality, user experience defaults, and secure behavior preferences.
        </PageDescription>
      </PageTop>

      <Card>
        <InlineRow>
          <div style={{ minWidth: '220px' }}>
            <Label htmlFor="setting-style">Doc Style</Label>
            <Select
              id="setting-style"
              value={draft.docStyle}
              onChange={(event) => setDraft((prev) => ({ ...prev, docStyle: event.target.value }))}
            >
              <option value="google">Google</option>
              <option value="numpy">NumPy</option>
              <option value="sphinx">Sphinx</option>
            </Select>
          </div>

          <div style={{ minWidth: '180px' }}>
            <Label htmlFor="setting-timeout">Timeout (ms)</Label>
            <Input
              id="setting-timeout"
              type="number"
              min={10000}
              step={1000}
              value={draft.timeoutMs}
              onChange={(event) => setDraft((prev) => ({ ...prev, timeoutMs: event.target.value }))}
            />
          </div>

          <div style={{ minWidth: '160px' }}>
            <Label htmlFor="setting-retries">Retry Attempts</Label>
            <Input
              id="setting-retries"
              type="number"
              min={0}
              max={5}
              value={draft.retryAttempts}
              onChange={(event) => setDraft((prev) => ({ ...prev, retryAttempts: event.target.value }))}
            />
          </div>
        </InlineRow>

        <div style={{ marginTop: '1rem' }}>
          <CheckboxRow>
            <input
              type="checkbox"
              checked={draft.includeExamples}
              onChange={(event) => setDraft((prev) => ({ ...prev, includeExamples: event.target.checked }))}
            />
            Include examples in generated output
          </CheckboxRow>

          <CheckboxRow>
            <input
              type="checkbox"
              checked={draft.includeComplexity}
              onChange={(event) => setDraft((prev) => ({ ...prev, includeComplexity: event.target.checked }))}
            />
            Include complexity hints in output metadata
          </CheckboxRow>

          <CheckboxRow>
            <input
              type="checkbox"
              checked={draft.autoSaveHistory}
              onChange={(event) => setDraft((prev) => ({ ...prev, autoSaveHistory: event.target.checked }))}
            />
            Auto-save generated drafts to history
          </CheckboxRow>

          <CheckboxRow>
            <input
              type="checkbox"
              checked={draft.strictMode}
              onChange={(event) => setDraft((prev) => ({ ...prev, strictMode: event.target.checked }))}
            />
            Strict mode for secure defaults and validation-first workflow
          </CheckboxRow>
        </div>

        <InlineRow style={{ marginTop: '1rem' }}>
          <PrimaryButton onClick={handleSave}>Save Settings</PrimaryButton>
          <Button onClick={handleReset}>Reset Defaults</Button>
        </InlineRow>

        {saved && <MutedText style={{ color: '#34d399', marginTop: '0.8rem' }}>Settings updated.</MutedText>}
      </Card>
    </WorkspacePage>
  );
};

export default SettingsPage;
