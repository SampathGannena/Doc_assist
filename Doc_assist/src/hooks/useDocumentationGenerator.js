import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { generateDocumentation as generateDocumentationAPI } from '../utils/api';
import { CODE_EXAMPLES, SUCCESS_MESSAGES, ERROR_MESSAGES } from '../utils/constants';
import { validateCode, validateLanguage } from '../utils/validators';
import { 
  extractFunctionName, 
  extractParameters,
  calculateComplexity 
} from '../utils/codeParser';

// Fallback mock documentation generator (used when API is unavailable)
const generateMockDocumentation = (code, language) => {
  const functionName = extractFunctionName(code, language);
  const parameters = extractParameters(code);
  
  // Simple mock documentation based on language
  const docstringFormats = {
    python: (name, params) => {
      return `def ${name}(${params.join(', ')}):\n    """\n    AI-generated documentation for ${name}.\n    \n    Args:\n${params.map(p => `        ${p}: Description of ${p}`).join('\n')}\n    \n    Returns:\n        The result of the operation\n    """\n${code.split('\n').slice(1).join('\n')}`;
    },
    javascript: (name, params) => {
      return `/**\n * AI-generated documentation for ${name}.\n *\n${params.map(p => ` * @param ${p} - Description of ${p}`).join('\n')}\n * @returns The result of the operation\n */\n${code}`;
    },
    java: (name, params) => {
      return `/**\n * AI-generated documentation for ${name}.\n *\n${params.map(p => ` * @param ${p} Description of ${p}`).join('\n')}\n * @return The result of the operation\n */\n${code}`;
    },
    cpp: (name, params) => {
      return `/**\n * @brief AI-generated documentation for ${name}.\n *\n${params.map(p => ` * @param ${p} Description of ${p}`).join('\n')}\n * @return The result of the operation\n */\n${code}`;
    },
    csharp: (name, params) => {
      return `/// <summary>\n/// AI-generated documentation for ${name}.\n/// </summary>\n${params.map(p => `/// <param name="${p}">Description of ${p}</param>`).join('\n')}\n/// <returns>The result of the operation</returns>\n${code}`;
    },
  };
  
  const formatter = docstringFormats[language] || docstringFormats.python;
  return formatter(functionName, parameters);
};

export const useDocumentationGenerator = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState('');
  const [metadata, setMetadata] = useState({
    confidence: '--',
    processingTime: '--',
    model: 'CodeT5-base',
    complexity: '--',
    fromCache: false
  });

  const generateDocumentation = useCallback(async (code, language) => {
    // Validate input
    const codeValidation = validateCode(code);
    if (!codeValidation.isValid) {
      toast.error(codeValidation.error);
      return;
    }

    const languageValidation = validateLanguage(language);
    if (!languageValidation.isValid) {
      toast.error(languageValidation.error);
      return;
    }

    const startTime = Date.now();
    setIsLoading(true);
    setResult('Analyzing your code and generating documentation...');
    setMetadata(prev => ({ 
      ...prev, 
      confidence: '--', 
      processingTime: '--',
      complexity: '--',
      fromCache: false
    }));

    try {
      // Calculate code complexity
      const complexity = calculateComplexity(code);

      // Call the real API
      const response = await generateDocumentationAPI(code, languageValidation.language);
      console.log('API response:', response);

      if (!response || typeof response !== 'object' || !('success' in response) || !response.success) {
        // If API fails, fall back to mock documentation
        console.warn('API request failed, using fallback:', response.error);
        const mockDoc = generateMockDocumentation(code, languageValidation.language);
        
        const processingTime = Date.now() - startTime;
        
        setResult(mockDoc);
        setMetadata({
          confidence: '85%',
          processingTime: `${processingTime}ms`,
          model: 'Local Fallback',
          complexity: complexity.toString(),
          fromCache: false
        });

        toast.error('API unavailable. Using offline mode.');
        return;
      }

      // Process successful API response
      const processingTime = Date.now() - startTime;
  // Backend returns { success, data: { documentation, metadata } }
  const payload = response?.data?.data || response?.data || {};
  const documentation = payload?.documentation || payload?.result || '';
  const apiMetadata = payload?.metadata || {};

      setResult(documentation);
      setMetadata({
        confidence: apiMetadata.confidence || '95%',
        processingTime: response.fromCache ? 'cached' : `${processingTime}ms`,
        model: apiMetadata.model || 'CodeT5-base',
        complexity: complexity.toString(),
        fromCache: response.fromCache || false
      });

      toast.success(response.fromCache ? 'Retrieved from cache!' : SUCCESS_MESSAGES.DOCS_GENERATED);
      
    } catch (error) {
      // Handle unexpected errors
      console.error('Documentation generation error:', error);
      
      // Try fallback
      try {
        const mockDoc = generateMockDocumentation(code, languageValidation.language);
        const processingTime = Date.now() - startTime;
        
        setResult(mockDoc);
        setMetadata({
          confidence: '80%',
          processingTime: `${processingTime}ms`,
          model: 'Emergency Fallback',
          complexity: calculateComplexity(code).toString(),
          fromCache: false
        });
        
        toast.error('API unavailable. Using basic documentation generator.');
      } catch (fallbackError) {
        setResult('Failed to generate documentation. Please try again.');
        toast.error(ERROR_MESSAGES.SERVER_ERROR);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getExample = useCallback((language) => {
    return CODE_EXAMPLES[language] || CODE_EXAMPLES.python;
  }, []);

  const clearResult = useCallback(() => {
    setResult('');
    setMetadata(prev => ({ ...prev, confidence: '--', processingTime: '--' }));
  }, []);

  return {
    generateDocumentation,
    getExample,
    clearResult,
    isLoading,
    result,
    metadata
  };
};