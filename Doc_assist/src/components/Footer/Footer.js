import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const FooterContainer = styled.footer`
  background: rgba(15, 15, 35, 0.95);
  border-top: 1px solid ${props => props.theme.colors.border};
  margin-top: 4rem;
  padding: 3rem 0 1rem;
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

const FooterContent = styled(motion.div)`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 3rem;
  margin-bottom: 2rem;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
    text-align: center;
    gap: 2rem;
  }
`;

const FooterSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const FooterTitle = styled.h3`
  color: ${props => props.theme.colors.text.primary};
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
`;

const FooterSubtitle = styled.h4`
  color: ${props => props.theme.colors.text.primary};
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
`;

const FooterDescription = styled.p`
  color: ${props => props.theme.colors.text.muted};
  line-height: 1.6;
  font-size: 0.95rem;
`;

const FooterLink = styled(motion.a)`
  color: ${props => props.theme.colors.text.muted};
  text-decoration: none;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  cursor: pointer;
  display: block;
  padding: 0.25rem 0;

  &:hover {
    color: ${props => props.theme.colors.primary};
    transform: translateX(4px);
  }
`;

const FooterBottom = styled(motion.div)`
  text-align: center;
  padding-top: 2rem;
  border-top: 1px solid ${props => props.theme.colors.border};
  color: ${props => props.theme.colors.text.disabled};
  font-size: 0.875rem;
`;

const SocialLinks = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 1rem;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    justify-content: center;
  }
`;

const SocialLink = styled(motion.a)`
  color: ${props => props.theme.colors.text.muted};
  font-size: 1.5rem;
  transition: all 0.3s ease;
  cursor: pointer;

  &:hover {
    color: ${props => props.theme.colors.primary};
    transform: translateY(-2px);
  }
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    justify-content: center;
  }
`;

const LogoIcon = styled.span`
  font-size: 1.5rem;
  filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.3));
`;

const LogoText = styled.span`
  font-size: 1.125rem;
  font-weight: 600;
  background: linear-gradient(135deg, ${props => props.theme.colors.primary}, ${props => props.theme.colors.secondary});
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const Footer = () => {
  const footerVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: "easeOut",
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

  const handleLinkClick = (section) => {
    if (section.startsWith('#')) {
      const element = document.getElementById(section.substring(1));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <FooterContainer>
      <Container>
        <motion.div
          variants={footerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <FooterContent>
            <FooterSection>
              <Logo>
                <LogoIcon>📚</LogoIcon>
                <LogoText>Code Documentation Assistant</LogoText>
              </Logo>
              <FooterDescription>
                Making code documentation effortless with AI-powered generation. 
                Transform your functions into well-documented, maintainable code with 
                intelligent docstring generation powered by advanced NLP models.
              </FooterDescription>
              <SocialLinks>
                <SocialLink
                  href="#"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  title="GitHub"
                >
                  🐙
                </SocialLink>
                <SocialLink
                  href="#"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  title="Twitter"
                >
                  🐦
                </SocialLink>
                <SocialLink
                  href="#"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  title="LinkedIn"
                >
                  💼
                </SocialLink>
                <SocialLink
                  href="#"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  title="Discord"
                >
                  💬
                </SocialLink>
              </SocialLinks>
            </FooterSection>
            
            <FooterSection>
              <FooterSubtitle>Quick Links</FooterSubtitle>
              <FooterLink
                onClick={() => handleLinkClick('#demo')}
                whileHover={{ x: 4 }}
              >
                Live Demo
              </FooterLink>
              <FooterLink
                onClick={() => handleLinkClick('#features')}
                whileHover={{ x: 4 }}
              >
                Features
              </FooterLink>
              <FooterLink
                onClick={() => handleLinkClick('#vscode')}
                whileHover={{ x: 4 }}
              >
                VS Code Extension
              </FooterLink>
              <FooterLink
                onClick={() => handleLinkClick('#examples')}
                whileHover={{ x: 4 }}
              >
                Examples
              </FooterLink>
              <FooterLink
                href="#"
                whileHover={{ x: 4 }}
              >
                API Documentation
              </FooterLink>
            </FooterSection>
            
            <FooterSection>
              <FooterSubtitle>Support & Resources</FooterSubtitle>
              <FooterLink
                href="#"
                whileHover={{ x: 4 }}
              >
                Help Center
              </FooterLink>
              <FooterLink
                href="#"
                whileHover={{ x: 4 }}
              >
                GitHub Repository
              </FooterLink>
              <FooterLink
                href="#"
                whileHover={{ x: 4 }}
              >
                Issue Tracker
              </FooterLink>
              <FooterLink
                href="#"
                whileHover={{ x: 4 }}
              >
                Contributing Guide
              </FooterLink>
              <FooterLink
                href="#"
                whileHover={{ x: 4 }}
              >
                Contact Us
              </FooterLink>
            </FooterSection>
          </FooterContent>
          
          <FooterBottom variants={itemVariants}>
            <p>
              &copy; 2025 Code Documentation Assistant. Built with ❤️ for developers worldwide.
              <br />
              <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                Powered by React, Styled Components, and Framer Motion
              </span>
            </p>
          </FooterBottom>
        </motion.div>
      </Container>
    </FooterContainer>
  );
};

export default Footer;