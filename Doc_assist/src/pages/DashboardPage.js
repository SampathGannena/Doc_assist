import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { useAppState } from '../context/AppStateContext';
import {
  Card,
  Grid,
  LinkButton,
  Metric,
  MutedText,
  PageDescription,
  PageTitle,
  PageTop,
  Table,
  TableWrap,
  WorkspacePage,
} from './PagePrimitives';

const DashboardPage = () => {
  const {
    projects,
    generationHistory,
    errorLogs,
    currentProject,
    onboardingCompleted,
  } = useAppState();

  const recentHistory = useMemo(() => generationHistory.slice(0, 6), [generationHistory]);

  return (
    <WorkspacePage>
      <PageTop>
        <PageTitle>Dashboard</PageTitle>
        <PageDescription>
          Overview of projects, generation activity, and operational readiness.
        </PageDescription>
      </PageTop>

      <Grid>
        <Card>
          <MutedText>Total Projects</MutedText>
          <Metric>{projects.length}</Metric>
        </Card>

        <Card>
          <MutedText>Generated Documents</MutedText>
          <Metric>{generationHistory.length}</Metric>
        </Card>

        <Card>
          <MutedText>Error Log Entries</MutedText>
          <Metric>{errorLogs.length}</Metric>
        </Card>

        <Card>
          <MutedText>Onboarding Status</MutedText>
          <Metric>{onboardingCompleted ? 'Done' : 'Pending'}</Metric>
        </Card>
      </Grid>

      <Grid style={{ marginTop: '1rem' }}>
        <Card>
          <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Current Workspace</h3>
          <MutedText>
            Active project: <strong>{currentProject?.name || 'None selected'}</strong>
          </MutedText>
          <div style={{ marginTop: '0.8rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <LinkButton as={Link} to="/app/workspace">Open Workspace</LinkButton>
            <LinkButton as={Link} to="/app/review">Generate Draft</LinkButton>
            <LinkButton as={Link} to="/app/status">System Status</LinkButton>
          </div>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Quick Actions</h3>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <LinkButton as={Link} to="/app/access">Configure API Access</LinkButton>
            <LinkButton as={Link} to="/app/settings">Update Preferences</LinkButton>
            <LinkButton as={Link} to="/app/errors">Review Error Center</LinkButton>
            {!onboardingCompleted && <LinkButton as={Link} to="/app/onboarding">Finish Onboarding</LinkButton>}
          </div>
        </Card>
      </Grid>

      <Card style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Recent Generation Activity</h3>
        {recentHistory.length === 0 ? (
          <MutedText>No generation records yet. Start in Review and Diff.</MutedText>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Language</th>
                  <th>Model</th>
                  <th>Complexity</th>
                </tr>
              </thead>
              <tbody>
                {recentHistory.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                    <td>{item.language || 'unknown'}</td>
                    <td>{item.model || 'unknown'}</td>
                    <td>{item.complexity ?? '-'}</td>
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

export default DashboardPage;
