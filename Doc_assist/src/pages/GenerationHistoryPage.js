import React, { useMemo, useState } from 'react';

import { useAppState } from '../context/AppStateContext';
import {
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
  Select,
  Table,
  TableWrap,
  WorkspacePage,
} from './PagePrimitives';

const GenerationHistoryPage = () => {
  const { generationHistory, projects, clearGenerationHistory } = useAppState();

  const [search, setSearch] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');

  const projectMap = useMemo(() => {
    const map = new Map();
    projects.forEach((project) => map.set(project.id, project.name));
    return map;
  }, [projects]);

  const filteredRecords = useMemo(() => {
    return generationHistory.filter((record) => {
      const languageOk = languageFilter === 'all' || record.language === languageFilter;
      const searchValue = search.trim().toLowerCase();

      if (!searchValue) {
        return languageOk;
      }

      const searchableText = `${record.inputSnippet || ''} ${record.model || ''} ${record.language || ''}`.toLowerCase();
      return languageOk && searchableText.includes(searchValue);
    });
  }, [generationHistory, languageFilter, search]);

  const languageOptions = useMemo(() => {
    const unique = new Set(generationHistory.map((record) => record.language).filter(Boolean));
    return ['all', ...Array.from(unique)];
  }, [generationHistory]);

  return (
    <WorkspacePage>
      <PageTop>
        <PageTitle>Generation History</PageTitle>
        <PageDescription>
          Search, filter, and audit previous documentation runs for traceability.
        </PageDescription>
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

          <div style={{ alignSelf: 'end' }}>
            <DangerButton onClick={clearGenerationHistory} disabled={generationHistory.length === 0}>
              Clear History
            </DangerButton>
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
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <MutedText style={{ marginTop: '0.8rem' }}>
        Tip: keep auto-save enabled in Settings to track generation trends over time.
      </MutedText>
    </WorkspacePage>
  );
};

export default GenerationHistoryPage;
