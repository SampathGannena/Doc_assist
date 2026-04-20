import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const ExamplesSection = styled.section`
  padding: 6rem 0;
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

const ExamplesGrid = styled(motion.div)`
  margin-top: 3rem;
`;

const ExampleCard = styled(motion.div)`
  background: ${props => props.theme.colors.background.card};
  border-radius: 1rem;
  padding: 2rem;
  border: 1px solid ${props => props.theme.colors.border};
  margin-bottom: 3rem;
  backdrop-filter: blur(10px);
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const ExampleTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  color: ${props => props.theme.colors.text.primary};
  text-align: center;
`;

const BeforeAfter = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
`;

const CodeSection = styled.div`
  background: ${props => props.theme.colors.background.input};
  border-radius: 0.5rem;
  padding: 1rem;
  border: 1px solid ${props => props.theme.colors.border};
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: ${props => props.isAfter 
      ? 'linear-gradient(90deg, #10b981, #059669)'
      : 'linear-gradient(90deg, #ef4444, #dc2626)'
    };
  }
`;

const CodeSectionTitle = styled.h4`
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: ${props => props.isAfter ? '#10b981' : '#ef4444'};
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &::before {
    content: ${props => props.isAfter ? '"✅"' : '"❌"'};
  }
`;

const CodeContainer = styled.div`
  font-family: ${props => props.theme.fonts.mono};
  font-size: 0.75rem;
  line-height: 1.4;
  overflow-x: auto;

  /* Custom scrollbar for code container */
  &::-webkit-scrollbar {
    height: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }
`;

const Examples = () => {
  const examples = [
    {
      title: 'Python Function Enhancement',
      language: 'python',
      before: `def merge_sorted_arrays(arr1, arr2):
    result = []
    i, j = 0, 0
    while i < len(arr1) and j < len(arr2):
        if arr1[i] <= arr2[j]:
            result.append(arr1[i])
            i += 1
        else:
            result.append(arr2[j])
            j += 1
    result.extend(arr1[i:])
    result.extend(arr2[j:])
    return result`,
      after: `def merge_sorted_arrays(arr1, arr2):
    """
    Merges two sorted arrays into a single sorted array.
    
    This function takes two pre-sorted arrays and combines them
    into one sorted array using the merge algorithm from merge sort.
    
    Args:
        arr1 (list): First sorted array of comparable elements
        arr2 (list): Second sorted array of comparable elements
    
    Returns:
        list: A new sorted array containing all elements from both
              input arrays
    
    Example:
        >>> merge_sorted_arrays([1, 3, 5], [2, 4, 6])
        [1, 2, 3, 4, 5, 6]
    """
    result = []
    i, j = 0, 0
    while i < len(arr1) and j < len(arr2):
        if arr1[i] <= arr2[j]:
            result.append(arr1[i])
            i += 1
        else:
            result.append(arr2[j])
            j += 1
    result.extend(arr1[i:])
    result.extend(arr2[j:])
    return result`
    },
    {
      title: 'JavaScript Function Documentation',
      language: 'javascript',
      before: `function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}`,
      after: `/**
 * Creates a throttled function that only invokes func at most once per every limit milliseconds.
 *
 * @param {Function} func - The function to throttle
 * @param {number} limit - The number of milliseconds to throttle invocations to
 * @returns {Function} The throttled function
 *
 * @example
 * const throttledScroll = throttle(handleScroll, 100);
 * window.addEventListener('scroll', throttledScroll);
 */
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}`
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.8,
        staggerChildren: 0.3
      }
    }
  };

  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: 50,
      scale: 0.95
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.8,
        ease: "easeOut"
      }
    }
  };

  const titleVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: "easeOut"
      }
    }
  };

  return (
    <ExamplesSection id="examples">
      <Container>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <SectionTitle variants={titleVariants}>
            Before & After Examples
          </SectionTitle>
          
          <ExamplesGrid>
            {examples.map((example, index) => (
              <ExampleCard
                key={index}
                variants={cardVariants}
                whileHover={{ 
                  scale: 1.01,
                  transition: { duration: 0.2 }
                }}
              >
                <ExampleTitle>{example.title}</ExampleTitle>
                
                <BeforeAfter>
                  <CodeSection isAfter={false}>
                    <CodeSectionTitle isAfter={false}>
                      Before - Undocumented Code
                    </CodeSectionTitle>
                    <CodeContainer>
                      <SyntaxHighlighter
                        language={example.language}
                        style={vscDarkPlus}
                        customStyle={{
                          background: 'transparent',
                          padding: 0,
                          margin: 0,
                          fontSize: '0.75rem',
                          lineHeight: '1.4',
                        }}
                      >
                        {example.before}
                      </SyntaxHighlighter>
                    </CodeContainer>
                  </CodeSection>
                  
                  <CodeSection isAfter={true}>
                    <CodeSectionTitle isAfter={true}>
                      After - AI Generated Documentation
                    </CodeSectionTitle>
                    <CodeContainer>
                      <SyntaxHighlighter
                        language={example.language}
                        style={vscDarkPlus}
                        customStyle={{
                          background: 'transparent',
                          padding: 0,
                          margin: 0,
                          fontSize: '0.75rem',
                          lineHeight: '1.4',
                        }}
                      >
                        {example.after}
                      </SyntaxHighlighter>
                    </CodeContainer>
                  </CodeSection>
                </BeforeAfter>
              </ExampleCard>
            ))}
          </ExamplesGrid>
        </motion.div>
      </Container>
    </ExamplesSection>
  );
};

export default Examples;