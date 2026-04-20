import React, { useEffect, useMemo, useState } from 'react';

import { useAppState } from '../context/AppStateContext';
import { generateDocumentation } from '../utils/api';
import { CODE_EXAMPLES, LANGUAGE_NAMES } from '../utils/constants';
import { calculateComplexity } from '../utils/codeParser';
import { validateCode } from '../utils/validators';
import {
  Card,
  CheckboxRow,
  EmptyState,
  InlineRow,
  Label,
  MutedText,
  PageDescription,
  PageTitle,
  PageTop,
  PreBlock,
  PrimaryButton,
  Select,
  StatusBadge,
  Textarea,
  Button,
  WorkspacePage,
} from './PagePrimitives';

const computeDiffRows = (leftText, rightText) => {
  const leftLines = (leftText || '').split('\n');
  const rightLines = (rightText || '').split('\n');
  const maxLines = Math.max(leftLines.length, rightLines.length);

  const rows = [];

  for (let index = 0; index < maxLines; index += 1) {
    const left = leftLines[index] ?? '';
    const right = rightLines[index] ?? '';

    let type = 'same';
    if (!left && right) {
      type = 'added';
    } else if (left && !right) {
      type = 'removed';
    } else if (left !== right) {
      type = 'changed';
    }

    rows.push({
      number: index + 1,
      left,
      right,
      type,
    });
  }

  return rows;
};

const ReviewDiffPage = () => {
  const {
    settings,
    addGenerationRecord,
    refreshGenerationHistory,
    logError,
    currentProject,
  } = useAppState();

  const [language, setLanguage] = useState(currentProject?.language || 'python');
  const [code, setCode] = useState(CODE_EXAMPLES[currentProject?.language || 'python'] || '');
  const [generated, setGenerated] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const diffRows = useMemo(() => computeDiffRows(code, generated), [code, generated]);

  useEffect(() => {
    const defaultLanguage = currentProject?.language || 'python';
    setLanguage(defaultLanguage);
    setCode(CODE_EXAMPLES[defaultLanguage] || '');
    setGenerated('');
    setMetadata(null);
    setError('');
    setSaved(false);
  }, [currentProject?.id, currentProject?.language]);

  const handleLoadSample = () => {
    setCode(CODE_EXAMPLES[language] || '');
    setGenerated('');
    setMetadata(null);
    setError('');
  };

  const handleGenerate = async () => {
    const validation = validateCode(code);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    setLoading(true);
    setError('');
    setSaved(false);

    const startedAt = Date.now();

    try {
      const response = await generateDocumentation(code, language, {
        projectId: currentProject?.id || null,
        options: {
          style: settings.docStyle,
          includeExamples: settings.includeExamples,
          includeComplexity: settings.includeComplexity,
        },
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to generate documentation.');
      }

      const payload = response?.data?.data || response?.data || {};
      const documentation = payload.documentation || payload.result || '';

      if (!documentation.trim()) {
        throw new Error('Documentation response was empty.');
      }

      const complexity = calculateComplexity(code);
      const nextMetadata = {
        model: payload?.metadata?.model || 'CodeT5-base',
        confidence: payload?.metadata?.confidence || 'N/A',
        processingTime: payload?.metadata?.processingTimeMs
          ? `${payload.metadata.processingTimeMs}ms`
          : `${Date.now() - startedAt}ms`,
        complexity: payload?.metadata?.complexity ?? complexity,
        fromCache: Boolean(payload?.metadata?.fromCache),
      };

      setGenerated(documentation);
      setMetadata(nextMetadata);

      if (settings.autoSaveHistory) {
        // Generation requests are persisted server-side; refresh to load canonical history.
        await refreshGenerationHistory({ suppressErrors: true });
      }
    } catch (requestError) {
      setError(requestError.message || 'Failed to generate documentation.');
      logError({
        source: 'review-diff',
        message: requestError.message || 'Failed to generate documentation.',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSnapshot = async () => {
    if (!generated) {
      return;
    }

    await addGenerationRecord({
      projectId: currentProject?.id || null,
      language,
      model: metadata?.model || 'CodeT5-base',
      confidence: metadata?.confidence || 'N/A',
      complexity: metadata?.complexity || calculateComplexity(code),
      fromCache: Boolean(metadata?.fromCache),
      inputSnippet: code.slice(0, 140),
      outputSnippet: generated.slice(0, 140),
      sourceCode: code,
      documentation: generated,
      style: settings.docStyle,
      includeExamples: settings.includeExamples,
      includeComplexity: settings.includeComplexity,
    });

    setSaved(true);
  };

  return (
    <WorkspacePage>
      <PageTop>
        <PageTitle>Review and Diff</PageTitle>
        <PageDescription>
          Generate documentation drafts, inspect changes line-by-line, and save approved snapshots.
        </PageDescription>
        <MutedText>
          Active project: <strong>{currentProject?.name || 'None selected'}</strong>
          {' '}| Default language: <strong>{currentProject?.language || 'python'}</strong>
        </MutedText>
      </PageTop>

      <Card>
        <InlineRow>
          <div style={{ minWidth: '200px' }}>
            <Label htmlFor="review-language">Language</Label>
            <Select
              id="review-language"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              {Object.entries(LANGUAGE_NAMES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </div>

          <div style={{ display: 'flex', alignItems: 'end', gap: '0.5rem' }}>
            <Button onClick={handleLoadSample}>Load Sample</Button>
            <Button onClick={() => setLanguage(currentProject?.language || 'python')}>
              Use Project Default
            </Button>
            <PrimaryButton onClick={handleGenerate} disabled={loading}>
              {loading ? 'Generating...' : 'Generate Draft'}
            </PrimaryButton>
            <Button onClick={handleSaveSnapshot} disabled={!generated}>
              Save Snapshot
            </Button>
          </div>
        </InlineRow>

        <div style={{ marginTop: '1rem' }}>
          <Label htmlFor="review-code">Source Code</Label>
          <Textarea
            id="review-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Paste the function or class you want to document."
          />
        </div>

        {error && <MutedText style={{ color: '#f87171', marginTop: '0.6rem' }}>{error}</MutedText>}
        {saved && <MutedText style={{ color: '#34d399', marginTop: '0.6rem' }}>Snapshot saved to history.</MutedText>}
      </Card>

      <Card style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Generated Documentation</h3>
        {!generated ? (
          <EmptyState>No draft yet. Generate documentation to start review.</EmptyState>
        ) : (
          <>
            <PreBlock>{generated}</PreBlock>
            {metadata && (
              <InlineRow style={{ marginTop: '0.7rem' }}>
                <StatusBadge status="success">Model: {metadata.model}</StatusBadge>
                <StatusBadge>{`Confidence: ${metadata.confidence}`}</StatusBadge>
                <StatusBadge>{`Time: ${metadata.processingTime}`}</StatusBadge>
                <StatusBadge>{`Complexity: ${metadata.complexity}`}</StatusBadge>
                {metadata.fromCache && <StatusBadge status="warning">From Cache</StatusBadge>}
              </InlineRow>
            )}
          </>
        )}
      </Card>

      <Card style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Line Diff</h3>
        {!generated ? (
          <EmptyState>Diff view appears after you generate a draft.</EmptyState>
        ) : (
          <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.65rem', overflow: 'hidden' }}>
            {diffRows.slice(0, 220).map((row) => {
              let background = 'transparent';

              if (row.type === 'added') {
                background = 'rgba(16, 185, 129, 0.15)';
              } else if (row.type === 'removed') {
                background = 'rgba(239, 68, 68, 0.15)';
              } else if (row.type === 'changed') {
                background = 'rgba(245, 158, 11, 0.15)';
              }

              return (
                <div
                  key={`${row.number}-${row.type}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '58px 1fr 1fr',
                    gap: '0.5rem',
                    padding: '0.35rem 0.5rem',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background,
                    fontFamily: 'JetBrains Mono, Courier New, monospace',
                    fontSize: '0.78rem',
                    color: '#e2e8f0',
                  }}
                >
                  <div style={{ opacity: 0.7 }}>L{row.number}</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{row.left}</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{row.right}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Secure Review Guidance</h3>
        <CheckboxRow>
          <input type="checkbox" checked readOnly />
          Always inspect generated output before copying to production code.
        </CheckboxRow>
        <CheckboxRow>
          <input type="checkbox" checked readOnly />
          Keep API keys in Access Management and avoid hard-coding secrets in source files.
        </CheckboxRow>
        <CheckboxRow>
          <input type="checkbox" checked readOnly />
          Track final approved drafts in history for team traceability.
        </CheckboxRow>
      </Card>
    </WorkspacePage>
  );
};

export default ReviewDiffPage;
