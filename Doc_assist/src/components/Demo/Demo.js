import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import toast from 'react-hot-toast';

import { useDocumentationGenerator } from '../../hooks/useDocumentationGenerator';

const DemoSection = styled.section`
  padding: 4rem 0;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 2rem;
  margin: 2rem 0;
  backdrop-filter: blur(10px);
`;

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    padding: 0 1rem;
  }
`;

const SectionTitle = styled(motion.h2)`
  font-size: 2.5rem;
  font-weight: 700;
  text-align: center;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, ${props => props.theme.colors.text.primary}, ${props => props.theme.colors.text.secondary});
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    font-size: 2rem;
  }
`;

const SectionSubtitle = styled(motion.p)`
  text-align: center;
  font-size: 1.125rem;
  color: ${props => props.theme.colors.text.muted};
  margin-bottom: 3rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
`;

const DemoContainer = styled(motion.div)`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-top: 2rem;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
  }
`;

const InputSection = styled.div`
  background: rgba(15, 15, 35, 0.8);
  border-radius: 1rem;
  border: 1px solid ${props => props.theme.colors.border};
  overflow: hidden;
  transition: all 0.3s ease;

  &:hover {
    border-color: rgba(59, 130, 246, 0.3);
  }
`;

const OutputSection = styled.div`
  background: rgba(15, 15, 35, 0.8);
  border-radius: 1rem;
  border: 1px solid ${props => props.theme.colors.border};
  overflow: hidden;
  transition: all 0.3s ease;

  &:hover {
    border-color: rgba(59, 130, 246, 0.3);
  }
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid ${props => props.theme.colors.border};
`;

const SectionHeaderTitle = styled.h3`
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
`;

const LanguageSelect = styled.select`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
  color: ${props => props.theme.colors.text.primary};
  font-size: 0.875rem;
  outline: none;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    border-color: rgba(255, 255, 255, 0.3);
  }

  &:focus {
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  option {
    background: #1e1e1e;
    color: ${props => props.theme.colors.text.primary};
  }
`;

const CodeInputContainer = styled.div`
  padding: 1.5rem;
`;

const CodeInput = styled.textarea`
  width: 100%;
  min-height: 300px;
  background: ${props => props.theme.colors.background.input};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 0.5rem;
  padding: 1rem;
  color: ${props => props.theme.colors.text.primary};
  font-family: ${props => props.theme.fonts.mono};
  font-size: 0.875rem;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  transition: all 0.3s ease;

  &:focus {
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  &::placeholder {
    color: ${props => props.theme.colors.text.disabled};
  }
`;

const InputActions = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  justify-content: flex-end;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    flex-direction: column;
  }
`;

const Button = styled(motion.button)`
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const PrimaryButton = styled(Button)`
  background: linear-gradient(135deg, ${props => props.theme.colors.primary}, ${props => props.theme.colors.secondary});
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);

  &:hover:not(:disabled) {
    box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const SecondaryButton = styled(Button)`
  background: rgba(255, 255, 255, 0.1);
  color: ${props => props.theme.colors.text.secondary};
  border: 1px solid rgba(255, 255, 255, 0.2);

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
  }
`;

const CopyButton = styled(motion.button)`
  background: none;
  border: none;
  color: ${props => props.theme.colors.text.muted};
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.375rem;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;

  &:hover {
    color: ${props => props.theme.colors.primary};
    background: rgba(59, 130, 246, 0.1);
  }
`;

const CodeOutputContainer = styled.div`
  padding: 1.5rem;
  max-height: 400px;
  overflow-y: auto;
`;

const OutputMetadata = styled.div`
  display: flex;
  gap: 2rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid ${props => props.theme.colors.border};
  flex-wrap: wrap;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    gap: 1rem;
  }
`;

const MetadataItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const MetadataLabel = styled.span`
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.disabled};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const MetadataValue = styled.span`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.primary};
  font-weight: 500;
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: ${props => props.theme.colors.primary};
  animation: spin 1s ease-in-out infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const Demo = () => {
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');
  const {
    generateDocumentation,
    getExample,
    clearResult,
    isLoading,
    result,
    metadata
  } = useDocumentationGenerator();

  useEffect(() => {
    // Load example for the selected language
    setCode(getExample(language));
  }, [language, getExample]);

  const handleGenerateDocumentation = () => {
    generateDocumentation(code, language);
  };

  const handleClearInput = () => {
    setCode('');
    clearResult();
  };

  const handleLoadExample = () => {
    setCode(getExample(language));
  };

  const handleCopy = () => {
    toast.success('Documentation copied to clipboard!');
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: "easeOut",
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  };

  return (
    <DemoSection id="demo">
      <Container>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <SectionTitle variants={itemVariants}>
            Try It Live
          </SectionTitle>
          
          <SectionSubtitle variants={itemVariants}>
            Paste your function below and watch the AI generate comprehensive documentation
          </SectionSubtitle>
          
          <DemoContainer variants={itemVariants}>
            <InputSection>
              <SectionHeader>
                <SectionHeaderTitle>Input Your Code</SectionHeaderTitle>
                <LanguageSelect
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                  <option value="csharp">C#</option>
                </LanguageSelect>
              </SectionHeader>
              
              <CodeInputContainer>
                <CodeInput
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste your function here..."
                  spellCheck="false"
                />
                
                <InputActions>
                  <SecondaryButton
                    onClick={handleClearInput}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Clear
                  </SecondaryButton>
                  
                  <SecondaryButton
                    onClick={handleLoadExample}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Load Example
                  </SecondaryButton>
                  
                  <PrimaryButton
                    onClick={handleGenerateDocumentation}
                    disabled={isLoading || !code.trim()}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isLoading ? (
                      <>
                        <LoadingSpinner />
                        Generating...
                      </>
                    ) : (
                      <>
                        <span>✨</span>
                        Generate Documentation
                      </>
                    )}
                  </PrimaryButton>
                </InputActions>
              </CodeInputContainer>
            </InputSection>

            <OutputSection>
              <SectionHeader>
                <SectionHeaderTitle>Generated Documentation</SectionHeaderTitle>
                {result && !isLoading && (
                  <CopyToClipboard text={result} onCopy={handleCopy}>
                    <CopyButton
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span>📋</span>
                      Copy
                    </CopyButton>
                  </CopyToClipboard>
                )}
              </SectionHeader>
              
              <CodeOutputContainer>
                {result ? (
                  <SyntaxHighlighter
                    language={language}
                    style={vscDarkPlus}
                    customStyle={{
                      background: 'transparent',
                      padding: 0,
                      margin: 0,
                      fontSize: '0.875rem',
                      lineHeight: '1.5',
                    }}
                  >
                    {result}
                  </SyntaxHighlighter>
                ) : (
                  <div style={{ 
                    color: '#64748b', 
                    fontStyle: 'italic',
                    textAlign: 'center',
                    padding: '2rem',
                    fontSize: '0.875rem'
                  }}>
                    Click "Generate Documentation" to see the AI-generated docstring appear here...
                  </div>
                )}
                
                <OutputMetadata>
                  <MetadataItem>
                    <MetadataLabel>Model</MetadataLabel>
                    <MetadataValue>{metadata.model}</MetadataValue>
                  </MetadataItem>
                  <MetadataItem>
                    <MetadataLabel>Confidence</MetadataLabel>
                    <MetadataValue>{metadata.confidence}</MetadataValue>
                  </MetadataItem>
                  <MetadataItem>
                    <MetadataLabel>Processing Time</MetadataLabel>
                    <MetadataValue>{metadata.processingTime}</MetadataValue>
                  </MetadataItem>
                </OutputMetadata>
              </CodeOutputContainer>
            </OutputSection>
          </DemoContainer>
        </motion.div>
      </Container>
    </DemoSection>
  );
};

export default Demo;