import React, { useState, useContext, useEffect } from 'react';
import styled from 'styled-components';
import socketContext from '../../context/websocket/socketContext';

const SuggestionContainer = styled.div`
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.85);
  border: 1px solid #4488ff;
  border-radius: 8px;
  padding: 12px 16px;
  color: white;
  font-size: 13px;
  min-width: 180px;
  z-index: 100;
`;

const SuggestButton = styled.button`
  background: #336699;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  width: 100%;
  font-size: 13px;
  &:hover { opacity: 0.9; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const ActionBadge = styled.span`
  display: inline-block;
  background: ${props => {
    switch(props.action) {
      case 'raise': return '#ff8800';
      case 'call': return '#00aa66';
      case 'check': return '#4488ff';
      case 'fold': return '#ff4444';
      default: return '#666';
    }
  }};
  color: white;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 12px;
  color: #ccc;
`;

const DecisionSuggestion = () => {
  const { socket } = useContext(socketContext);
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!socket) return;
    const onSuggestion = (data) => {
      setSuggestion(data);
      setLoading(false);
    };
    socket.on('SC_SUGGESTION', onSuggestion);
    return () => socket.off('SC_SUGGESTION', onSuggestion);
  }, [socket]);

  const handleGetSuggestion = () => {
    if (!socket) return;
    setLoading(true);
    setSuggestion(null);
    socket.emit('CS_GET_SUGGESTION', {});
  };

  return (
    <SuggestionContainer>
      {suggestion && suggestion.action ? (
        <>
          <div style={{ marginBottom: 8, fontWeight: 'bold' }}>AI Suggestion</div>
          <ActionBadge action={suggestion.action}>
            {suggestion.action} {suggestion.amount > 0 ? `$${suggestion.amount}` : ''}
          </ActionBadge>
          <InfoRow>
            <span>Confidence:</span>
            <span>{((suggestion.confidence || 0) * 100).toFixed(0)}%</span>
          </InfoRow>
          {suggestion.reason && (
            <InfoRow>
              <span style={{ color: '#888', fontSize: 11, fontStyle: 'italic' }}>
                {suggestion.reason}
              </span>
            </InfoRow>
          )}
          <SuggestButton onClick={handleGetSuggestion} style={{ marginTop: 8 }}>
            Refresh
          </SuggestButton>
        </>
      ) : (
        <SuggestButton onClick={handleGetSuggestion} disabled={loading}>
          {loading ? 'Thinking...' : 'Get AI Suggestion'}
        </SuggestButton>
      )}
    </SuggestionContainer>
  );
};

export default DecisionSuggestion;
