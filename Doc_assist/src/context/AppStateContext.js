import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  clearGenerationHistoryRemote,
  createGenerationHistoryRecord,
  deleteProject,
  fetchGenerationHistory,
  fetchPreferences,
  fetchProjects,
  getAuthProfile,
  loginAuthUser,
  normalizePayloadData,
  logoutAuthUser,
  registerAuthUser,
  savePreferences,
  saveProject,
} from '../utils/api';
import { clearStoredApiKey, setStoredApiKey } from '../utils/security';

const STORAGE_KEY = 'docassist:app-state:v1';
const MAX_HISTORY = 300;
const MAX_ERRORS = 200;

const nowIso = () => new Date().toISOString();

const createInitialProject = () => ({
  id: 'project-default',
  name: 'Default Project',
  language: 'python',
  createdAt: nowIso(),
  updatedAt: nowIso(),
});

export const DEFAULT_SETTINGS = {
  docStyle: 'google',
  includeExamples: true,
  includeComplexity: true,
  timeoutMs: 60000,
  retryAttempts: 2,
  autoSaveHistory: true,
  strictMode: true,
};

const DEFAULT_INTEGRATIONS = {
  vscodeConnected: false,
  githubConnected: false,
  webhookUrl: '',
};

const getDefaultState = () => {
  const defaultProject = createInitialProject();
  return {
    projects: [defaultProject],
    activeProjectId: defaultProject.id,
    generationHistory: [],
    settings: DEFAULT_SETTINGS,
    integrations: DEFAULT_INTEGRATIONS,
    errorLogs: [],
    onboardingCompleted: false,
  };
};

const normalizeState = (raw) => {
  const defaults = getDefaultState();

  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const projects = Array.isArray(raw.projects) && raw.projects.length > 0
    ? raw.projects
    : defaults.projects;

  let activeProjectId = raw.activeProjectId;
  if (!projects.some((project) => project.id === activeProjectId)) {
    activeProjectId = projects[0].id;
  }

  return {
    projects,
    activeProjectId,
    generationHistory: Array.isArray(raw.generationHistory)
      ? raw.generationHistory.slice(0, MAX_HISTORY)
      : defaults.generationHistory,
    settings: {
      ...DEFAULT_SETTINGS,
      ...(raw.settings || {}),
    },
    integrations: {
      ...DEFAULT_INTEGRATIONS,
      ...(raw.integrations || {}),
    },
    errorLogs: Array.isArray(raw.errorLogs)
      ? raw.errorLogs.slice(0, MAX_ERRORS)
      : defaults.errorLogs,
    onboardingCompleted: Boolean(raw.onboardingCompleted),
  };
};

const loadState = () => {
  if (typeof window === 'undefined') {
    return getDefaultState();
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return getDefaultState();
    }

    return normalizeState(JSON.parse(stored));
  } catch (error) {
    return getDefaultState();
  }
};

const sanitizeText = (value, maxLength = 120) => {
  return String(value || '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
};

const sanitizeNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeProject = (project) => {
  if (!project || typeof project !== 'object') {
    return null;
  }

  const id = sanitizeText(project.id || `project-${Date.now()}`, 120);
  if (!id) {
    return null;
  }

  return {
    id,
    name: sanitizeText(project.name || 'Unnamed Project', 80) || 'Unnamed Project',
    language: sanitizeText(project.language || 'python', 20) || 'python',
    createdAt: project.createdAt || project.created_at || nowIso(),
    updatedAt: project.updatedAt || project.updated_at || nowIso(),
  };
};

const normalizeHistoryRecord = (record) => {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const id = sanitizeText(record.id || `history-${Date.now()}`, 120);
  if (!id) {
    return null;
  }

  return {
    id,
    createdAt: record.createdAt || record.created_at || nowIso(),
    projectId: record.projectId || record.project_id || null,
    language: sanitizeText(record.language || 'python', 20) || 'python',
    model: sanitizeText(record.model || 'unknown', 180),
    confidence: record.confidence ?? null,
    complexity: sanitizeNumber(record.complexity, 0),
    qualityScore: sanitizeNumber(record.qualityScore ?? record.quality_score, 0),
    fromCache: Boolean(record.fromCache ?? record.from_cache),
    processingMs: sanitizeNumber(record.processingMs ?? record.processing_ms, 0),
    inputSnippet: sanitizeText(record.inputSnippet || '', 300),
    outputSnippet: sanitizeText(record.outputSnippet || '', 300),
    sourceCode: typeof record.sourceCode === 'string'
      ? record.sourceCode.slice(0, 50000)
      : (typeof record.source_code === 'string' ? record.source_code.slice(0, 50000) : ''),
    documentation: typeof record.documentation === 'string'
      ? record.documentation.slice(0, 80000)
      : '',
    style: sanitizeText(record.style || 'google', 20) || 'google',
  };
};

const hasUserSession = (profile) => {
  return Boolean(
    profile?.authenticated
      && profile?.tokenSource === 'session'
      && profile?.user?.id,
  );
};

const AppStateContext = createContext(undefined);

export const AppStateProvider = ({ children }) => {
  const [state, setState] = useState(loadState);
  const [backendConnected, setBackendConnected] = useState(false);
  const [authProfile, setAuthProfile] = useState(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [settingsUpdatedAt, setSettingsUpdatedAt] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const persistable = {
      projects: state.projects,
      activeProjectId: state.activeProjectId,
      generationHistory: state.generationHistory,
      settings: state.settings,
      integrations: state.integrations,
      errorLogs: state.errorLogs,
      onboardingCompleted: state.onboardingCompleted,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  }, [state]);

  const logError = useCallback((payload) => {
    const source = sanitizeText(payload?.source || 'client', 40);
    const message = sanitizeText(payload?.message || 'Unexpected error', 500);
    const severity = sanitizeText(payload?.severity || 'error', 20);

    if (!message) {
      return;
    }

    const details = payload?.details ? JSON.stringify(payload.details) : '';

    setState((prev) => ({
      ...prev,
      errorLogs: [
        {
          id: `error-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          source,
          message,
          severity,
          status: payload?.status || null,
          endpoint: payload?.endpoint || null,
          details,
          createdAt: nowIso(),
        },
        ...prev.errorLogs,
      ].slice(0, MAX_ERRORS),
    }));
  }, []);

  const refreshAuthState = useCallback(async ({ suppressErrors = false } = {}) => {
    try {
      const response = await getAuthProfile();
      if (!response.success) {
        setBackendConnected(false);
        setAuthProfile(null);

        if (!suppressErrors && response.status && response.status !== 401) {
          logError({
            source: 'auth-sync',
            message: response.error || 'Unable to validate API key with backend.',
            severity: 'warning',
          });
        }
        return null;
      }

      const payload = normalizePayloadData(response);
      setBackendConnected(true);
      setAuthProfile(payload || null);
      return payload || null;
    } catch (error) {
      setBackendConnected(false);
      setAuthProfile(null);

      if (!suppressErrors) {
        logError({
          source: 'auth-sync',
          message: error.message || 'Unable to contact backend auth endpoint.',
          severity: 'warning',
        });
      }
      return null;
    }
  }, [logError]);

  const refreshProjects = useCallback(async ({ suppressErrors = false } = {}) => {
    try {
      const response = await fetchProjects();
      if (!response.success) {
        throw new Error(response.error || 'Failed to load projects from backend.');
      }

      const payload = normalizePayloadData(response);
      const normalizedProjects = Array.isArray(payload)
        ? payload.map(normalizeProject).filter(Boolean)
        : [];

      setState((prev) => {
        const nextProjects = normalizedProjects.length > 0 ? normalizedProjects : prev.projects;
        const hasActive = nextProjects.some((project) => project.id === prev.activeProjectId);

        return {
          ...prev,
          projects: nextProjects,
          activeProjectId: hasActive ? prev.activeProjectId : (nextProjects[0]?.id || null),
        };
      });

      return true;
    } catch (error) {
      if (!suppressErrors) {
        logError({
          source: 'state-sync',
          message: error.message || 'Failed to sync projects.',
          severity: 'warning',
        });
      }
      return false;
    }
  }, [logError]);

  const refreshGenerationHistory = useCallback(async ({ suppressErrors = false } = {}) => {
    try {
      const response = await fetchGenerationHistory({ limit: MAX_HISTORY });
      if (!response.success) {
        throw new Error(response.error || 'Failed to load generation history from backend.');
      }

      const payload = normalizePayloadData(response);
      const normalized = Array.isArray(payload)
        ? payload.map(normalizeHistoryRecord).filter(Boolean).slice(0, MAX_HISTORY)
        : [];

      setState((prev) => ({
        ...prev,
        generationHistory: normalized,
      }));

      return true;
    } catch (error) {
      if (!suppressErrors) {
        logError({
          source: 'state-sync',
          message: error.message || 'Failed to sync generation history.',
          severity: 'warning',
        });
      }
      return false;
    }
  }, [logError]);

  const refreshSettings = useCallback(async ({ suppressErrors = false } = {}) => {
    try {
      const response = await fetchPreferences();
      if (!response.success) {
        throw new Error(response.error || 'Failed to load backend preferences.');
      }

      const payload = normalizePayloadData(response);
      const remoteSettings = payload?.settings && typeof payload.settings === 'object'
        ? payload.settings
        : {};
      const updatedAt = payload?.updatedAt || payload?.updated_at || null;

      setState((prev) => ({
        ...prev,
        settings: {
          ...DEFAULT_SETTINGS,
          ...remoteSettings,
        },
      }));
      setSettingsUpdatedAt(updatedAt);

      return true;
    } catch (error) {
      if (!suppressErrors) {
        logError({
          source: 'state-sync',
          message: error.message || 'Failed to sync settings.',
          severity: 'warning',
        });
      }
      return false;
    }
  }, [logError]);

  const refreshBackendState = useCallback(async ({ suppressErrors = false } = {}) => {
    setIsHydrating(true);

    const auth = await refreshAuthState({ suppressErrors });
    if (!auth) {
      setIsHydrating(false);
      return false;
    }

    if (!hasUserSession(auth)) {
      setIsHydrating(false);
      return true;
    }

    const [projectsOk, historyOk, settingsOk] = await Promise.all([
      refreshProjects({ suppressErrors }),
      refreshGenerationHistory({ suppressErrors }),
      refreshSettings({ suppressErrors }),
    ]);

    const success = projectsOk && historyOk && settingsOk;
    if (success) {
      setLastSyncAt(nowIso());
    }

    setIsHydrating(false);
    return success;
  }, [refreshAuthState, refreshGenerationHistory, refreshProjects, refreshSettings]);

  const login = useCallback(async ({ email, password, rememberOnDevice = true }) => {
    const response = await loginAuthUser({ email, password });
    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Unable to sign in.',
      };
    }

    const payload = normalizePayloadData(response) || {};
    const token = String(payload.token || '').trim();
    if (!token) {
      return {
        success: false,
        error: 'Backend did not return a valid session token.',
      };
    }

    setStoredApiKey(token, rememberOnDevice);
    await refreshBackendState({ suppressErrors: false });

    return {
      success: true,
      data: payload,
    };
  }, [refreshBackendState]);

  const register = useCallback(async ({ name, email, password, rememberOnDevice = true }) => {
    const response = await registerAuthUser({ name, email, password });
    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Unable to register account.',
      };
    }

    const payload = normalizePayloadData(response) || {};
    const token = String(payload.token || '').trim();
    if (!token) {
      return {
        success: false,
        error: 'Backend did not return a valid session token.',
      };
    }

    setStoredApiKey(token, rememberOnDevice);
    await refreshBackendState({ suppressErrors: false });

    return {
      success: true,
      data: payload,
    };
  }, [refreshBackendState]);

  const logout = useCallback(async () => {
    await logoutAuthUser();
    clearStoredApiKey();
    setBackendConnected(false);
    setAuthProfile(null);
    setLastSyncAt(null);
    setSettingsUpdatedAt(null);
    setState(getDefaultState());
  }, []);

  const setActiveProject = useCallback((projectId) => {
    setState((prev) => {
      if (!prev.projects.some((project) => project.id === projectId)) {
        return prev;
      }
      return {
        ...prev,
        activeProjectId: projectId,
      };
    });
  }, []);

  const addProject = useCallback(async (name, language) => {
    const safeName = sanitizeText(name, 80);
    const safeLanguage = sanitizeText(language, 20) || 'python';

    if (!safeName) {
      return null;
    }

    if (!backendConnected) {
      const localProject = {
        id: `project-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        name: safeName,
        language: safeLanguage,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };

      setState((prev) => ({
        ...prev,
        projects: [localProject, ...prev.projects],
        activeProjectId: localProject.id,
      }));

      return localProject;
    }

    const response = await saveProject({
      name: safeName,
      language: safeLanguage,
    });

    if (!response.success) {
      logError({
        source: 'project-workspace',
        message: response.error || 'Unable to create project in backend.',
        severity: 'error',
      });
      return null;
    }

    const payload = normalizePayloadData(response);
    const project = normalizeProject(payload);

    if (!project) {
      return null;
    }

    setState((prev) => {
      const nextProjects = [project, ...prev.projects.filter((item) => item.id !== project.id)];
      return {
        ...prev,
        projects: nextProjects,
        activeProjectId: project.id,
      };
    });

    return project;
  }, [backendConnected, logError]);

  const removeProject = useCallback(async (projectId) => {
    if (!projectId) {
      return false;
    }

    if (backendConnected) {
      const response = await deleteProject(projectId);
      if (!response.success) {
        logError({
          source: 'project-workspace',
          message: response.error || 'Unable to remove project from backend.',
          severity: 'error',
        });
        return false;
      }
    }

    setState((prev) => {
      if (prev.projects.length <= 1) {
        return prev;
      }

      const nextProjects = prev.projects.filter((project) => project.id !== projectId);
      const nextActive = nextProjects.some((project) => project.id === prev.activeProjectId)
        ? prev.activeProjectId
        : nextProjects[0]?.id || null;

      return {
        ...prev,
        projects: nextProjects,
        activeProjectId: nextActive,
      };
    });

    return true;
  }, [backendConnected, logError]);

  const addGenerationRecord = useCallback(async (record) => {
    setState((prev) => {
      const nextRecord = {
        id: `history-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        createdAt: nowIso(),
        projectId: prev.activeProjectId,
        ...record,
      };

      return {
        ...prev,
        generationHistory: [nextRecord, ...prev.generationHistory].slice(0, MAX_HISTORY),
      };
    });

    if (!backendConnected) {
      return;
    }

    const response = await createGenerationHistoryRecord({
      ...record,
      projectId: record?.projectId || state.activeProjectId || null,
      style: record?.style || state.settings.docStyle,
      includeExamples: Boolean(record?.includeExamples ?? state.settings.includeExamples),
      includeComplexity: Boolean(record?.includeComplexity ?? state.settings.includeComplexity),
      processingMs: sanitizeNumber(record?.processingMs, 0),
    });

    if (!response.success) {
      logError({
        source: 'history-sync',
        message: response.error || 'Unable to persist history record in backend.',
        severity: 'warning',
      });
      return;
    }

    const payload = normalizePayloadData(response);
    const normalized = normalizeHistoryRecord(payload);

    if (!normalized) {
      return;
    }

    setState((prev) => ({
      ...prev,
      generationHistory: [
        normalized,
        ...prev.generationHistory.filter((item) => item.id !== normalized.id),
      ].slice(0, MAX_HISTORY),
    }));
  }, [backendConnected, logError, state.activeProjectId, state.settings.docStyle, state.settings.includeComplexity, state.settings.includeExamples]);

  const clearGenerationHistory = useCallback(async () => {
    if (backendConnected) {
      const response = await clearGenerationHistoryRemote();
      if (!response.success) {
        logError({
          source: 'history-sync',
          message: response.error || 'Unable to clear history from backend.',
          severity: 'error',
        });
        return false;
      }
    }

    setState((prev) => ({
      ...prev,
      generationHistory: [],
    }));

    return true;
  }, [backendConnected, logError]);

  const updateSettings = useCallback(async (partial) => {
    const nextSettings = {
      ...state.settings,
      ...partial,
    };

    if (backendConnected) {
      const response = await savePreferences(nextSettings);
      if (!response.success) {
        logError({
          source: 'settings-sync',
          message: response.error || 'Unable to save settings in backend.',
          severity: 'error',
        });
        return false;
      }

      const payload = normalizePayloadData(response);
      setSettingsUpdatedAt(payload?.updatedAt || payload?.updated_at || nowIso());
    }

    setState((prev) => ({
      ...prev,
      settings: nextSettings,
    }));

    return true;
  }, [backendConnected, logError, state.settings]);

  const resetSettings = useCallback(async () => {
    return updateSettings(DEFAULT_SETTINGS);
  }, [updateSettings]);

  const updateIntegrations = useCallback((partial) => {
    setState((prev) => ({
      ...prev,
      integrations: {
        ...prev.integrations,
        ...partial,
      },
    }));
  }, []);

  const clearErrors = useCallback(() => {
    setState((prev) => ({
      ...prev,
      errorLogs: [],
    }));
  }, []);

  const markOnboardingComplete = useCallback((completed) => {
    setState((prev) => ({
      ...prev,
      onboardingCompleted: Boolean(completed),
    }));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleRuntimeError = (event) => {
      if (event?.detail) {
        logError(event.detail);
      }
    };

    window.addEventListener('docassist:error', handleRuntimeError);
    return () => {
      window.removeEventListener('docassist:error', handleRuntimeError);
    };
  }, [logError]);

  useEffect(() => {
    refreshBackendState({ suppressErrors: true });
  }, [refreshBackendState]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleAccessUpdate = () => {
      refreshBackendState();
    };

    window.addEventListener('docassist:access-updated', handleAccessUpdate);
    return () => {
      window.removeEventListener('docassist:access-updated', handleAccessUpdate);
    };
  }, [refreshBackendState]);

  const currentProject = useMemo(() => {
    return state.projects.find((project) => project.id === state.activeProjectId) || null;
  }, [state.projects, state.activeProjectId]);

  const isAuthenticated = useMemo(
    () => hasUserSession(authProfile),
    [authProfile],
  );

  const value = useMemo(() => ({
    ...state,
    currentProject,
    setActiveProject,
    addProject,
    removeProject,
    addGenerationRecord,
    clearGenerationHistory,
    updateSettings,
    resetSettings,
    updateIntegrations,
    logError,
    clearErrors,
    markOnboardingComplete,
    backendConnected,
    authProfile,
    isHydrating,
    lastSyncAt,
    refreshAuthState,
    refreshSettings,
    refreshGenerationHistory,
    refreshBackendState,
    login,
    register,
    logout,
    isAuthenticated,
    settingsUpdatedAt,
  }), [
    state,
    currentProject,
    setActiveProject,
    addProject,
    removeProject,
    addGenerationRecord,
    clearGenerationHistory,
    updateSettings,
    resetSettings,
    updateIntegrations,
    logError,
    clearErrors,
    markOnboardingComplete,
    backendConnected,
    authProfile,
    isHydrating,
    lastSyncAt,
    refreshAuthState,
    refreshSettings,
    refreshGenerationHistory,
    refreshBackendState,
    login,
    register,
    logout,
    isAuthenticated,
    settingsUpdatedAt,
  ]);

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }

  return context;
};
