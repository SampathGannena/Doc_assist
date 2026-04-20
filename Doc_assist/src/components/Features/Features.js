import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const FeaturesSection = styled.section`
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

const FeaturesGrid = styled(motion.div)`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  margin-top: 3rem;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
`;

const FeatureCard = styled(motion.div)`
  background: ${props => props.theme.colors.background.card};
  backdrop-filter: blur(10px);
  border-radius: 1rem;
  padding: 2rem;
  border: 1px solid ${props => props.theme.colors.border};
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, ${props => props.theme.colors.primary}, ${props => props.theme.colors.secondary});
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 20px 40px ${props => props.theme.colors.shadow};
    border-color: rgba(59, 130, 246, 0.3);

    &::before {
      opacity: 1;
    }
  }
`;

const FeatureIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
  filter: drop-shadow(0 0 10px rgba(59, 130, 246, 0.3));
  display: flex;
  align-items: center;
  justify-content: flex-start;
`;

const FeatureTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: ${props => props.theme.colors.text.primary};
`;

const FeatureDescription = styled.p`
  color: ${props => props.theme.colors.text.muted};
  line-height: 1.6;
  font-size: 0.95rem;
`;

const Features = () => {
  const features = [
    {
      icon: '🧠',
      title: 'Smart Analysis',
      description: 'Advanced NLP models analyze your code structure, parameter types, and logic flow to generate accurate documentation.'
    },
    {
      icon: '⚡',
      title: 'Instant Generation',
      description: 'Get comprehensive docstrings in seconds. No more manual documentation writing that slows down development.'
    },
    {
      icon: '🎯',
      title: 'Context Aware',
      description: 'Understands function context, parameter relationships, and return values to create meaningful documentation.'
    },
    {
      icon: '🔧',
      title: 'Multi-Language',
      description: 'Supports Python, JavaScript, Java, C++, C#, and many more programming languages with native conventions.'
    },
    {
      icon: '📝',
      title: 'Standard Formats',
      description: 'Generates documentation in standard formats like Google, NumPy, or Sphinx docstring styles.'
    },
    {
      icon: '🚀',
      title: 'IDE Integration',
      description: 'Seamlessly integrates with VS Code, PyCharm, and other popular IDEs as extensions.'
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: 50,
      scale: 0.9
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.6,
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
    <FeaturesSection id="features">
      <Container>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <SectionTitle variants={titleVariants}>
            Intelligent Features
          </SectionTitle>
          
          <FeaturesGrid variants={containerVariants}>
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                variants={cardVariants}
                whileHover={{ 
                  scale: 1.02,
                  transition: { duration: 0.2 }
                }}
              >
                <FeatureIcon>{feature.icon}</FeatureIcon>
                <FeatureTitle>{feature.title}</FeatureTitle>
                <FeatureDescription>{feature.description}</FeatureDescription>
              </FeatureCard>
            ))}
          </FeaturesGrid>
        </motion.div>
      </Container>
    </FeaturesSection>
  );
};

export default Features;