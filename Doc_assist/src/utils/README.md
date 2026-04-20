# Utilities Folder

This folder contains utility functions and modules used throughout the application.

## Files

### `api.js`
API client for making HTTP requests to the backend documentation generation service.

**Key Functions:**
- `generateDocumentation(code, language, options)` - Generates documentation for code
- `analyzeCode(code, language)` - Analyzes code structure
- `validateSyntax(code, language)` - Validates code syntax
- `checkHealth()` - Checks API health status

**Features:**
- Automatic retry with exponential backoff
- Request timeout handling
- Response caching
- Comprehensive error handling

### `codeParser.js`
Functions for parsing and analyzing source code.

**Key Functions:**
- `extractFunctionName(code, language)` - Extracts function name from code
- `extractParameters(code)` - Extracts function parameters
- `extractClassName(code, language)` - Extracts class name
- `isAsync(code)` - Detects async/await patterns
- `hasReturnValue(code, language)` - Checks if function returns a value
- `inferParameterType(param, code, language)` - Infers parameter types
- `inferReturnType(code, language)` - Infers return type
- `countLinesOfCode(code)` - Counts LOC
- `calculateComplexity(code)` - Calculates cyclomatic complexity
- `validateCodeStructure(code, language)` - Validates code structure

### `constants.js`
Application-wide constants and configuration.

**Exports:**
- `API_CONFIG` - API configuration (base URL, timeout, retry settings)
- `SUPPORTED_LANGUAGES` - List of supported programming languages
- `LANGUAGE_NAMES` - Display names for languages
- `ENDPOINTS` - API endpoint paths
- `ERROR_MESSAGES` - Standardized error messages
- `SUCCESS_MESSAGES` - Success notification messages
- `CODE_EXAMPLES` - Sample code for each language
- `CODE_PATTERNS` - Regex patterns for code parsing
- `HTTP_STATUS` - HTTP status code constants
- `CACHE_CONFIG` - Cache configuration

### `helpers.js`
General utility helper functions.

**Key Functions:**
- `retryWithBackoff(fn, maxAttempts, baseDelay)` - Implements retry logic
- `sleep(ms)` - Delays execution
- `debounce(func, wait)` - Debounces function calls
- `throttle(func, limit)` - Throttles function calls
- `getCachedData(key)` - Retrieves cached data
- `setCachedData(key, data)` - Stores data in cache
- `clearCache()` - Clears all cached data
- `formatCode(code, spaces)` - Formats code with proper indentation
- `truncate(text, maxLength)` - Truncates text with ellipsis
- `copyToClipboard(text)` - Copies text to clipboard
- `downloadFile(content, filename, mimeType)` - Downloads content as file
- `formatExecutionTime(milliseconds)` - Formats time display
- `generateId()` - Generates unique IDs
- `sanitizeInput(input)` - Sanitizes user input
- `isEmpty(value)` - Checks if value is empty
- `deepClone(obj)` - Deep clones objects

### `validators.js`
Input validation functions.

**Key Functions:**
- `validateLanguage(language)` - Validates programming language
- `validateCode(code)` - Validates code input
- `validateDocumentationRequest(request)` - Validates full request
- `validateApiResponse(response)` - Validates API response structure
- `validateFunctionSignature(code, language)` - Validates function syntax
- `isValidEmail(email)` - Validates email format
- `isValidUrl(url)` - Validates URL format
- `validateApiKey(apiKey)` - Validates API key format
- `validateFileName(filename)` - Validates and sanitizes filenames

## Usage Examples

### Generating Documentation
```javascript
import { generateDocumentation } from './utils';

const result = await generateDocumentation(code, 'python');
if (result.success) {
  console.log(result.data.documentation);
}
```

### Parsing Code
```javascript
import { extractFunctionName, extractParameters } from './utils';

const functionName = extractFunctionName(code, 'javascript');
const params = extractParameters(code);
```

### Validation
```javascript
import { validateCode, validateLanguage } from './utils';

const codeValidation = validateCode(userCode);
if (!codeValidation.isValid) {
  console.error(codeValidation.error);
}
```

### Caching
```javascript
import { getCachedData, setCachedData } from './utils';

const cached = getCachedData('myKey');
if (!cached) {
  const data = await fetchData();
  setCachedData('myKey', data);
}
```

## Configuration

Configure the utilities by setting environment variables in `.env`:

```env
REACT_APP_API_BASE_URL=http://localhost:5000/api
REACT_APP_API_TIMEOUT=30000
REACT_APP_RETRY_ATTEMPTS=3
REACT_APP_ENABLE_CACHE=true
REACT_APP_CACHE_TTL=3600000
```

## Error Handling

All API functions return a standardized response format:

```javascript
{
  success: boolean,
  data?: any,        // Present if success is true
  error?: string,    // Present if success is false
  status?: number,   // HTTP status code
  fromCache?: boolean // Indicates if result is from cache
}
```

## Cache Management

The cache uses an LRU (Least Recently Used) eviction policy:
- Maximum 100 items
- 1-hour TTL (configurable)
- Automatic cleanup

## Testing

Each utility module is designed to be testable in isolation. Mock the API client for testing components that use these utilities.
