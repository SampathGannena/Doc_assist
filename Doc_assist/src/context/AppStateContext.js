import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

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

const AppStateContext = createContext(undefined);

export const AppStateProvider = ({ children }) => {
  const [state, setState] = useState(loadState);

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

  const addProject = useCallback((name, language) => {
    const safeName = sanitizeText(name, 80);
    const safeLanguage = sanitizeText(language, 20) || 'python';

    if (!safeName) {
      return null;
    }

    const project = {
      id: `project-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      name: safeName,
      language: safeLanguage,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    setState((prev) => ({
      ...prev,
      projects: [project, ...prev.projects],
      activeProjectId: project.id,
    }));

    return project;
  }, []);

  const removeProject = useCallback((projectId) => {
    setState((prev) => {
      if (prev.projects.length <= 1) {
        return prev;
      }

      const nextProjects = prev.projects.filter((project) => project.id !== projectId);
      const nextActive = nextProjects.some((project) => project.id === prev.activeProjectId)
        ? prev.activeProjectId
        : nextProjects[0].id;

      return {
        ...prev,
        projects: nextProjects,
        activeProjectId: nextActive,
      };
    });
  }, []);

  const addGenerationRecord = useCallback((record) => {
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
  }, []);

  const clearGenerationHistory = useCallback(() => {
    setState((prev) => ({
      ...prev,
      generationHistory: [],
    }));
  }, []);

  const updateSettings = useCallback((partial) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...partial,
      },
    }));
  }, []);

  const resetSettings = useCallback(() => {
    setState((prev) => ({
      ...prev,
      settings: DEFAULT_SETTINGS,
    }));
  }, []);

  const updateIntegrations = useCallback((partial) => {
    setState((prev) => ({
      ...prev,
      integrations: {
        ...prev.integrations,
        ...partial,
      },
    }));
  }, []);

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

  const currentProject = useMemo(() => {
    return state.projects.find((project) => project.id === state.activeProjectId) || null;
  }, [state.projects, state.activeProjectId]);

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
