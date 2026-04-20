import React, { useCallback, useEffect, useState } from 'react';

import { useAppState } from '../context/AppStateContext';
import { checkHealth } from '../utils/api';
import { API_CONFIG } from '../utils/constants';
import {
  Card,
  MutedText,
  PageDescription,
  PageTitle,
  PageTop,
  PreBlock,
  PrimaryButton,
  StatusBadge,
  WorkspacePage,
} from './PagePrimitives';

const SystemStatusPage = () => {
  const { logError } = useAppState();

  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastCheckedAt, setLastCheckedAt] = useState(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await checkHealth();

      if (!response.success) {
        throw new Error(response.error || 'Unable to reach backend health endpoint.');
      }

      const payload = response?.data?.data || response?.data || {};
      setStatusData(payload);
      setLastCheckedAt(new Date());

      if (String(payload.status || '').toLowerCase() !== 'healthy') {
        logError({
          source: 'system-status',
          message: `Backend status is ${payload.status || 'unknown'}`,
          severity: 'warning',
          details: payload,
        });
      }
    } catch (statusError) {
      const message = statusError.message || 'Unable to load backend status.';
      setError(message);
      logError({
        source: 'system-status',
        message,
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [logError]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  return (
    <WorkspacePage>
      <PageTop>
        <PageTitle>System Status</PageTitle>
        <PageDescription>
          Monitor backend availability, model readiness, and dependency diagnostics.
        </PageDescription>
      </PageTop>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.7rem', flexWrap: 'wrap' }}>
          <div>
            <MutedText>API Base URL</MutedText>
            <div style={{ color: '#f8fafc', fontSize: '0.95rem' }}>{API_CONFIG.BASE_URL}</div>
          </div>
          <div style={{ alignSelf: 'end' }}>
            <PrimaryButton onClick={loadStatus} disabled={loading}>
              {loading ? 'Checking...' : 'Refresh Status'}
            </PrimaryButton>
          </div>
        </div>

        {lastCheckedAt && (
          <MutedText style={{ marginTop: '0.8rem' }}>
            Last checked: {lastCheckedAt.toLocaleString()}
          </MutedText>
        )}
      </Card>

      <Card style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Health Summary</h3>
        {error && <MutedText style={{ color: '#f87171' }}>{error}</MutedText>}
        {!error && !statusData && <MutedText>Status data unavailable.</MutedText>}

        {statusData && (
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            <div>
              <MutedText>Service Status</MutedText>
              <StatusBadge status={String(statusData.status || '').toLowerCase()}>
                {statusData.status || 'unknown'}
              </StatusBadge>
            </div>

            <div>
              <MutedText>Model Loaded</MutedText>
              <StatusBadge status={statusData.modelLoaded ? 'healthy' : 'degraded'}>
                {statusData.modelLoaded ? 'true' : 'false'}
              </StatusBadge>
            </div>

            <div>
              <MutedText>Model</MutedText>
              <div style={{ color: '#e2e8f0' }}>{statusData.model || 'unknown'}</div>
            </div>

            <div>
              <MutedText>Fine-tuned Path</MutedText>
              <div style={{ color: '#e2e8f0', wordBreak: 'break-all' }}>{statusData.finetunedPath || '-'}</div>
            </div>

            {statusData.loadError && (
              <div>
                <MutedText>Load Error</MutedText>
                <PreBlock>{statusData.loadError}</PreBlock>
              </div>
            )}
          </div>
        )}
      </Card>
    </WorkspacePage>
  );
};

export default SystemStatusPage;
