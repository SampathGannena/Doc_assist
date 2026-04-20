import React, { useEffect, useMemo, useState } from 'react';

import { useAppState } from '../context/AppStateContext';
import {
  downloadProjectSnapshot,
  fetchGenerationHistoryRecord,
  fetchProjectSnapshot,
  normalizePayloadData,
} from '../utils/api';
import {
  Button,
  Card,
  DangerButton,
  EmptyState,
  Input,
  InlineRow,
  Label,
  MutedText,
  PageDescription,
  PageTitle,
  PageTop,
  PreBlock,
  Select,
  Table,
  TableWrap,
  WorkspacePage,
} from './PagePrimitives';

const GenerationHistoryPage = () => {
  const {
    generationHistory,
    projects,
    clearGenerationHistory,
    backendConnected,
    isHydrating,
    logError,
  } = useAppState();

  const [search, setSearch] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [isClearing, setIsClearing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loadingDetailId, setLoadingDetailId] = useState(null);
  const [projectSnapshot, setProjectSnapshot] = useState(null);
  const [isPreviewingProjectSnapshot, setIsPreviewingProjectSnapshot] = useState(false);
  const [isDownloadingProjectSnapshot, setIsDownloadingProjectSnapshot] = useState(false);

  const projectMap = useMemo(() => {
    const map = new Map();
    projects.forEach((project) => map.set(project.id, project.name));
    return map;
  }, [projects]);

  const projectOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'all' }];
    projects.forEach((project) => {
      options.push({ value: project.id, label: project.name });
    });
    return options;
  }, [projects]);

  const selectedProject = useMemo(() => {
    if (projectFilter === 'all') {
      return null;
    }
    return projects.find((project) => project.id === projectFilter) || null;
  }, [projectFilter, projects]);

  useEffect(() => {
    setProjectSnapshot(null);
  }, [projectFilter]);

  const filteredRecords = useMemo(() => {
    return generationHistory.filter((record) => {
      const languageOk = languageFilter === 'all' || record.language === languageFilter;
      const projectOk = projectFilter === 'all' || record.projectId === projectFilter;
      const searchValue = search.trim().toLowerCase();

      if (!searchValue) {
        return languageOk && projectOk;
      }

      const searchableText = `${record.inputSnippet || ''} ${record.outputSnippet || ''} ${record.model || ''} ${record.language || ''}`.toLowerCase();
      return languageOk && projectOk && searchableText.includes(searchValue);
    });
  }, [generationHistory, languageFilter, projectFilter, search]);

  const languageOptions = useMemo(() => {
    const unique = new Set(generationHistory.map((record) => record.language).filter(Boolean));
    return ['all', ...Array.from(unique)];
  }, [generationHistory]);

  const handleClearHistory = async () => {
    setIsClearing(true);
    await clearGenerationHistory();
    setSelectedRecord(null);
    setIsClearing(false);
  };

  const handleViewSnapshot = async (record) => {
    if (!record) {
      return;
    }

    const hasFullSnapshot = Boolean(record.sourceCode || record.documentation);
    if (hasFullSnapshot) {
      setSelectedRecord(record);
      return;
    }

    setLoadingDetailId(record.id);
    const response = await fetchGenerationHistoryRecord(record.id);
    setLoadingDetailId(null);

    if (!response.success) {
      logError({
        source: 'history-view',
        message: response.error || 'Unable to load full snapshot details.',
        severity: 'warning',
      });
      return;
    }

    const payload = normalizePayloadData(response);
    setSelectedRecord(payload || record);
  };

  const handlePreviewProjectSnapshot = async () => {
    if (!selectedProject) {
      return;
    }

    setIsPreviewingProjectSnapshot(true);
    const response = await fetchProjectSnapshot(selectedProject.id, { limit: 5000 });
    setIsPreviewingProjectSnapshot(false);

    if (!response.success) {
      logError({
        source: 'history-view',
        message: response.error || 'Unable to build project file snapshot.',
        severity: 'warning',
      });
      return;
    }

    const payload = normalizePayloadData(response);
    setProjectSnapshot(payload || null);
  };

  const handleDownloadProjectSnapshot = async () => {
    if (!selectedProject) {
      return;
    }

    setIsDownloadingProjectSnapshot(true);
    const response = await downloadProjectSnapshot(selectedProject.id, { limit: 5000 });
    setIsDownloadingProjectSnapshot(false);

    if (!response.success) {
      logError({
        source: 'history-view',
        message: response.error || 'Unable to download project file snapshot.',
        severity: 'warning',
      });
      return;
    }

    const payload = normalizePayloadData(response) || response.data || {};
    const blob = payload.blob;
    if (!(blob instanceof Blob)) {
      logError({
        source: 'history-view',
        message: 'Download payload was invalid.',
        severity: 'warning',
      });
      return;
    }

    const fileName = payload.fileName || `${selectedProject.name || 'project'}-snapshot.md`;
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <WorkspacePage>
      <PageTop>
        <PageTitle>Generation History</PageTitle>
        <PageDescription>
          Search, filter, and audit previous documentation runs for traceability.
        </PageDescription>
        <MutedText>
          Backend sync: <strong>{backendConnected ? 'connected' : 'offline fallback'}</strong>
          {isHydrating ? ' (syncing...)' : ''}
        </MutedText>
      </PageTop>

      <Card>
        <InlineRow>
          <div style={{ minWidth: '230px', flex: 1 }}>
            <Label htmlFor="history-search">Search</Label>
            <Input
              id="history-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by snippet, model, or language"
            />
          </div>

          <div style={{ minWidth: '170px' }}>
            <Label htmlFor="history-language">Language</Label>
            <Select
              id="history-language"
              value={languageFilter}
              onChange={(event) => setLanguageFilter(event.target.value)}
            >
              {languageOptions.map((language) => (
                <option key={language} value={language}>{language}</option>
              ))}
            </Select>
          </div>

          <div style={{ minWidth: '210px' }}>
            <Label htmlFor="history-project">Project</Label>
            <Select
              id="history-project"
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
            >
              {projectOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>

          <div style={{ alignSelf: 'end' }}>
            <DangerButton onClick={handleClearHistory} disabled={generationHistory.length === 0 || isClearing}>
              {isClearing ? 'Clearing...' : 'Clear History'}
            </DangerButton>
          </div>

          <div style={{ alignSelf: 'end', display: 'flex', gap: '0.5rem' }}>
            <Button
              onClick={handlePreviewProjectSnapshot}
              disabled={!selectedProject || isPreviewingProjectSnapshot}
            >
              {isPreviewingProjectSnapshot ? 'Building File...' : 'Preview Project File'}
            </Button>
            <Button
              onClick={handleDownloadProjectSnapshot}
              disabled={!selectedProject || isDownloadingProjectSnapshot}
            >
              {isDownloadingProjectSnapshot ? 'Preparing Download...' : 'Download Project File'}
            </Button>
          </div>
        </InlineRow>
      </Card>

      <Card style={{ marginTop: '1rem' }}>
        {filteredRecords.length === 0 ? (
          <EmptyState>No history records match your filter.</EmptyState>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Project</th>
                  <th>Language</th>
                  <th>Model</th>
                  <th>Complexity</th>
                  <th>Snippet</th>
                  <th>Snapshot</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{new Date(record.createdAt).toLocaleString()}</td>
                    <td>{projectMap.get(record.projectId) || 'Unknown'}</td>
                    <td>{record.language || '-'}</td>
                    <td>{record.model || '-'}</td>
                    <td>{record.complexity ?? '-'}</td>
                    <td>{record.inputSnippet || '-'}</td>
                    <td>
                      <Button
                        onClick={() => handleViewSnapshot(record)}
                        disabled={loadingDetailId === record.id}
                      >
                        {loadingDetailId === record.id ? 'Loading...' : 'View Snapshot'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {selectedRecord && (
        <Card style={{ marginTop: '1rem' }}>
          <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Snapshot Preview</h3>
          <MutedText>
            Project: <strong>{projectMap.get(selectedRecord.projectId) || 'Unknown'}</strong>
            {' '}| Language: <strong>{selectedRecord.language || '-'}</strong>
            {' '}| Model: <strong>{selectedRecord.model || '-'}</strong>
          </MutedText>

          <div style={{ marginTop: '0.8rem' }}>
            <Label>Source Code</Label>
            <PreBlock>{selectedRecord.sourceCode || selectedRecord.inputSnippet || 'Source code not available for this record.'}</PreBlock>
          </div>

          <div style={{ marginTop: '0.8rem' }}>
            <Label>Generated Documentation</Label>
            <PreBlock>{selectedRecord.documentation || selectedRecord.outputSnippet || 'Generated documentation not available for this record.'}</PreBlock>
          </div>
        </Card>
      )}

      {projectSnapshot && (
        <Card style={{ marginTop: '1rem' }}>
          <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Project File Snapshot</h3>
          <MutedText>
            Project: <strong>{projectSnapshot?.project?.name || selectedProject?.name || 'Unknown'}</strong>
            {' '}| Records: <strong>{projectSnapshot?.recordCount ?? 0}</strong>
            {' '}| Generated: <strong>{projectSnapshot?.generatedAt ? new Date(projectSnapshot.generatedAt).toLocaleString() : '-'}</strong>
          </MutedText>
          <PreBlock>{projectSnapshot.snapshotMarkdown || 'Project snapshot is empty.'}</PreBlock>
        </Card>
      )}

      <MutedText style={{ marginTop: '0.8rem' }}>
        Tip: keep auto-save enabled in Settings to track generation trends over time.
      </MutedText>
    </WorkspacePage>
  );
};

export default GenerationHistoryPage;
