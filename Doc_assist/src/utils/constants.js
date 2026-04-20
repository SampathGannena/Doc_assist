// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api',
  TIMEOUT: 60000, // 60 seconds (increased for ML model)
  RETRY_ATTEMPTS: 2, // Reduced retries to avoid long waits
  RETRY_DELAY: 1000, // 1 second
};

// Supported programming languages
export const SUPPORTED_LANGUAGES = {
  PYTHON: 'python',
  JAVASCRIPT: 'javascript',
  JAVA: 'java',
  CPP: 'cpp',
  CSHARP: 'csharp',
  TYPESCRIPT: 'typescript',
  GO: 'go',
  RUST: 'rust',
  PHP: 'php',
  RUBY: 'ruby',
};

// Language display names
export const LANGUAGE_NAMES = {
  python: 'Python',
  javascript: 'JavaScript',
  java: 'Java',
  cpp: 'C++',
  csharp: 'C#',
  typescript: 'TypeScript',
  go: 'Go',
  rust: 'Rust',
  php: 'PHP',
  ruby: 'Ruby',
};

// API Endpoints
export const ENDPOINTS = {
  GENERATE_DOCS: '/generate-documentation',
  ANALYZE_CODE: '/analyze-code',
  VALIDATE_SYNTAX: '/validate-syntax',
  HEALTH_CHECK: '/health',
};

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  TIMEOUT_ERROR: 'Request timeout. The server took too long to respond.',
  SERVER_ERROR: 'Server error. Please try again later.',
  INVALID_CODE: 'Invalid code provided. Please check your syntax.',
  UNSUPPORTED_LANGUAGE: 'Unsupported programming language.',
  EMPTY_CODE: 'Please enter some code to generate documentation for.',
  RATE_LIMIT: 'Rate limit exceeded. Please try again later.',
  UNAUTHORIZED: 'Unauthorized. Please check your API key.',
};

// Success messages
export const SUCCESS_MESSAGES = {
  DOCS_GENERATED: 'Documentation generated successfully!',
  CODE_ANALYZED: 'Code analyzed successfully!',
  SYNTAX_VALID: 'Syntax is valid!',
};

// Code examples for different languages
export const CODE_EXAMPLES = {
  python: `def calculate_fibonacci(n):
    if n <= 1:
        return n
    return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)`,

  javascript: `function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}`,

  java: `public int binarySearch(int[] arr, int target) {
    int left = 0, right = arr.length - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (arr[mid] == target) return mid;
        if (arr[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    return -1;
}`,

  cpp: `template<typename T>
void quickSort(vector<T>& arr, int low, int high) {
    if (low < high) {
        int pi = partition(arr, low, high);
        quickSort(arr, low, pi - 1);
        quickSort(arr, pi + 1, high);
    }
}`,

  csharp: `public async Task<List<User>> GetUsersAsync(string filter) {
    using var client = new HttpClient();
    var response = await client.GetAsync($"/api/users?filter={filter}");
    var json = await response.Content.ReadAsStringAsync();
    return JsonSerializer.Deserialize<List<User>>(json);
}`,

  typescript: `async function fetchData<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return await response.json() as T;
}`,
};

// Regex patterns for code parsing
export const CODE_PATTERNS = {
  python: {
    function: /def\s+(\w+)\s*\(([^)]*)\)/,
    class: /class\s+(\w+)/,
    import: /^(?:from\s+\S+\s+)?import\s+.+/gm,
  },
  javascript: {
    function: /function\s+(\w+)\s*\(([^)]*)\)|const\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/,
    class: /class\s+(\w+)/,
    import: /^import\s+.+/gm,
  },
  java: {
    function: /(?:public|private|protected)?\s*(?:static)?\s*\w+\s+(\w+)\s*\(([^)]*)\)/,
    class: /(?:public|private)?\s*class\s+(\w+)/,
    import: /^import\s+.+/gm,
  },
  cpp: {
    function: /\w+\s+(\w+)\s*\(([^)]*)\)/,
    class: /class\s+(\w+)/,
    include: /^#include\s+.+/gm,
  },
  csharp: {
    function: /(?:public|private|protected)?\s*(?:static)?\s*(?:async)?\s*\w+\s+(\w+)\s*\(([^)]*)\)/,
    class: /(?:public|private)?\s*class\s+(\w+)/,
    using: /^using\s+.+/gm,
  },
};

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMIT: 429,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// Cache configuration
export const CACHE_CONFIG = {
  ENABLED: true,
  TTL: 3600000, // 1 hour in milliseconds
  MAX_SIZE: 100, // Maximum number of cached items
};
