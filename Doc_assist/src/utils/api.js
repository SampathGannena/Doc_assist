import { API_CONFIG, ENDPOINTS, ERROR_MESSAGES, HTTP_STATUS } from './constants';
import { retryWithBackoff } from './helpers';
import { getStoredApiKey } from './security';

const normalizePayloadData = (responsePayload) => {
  return responsePayload?.data?.data || responsePayload?.data || null;
};

const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    searchParams.set(key, String(value));
  });

  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : '';
};

const parseFileNameFromDisposition = (headerValue) => {
  const value = String(headerValue || '');
  if (!value) {
    return null;
  }

  const utfMatch = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch && utfMatch[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch {
      return utfMatch[1];
    }
  }

  const plainMatch = value.match(/filename="?([^";]+)"?/i);
  return plainMatch && plainMatch[1] ? plainMatch[1] : null;
};

const emitRuntimeError = (detail) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent('docassist:error', {
    detail: {
      ...detail,
      createdAt: new Date().toISOString(),
    },
  }));
};

/**
 * API client for documentation generation service
 */
class ApiClient {
  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.timeout = API_CONFIG.TIMEOUT;
  }

  /**
   * Makes an HTTP request with timeout and error handling
   * @param {string} endpoint - The API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} The response data
   */
  async request(endpoint, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    const apiKey = getStoredApiKey();

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
          ...(options.headers || {}),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return this.handleErrorResponse(response, endpoint);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      clearTimeout(timeoutId);
      return this.handleRequestError(error, endpoint);
    }
  }

  /**
   * Handles HTTP error responses
   * @param {Response} response - The fetch response object
   * @returns {Promise<Object>} Error response object
   */
  async handleErrorResponse(response, endpoint) {
    let errorMessage;

    switch (response.status) {
      case HTTP_STATUS.BAD_REQUEST:
        errorMessage = ERROR_MESSAGES.INVALID_CODE;
        break;
      case HTTP_STATUS.UNAUTHORIZED:
        errorMessage = ERROR_MESSAGES.UNAUTHORIZED;
        break;
      case HTTP_STATUS.RATE_LIMIT:
        errorMessage = ERROR_MESSAGES.RATE_LIMIT;
        break;
      case HTTP_STATUS.SERVER_ERROR:
      case HTTP_STATUS.SERVICE_UNAVAILABLE:
        errorMessage = ERROR_MESSAGES.SERVER_ERROR;
        break;
      default:
        errorMessage = `Server error: ${response.status}`;
    }

    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch (e) {
      // Use default error message if JSON parsing fails
    }

    const errorPayload = {
      success: false,
      error: errorMessage,
      status: response.status,
      endpoint,
    };

    emitRuntimeError({
      source: 'api-client',
      endpoint,
      status: response.status,
      message: errorMessage,
      severity: response.status >= 500 ? 'error' : 'warning',
    });

    return errorPayload;
  }

  /**
   * Handles request errors (network, timeout, etc.)
   * @param {Error} error - The error object
   * @returns {Object} Error response object
   */
  handleRequestError(error, endpoint) {
    let errorMessage;

    if (error.name === 'AbortError') {
      errorMessage = ERROR_MESSAGES.TIMEOUT_ERROR;
    } else if (error.message.includes('fetch')) {
      errorMessage = ERROR_MESSAGES.NETWORK_ERROR;
    } else {
      errorMessage = error.message || ERROR_MESSAGES.SERVER_ERROR;
    }

    const errorPayload = {
      success: false,
      error: errorMessage,
      endpoint,
    };

    emitRuntimeError({
      source: 'api-client',
      endpoint,
      message: errorMessage,
      severity: 'error',
    });

    return errorPayload;
  }

  /**
   * Makes a POST request
   * @param {string} endpoint - The API endpoint
   * @param {Object} data - The request body data
   * @returns {Promise<Object>} The response data
   */
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Makes a GET request
   * @param {string} endpoint - The API endpoint
   * @returns {Promise<Object>} The response data
   */
  async get(endpoint) {
    return this.request(endpoint, {
      method: 'GET',
    });
  }

  /**
   * Makes a PUT request
   * @param {string} endpoint - The API endpoint
   * @param {Object} data - The request body data
   * @returns {Promise<Object>} The response data
   */
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Makes a DELETE request
   * @param {string} endpoint - The API endpoint
   * @returns {Promise<Object>} The response data
   */
  async delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  }
}

// Create singleton instance
const apiClient = new ApiClient();

/**
 * Generates documentation for the provided code
 * @param {string} code - The source code
 * @param {string} language - The programming language
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Generated documentation result
 */
export const generateDocumentation = async (code, language, options = {}) => {
  // Always call backend so project-scoped history and server-side cache stay consistent.
  const requestFn = () => apiClient.post(ENDPOINTS.GENERATE_DOCS, {
    code,
    language,
    ...options,
  });

  return retryWithBackoff(requestFn, API_CONFIG.RETRY_ATTEMPTS);
};

/**
 * Analyzes code and extracts metadata
 * @param {string} code - The source code
 * @param {string} language - The programming language
 * @returns {Promise<Object>} Code analysis result
 */
export const analyzeCode = async (code, language) => {
  return apiClient.post(ENDPOINTS.ANALYZE_CODE, {
    code,
    language,
  });
};

/**
 * Validates code syntax
 * @param {string} code - The source code
 * @param {string} language - The programming language
 * @returns {Promise<Object>} Validation result
 */
export const validateSyntax = async (code, language) => {
  return apiClient.post(ENDPOINTS.VALIDATE_SYNTAX, {
    code,
    language,
  });
};

/**
 * Checks API health status
 * @returns {Promise<Object>} Health check result
 */
export const checkHealth = async () => {
  return apiClient.get(ENDPOINTS.HEALTH_CHECK);
};

/**
 * Retrieves the authenticated API key profile and scopes
 * @returns {Promise<Object>} Authentication profile result
 */
export const getAuthProfile = async () => {
  return apiClient.get(ENDPOINTS.AUTH_ME);
};

/**
 * Registers a new user account and returns an auth token.
 * @param {Object} payload - Register payload
 * @returns {Promise<Object>} Register result
 */
export const registerAuthUser = async (payload) => {
  return apiClient.post(ENDPOINTS.AUTH_REGISTER, payload);
};

/**
 * Logs in an existing user account and returns an auth token.
 * @param {Object} payload - Login payload
 * @returns {Promise<Object>} Login result
 */
export const loginAuthUser = async (payload) => {
  return apiClient.post(ENDPOINTS.AUTH_LOGIN, payload);
};

/**
 * Logs out current session token.
 * @returns {Promise<Object>} Logout result
 */
export const logoutAuthUser = async () => {
  return apiClient.post(ENDPOINTS.AUTH_LOGOUT, {});
};

/**
 * Lists API keys from backend
 * @param {Object} options - Query options
 * @returns {Promise<Object>} API keys list result
 */
export const listAccessKeys = async (options = {}) => {
  const endpoint = `${ENDPOINTS.ACCESS_KEYS}${buildQueryString(options)}`;
  return apiClient.get(endpoint);
};

/**
 * Creates a scoped API key on backend
 * @param {Object} payload - API key creation payload
 * @returns {Promise<Object>} Created key result
 */
export const createAccessKey = async (payload) => {
  return apiClient.post(ENDPOINTS.ACCESS_KEYS, payload);
};

/**
 * Revokes a backend API key
 * @param {string} keyId - API key id
 * @returns {Promise<Object>} Revoke result
 */
export const revokeAccessKey = async (keyId) => {
  return apiClient.delete(`${ENDPOINTS.ACCESS_KEYS}/${encodeURIComponent(keyId)}`);
};

/**
 * Fetches generation history from backend persistence
 * @param {Object} filters - Optional filters
 * @returns {Promise<Object>} History result
 */
export const fetchGenerationHistory = async (filters = {}) => {
  const endpoint = `${ENDPOINTS.HISTORY}${buildQueryString(filters)}`;
  return apiClient.get(endpoint);
};

/**
 * Fetches a single generation history record with full snapshot data
 * @param {string} recordId - History record id
 * @returns {Promise<Object>} History detail result
 */
export const fetchGenerationHistoryRecord = async (recordId) => {
  return apiClient.get(`${ENDPOINTS.HISTORY}/${encodeURIComponent(recordId)}`);
};

/**
 * Creates a manual history entry (snapshot) in backend persistence
 * @param {Object} payload - History entry payload
 * @returns {Promise<Object>} Create history result
 */
export const createGenerationHistoryRecord = async (payload) => {
  return apiClient.post(ENDPOINTS.HISTORY, payload);
};

/**
 * Clears generation history records in backend persistence
 * @param {Object} filters - Optional filters such as projectId
 * @returns {Promise<Object>} Clear history result
 */
export const clearGenerationHistoryRemote = async (filters = {}) => {
  const endpoint = `${ENDPOINTS.HISTORY}${buildQueryString(filters)}`;
  return apiClient.delete(endpoint);
};

/**
 * Fetches projects from backend persistence
 * @returns {Promise<Object>} Projects result
 */
export const fetchProjects = async () => {
  return apiClient.get(ENDPOINTS.PROJECTS);
};

/**
 * Builds a full project documentation snapshot from all generation entries
 * @param {string} projectId - Project id
 * @param {Object} options - Optional query params
 * @returns {Promise<Object>} Project snapshot result
 */
export const fetchProjectSnapshot = async (projectId, options = {}) => {
  const endpoint = `${ENDPOINTS.PROJECTS}/${encodeURIComponent(projectId)}/snapshot${buildQueryString(options)}`;
  return apiClient.get(endpoint);
};

/**
 * Downloads the project snapshot as a markdown file
 * @param {string} projectId - Project id
 * @param {Object} options - Optional query params
 * @returns {Promise<Object>} Download result containing blob and filename
 */
export const downloadProjectSnapshot = async (projectId, options = {}) => {
  const endpoint = `${ENDPOINTS.PROJECTS}/${encodeURIComponent(projectId)}/snapshot${buildQueryString({
    ...options,
    download: true,
  })}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
  const apiKey = getStoredApiKey();

  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        Accept: 'text/markdown',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return apiClient.handleErrorResponse(response, endpoint);
    }

    const blob = await response.blob();
    const fileName = parseFileNameFromDisposition(response.headers.get('content-disposition'))
      || 'project-snapshot.md';

    return {
      success: true,
      data: {
        blob,
        fileName,
      },
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return apiClient.handleRequestError(error, endpoint);
  }
};

/**
 * Creates or updates a project in backend persistence
 * @param {Object} payload - Project payload
 * @returns {Promise<Object>} Project result
 */
export const saveProject = async (payload) => {
  return apiClient.post(ENDPOINTS.PROJECTS, payload);
};

/**
 * Deletes project in backend persistence
 * @param {string} projectId - Project id
 * @returns {Promise<Object>} Delete result
 */
export const deleteProject = async (projectId) => {
  return apiClient.delete(`${ENDPOINTS.PROJECTS}/${encodeURIComponent(projectId)}`);
};

/**
 * Fetches persisted settings/preferences from backend
 * @returns {Promise<Object>} Preferences result
 */
export const fetchPreferences = async () => {
  return apiClient.get(ENDPOINTS.PREFERENCES);
};

/**
 * Saves persisted settings/preferences to backend
 * @param {Object} settings - Settings payload
 * @returns {Promise<Object>} Save preferences result
 */
export const savePreferences = async (settings) => {
  return apiClient.put(ENDPOINTS.PREFERENCES, {
    settings,
  });
};

export {
  normalizePayloadData,
};

export default apiClient;
