import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';
import Container from '../components/layout/Container';
import Heading from '../components/typography/Heading';
import Text from '../components/typography/Text';
import globalContext from '../context/global/globalContext';

const ProposalCard = styled.div`
  background: ${(props) => props.theme.colors.playingCardBg};
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
  padding: 1.5rem;
  margin-bottom: 1rem;
  box-shadow: ${(props) => props.theme.other.cardDropShadow};
  border-left: 4px solid ${props => {
    switch(props.state) {
      case 'ACTIVE': return '#4CAF50';
      case 'PASSED': return '#2196F3';
      case 'EXECUTED': return '#9C27B0';
      case 'REJECTED': return '#f44336';
      default: return '#9E9E9E';
    }
  }};
`;

const VoteBar = styled.div`
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  margin: 1rem 0;
  overflow: hidden;
`;

const VoteFill = styled.div`
  height: 100%;
  background: #4CAF50;
  width: ${props => props.percentage}%;
  transition: width 0.3s;
`;

const ActionButton = styled.button`
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
  background: ${props => {
    if (props.for) return '#4CAF50';
    if (props.against) return '#f44336';
    return props.primary ? props.theme.colors.primaryCta : 'transparent';
  }};
  color: ${props => props.primary || props.for || props.against ? 'white' : props.theme.colors.primaryCta};
  border: ${props => props.primary || props.for || props.against ? 'none' : `2px solid ${props.theme.colors.primaryCta}`};
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;

  &:hover {
    opacity: 0.8;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StateBadge = styled.span`
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: bold;
  background: ${props => {
    switch(props.state) {
      case 'ACTIVE': return '#4CAF50';
      case 'PASSED': return '#2196F3';
      case 'EXECUTED': return '#9C27B0';
      case 'REJECTED': return '#f44336';
      default: return '#9E9E9E';
    }
  }};
  color: white;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin: 1rem 0;
`;

const StatBox = styled.div`
  text-align: center;
  padding: 1rem;
  background: ${(props) => props.theme.colors.border};
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
`;

const CreateProposalForm = styled.div`
  background: ${(props) => props.theme.colors.playingCardBg};
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: ${(props) => props.theme.other.cardDropShadow};
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid ${(props) => props.theme.colors.border};
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
  margin-bottom: 1rem;
  font-size: 1rem;
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid ${(props) => props.theme.colors.border};
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
  margin-bottom: 1rem;
  font-size: 1rem;
  min-height: 100px;
`;

const Tabs = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
`;

const Tab = styled.button`
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
  background: ${props => props.active ? props.theme.colors.primaryCta : props.theme.colors.playingCardBg};
  color: ${props => props.active ? 'white' : props.theme.colors.textPrimary};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.active ? props.theme.colors.primaryCta : props.theme.colors.border};
  }
`;

const DAO = () => {
  const { walletAddress } = useContext(globalContext);
  const [tab, setTab] = useState('active');
  const [proposals, setProposals] = useState([]);
  const [votingPower, setVotingPower] = useState(0);
  const [threshold, setThreshold] = useState(0);
  const [loading, setLoading] = useState(true);
  const [newProposal, setNewProposal] = useState({ title: '', description: '' });

  useEffect(() => {
    fetchProposals();
    if (walletAddress) {
      fetchVotingPower();
    }
  }, [tab, walletAddress]);

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const state = tab === 'active' ? 'ACTIVE' : tab === 'passed' ? 'PASSED' : undefined;
      const response = await fetch(`/api/dao/proposals${state ? `?state=${state}` : ''}`);
      const data = await response.json();
      if (data.success) {
        setProposals(data.proposals || []);
      }
    } catch (error) {
      console.error('Failed to fetch proposals:', error);
    }
    setLoading(false);
  };

  const fetchVotingPower = async () => {
    try {
      const [powerRes, thresholdRes] = await Promise.all([
        fetch(`/api/dao/voting-power/${walletAddress}`),
        fetch('/api/dao/threshold')
      ]);
      const powerData = await powerRes.json();
      const thresholdData = await thresholdRes.json();
      if (powerData.success) setVotingPower(powerData.votingPower);
      if (thresholdData.success) setThreshold(thresholdData.threshold);
    } catch (error) {
      console.error('Failed to fetch voting power:', error);
    }
  };

  const handleVote = async (proposalId, support) => {
    try {
      const response = await fetch(`/api/dao/proposals/${proposalId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, support })
      });
      const data = await response.json();
      if (data.success) {
        fetchProposals();
      }
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const handleCreateProposal = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/dao/proposals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, ...newProposal })
      });
      const data = await response.json();
      if (data.success) {
        setNewProposal({ title: '', description: '' });
        setTab('active');
        fetchProposals();
      }
    } catch (error) {
      console.error('Failed to create proposal:', error);
    }
  };

  const calculateVotePercentage = (proposal) => {
    const total = proposal.votesFor + proposal.votesAgainst;
    if (total === 0) return 0;
    return ((proposal.votesFor / total) * 100).toFixed(1);
  };

  return (
    <Container
      fullHeight
      flexDirection="column"
      padding="6rem 2rem 2rem 2rem"
    >
      <Heading as="h1" textCentered>DAO Governance</Heading>

      {walletAddress && (
        <Container flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom="1.5rem">
          <div>
            <Text color="textSecondary">Your Voting Power</Text>
            <Text size="1.5rem" fontWeight="bold">{votingPower.toLocaleString()} CHIP</Text>
          </div>
          <div>
            <Text color="textSecondary">Proposal Threshold</Text>
            <Text size="1.5rem" fontWeight="bold">{threshold.toLocaleString()} CHIP</Text>
          </div>
        </Container>
      )}

      <Tabs>
        <Tab active={tab === 'active'} onClick={() => setTab('active')}>Active</Tab>
        <Tab active={tab === 'passed'} onClick={() => setTab('passed')}>Passed</Tab>
        <Tab active={tab === 'all'} onClick={() => setTab('all')}>All</Tab>
        <Tab active={tab === 'create'} onClick={() => setTab('create')}>Create</Tab>
      </Tabs>

      {tab === 'create' ? (
        <CreateProposalForm>
          <Heading as="h3">Create New Proposal</Heading>
          <form onSubmit={handleCreateProposal}>
            <Input
              type="text"
              placeholder="Proposal Title"
              value={newProposal.title}
              onChange={(e) => setNewProposal({ ...newProposal, title: e.target.value })}
              required
            />
            <TextArea
              placeholder="Proposal Description"
              value={newProposal.description}
              onChange={(e) => setNewProposal({ ...newProposal, description: e.target.value })}
              required
            />
            <ActionButton primary type="submit" disabled={!walletAddress || votingPower < threshold}>
              Create Proposal
            </ActionButton>
          </form>
        </CreateProposalForm>
      ) : loading ? (
        <Text textCentered>Loading proposals...</Text>
      ) : proposals.length === 0 ? (
        <Text textCentered>No proposals found</Text>
      ) : (
        proposals.map((proposal) => (
          <ProposalCard key={proposal._id} state={proposal.state}>
            <Container flexDirection="row" justifyContent="space-between" alignItems="flex-start">
              <div style={{ flex: 1 }}>
                <Heading as="h3">{proposal.title}</Heading>
                <Text color="textSecondary" marginTop="0.5rem">{proposal.description}</Text>
              </div>
              <StateBadge state={proposal.state}>{proposal.state}</StateBadge>
            </Container>

            <StatsGrid>
              <StatBox>
                <Text size="0.8rem" color="textSecondary">For</Text>
                <Text size="1.25rem" fontWeight="bold" color="primaryCta">
                  {proposal.votesFor?.toLocaleString() || 0}
                </Text>
              </StatBox>
              <StatBox>
                <Text size="0.8rem" color="textSecondary">Against</Text>
                <Text size="1.25rem" fontWeight="bold">
                  {proposal.votesAgainst?.toLocaleString() || 0}
                </Text>
              </StatBox>
              <StatBox>
                <Text size="0.8rem" color="textSecondary">Quorum</Text>
                <Text size="1.25rem" fontWeight="bold">
                  {proposal.quorumReached ? '✅' : '❌'}
                </Text>
              </StatBox>
            </StatsGrid>

            <VoteBar>
              <VoteFill percentage={calculateVotePercentage(proposal)} />
            </VoteBar>

            <Container flexDirection="row" justifyContent="space-between" alignItems="center">
              <Text size="0.8rem" color="textSecondary">
                Ends: {new Date(proposal.votingEnds).toLocaleString()}
              </Text>
              {proposal.state === 'ACTIVE' && walletAddress && (
                <Container flexDirection="row" gap="0.5rem">
                  <ActionButton for onClick={() => handleVote(proposal._id, true)}>
                    Vote For
                  </ActionButton>
                  <ActionButton against onClick={() => handleVote(proposal._id, false)}>
                    Vote Against
                  </ActionButton>
                </Container>
              )}
            </Container>
          </ProposalCard>
        ))
      )}
    </Container>
  );
};

export default DAO;
