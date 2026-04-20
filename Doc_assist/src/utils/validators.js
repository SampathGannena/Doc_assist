import { SUPPORTED_LANGUAGES, ERROR_MESSAGES } from './constants';
import { isEmpty } from './helpers';

/**
 * Validates if the provided language is supported
 * @param {string} language - The programming language
 * @returns {Object} Validation result
 */
export const validateLanguage = (language) => {
  const supportedLanguages = Object.values(SUPPORTED_LANGUAGES);
  
  if (!language || typeof language !== 'string') {
    return {
      isValid: false,
      error: 'Language must be a non-empty string',
    };
  }

  const normalizedLanguage = language.toLowerCase();
  
  if (!supportedLanguages.includes(normalizedLanguage)) {
    return {
      isValid: false,
      error: ERROR_MESSAGES.UNSUPPORTED_LANGUAGE,
    };
  }

  return {
    isValid: true,
    language: normalizedLanguage,
  };
};

/**
 * Validates code input
 * @param {string} code - The source code
 * @returns {Object} Validation result
 */
export const validateCode = (code) => {
  if (!code || typeof code !== 'string') {
    return {
      isValid: false,
      error: 'Code must be a non-empty string',
    };
  }

  if (isEmpty(code)) {
    return {
      isValid: false,
      error: ERROR_MESSAGES.EMPTY_CODE,
    };
  }

  // Check minimum code length
  if (code.trim().length < 10) {
    return {
      isValid: false,
      error: 'Code is too short. Please provide a meaningful code snippet.',
    };
  }

  // Check maximum code length (to prevent abuse)
  const maxLength = 50000; // ~50KB
  if (code.length > maxLength) {
    return {
      isValid: false,
      error: `Code exceeds maximum length of ${maxLength} characters.`,
    };
  }

  return {
    isValid: true,
  };
};

/**
 * Validates documentation generation request
 * @param {Object} request - The request object
 * @returns {Object} Validation result
 */
export const validateDocumentationRequest = (request) => {
  const errors = [];

  // Validate code
  const codeValidation = validateCode(request.code);
  if (!codeValidation.isValid) {
    errors.push(codeValidation.error);
  }

  // Validate language
  const languageValidation = validateLanguage(request.language);
  if (!languageValidation.isValid) {
    errors.push(languageValidation.error);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validates API response structure
 * @param {Object} response - The API response
 * @returns {Object} Validation result
 */
export const validateApiResponse = (response) => {
  if (!response || typeof response !== 'object') {
    return {
      isValid: false,
      error: 'Invalid response format',
    };
  }

  if (!response.hasOwnProperty('success')) {
    return {
      isValid: false,
      error: 'Response missing success field',
    };
  }

  if (response.success && !response.data) {
    return {
      isValid: false,
      error: 'Successful response missing data field',
    };
  }

  if (!response.success && !response.error) {
    return {
      isValid: false,
      error: 'Error response missing error field',
    };
  }

  return {
    isValid: true,
  };
};

/**
 * Validates function signature
 * @param {string} code - The source code
 * @param {string} language - The programming language
 * @returns {Object} Validation result
 */
export const validateFunctionSignature = (code, language) => {
  const patterns = {
    python: /def\s+\w+\s*\([^)]*\)\s*:/,
    javascript: /function\s+\w+\s*\([^)]*\)|const\s+\w+\s*=\s*(\([^)]*\)|\w+)\s*=>/,
    java: /(public|private|protected)\s+\w+\s+\w+\s*\([^)]*\)/,
    cpp: /\w+\s+\w+\s*\([^)]*\)/,
    csharp: /(public|private|protected)\s+\w+\s+\w+\s*\([^)]*\)/,
    typescript: /function\s+\w+\s*\([^)]*\)|const\s+\w+\s*=\s*(\([^)]*\)|\w+)\s*=>/,
  };

  const pattern = patterns[language];
  
  if (!pattern) {
    return {
      isValid: false,
      error: `No validation pattern for language: ${language}`,
    };
  }

  const hasValidSignature = pattern.test(code);

  return {
    isValid: hasValidSignature,
    error: hasValidSignature ? null : 'No valid function signature found',
  };
};

/**
 * Validates email format
 * @param {string} email - The email address
 * @returns {boolean} True if valid
 */
export const isValidEmail = (email) => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
};

/**
 * Validates URL format
 * @param {string} url - The URL string
 * @returns {boolean} True if valid
 */
export const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Validates API key format
 * @param {string} apiKey - The API key
 * @returns {Object} Validation result
 */
export const validateApiKey = (apiKey) => {
  if (!apiKey || typeof apiKey !== 'string') {
    return {
      isValid: false,
      error: 'API key must be a non-empty string',
    };
  }

  // Check minimum length
  if (apiKey.length < 20) {
    return {
      isValid: false,
      error: 'API key is too short',
    };
  }

  // Check for valid characters (alphanumeric and some special chars)
  if (!/^[a-zA-Z0-9_-]+$/.test(apiKey)) {
    return {
      isValid: false,
      error: 'API key contains invalid characters',
    };
  }

  return {
    isValid: true,
  };
};

/**
 * Sanitizes and validates file name
 * @param {string} filename - The filename
 * @returns {Object} Validation result with sanitized filename
 */
export const validateFileName = (filename) => {
  if (!filename || typeof filename !== 'string') {
    return {
      isValid: false,
      error: 'Filename must be a non-empty string',
    };
  }

  // Remove invalid characters
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Check if filename is not empty after sanitization
  if (sanitized.trim() === '') {
    return {
      isValid: false,
      error: 'Invalid filename',
    };
  }

  return {
    isValid: true,
    filename: sanitized,
  };
};
