import React, { useState, useContext, useEffect } from 'react';
import styled from 'styled-components';
import socketContext from '../../context/websocket/socketContext';

const PanelContainer = styled.div`
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.85);
  border: 1px solid ${props => props.aiEnabled ? '#00ff88' : '#444'};
  border-radius: 8px;
  padding: 12px 16px;
  color: white;
  font-size: 13px;
  min-width: 200px;
  z-index: 100;
`;

const Title = styled.div`
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const StatusDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.active ? '#00ff88' : '#666'};
  display: inline-block;
`;

const Select = styled.select`
  background: #333;
  color: white;
  border: 1px solid #555;
  border-radius: 4px;
  padding: 4px 8px;
  width: 100%;
  margin: 4px 0;
  font-size: 12px;
`;

const Button = styled.button`
  background: ${props => props.danger ? '#ff4444' : '#00aa66'};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  width: 100%;
  margin-top: 8px;
  font-size: 13px;
  &:hover { opacity: 0.9; }
`;

const StatsRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #aaa;
  margin-top: 4px;
`;

const AIControlPanel = () => {
  const { socket } = useContext(socketContext);
  const [isEnabled, setIsEnabled] = useState(false);
  const [difficulty, setDifficulty] = useState('medium');
  const [maxHands, setMaxHands] = useState(100);
  const [stats, setStats] = useState({});

  useEffect(() => {
    if (!socket) return;
    const onEnabled = (data) => {
      setIsEnabled(true);
      setStats(data);
    };
    const onDisabled = () => setIsEnabled(false);
    const onStats = (data) => setStats(data);

    socket.on('SC_AI_ENABLED', onEnabled);
    socket.on('SC_AI_DISABLED', onDisabled);
    socket.on('SC_AI_STATS', onStats);
    return () => {
      socket.off('SC_AI_ENABLED', onEnabled);
      socket.off('SC_AI_DISABLED', onDisabled);
      socket.off('SC_AI_STATS', onStats);
    };
  }, [socket]);

  const handleToggle = () => {
    if (!socket) return;
    if (isEnabled) {
      socket.emit('CS_AI_DISABLE');
      setIsEnabled(false);
    } else {
      socket.emit('CS_AI_ENABLE', { difficulty, maxHands });
    }
  };

  return (
    <PanelContainer aiEnabled={isEnabled}>
      <Title>
        <StatusDot active={isEnabled} />
        AI Autopilot
      </Title>

      {!isEnabled && (
        <>
          <Select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
            <option value="easy">Easy - Random</option>
            <option value="medium">Medium - Rules</option>
            <option value="hard">Hard - NFSP AI</option>
            <option value="expert">Expert - Deep AI</option>
          </Select>
          <input
            type="number"
            value={maxHands}
            onChange={e => setMaxHands(parseInt(e.target.value) || 100)}
            min={1} max={1000}
            style={{
              background: '#333', color: 'white', border: '1px solid #555',
              borderRadius: '4px', padding: '4px 8px', width: '100%',
              marginTop: '4px', fontSize: '12px', boxSizing: 'border-box'
            }}
            placeholder="Max hands"
          />
        </>
      )}

      {isEnabled && (
        <>
          <StatsRow>
            <span>Difficulty:</span>
            <span>{stats.difficulty || difficulty}</span>
          </StatsRow>
          <StatsRow>
            <span>Hands played:</span>
            <span>{stats.handsPlayed || 0} / {stats.maxHands || maxHands}</span>
          </StatsRow>
        </>
      )}

      <Button danger={isEnabled} onClick={handleToggle}>
        {isEnabled ? 'Disable AI' : 'Enable AI'}
      </Button>
    </PanelContainer>
  );
};

export default AIControlPanel;
