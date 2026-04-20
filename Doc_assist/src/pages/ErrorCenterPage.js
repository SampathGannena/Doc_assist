import React, { useMemo, useState } from 'react';

import { useAppState } from '../context/AppStateContext';
import {
  Card,
  EmptyState,
  InlineRow,
  MutedText,
  PageDescription,
  PageTitle,
  PageTop,
  Select,
  StatusBadge,
  Table,
  TableWrap,
  WorkspacePage,
  DangerButton,
} from './PagePrimitives';

const ErrorCenterPage = () => {
  const { errorLogs, clearErrors } = useAppState();

  const [sourceFilter, setSourceFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  const sources = useMemo(() => {
    const set = new Set(errorLogs.map((error) => error.source).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [errorLogs]);

  const filteredErrors = useMemo(() => {
    return errorLogs.filter((entry) => {
      const sourceMatch = sourceFilter === 'all' || entry.source === sourceFilter;
      const severityMatch = severityFilter === 'all' || entry.severity === severityFilter;
      return sourceMatch && severityMatch;
    });
  }, [errorLogs, sourceFilter, severityFilter]);

  return (
    <WorkspacePage>
      <PageTop>
        <PageTitle>Error Center</PageTitle>
        <PageDescription>
          Review recent runtime and API issues with filterable diagnostics.
        </PageDescription>
      </PageTop>

      <Card>
        <InlineRow>
          <div>
            <MutedText>Source</MutedText>
            <Select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              {sources.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </Select>
          </div>

          <div>
            <MutedText>Severity</MutedText>
            <Select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
              <option value="all">all</option>
              <option value="warning">warning</option>
              <option value="error">error</option>
            </Select>
          </div>

          <div style={{ alignSelf: 'end' }}>
            <DangerButton onClick={clearErrors} disabled={errorLogs.length === 0}>
              Clear Errors
            </DangerButton>
          </div>
        </InlineRow>
      </Card>

      <Card style={{ marginTop: '1rem' }}>
        {filteredErrors.length === 0 ? (
          <EmptyState>No matching errors.</EmptyState>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Severity</th>
                  <th>Message</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredErrors.map((entry) => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.createdAt).toLocaleString()}</td>
                    <td>{entry.source}</td>
                    <td>
                      <StatusBadge status={entry.severity === 'warning' ? 'warning' : 'error'}>
                        {entry.severity || 'error'}
                      </StatusBadge>
                    </td>
                    <td style={{ maxWidth: '360px' }}>{entry.message}</td>
                    <td>{entry.status || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </WorkspacePage>
  );
};

export default ErrorCenterPage;
