import { API_CONFIG, CACHE_CONFIG } from './constants';

// Simple in-memory cache
const cache = new Map();
let cacheAccessOrder = [];

/**
 * Implements exponential backoff retry logic
 * @param {Function} fn - The async function to retry
 * @param {number} maxAttempts - Maximum number of retry attempts
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise<any>} The result of the function
 */
export const retryWithBackoff = async (fn, maxAttempts = 3, baseDelay = 1000) => {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 * delay;
      
      await sleep(delay + jitter);
    }
  }

  throw lastError;
};

/**
 * Delays execution for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Debounces a function call
 * @param {Function} func - The function to debounce
 * @param {number} wait - The delay in milliseconds
 * @returns {Function} The debounced function
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttles a function call
 * @param {Function} func - The function to throttle
 * @param {number} limit - The time limit in milliseconds
 * @returns {Function} The throttled function
 */
export const throttle = (func, limit = 300) => {
  let inThrottle;
  
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Gets data from cache if available and not expired
 * @param {string} key - The cache key
 * @returns {any|null} The cached data or null
 */
export const getCachedData = (key) => {
  if (!CACHE_CONFIG.ENABLED) {
    return null;
  }

  const cached = cache.get(key);
  
  if (!cached) {
    return null;
  }

  const now = Date.now();
  if (now - cached.timestamp > CACHE_CONFIG.TTL) {
    cache.delete(key);
    return null;
  }

  // Update access order for LRU
  cacheAccessOrder = cacheAccessOrder.filter(k => k !== key);
  cacheAccessOrder.push(key);

  return cached.data;
};

/**
 * Stores data in cache with timestamp
 * @param {string} key - The cache key
 * @param {any} data - The data to cache
 */
export const setCachedData = (key, data) => {
  if (!CACHE_CONFIG.ENABLED) {
    return;
  }

  // Implement LRU eviction if cache is full
  if (cache.size >= CACHE_CONFIG.MAX_SIZE) {
    const oldestKey = cacheAccessOrder.shift();
    cache.delete(oldestKey);
  }

  cache.set(key, {
    data,
    timestamp: Date.now(),
  });

  cacheAccessOrder.push(key);
};

/**
 * Clears all cached data
 */
export const clearCache = () => {
  cache.clear();
  cacheAccessOrder = [];
};

/**
 * Formats code by adding proper indentation
 * @param {string} code - The source code
 * @param {number} spaces - Number of spaces for indentation
 * @returns {string} Formatted code
 */
export const formatCode = (code, spaces = 4) => {
  const lines = code.split('\n');
  let indentLevel = 0;
  const formatted = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    
    if (!trimmed) {
      formatted.push('');
      return;
    }

    // Decrease indent for closing brackets
    if (/^[}\])]/.test(trimmed)) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    formatted.push(' '.repeat(indentLevel * spaces) + trimmed);

    // Increase indent for opening brackets
    if (/{$/.test(trimmed) || /\[$/.test(trimmed)) {
      indentLevel++;
    }
  });

  return formatted.join('\n');
};

/**
 * Truncates text to specified length with ellipsis
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncate = (text, maxLength = 100) => {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Copies text to clipboard
 * @param {string} text - The text to copy
 * @returns {Promise<boolean>} True if successful
 */
export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      
      try {
        document.execCommand('copy');
        return true;
      } finally {
        document.body.removeChild(textArea);
      }
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

/**
 * Downloads text as a file
 * @param {string} content - The file content
 * @param {string} filename - The filename
 * @param {string} mimeType - The MIME type
 */
export const downloadFile = (content, filename, mimeType = 'text/plain') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Formats execution time in human-readable format
 * @param {number} milliseconds - Time in milliseconds
 * @returns {string} Formatted time string
 */
export const formatExecutionTime = (milliseconds) => {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  
  const seconds = (milliseconds / 1000).toFixed(2);
  return `${seconds}s`;
};

/**
 * Generates a unique ID
 * @returns {string} Unique identifier
 */
export const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Sanitizes user input to prevent XSS
 * @param {string} input - The user input
 * @returns {string} Sanitized input
 */
export const sanitizeInput = (input) => {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
};

/**
 * Checks if a value is empty (null, undefined, empty string, or empty array)
 * @param {any} value - The value to check
 * @returns {boolean} True if empty
 */
export const isEmpty = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

/**
 * Deep clones an object
 * @param {any} obj - The object to clone
 * @returns {any} Cloned object
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  
  const clonedObj = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clonedObj[key] = deepClone(obj[key]);
    }
  }
  return clonedObj;
};
