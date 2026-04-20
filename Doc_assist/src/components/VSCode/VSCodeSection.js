import React, { useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

const VSCodeSection = styled.section`
  padding: 6rem 0;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 2rem;
  margin: 4rem 0;
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

const VSCodeDemo = styled(motion.div)`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 3rem;
  align-items: start;
  margin-top: 3rem;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
`;

const VSCodeMockup = styled(motion.div)`
  background: #1e1e1e;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  border: 1px solid #333;
  position: relative;
`;

const VSCodeTitlebar = styled.div`
  background: #323233;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  border-bottom: 1px solid #2d2d30;
`;

const VSCodeButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const VSCodeButton = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  
  &.close { background: #ff5f57; }
  &.minimize { background: #ffbd2e; }
  &.maximize { background: #28ca42; }
`;

const VSCodeTitle = styled.span`
  color: #cccccc;
  font-size: 0.875rem;
`;

const VSCodeContent = styled.div`
  display: flex;
  height: 400px;
`;

const VSCodeSidebar = styled.div`
  width: 200px;
  background: #252526;
  border-right: 1px solid #2d2d30;
`;

const VSCodeExplorer = styled.div`
  padding: 1rem;
`;

const ExplorerHeader = styled.div`
  color: #cccccc;
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const FileTree = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const FileItem = styled.div`
  color: #cccccc;
  font-size: 0.875rem;
  padding: 0.25rem;
  cursor: pointer;
  border-radius: 0.25rem;
  transition: all 0.2s ease;

  &.active {
    background: #37373d;
    color: #ffffff;
  }

  &:hover {
    background: #2a2d2e;
  }
`;

const VSCodeEditor = styled.div`
  flex: 1;
  background: #1e1e1e;
`;

const VSCodeTabs = styled.div`
  background: #2d2d30;
  border-bottom: 1px solid #2d2d30;
  padding: 0.5rem 1rem;
`;

const VSCodeTab = styled.div`
  background: #1e1e1e;
  color: #cccccc;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem 0.25rem 0 0;
  font-size: 0.875rem;
  display: inline-block;
`;

const CodeArea = styled.div`
  padding: 1rem;
  position: relative;
  font-family: ${props => props.theme.fonts.mono};
  font-size: 0.875rem;
  line-height: 1.5;
  color: #d4d4d4;
`;

const ContextMenu = styled(motion.div)`
  position: absolute;
  top: 2rem;
  left: 2rem;
  background: #2d2d30;
  border: 1px solid #464647;
  border-radius: 0.375rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  min-width: 200px;
  z-index: 10;
  overflow: hidden;
`;

const ContextMenuItem = styled(motion.div)`
  padding: 0.75rem 1rem;
  color: #cccccc;
  font-size: 0.875rem;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s ease;

  &.primary {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
    font-weight: 500;
  }

  &:hover {
    background: #37373d;
  }

  &:last-child {
    border-bottom: none;
  }
`;

const VSCodeFeatures = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

const FeaturesTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
`;

const FeatureList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const FeatureItem = styled(motion.li)`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0;
  color: ${props => props.theme.colors.text.muted};
  border-bottom: 1px solid ${props => props.theme.colors.border};
  font-size: 0.95rem;

  &:last-child {
    border-bottom: none;
  }
`;

const FeatureBullet = styled.span`
  color: #10b981;
  font-weight: 600;
  font-size: 1rem;
`;

const InstallButton = styled(motion.a)`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, ${props => props.theme.colors.primary}, ${props => props.theme.colors.secondary});
  color: white;
  text-decoration: none;
  padding: 1rem 2rem;
  border-radius: 0.5rem;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  text-align: center;

  &:hover {
    box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
    transform: translateY(-2px);
  }
`;

const CodeBlock = styled.pre`
  margin: 0;
  color: #d4d4d4;
  
  .keyword { color: #569cd6; }
  .function { color: #dcdcaa; }
  .string { color: #ce9178; }
  .comment { color: #6a9955; }
`;

const VSCodeSectionComponent = () => {
  const [showContextMenu, setShowContextMenu] = useState(true);

  const features = [
    'Right-click context menu integration',
    'Keyboard shortcut support (Ctrl+Shift+D)',
    'Real-time docstring preview',
    'Multiple docstring format options',
    'Batch documentation for entire files',
    'Customizable templates and styles'
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.8,
        staggerChildren: 0.1
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

  const mockupVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 50 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.8, ease: "easeOut" }
    }
  };

  const contextMenuVariants = {
    hidden: { opacity: 0, scale: 0.9, y: -10 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.3, ease: "easeOut" }
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      y: -10,
      transition: { duration: 0.2 }
    }
  };

  return (
    <VSCodeSection id="vscode">
      <Container>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <SectionTitle variants={itemVariants}>
            VS Code Extension
          </SectionTitle>
          
          <SectionSubtitle variants={itemVariants}>
            Right-click any function and generate documentation instantly
          </SectionSubtitle>
          
          <VSCodeDemo variants={itemVariants}>
            <VSCodeMockup variants={mockupVariants}>
              <VSCodeTitlebar>
                <VSCodeButtons>
                  <VSCodeButton className="close" />
                  <VSCodeButton className="minimize" />
                  <VSCodeButton className="maximize" />
                </VSCodeButtons>
                <VSCodeTitle>main.py - Code Documentation Assistant</VSCodeTitle>
              </VSCodeTitlebar>
              
              <VSCodeContent>
                <VSCodeSidebar>
                  <VSCodeExplorer>
                    <ExplorerHeader>EXPLORER</ExplorerHeader>
                    <FileTree>
                      <FileItem>📁 src</FileItem>
                      <FileItem className="active">📄 main.py</FileItem>
                      <FileItem>📄 utils.py</FileItem>
                    </FileTree>
                  </VSCodeExplorer>
                </VSCodeSidebar>
                
                <VSCodeEditor>
                  <VSCodeTabs>
                    <VSCodeTab>main.py</VSCodeTab>
                  </VSCodeTabs>
                  
                  <CodeArea onClick={() => setShowContextMenu(!showContextMenu)}>
                    <CodeBlock>
                      <span className="keyword">def</span>{' '}
                      <span className="function">calculate_fibonacci</span>(n):{'\n'}
                      {'    '}<span className="keyword">if</span> n &lt;= <span className="string">1</span>:{'\n'}
                      {'        '}<span className="keyword">return</span> n{'\n'}
                      {'    '}<span className="keyword">return</span> <span className="function">calculate_fibonacci</span>(n-<span className="string">1</span>) + <span className="function">calculate_fibonacci</span>(n-<span className="string">2</span>)
                    </CodeBlock>
                    
                    <AnimatePresence>
                      {showContextMenu && (
                        <ContextMenu
                          variants={contextMenuVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                        >
                          <ContextMenuItem className="primary">
                            ✨ Generate Docstring
                          </ContextMenuItem>
                          <ContextMenuItem>Cut</ContextMenuItem>
                          <ContextMenuItem>Copy</ContextMenuItem>
                          <ContextMenuItem>Paste</ContextMenuItem>
                        </ContextMenu>
                      )}
                    </AnimatePresence>
                  </CodeArea>
                </VSCodeEditor>
              </VSCodeContent>
            </VSCodeMockup>
            
            <VSCodeFeatures>
              <FeaturesTitle>Extension Features</FeaturesTitle>
              <FeatureList>
                {features.map((feature, index) => (
                  <FeatureItem
                    key={index}
                    variants={itemVariants}
                    custom={index}
                  >
                    <FeatureBullet>✓</FeatureBullet>
                    {feature}
                  </FeatureItem>
                ))}
              </FeatureList>
              
              <InstallButton
                href="#"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span>📦</span>
                Install VS Code Extension
              </InstallButton>
            </VSCodeFeatures>
          </VSCodeDemo>
        </motion.div>
      </Container>
    </VSCodeSection>
  );
};

export default VSCodeSectionComponent;