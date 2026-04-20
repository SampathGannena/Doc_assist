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
  } = useAppState();

  const [projectName, setProjectName] = useState('');
  const [language, setLanguage] = useState('python');
  const [error, setError] = useState('');

  const languageOptions = useMemo(() => Object.entries(LANGUAGE_NAMES), []);

  const handleCreate = () => {
    if (!projectName.trim()) {
      setError('Project name is required.');
      return;
    }

    const created = addProject(projectName, language);
    if (!created) {
      setError('Unable to create project. Check project name and try again.');
      return;
    }

    setProjectName('');
    setError('');
  };

  return (
    <WorkspacePage>
      <PageTop>
        <PageTitle>Project Workspace</PageTitle>
        <PageDescription>
          Create and manage projects for organized documentation workflows.
        </PageDescription>
      </PageTop>

      <Grid>
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
            <PrimaryButton onClick={handleCreate}>Create Project</PrimaryButton>
          </div>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Workspace Tips</h3>
          <MutedText>
            Keep separate projects for each repository or service. This helps maintain accurate history,
            language defaults, and cleaner review workflows.
          </MutedText>
        </Card>
      </Grid>

      <Card style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Your Projects</h3>

        {projects.length === 0 ? (
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
                {projects.map((project) => (
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
                          onClick={() => removeProject(project.id)}
                          disabled={projects.length <= 1}
                        >
                          Remove
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
