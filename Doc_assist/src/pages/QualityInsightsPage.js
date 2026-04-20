import React, { useMemo } from 'react';

import { useAppState } from '../context/AppStateContext';
import {
  Card,
  EmptyState,
  Grid,
  Metric,
  MutedText,
  PageDescription,
  PageTitle,
  PageTop,
  WorkspacePage,
} from './PagePrimitives';

const parseConfidence = (value) => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const match = value.match(/(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : null;
  }

  return null;
};

const QualityInsightsPage = () => {
  const { generationHistory } = useAppState();

  const metrics = useMemo(() => {
    if (generationHistory.length === 0) {
      return {
        total: 0,
        averageComplexity: 0,
        averageConfidence: 0,
        cacheHitRate: 0,
        fallbackRate: 0,
        languageCounts: [],
      };
    }

    const total = generationHistory.length;

    const complexityValues = generationHistory
      .map((record) => Number(record.complexity))
      .filter((value) => Number.isFinite(value));

    const confidenceValues = generationHistory
      .map((record) => parseConfidence(record.confidence))
      .filter((value) => Number.isFinite(value));

    const cacheHits = generationHistory.filter((record) => record.fromCache).length;
    const fallbackCount = generationHistory.filter((record) => {
      return String(record.model || '').toLowerCase().includes('fallback');
    }).length;

    const languageMap = generationHistory.reduce((acc, record) => {
      const language = record.language || 'unknown';
      acc.set(language, (acc.get(language) || 0) + 1);
      return acc;
    }, new Map());

    const languageCounts = Array.from(languageMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([language, count]) => ({ language, count }));

    return {
      total,
      averageComplexity: complexityValues.length > 0
        ? (complexityValues.reduce((sum, value) => sum + value, 0) / complexityValues.length)
        : 0,
      averageConfidence: confidenceValues.length > 0
        ? (confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
        : 0,
      cacheHitRate: total > 0 ? (cacheHits / total) * 100 : 0,
      fallbackRate: total > 0 ? (fallbackCount / total) * 100 : 0,
      languageCounts,
    };
  }, [generationHistory]);

  return (
    <WorkspacePage>
      <PageTop>
        <PageTitle>Quality Insights</PageTitle>
        <PageDescription>
          Track quality trends, model reliability, and language usage using your generation history.
        </PageDescription>
      </PageTop>

      {metrics.total === 0 ? (
        <EmptyState>
          No quality data yet. Generate documentation drafts to populate insights.
        </EmptyState>
      ) : (
        <>
          <Grid>
            <Card>
              <MutedText>Total Runs</MutedText>
              <Metric>{metrics.total}</Metric>
            </Card>

            <Card>
              <MutedText>Avg Complexity</MutedText>
              <Metric>{metrics.averageComplexity.toFixed(1)}</Metric>
            </Card>

            <Card>
              <MutedText>Avg Confidence</MutedText>
              <Metric>{metrics.averageConfidence.toFixed(1)}%</Metric>
            </Card>

            <Card>
              <MutedText>Cache Hit Rate</MutedText>
              <Metric>{metrics.cacheHitRate.toFixed(1)}%</Metric>
            </Card>
          </Grid>

          <Grid style={{ marginTop: '1rem' }}>
            <Card>
              <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Language Distribution</h3>
              {metrics.languageCounts.map((item) => {
                const width = Math.max(8, (item.count / metrics.total) * 100);
                return (
                  <div key={item.language} style={{ marginBottom: '0.7rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>{item.language}</span>
                      <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{item.count}</span>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px' }}>
                      <div
                        style={{
                          width: `${width}%`,
                          height: '100%',
                          borderRadius: '999px',
                          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </Card>

            <Card>
              <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Reliability Signals</h3>
              <MutedText>
                Fallback Rate: <strong>{metrics.fallbackRate.toFixed(1)}%</strong>
              </MutedText>
              <MutedText>
                Lower fallback rate usually indicates stronger model availability and dependency readiness.
              </MutedText>
            </Card>
          </Grid>
        </>
      )}
    </WorkspacePage>
  );
};

export default QualityInsightsPage;
