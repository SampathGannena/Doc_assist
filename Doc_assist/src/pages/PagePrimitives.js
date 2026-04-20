import styled from 'styled-components';
import { motion } from 'framer-motion';

export const WorkspacePage = styled.div`
  padding: 2rem;

  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    padding: 1rem;
  }
`;

export const PageTop = styled.div`
  margin-bottom: 1.5rem;
`;

export const PageTitle = styled.h1`
  color: ${props => props.theme.colors.text.primary};
  font-size: 1.75rem;
  margin-bottom: 0.5rem;
`;

export const PageDescription = styled.p`
  color: ${props => props.theme.colors.text.muted};
  max-width: 900px;
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
`;

export const Card = styled(motion.section)`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 0.75rem;
  padding: 1rem;
`;

export const CardTitle = styled.h2`
  color: ${props => props.theme.colors.text.primary};
  font-size: 1rem;
  margin-bottom: 0.75rem;
`;

export const MutedText = styled.p`
  color: ${props => props.theme.colors.text.muted};
  font-size: 0.9rem;
`;

export const Metric = styled.p`
  color: ${props => props.theme.colors.text.primary};
  font-size: 1.8rem;
  font-weight: 700;
  margin: 0;
`;

export const Label = styled.label`
  color: ${props => props.theme.colors.text.secondary};
  font-size: 0.9rem;
  font-weight: 500;
  display: block;
  margin-bottom: 0.35rem;
`;

export const Input = styled.input`
  width: 100%;
  padding: 0.7rem 0.8rem;
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid ${props => props.theme.colors.border};
  color: ${props => props.theme.colors.text.primary};
`;

export const Select = styled.select`
  width: 100%;
  padding: 0.7rem 0.8rem;
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid ${props => props.theme.colors.border};
  color: ${props => props.theme.colors.text.primary};
`;

export const Textarea = styled.textarea`
  width: 100%;
  min-height: 160px;
  padding: 0.7rem 0.8rem;
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid ${props => props.theme.colors.border};
  color: ${props => props.theme.colors.text.primary};
  resize: vertical;
  font-family: ${props => props.theme.fonts.mono};
`;

export const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: ${props => props.theme.colors.text.secondary};
  margin-bottom: 0.6rem;
`;

export const InlineRow = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

export const Button = styled.button`
  border: 1px solid ${props => props.theme.colors.border};
  background: rgba(255, 255, 255, 0.05);
  color: ${props => props.theme.colors.text.primary};
  border-radius: 0.5rem;
  padding: 0.65rem 0.9rem;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export const PrimaryButton = styled(Button)`
  border: none;
  background: linear-gradient(135deg, ${props => props.theme.colors.primary}, ${props => props.theme.colors.secondary});
`;

export const DangerButton = styled(Button)`
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.35);
`;

export const LinkButton = styled(Button)`
  text-decoration: none;
  display: inline-flex;
  align-items: center;
`;

export const TableWrap = styled.div`
  width: 100%;
  overflow-x: auto;
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    border-bottom: 1px solid ${props => props.theme.colors.border};
    text-align: left;
    padding: 0.7rem 0.5rem;
    color: ${props => props.theme.colors.text.secondary};
    font-size: 0.9rem;
    vertical-align: top;
  }

  th {
    color: ${props => props.theme.colors.text.primary};
    font-weight: 600;
  }
`;

export const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.2rem 0.6rem;
  font-size: 0.8rem;
  font-weight: 600;
  background: ${({ status }) => {
    if (status === 'healthy' || status === 'success') {
      return 'rgba(16, 185, 129, 0.18)';
    }
    if (status === 'warning' || status === 'degraded') {
      return 'rgba(245, 158, 11, 0.2)';
    }
    if (status === 'error') {
      return 'rgba(239, 68, 68, 0.2)';
    }
    return 'rgba(148, 163, 184, 0.2)';
  }};
  color: ${({ status }) => {
    if (status === 'healthy' || status === 'success') {
      return '#34d399';
    }
    if (status === 'warning' || status === 'degraded') {
      return '#fbbf24';
    }
    if (status === 'error') {
      return '#f87171';
    }
    return '#cbd5e1';
  }};
`;

export const EmptyState = styled.div`
  border: 1px dashed ${props => props.theme.colors.border};
  border-radius: 0.75rem;
  padding: 1.25rem;
  color: ${props => props.theme.colors.text.muted};
`;

export const PreBlock = styled.pre`
  border: 1px solid ${props => props.theme.colors.border};
  background: rgba(0, 0, 0, 0.25);
  border-radius: 0.65rem;
  padding: 0.8rem;
  color: ${props => props.theme.colors.text.secondary};
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 320px;
  overflow: auto;
`;
