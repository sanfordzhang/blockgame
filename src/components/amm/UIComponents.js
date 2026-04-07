/**
 * AMM UI Components
 * Reusable UI components for AMM interface
 */

import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';

// ==================== Error Alert ====================
const ErrorAlertContainer = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: #fff5f5;
  border: 1px solid #fc8181;
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
  margin-bottom: 1rem;
`;

const ErrorIcon = styled.span`
  color: #e53e3e;
  font-size: 1.25rem;
  flex-shrink: 0;
`;

const ErrorContent = styled.div`
  flex: 1;
`;

const ErrorTitle = styled.div`
  font-weight: 600;
  color: #c53030;
  margin-bottom: 0.25rem;
`;

const ErrorMessage = styled.div`
  font-size: 0.875rem;
  color: #742a2a;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: #c53030;
  cursor: pointer;
  padding: 0.25rem;
  font-size: 1.25rem;
  line-height: 1;

  &:hover {
    color: #9b2c2c;
  }
`;

export const ErrorAlert = ({ title, message, onClose }) => {
  return (
    <ErrorAlertContainer>
      <ErrorIcon>⚠️</ErrorIcon>
      <ErrorContent>
        {title && <ErrorTitle>{title}</ErrorTitle>}
        <ErrorMessage>{message}</ErrorMessage>
      </ErrorContent>
      {onClose && (
        <CloseButton onClick={onClose}>×</CloseButton>
      )}
    </ErrorAlertContainer>
  );
};

// ==================== Loading Spinner ====================
const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const SpinnerContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${props => props.fullPage ? '4rem' : '2rem'};
  min-height: ${props => props.fullPage ? '200px' : 'auto'};
`;

const SpinnerRing = styled.div`
  width: ${props => props.size || '40px'};
  height: ${props => props.size || '40px'};
  border: 3px solid ${(props) => props.theme.colors.border};
  border-top-color: ${(props) => props.theme.colors.primaryCta};
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
`;

const LoadingText = styled.div`
  margin-top: 1rem;
  color: ${(props) => props.theme.colors.textSecondary};
  font-size: 0.9rem;
`;

export const LoadingSpinner = ({ text, size, fullPage }) => {
  return (
    <SpinnerContainer fullPage={fullPage}>
      <SpinnerRing size={size} />
      {text && <LoadingText>{text}</LoadingText>}
    </SpinnerContainer>
  );
};

// ==================== Skeleton Loader ====================
const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const SkeletonBase = styled.div`
  background: linear-gradient(90deg, 
    ${(props) => props.theme.colors.border} 25%, 
    ${(props) => props.theme.colors.playingCardBg} 50%, 
    ${(props) => props.theme.colors.border} 75%
  );
  background-size: 200% 100%;
  animation: ${shimmer} 1.5s infinite;
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
`;

export const Skeleton = styled(SkeletonBase)`
  width: ${props => props.width || '100%'};
  height: ${props => props.height || '20px'};
  margin-bottom: ${props => props.mb || '0.5rem'};
`;

export const SkeletonCard = styled(SkeletonBase)`
  height: ${props => props.height || '120px'};
  margin-bottom: 1rem;
`;

// ==================== Tooltip ====================
const TooltipContainer = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
`;

const TooltipIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: ${(props) => props.theme.colors.border};
  color: ${(props) => props.theme.colors.textSecondary};
  font-size: 10px;
  font-weight: bold;
  cursor: help;
  margin-left: 4px;
  
  &:hover + div {
    opacity: 1;
    visibility: visible;
  }
`;

const TooltipContent = styled.div`
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 0.5rem 0.75rem;
  background: ${(props) => props.theme.colors.textPrimary};
  color: white;
  font-size: 0.75rem;
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
  z-index: 100;
  
  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: ${(props) => props.theme.colors.textPrimary};
  }
`;

export const Tooltip = ({ text }) => {
  return (
    <TooltipContainer>
      <TooltipIcon>?</TooltipIcon>
      <TooltipContent>{text}</TooltipContent>
    </TooltipContainer>
  );
};

// ==================== Input Field ====================
const InputContainer = styled.div`
  margin-bottom: 1rem;
`;

const InputLabel = styled.label`
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: ${(props) => props.theme.colors.textSecondary};
`;

const InputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const StyledInput = styled.input`
  width: 100%;
  padding: ${props => props.hasSuffix ? '0.75rem 80px 0.75rem 1rem' : '0.75rem 1rem'};
  border: 1px solid ${(props) => props.error ? '#e53e3e' : props.theme.colors.border};
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
  font-size: 1rem;
  background: ${(props) => props.theme.colors.playingCardBg};
  color: ${(props) => props.theme.colors.textPrimary};
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: ${(props) => props.theme.colors.primaryCta};
  }

  &:disabled {
    background: ${(props) => props.theme.colors.border};
    cursor: not-allowed;
  }
`;

const InputSuffix = styled.div`
  position: absolute;
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const MaxButton = styled.button`
  background: ${(props) => props.theme.colors.primaryCta};
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  
  &:hover {
    opacity: 0.8;
  }
`;

const InputError = styled.div`
  color: #e53e3e;
  font-size: 0.75rem;
  margin-top: 0.25rem;
`;

export const InputField = ({ 
  label, 
  value, 
  onChange, 
  placeholder, 
  type = 'text',
  suffix,
  showMax,
  maxAmount,
  error,
  disabled,
  tooltip
}) => {
  return (
    <InputContainer>
      {label && (
        <InputLabel>
          {label}
          {tooltip && <Tooltip text={tooltip} />}
        </InputLabel>
      )}
      <InputWrapper>
        <StyledInput
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          error={error}
          hasSuffix={suffix || showMax}
        />
        {(suffix || showMax) && (
          <InputSuffix>
            {showMax && (
              <MaxButton onClick={() => onChange({ target: { value: maxAmount } })}>
                MAX
              </MaxButton>
            )}
            {suffix}
          </InputSuffix>
        )}
      </InputWrapper>
      {error && <InputError>{error}</InputError>}
    </InputContainer>
  );
};

// ==================== Slippage Settings ====================
const SlippageContainer = styled.div`
  margin-bottom: 1rem;
`;

const SlippageLabel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: ${(props) => props.theme.colors.textSecondary};
`;

const SlippageOptions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const SlippageOption = styled.button`
  flex: 1;
  padding: 0.5rem;
  border: 1px solid ${props => props.active ? props.theme.colors.primaryCta : props.theme.colors.border};
  background: ${props => props.active ? props.theme.colors.primaryCta : 'transparent'};
  color: ${props => props.active ? 'white' : props.theme.colors.textPrimary};
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;

  &:hover {
    border-color: ${(props) => props.theme.colors.primaryCta};
  }
`;

const SlippageCustomInput = styled.input`
  width: 80px;
  padding: 0.5rem;
  border: 1px solid ${props => props.error ? '#e53e3e' : props.theme.colors.border};
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
  font-size: 0.85rem;
  text-align: center;
  background: ${(props) => props.theme.colors.playingCardBg};
  color: ${(props) => props.theme.colors.textPrimary};

  &:focus {
    outline: none;
    border-color: ${(props) => props.theme.colors.primaryCta};
  }
`;

const SlippageWarning = styled.div`
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: ${props => props.type === 'high' ? '#e53e3e' : '#f56500'};
`;

export const SlippageSettings = ({ value, onChange }) => {
  const presets = [0.5, 1, 2];
  const [customValue, setCustomValue] = useState('');
  
  const isPreset = presets.includes(value);
  const isHigh = value > 2;
  const isLow = value < 0.5;

  const handleCustomChange = (e) => {
    const val = e.target.value;
    setCustomValue(val);
    const numVal = parseFloat(val);
    if (!isNaN(numVal) && numVal >= 0) {
      onChange(numVal);
    }
  };

  return (
    <SlippageContainer>
      <SlippageLabel>
        <span>Slippage Tolerance</span>
        {isHigh && <SlippageWarning type="high">High slippage risk!</SlippageWarning>}
      </SlippageLabel>
      <SlippageOptions>
        {presets.map(preset => (
          <SlippageOption
            key={preset}
            active={value === preset}
            onClick={() => {
              onChange(preset);
              setCustomValue('');
            }}
          >
            {preset}%
          </SlippageOption>
        ))}
        <SlippageCustomInput
          placeholder="Custom"
          value={isPreset ? '' : customValue || value}
          onChange={handleCustomChange}
          error={!isPreset && (isHigh || isLow)}
        />
        <span style={{ alignSelf: 'center', color: '#666' }}>%</span>
      </SlippageOptions>
      {isLow && !isHigh && (
        <SlippageWarning type="low">Your transaction may fail</SlippageWarning>
      )}
    </SlippageContainer>
  );
};

// ==================== Confirmation Modal ====================
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: ${(props) => props.theme.colors.playingCardBg};
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
  padding: 1.5rem;
  width: 90%;
  max-width: 420px;
  max-height: 90vh;
  overflow-y: auto;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.25rem;
`;

const ModalCloseButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: ${(props) => props.theme.colors.textSecondary};
  
  &:hover {
    color: ${(props) => props.theme.colors.textPrimary};
  }
`;

const ModalBody = styled.div`
  margin-bottom: 1.5rem;
`;

const ModalFooter = styled.div`
  display: flex;
  gap: 1rem;
`;

const ModalButton = styled.button`
  flex: 1;
  padding: 0.75rem 1rem;
  border: ${props => props.primary ? 'none' : `1px solid ${props.theme.colors.border}`};
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
  background: ${props => props.primary ? props.theme.colors.primaryCta : 'transparent'};
  color: ${props => props.primary ? 'white' : props.theme.colors.textPrimary};
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const ConfirmModal = ({ isOpen, onClose, onConfirm, title, children, confirmText, loading }) => {
  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>{title}</ModalTitle>
          <ModalCloseButton onClick={onClose}>×</ModalCloseButton>
        </ModalHeader>
        <ModalBody>
          {children}
        </ModalBody>
        <ModalFooter>
          <ModalButton onClick={onClose}>Cancel</ModalButton>
          <ModalButton primary onClick={onConfirm} disabled={loading}>
            {loading ? <LoadingSpinner size="20px" /> : confirmText}
          </ModalButton>
        </ModalFooter>
      </ModalContent>
    </ModalOverlay>
  );
};

// ==================== Transaction Status ====================
const StatusContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: ${props => {
    switch(props.status) {
      case 'success': return '#f0fff4';
      case 'error': return '#fff5f5';
      case 'pending': return '#fffaf0';
      default: return props.theme.colors.playingCardBg;
    }
  }};
  border: 1px solid ${props => {
    switch(props.status) {
      case 'success': return '#9ae6b4';
      case 'error': return '#fc8181';
      case 'pending': return '#fbd38d';
      default: return props.theme.colors.border;
    }
  }};
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
  margin-bottom: 1rem;
`;

const StatusIcon = styled.span`
  font-size: 1.5rem;
`;

const StatusText = styled.div`
  flex: 1;
`;

const StatusTitle = styled.div`
  font-weight: 600;
  color: ${props => {
    switch(props.status) {
      case 'success': return '#276749';
      case 'error': return '#c53030';
      case 'pending': return '#c05621';
      default: return props.theme.colors.textPrimary;
    }
  }};
`;

const StatusMessage = styled.div`
  font-size: 0.85rem;
  color: ${props => {
    switch(props.status) {
      case 'success': return '#2f855a';
      case 'error': return '#742a2a';
      case 'pending': return '#975a16';
      default: return props.theme.colors.textSecondary;
    }
  }};
`;

export const TransactionStatus = ({ status, title, message, txHash, network }) => {
  const icons = {
    success: '✅',
    error: '❌',
    pending: '⏳'
  };

  const explorerUrl = network === 'mainnet' 
    ? 'https://tronscan.org/#/transaction/' 
    : 'https://nile.tronscan.org/#/transaction/';

  return (
    <StatusContainer status={status}>
      <StatusIcon>{icons[status]}</StatusIcon>
      <StatusText>
        <StatusTitle status={status}>{title}</StatusTitle>
        <StatusMessage status={status}>
          {message}
          {txHash && (
            <>
              <br />
              <a 
                href={`${explorerUrl}${txHash}`} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#3182ce' }}
              >
                View on TronScan
              </a>
            </>
          )}
        </StatusMessage>
      </StatusText>
    </StatusContainer>
  );
};

export default {
  ErrorAlert,
  LoadingSpinner,
  Skeleton,
  SkeletonCard,
  Tooltip,
  InputField,
  SlippageSettings,
  ConfirmModal,
  TransactionStatus
};
