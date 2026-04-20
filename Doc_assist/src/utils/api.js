import { API_CONFIG, ENDPOINTS, ERROR_MESSAGES, HTTP_STATUS } from './constants';
import { retryWithBackoff, getCachedData, setCachedData } from './helpers';
import { getStoredApiKey } from './security';

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
  // Check cache first
  const cacheKey = `doc_${language}_${btoa(code).substring(0, 50)}`;
  const cachedResult = getCachedData(cacheKey);
  
  if (cachedResult) {
    return {
      success: true,
      data: cachedResult,
      fromCache: true,
    };
  }

  // Make API request with retry logic
  const requestFn = () => apiClient.post(ENDPOINTS.GENERATE_DOCS, {
    code,
    language,
    ...options,
  });

  const result = await retryWithBackoff(requestFn, API_CONFIG.RETRY_ATTEMPTS);

  // Cache successful results
  if (result.success && result.data) {
    setCachedData(cacheKey, result.data);
  }

  return result;
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

export default apiClient;
