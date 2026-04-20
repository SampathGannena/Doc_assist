import React, { useMemo, useState } from 'react';

import { useAppState } from '../context/AppStateContext';
import { LANGUAGE_NAMES } from '../utils/constants';
import {
  Button,
  Card,
  EmptyState,
  Grid,
  InlineRow,
  Input,
  Label,
  Metric,
  MutedText,
  PageDescription,
  PageTitle,
  PageTop,
  PrimaryButton,
  Select,
  StatusBadge,
  Table,
  TableWrap,
  WorkspacePage,
} from './PagePrimitives';

const ProjectWorkspacePage = () => {
  const {
    projects,
    activeProjectId,
    setActiveProject,
    addProject,
    removeProject,
    authProfile,
    generationHistory,
    isHydrating,
    lastSyncAt,
  } = useAppState();

  const [projectName, setProjectName] = useState('');
  const [language, setLanguage] = useState('python');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [removingProjectId, setRemovingProjectId] = useState(null);

  const languageOptions = useMemo(() => Object.entries(LANGUAGE_NAMES), []);
  const authProgress = authProfile?.progress || {};
  const activeProject = projects.find((project) => project.id === activeProjectId) || null;

  const filteredProjects = useMemo(() => {
    const needle = String(searchTerm || '').trim().toLowerCase();
    if (!needle) {
      return projects;
    }

    return projects.filter((project) => {
      const nameMatch = String(project.name || '').toLowerCase().includes(needle);
      const langMatch = String(project.language || '').toLowerCase().includes(needle);
      return nameMatch || langMatch;
    });
  }, [projects, searchTerm]);

  const activeProjectHistoryCount = useMemo(() => {
    if (!activeProjectId) {
      return 0;
    }
    return generationHistory.filter((item) => item.projectId === activeProjectId).length;
  }, [activeProjectId, generationHistory]);

  const handleCreate = async () => {
    if (!projectName.trim()) {
      setError('Project name is required.');
      return;
    }

    setIsSaving(true);
    const created = await addProject(projectName, language);
    setIsSaving(false);

    if (!created) {
      setError('Unable to create project. Check project name and try again.');
      return;
    }

    setProjectName('');
    setError('');
  };

  const handleRemoveProject = async (projectId) => {
    setRemovingProjectId(projectId);
    const removed = await removeProject(projectId);
    setRemovingProjectId(null);

    if (!removed) {
      setError('Unable to remove project. Check your permissions and try again.');
    }
  };

  return (
    <WorkspacePage>
      <PageTop>
        <PageTitle>Project Workspace</PageTitle>
        <PageDescription>
          Create and manage projects per user account with backend-synced progress and secure access control.
        </PageDescription>
        <MutedText>
          {isHydrating ? 'Syncing from backend...' : 'Backend sync complete.'}
          {lastSyncAt ? ` Last synced: ${new Date(lastSyncAt).toLocaleString()}` : ''}
        </MutedText>
      </PageTop>

      <Grid>
        <Card>
          <MutedText>My Projects</MutedText>
          <Metric>{authProgress.projectCount ?? projects.length}</Metric>
        </Card>

        <Card>
          <MutedText>My Generated Docs</MutedText>
          <Metric>{authProgress.generationCount ?? generationHistory.length}</Metric>
        </Card>

        <Card>
          <MutedText>Active API Keys</MutedText>
          <Metric>{authProgress.activeKeyCount ?? '-'}</Metric>
        </Card>

        <Card>
          <MutedText>Active Project Activity</MutedText>
          <Metric>{activeProjectHistoryCount}</Metric>
        </Card>
      </Grid>

      <Grid style={{ marginTop: '1rem' }}>
        <Card>
          <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Create New Project</h3>

          <Label htmlFor="project-name">Project Name</Label>
          <Input
            id="project-name"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="Example: Backend API Docs"
          />

          <div style={{ marginTop: '0.7rem' }}>
            <Label htmlFor="project-language">Default Language</Label>
            <Select
              id="project-language"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              {languageOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </div>

          {error && <MutedText style={{ color: '#f87171', marginTop: '0.7rem' }}>{error}</MutedText>}

          <div style={{ marginTop: '0.9rem' }}>
            <PrimaryButton onClick={handleCreate} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Create Project'}
            </PrimaryButton>
          </div>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Current User Workspace</h3>
          <MutedText>
            User: <strong>{authProfile?.user?.name || authProfile?.user?.email || 'Unknown'}</strong>
          </MutedText>
          <MutedText>
            Active project: <strong>{activeProject?.name || 'None selected'}</strong>
          </MutedText>
          <MutedText>
            Keep separate projects for each repository or service so your history and quality insights stay clear.
          </MutedText>
        </Card>
      </Grid>

      <Card style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Your Projects</h3>

        <div style={{ marginBottom: '0.8rem' }}>
          <Label htmlFor="project-search">Search Projects</Label>
          <Input
            id="project-search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by project name or language"
          />
        </div>

        {isHydrating && (
          <MutedText>Syncing projects from backend...</MutedText>
        )}

        {filteredProjects.length === 0 ? (
          <EmptyState>No projects available yet.</EmptyState>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Language</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => (
                  <tr key={project.id}>
                    <td>{project.name}</td>
                    <td>{project.language}</td>
                    <td>
                      {project.id === activeProjectId ? (
                        <StatusBadge status="healthy">Active</StatusBadge>
                      ) : (
                        <StatusBadge>Inactive</StatusBadge>
                      )}
                    </td>
                    <td>{new Date(project.createdAt).toLocaleDateString()}</td>
                    <td>
                      <InlineRow>
                        <Button onClick={() => setActiveProject(project.id)}>
                          Set Active
                        </Button>
                        <Button
                          onClick={() => handleRemoveProject(project.id)}
                          disabled={projects.length <= 1 || removingProjectId === project.id}
                        >
                          {removingProjectId === project.id ? 'Removing...' : 'Remove'}
                        </Button>
                      </InlineRow>
                    </td>
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

export default ProjectWorkspacePage;
