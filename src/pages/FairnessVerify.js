/**
 * FairnessVerify — Verifiable Fairness Page
 * Allows players to verify any hand's fairness using commitment-reveal + DA proof.
 *
 * Route: /fairness-verify
 */

import React, { useState, useContext, useCallback } from 'react';
import Container from '../components/layout/Container';
import CenteredBlock from '../components/layout/CenteredBlock';
import Heading from '../components/typography/Heading';
import Button from '../components/buttons/Button';
import styled from 'styled-components';
import useScrollToTopOnPageLoad from '../hooks/useScrollToTopOnPageLoad';
import socketContext from '../context/websocket/socketContext';
import globalContext from '../context/global/globalContext';

const VerifyPanel = styled.div`
  background: #16213e;
  border-radius: 12px;
  padding: 2rem;
  max-width: 700px;
  margin: 0 auto;
  border: 1px solid #1a3a5c;
`;

const InputRow = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;

  @media (max-width: 600px) {
    flex-direction: column;
  }
`;

const StyledInput = styled.input`
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid #2a4a6c;
  background: #0f1929;
  color: #fff;
  font-size: 1rem;
  font-family: monospace;

  &:focus {
    outline: none;
    border-color: #4ecca3;
    box-shadow: 0 0 0 2px rgba(78, 204, 163, 0.15);
  }
`;

const StepCard = styled.div`
  background: #0f1929;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  margin-bottom: 0.75rem;
  border-left: 3px solid ${props => {
    if (props.status === 'pass') return '#4ecca3';
    if (props.status === 'fail') return '#ff4444';
    if (props.status === 'pending') return '#f0883e';
    return '#4a6a8c';
  }};
`;

const StatusBadge = styled.span`
  display: inline-block;
  padding: 0.15rem 0.6rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  background: ${props => {
    if (props.status === 'pass') return 'rgba(78, 204, 163, 0.15)';
    if (props.status === 'fail') return 'rgba(255, 68, 68, 0.15)';
    if (props.status === 'pending') return 'rgba(240, 136, 62, 0.15)';
    return 'rgba(74, 106, 140, 0.15)';
  }};
  color: ${props => {
    if (props.status === 'pass') return '#4ecca3';
    if (props.status === 'fail') return '#ff4444';
    if (props.status === 'pending') return '#f0883e';
    return '#8899aa';
  }};
  margin-left: 0.5rem;
`;

const ShieldIcon = () => (
  <span role="img" aria-label="shield" style={{ fontSize: '1.5em', marginRight: '0.5em' }}>🛡️</span>
);

const FairnessVerify = () => {
  const { socket } = useContext(socketContext);
  const [handId, setHandId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useScrollToTopOnPageLoad();

  const handleVerify = useCallback(async () => {
    if (!handId.trim()) return;

    setVerifying(true);
    setError(null);
    setResult(null);

    try {
      // Call backend fairness verification API
      const response = await fetch(`/api/0g/fairness-verify/${encodeURIComponent(handId.trim())}`);
      const data = await response.json();

      if (data.success || data.commitment) {
        setResult(data);
      } else {
        // If API not available, show offline verification instructions
        setResult({
          handId,
          message: 'Use the CLI tool for offline verification',
          steps: [
            { label: 'Seed Commitment', status: 'pending', desc: 'Pre-deal commitment hash' },
            { label: 'Shuffle Replay', status: 'pending', desc: 'Replay card shuffle with revealed seed' },
            { label: 'State Hash', status: 'pending', desc: 'Game result SHA-256' },
            { label: 'DA Anchor', status: 'pending', desc: 'Data Availability proof on 0G chain' }
          ]
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  }, [handId]);

  return (
    <Container>
      <CenteredBlock>
        <Heading as="h2">
          <ShieldIcon />Verifiable Fairness
        </Heading>
        <p style={{ color: '#8899aa', marginBottom: '2rem', textAlign: 'center' }}>
          Verify that any poker hand was dealt fairly using cryptographic proof.
          Every hand uses a commitment-reveal scheme anchored to the Data Availability layer.
        </p>

        <VerifyPanel>
          <InputRow>
            <StyledInput
              type="text"
              placeholder="Enter Hand ID (e.g., hand_1701234567)"
              value={handId}
              onChange={(e) => setHandId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleVerify()}
              autoFocus
            />
            <Button primary onClick={handleVerify} disabled={verifying || !handId.trim()}>
              {verifying ? 'Verifying...' : 'Verify Hand'}
            </Button>
          </InputRow>

          {error && (
            <StepCard status="fail">
              <strong>Error:</strong> {error}
            </StepCard>
          )}

          {result && (
            <div>
              {/* Overall Result */}
              <StepCard status={result.allValid !== undefined ? (result.allValid ? 'pass' : 'fail') : 'pending'}>
                <strong>Hand ID:</strong> {result.handId || handId}
                <StatusBadge status={result.allValid !== undefined ? (result.allValid ? 'pass' : 'fail') : 'pending'}>
                  {result.allValid === true ? 'VERIFIED' : result.allValid === false ? 'FAILED' : 'PENDING'}
                </StatusBadge>
                {result.message && <p style={{ marginTop: '0.5rem', color: '#aaa' }}>{result.message}</p>}
              </StepCard>

              {/* Verification Steps */}
              {(result.steps || []).map((step, i) => (
                <StepCard key={i} status={step.status}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>Step {i + 1}: {step.label}</strong>
                    <StatusBadge status={step.status}>{step.status.toUpperCase()}</StatusBadge>
                  </div>
                  {step.desc && <p style={{ marginTop: '0.25rem', color: '#8899aa', marginBottom: 0 }}>{step.desc}</p>}
                  {step.value && (
                    <code style={{
                      display: 'block', marginTop: '0.5rem',
                      padding: '0.5rem', background: '#0a1220', borderRadius: 4,
                      fontSize: '0.8rem', wordBreak: 'break-all', color: '#4ecca3'
                    }}>
                      {typeof step.value === 'string' && step.value.length > 60
                        ? step.value.slice(0, 60) + '...'
                        : JSON.stringify(step.value)
                      }
                    </code>
                  )}
                </StepCard>
              ))}

              {/* DA Proof Info */}
              {result.daProof && (
                <StepCard status={result.daProof.verified ? 'pass' : 'pending'}>
                  <strong>Data Availability Proof</strong>
                  <StatusBadge status={result.daProof.verified ? 'pass' : 'pending'}>
                    {result.daProof.verified ? 'ANCHORED' : 'PENDING'}
                  </StatusBadge>
                  {result.daProof.batchIndex && (
                    <p style={{ marginTop: '0.25rem', color: '#8899aa', marginBottom: 0 }}>
                      Batch #{result.daProof.batchIndex} on 0G DA layer | Tx: {result.daProof.txHash?.slice(0, 18)}...
                    </p>
                  )}
                </StepCard>
              )}

              {/* Commitment Data */}
              {result.commitmentData && (
                <details style={{ marginTop: '1rem' }}>
                  <summary style={{ cursor: 'pointer', color: '#4ecca3' }}>Raw Cryptographic Proof</summary>
                  <pre style={{
                    marginTop: '0.5rem', padding: '1rem', background: '#0a1220',
                    borderRadius: 6, overflow: 'auto', fontSize: '0.75rem', maxHeight: 300,
                    color: '#99bbcc'
                  }}>
                    {JSON.stringify(result.commitmentData, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          {!result && !error && (
            <div style={{ textAlign: 'center', color: '#556677', padding: '2rem' }}>
              <p>Enter a Hand ID above to start verification.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Each hand is cryptographically verifiable through 4 independent checks:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', marginTop: '1rem' }}>
                {['Seed Commitment', 'Shuffle Replay', 'State Hash', 'DA Anchor'].map((s, i) => (
                  <div key={i} style={{ background: '#0f1929', padding: '0.75rem', borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2em', marginBottom: '0.25em' }}>{['🔐', '🃏', '📋', '⛓️'][i]}</div>
                    <div style={{ fontSize: '0.8rem', color: '#8899aa' }}>{s}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </VerifyPanel>

        {/* Offline Tool Hint */}
        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#556677', fontSize: '0.85rem' }}>
          For fully offline verification, run:
          <br />
          <code style={{ background: '#0f1929', padding: '0.2rem 0.5rem', borderRadius: 4, marginTop: '0.3rem', display: 'inline-block' }}>
            node scripts/verify-fairness.js --hand &lt;handId&gt;
          </code>
        </p>
      </CenteredBlock>
    </Container>
  );
};

export default FairnessVerify;