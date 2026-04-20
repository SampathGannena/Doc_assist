import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const HeaderContainer = styled.header`
  background: rgba(15, 15, 35, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid ${props => props.theme.colors.border};
  position: sticky;
  top: 0;
  z-index: 100;
  transition: all 0.3s ease;
`;

const Nav = styled.nav`
  padding: 1rem 0;
`;

const NavContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    flex-direction: column;
    gap: 1rem;
    padding: 0 1rem;
  }
`;

const Logo = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const LogoIcon = styled.span`
  font-size: 2rem;
  filter: drop-shadow(0 0 10px rgba(59, 130, 246, 0.5));
`;

const LogoText = styled.h1`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${props => props.theme.colors.text.primary};
  background: linear-gradient(135deg, ${props => props.theme.colors.primary}, ${props => props.theme.colors.secondary});
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    font-size: 1.25rem;
  }
`;

const NavLinks = styled.div`
  display: flex;
  gap: 2rem;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    gap: 1rem;
  }
`;

const NavLink = styled(motion.a)`
  color: ${props => props.theme.colors.text.secondary};
  text-decoration: none;
  font-weight: 500;
  transition: all 0.3s ease;
  position: relative;
  cursor: pointer;

  &:hover {
    color: ${props => props.theme.colors.primary};
  }

  &::after {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 0;
    width: 0;
    height: 2px;
    background: linear-gradient(90deg, ${props => props.theme.colors.primary}, ${props => props.theme.colors.secondary});
    transition: width 0.3s ease;
  }

  &:hover::after {
    width: 100%;
  }
`;

const HeroSection = styled.section`
  padding: 4rem 0 6rem;
  text-align: center;
  background: radial-gradient(ellipse at center, rgba(59, 130, 246, 0.1) 0%, transparent 70%);
`;

const HeroContent = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 0 2rem;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    padding: 0 1rem;
  }
`;

const HeroTitle = styled(motion.h2)`
  font-size: 3.5rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  background: linear-gradient(135deg, ${props => props.theme.colors.text.primary}, ${props => props.theme.colors.text.secondary});
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1.2;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    font-size: 2.5rem;
  }

  @media (max-width: 480px) {
    font-size: 2rem;
  }
`;

const HeroSubtitle = styled(motion.p)`
  font-size: 1.25rem;
  color: ${props => props.theme.colors.text.muted};
  margin-bottom: 3rem;
  line-height: 1.7;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    font-size: 1.125rem;
  }
`;

const HeroStats = styled(motion.div)`
  display: flex;
  justify-content: center;
  gap: 3rem;
  margin-top: 2rem;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    flex-direction: column;
    gap: 1.5rem;
  }
`;

const Stat = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
`;

const StatNumber = styled.span`
  font-size: 2.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, ${props => props.theme.colors.primary}, ${props => props.theme.colors.secondary});
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    font-size: 2rem;
  }
`;

const StatLabel = styled.span`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.disabled};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const MobileMenuButton = styled.button`
  display: none;
  background: none;
  border: none;
  color: ${props => props.theme.colors.text.secondary};
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    display: block;
  }
`;

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  };

  const navVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  };

  const heroVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.8, delay: 0.2, ease: "easeOut" }
    }
  };

  const statsVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, delay: 0.8, ease: "easeOut" }
    }
  };

  return (
    <HeaderContainer style={{ 
      background: isScrolled ? 'rgba(15, 15, 35, 0.98)' : 'rgba(15, 15, 35, 0.95)' 
    }}>
      <Nav>
        <NavContainer>
          <Logo
            variants={navVariants}
            initial="hidden"
            animate="visible"
          >
            <LogoIcon>📚</LogoIcon>
            <LogoText>Code Documentation Assistant</LogoText>
          </Logo>
          
          <NavLinks>
            <NavLink
              onClick={() => scrollToSection('demo')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Demo
            </NavLink>
            <NavLink
              onClick={() => scrollToSection('features')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Features
            </NavLink>
            <NavLink
              onClick={() => scrollToSection('vscode')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              VS Code Extension
            </NavLink>
            <NavLink
              as={Link}
              to="/app/dashboard"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Open Workspace
            </NavLink>
          </NavLinks>
        </NavContainer>
      </Nav>

      <HeroSection>
        <HeroContent>
          <HeroTitle
            variants={heroVariants}
            initial="hidden"
            animate="visible"
          >
            AI-Powered Code Documentation
          </HeroTitle>
          
          <HeroSubtitle
            variants={heroVariants}
            initial="hidden"
            animate="visible"
          >
            Transform your functions into well-documented code with intelligent docstring generation. 
            Powered by advanced NLP models like CodeT5 and GPT.
          </HeroSubtitle>
          
          <HeroStats
            variants={statsVariants}
            initial="hidden"
            animate="visible"
          >
            <Stat>
              <StatNumber>10x</StatNumber>
              <StatLabel>Faster Documentation</StatLabel>
            </Stat>
            <Stat>
              <StatNumber>99%</StatNumber>
              <StatLabel>Accuracy Rate</StatLabel>
            </Stat>
            <Stat>
              <StatNumber>50+</StatNumber>
              <StatLabel>Languages Supported</StatLabel>
            </Stat>
          </HeroStats>
        </HeroContent>
      </HeroSection>
    </HeaderContainer>
  );
};

export default Header;