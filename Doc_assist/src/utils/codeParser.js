import { CODE_PATTERNS, SUPPORTED_LANGUAGES } from './constants';

/**
 * Extracts function name from code based on language
 * @param {string} code - The source code
 * @param {string} language - The programming language
 * @returns {string} The function name or 'function' as default
 */
export const extractFunctionName = (code, language) => {
  const patterns = CODE_PATTERNS[language];
  
  if (!patterns || !patterns.function) {
    return 'function';
  }

  const match = code.match(patterns.function);
  
  if (!match) {
    return 'function';
  }

  // Handle different capture groups for different languages
  return match[1] || match[3] || 'function';
};

/**
 * Extracts function parameters from code
 * @param {string} code - The source code
 * @returns {Array<string>} Array of parameter names
 */
export const extractParameters = (code) => {
  const paramPattern = /\(([^)]*)\)/;
  const match = code.match(paramPattern);
  
  if (!match || !match[1].trim()) {
    return [];
  }
  
  return match[1]
    .split(',')
    .map(param => {
      // Remove type annotations and default values
      let cleanParam = param.trim();
      
      // Handle TypeScript/Java type annotations (e.g., "name: string" or "String name")
      cleanParam = cleanParam.split(':')[0].trim();
      
      // Handle default values (e.g., "count = 0")
      cleanParam = cleanParam.split('=')[0].trim();
      
      // Get the last word (variable name)
      const parts = cleanParam.split(/\s+/);
      return parts[parts.length - 1];
    })
    .filter(param => param && param !== '');
};

/**
 * Extracts class name from code
 * @param {string} code - The source code
 * @param {string} language - The programming language
 * @returns {string|null} The class name or null
 */
export const extractClassName = (code, language) => {
  const patterns = CODE_PATTERNS[language];
  
  if (!patterns || !patterns.class) {
    return null;
  }

  const match = code.match(patterns.class);
  return match ? match[1] : null;
};

/**
 * Detects if code contains async/await patterns
 * @param {string} code - The source code
 * @returns {boolean} True if async code is detected
 */
export const isAsync = (code) => {
  return /\basync\b/.test(code) || /\bawait\b/.test(code) || /\bPromise\b/.test(code);
};

/**
 * Detects if function returns a value
 * @param {string} code - The source code
 * @param {string} language - The programming language
 * @returns {boolean} True if function returns a value
 */
export const hasReturnValue = (code, language) => {
  // Check for void type declarations
  if (language === SUPPORTED_LANGUAGES.JAVA || 
      language === SUPPORTED_LANGUAGES.CPP ||
      language === SUPPORTED_LANGUAGES.CSHARP) {
    if (/\bvoid\b/.test(code)) {
      return false;
    }
  }

  // Check for return statements
  const returnPattern = /\breturn\b/;
  const hasReturn = returnPattern.test(code);
  
  if (!hasReturn) {
    return false;
  }

  // Check if returning None/null/undefined
  const emptyReturnPatterns = [
    /return\s*;/,
    /return\s+None/,
    /return\s+null/,
    /return\s+undefined/,
  ];

  return !emptyReturnPatterns.some(pattern => pattern.test(code));
};

/**
 * Infers parameter type from code context
 * @param {string} param - The parameter name
 * @param {string} code - The source code
 * @param {string} language - The programming language
 * @returns {string} The inferred type
 */
export const inferParameterType = (param, code, language) => {
  // Check for explicit type annotations
  const typeAnnotationPattern = new RegExp(`${param}\\s*:\\s*(\\w+)`);
  const annotationMatch = code.match(typeAnnotationPattern);
  
  if (annotationMatch) {
    return annotationMatch[1];
  }

  // Infer from parameter name patterns
  const typeInferences = {
    // Numbers
    n: 'number',
    num: 'number',
    count: 'number',
    index: 'number',
    id: 'number',
    // Strings
    str: 'string',
    text: 'string',
    name: 'string',
    message: 'string',
    // Arrays
    arr: 'array',
    array: 'array',
    list: 'array',
    items: 'array',
    // Objects
    obj: 'object',
    data: 'object',
    config: 'object',
    options: 'object',
    // Booleans
    is: 'boolean',
    has: 'boolean',
    should: 'boolean',
    // Functions
    func: 'function',
    callback: 'function',
    handler: 'function',
  };

  // Check for partial matches
  const paramLower = param.toLowerCase();
  for (const [key, type] of Object.entries(typeInferences)) {
    if (paramLower.includes(key)) {
      return type;
    }
  }

  return 'any';
};

/**
 * Infers return type from code analysis
 * @param {string} code - The source code
 * @param {string} language - The programming language
 * @returns {string} The inferred return type
 */
export const inferReturnType = (code, language) => {
  // Check for explicit return type annotations
  const returnTypePatterns = {
    typescript: /\):\s*(\w+)/,
    csharp: /^\s*(?:public|private|protected)?\s*(?:static)?\s*(?:async)?\s*(\w+)\s+\w+/,
    java: /^\s*(?:public|private|protected)?\s*(?:static)?\s*(\w+)\s+\w+/,
    cpp: /^\s*(\w+)\s+\w+\s*\(/,
  };

  if (returnTypePatterns[language]) {
    const match = code.match(returnTypePatterns[language]);
    if (match && match[1] !== 'void') {
      return match[1];
    }
  }

  // Infer from return statements
  if (/return\s+\d+/.test(code)) return 'number';
  if (/return\s+["']/.test(code)) return 'string';
  if (/return\s+\[/.test(code)) return 'array';
  if (/return\s+\{/.test(code)) return 'object';
  if (/return\s+(true|false)/.test(code)) return 'boolean';
  if (isAsync(code)) return 'Promise';

  return 'any';
};

/**
 * Counts lines of code (excluding comments and blank lines)
 * @param {string} code - The source code
 * @returns {number} Number of lines of code
 */
export const countLinesOfCode = (code) => {
  const lines = code.split('\n');
  return lines.filter(line => {
    const trimmed = line.trim();
    return trimmed !== '' && 
           !trimmed.startsWith('//') && 
           !trimmed.startsWith('#') &&
           !trimmed.startsWith('/*') &&
           !trimmed.startsWith('*');
  }).length;
};

/**
 * Calculates code complexity (simplified cyclomatic complexity)
 * @param {string} code - The source code
 * @returns {number} Complexity score
 */
export const calculateComplexity = (code) => {
  const controlFlowKeywords = [
    /\bif\b/g,
    /\belse\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bswitch\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\b&&\b/g,
    /\b\|\|\b/g,
  ];

  let complexity = 1; // Base complexity

  controlFlowKeywords.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  });

  return complexity;
};

/**
 * Validates if code is well-formed for a given language
 * @param {string} code - The source code
 * @param {string} language - The programming language
 * @returns {Object} Validation result with isValid and errors
 */
export const validateCodeStructure = (code, language) => {
  const errors = [];

  // Check for balanced brackets
  const brackets = { '(': ')', '[': ']', '{': '}' };
  const stack = [];
  
  for (const char of code) {
    if (brackets[char]) {
      stack.push(char);
    } else if (Object.values(brackets).includes(char)) {
      const last = stack.pop();
      if (brackets[last] !== char) {
        errors.push('Unbalanced brackets detected');
        break;
      }
    }
  }

  if (stack.length > 0) {
    errors.push('Unclosed brackets detected');
  }

  // Language-specific checks
  if (language === SUPPORTED_LANGUAGES.PYTHON) {
    if (!/def\s+\w+\s*\(/.test(code) && !/class\s+\w+/.test(code)) {
      errors.push('No valid function or class definition found');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
