const SESSION_API_KEY = 'docassist:api-key:session';
const PERSISTED_API_KEY = 'docassist:api-key:persisted';

const sanitizeApiKey = (apiKey) => String(apiKey || '').trim();

const emitAccessUpdate = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent('docassist:access-updated'));
};

export const getStoredApiKey = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  const sessionValue = sanitizeApiKey(window.sessionStorage.getItem(SESSION_API_KEY));
  if (sessionValue) {
    return sessionValue;
  }

  return sanitizeApiKey(window.localStorage.getItem(PERSISTED_API_KEY));
};

export const getApiKeyLocation = () => {
  if (typeof window === 'undefined') {
    return 'none';
  }

  if (sanitizeApiKey(window.sessionStorage.getItem(SESSION_API_KEY))) {
    return 'session';
  }

  if (sanitizeApiKey(window.localStorage.getItem(PERSISTED_API_KEY))) {
    return 'persisted';
  }

  return 'none';
};

export const setStoredApiKey = (apiKey, rememberOnDevice = false) => {
  if (typeof window === 'undefined') {
    return;
  }

  const safeApiKey = sanitizeApiKey(apiKey);

  window.sessionStorage.removeItem(SESSION_API_KEY);
  window.localStorage.removeItem(PERSISTED_API_KEY);

  if (!safeApiKey) {
    emitAccessUpdate();
    return;
  }

  if (rememberOnDevice) {
    window.localStorage.setItem(PERSISTED_API_KEY, safeApiKey);
    emitAccessUpdate();
    return;
  }

  window.sessionStorage.setItem(SESSION_API_KEY, safeApiKey);
  emitAccessUpdate();
};

export const clearStoredApiKey = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(SESSION_API_KEY);
  window.localStorage.removeItem(PERSISTED_API_KEY);
  emitAccessUpdate();
};

export const maskApiKey = (apiKey) => {
  const safeValue = sanitizeApiKey(apiKey);

  if (!safeValue) {
    return 'Not configured';
  }

  if (safeValue.length <= 8) {
    return '********';
  }

  return `${safeValue.slice(0, 4)}...${safeValue.slice(-4)}`;
};
