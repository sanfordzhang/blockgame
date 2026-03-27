import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';
import Container from '../components/layout/Container';
import Heading from '../components/typography/Heading';
import Text from '../components/typography/Text';
import Button from '../components/buttons/Button';
import globalContext from '../context/global/globalContext';

const WalletCard = styled.div`
  background: ${(props) => props.theme.colors.playingCardBg};
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
  padding: 2rem;
  box-shadow: ${(props) => props.theme.other.cardDropShadow};
  margin-bottom: 1.5rem;
`;

const BalanceDisplay = styled.div`
  font-size: 3rem;
  font-weight: bold;
  color: ${(props) => props.theme.colors.primaryCta};
  margin-bottom: 0.5rem;
`;

const VIPBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 2rem;
  background: ${props => {
    switch(props.level) {
      case 'PLATINUM': return 'linear-gradient(135deg, #E5E4E2, #C0C0C0)';
      case 'GOLD': return 'linear-gradient(135deg, #FFD700, #FFA500)';
      case 'SILVER': return 'linear-gradient(135deg, #C0C0C0, #A8A8A8)';
      default: return 'linear-gradient(135deg, #CD7F32, #8B4513)';
    }
  }};
  color: ${props => props.level === 'PLATINUM' ? '#333' : 'white'};
  font-weight: bold;
`;

const ActionButton = styled.button`
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
  background: ${(props) => props.primary ? props.theme.colors.primaryCta : 'transparent'};
  color: ${(props) => props.primary ? 'white' : props.theme.colors.primaryCta};
  border: 2px solid ${(props) => props.theme.colors.primaryCta};
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

const StakingCard = styled.div`
  background: ${(props) => props.theme.colors.playingCardBg};
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
  padding: 1.5rem;
  margin-bottom: 1rem;
  border-left: 4px solid ${(props) => props.theme.colors.primaryCta};
`;

const RewardDisplay = styled.div`
  background: linear-gradient(135deg, #4CAF50, #8BC34A);
  color: white;
  padding: 1rem;
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
  margin-top: 1rem;
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

const CHIPWallet = () => {
  const { walletAddress } = useContext(globalContext);
  const [tab, setTab] = useState('wallet');
  const [balance, setBalance] = useState({ chip: 0, staked: 0, pendingReward: 0 });
  const [vipStatus, setVipStatus] = useState({ level: 'BRONZE', discount: 0, requiredStake: 0 });
  const [stakes, setStakes] = useState([]);
  const [transactions, setTransactions] = useState([]); // Task 18.7
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false); // Task 18.7

  useEffect(() => {
    if (walletAddress) {
      fetchData();
    }
  }, [walletAddress]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [balanceRes, vipRes, stakesRes, txRes] = await Promise.all([
        fetch(`/api/chip/balance/${walletAddress}`),
        fetch(`/api/chip/vip-status/${walletAddress}`),
        fetch(`/api/stake/history/${walletAddress}`),
        fetch(`/api/chip/transactions/${walletAddress}`) // Task 18.7
      ]);

      const balanceData = await balanceRes.json();
      const vipData = await vipRes.json();
      const stakesData = await stakesRes.json();
      const txData = await txRes.json();

      if (balanceData.success) {
        setBalance(balanceData);
      }
      if (vipData.success) {
        setVipStatus(vipData);
      }
      if (stakesData.success) {
        setStakes(stakesData.stakes);
      }
      if (txData.success) { // Task 18.7
        setTransactions(txData.transactions || []);
      }
    } catch (error) {
      console.error('Failed to fetch wallet data:', error);
    }
    setLoading(false);
  };

  const handleStake = async (amount, lockDays) => {
    try {
      const response = await fetch('/api/stake/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, amount, lockDays })
      });
      const data = await response.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to stake:', error);
    }
  };

  const handleUnstake = async (stakeId) => {
    try {
      const response = await fetch('/api/stake/unstake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, stakeId })
      });
      const data = await response.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to unstake:', error);
    }
  };

  const handleClaimReward = async (stakeId) => {
    try {
      const response = await fetch('/api/stake/claim-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, stakeId })
      });
      const data = await response.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to claim reward:', error);
    }
  };

  return (
    <Container
      fullHeight
      flexDirection="column"
      padding="6rem 2rem 2rem 2rem"
    >
      <Heading as="h1" textCentered>CHIP Wallet</Heading>

      <Tabs>
        <Tab active={tab === 'wallet'} onClick={() => setTab('wallet')}>Balance</Tab>
        <Tab active={tab === 'stake'} onClick={() => setTab('stake')}>Staking</Tab>
        <Tab active={tab === 'vip'} onClick={() => setTab('vip')}>VIP Status</Tab>
        <Tab active={tab === 'history'} onClick={() => setTab('history')}>History</Tab>
      </Tabs>

      {!walletAddress ? (
        <Text textCentered data-testid="connect-wallet-prompt">Connect your wallet to view your CHIP balance</Text>
      ) : loading ? (
        <Text textCentered data-testid="loading">Loading...</Text>
      ) : tab === 'wallet' ? (
        <>
          <WalletCard data-testid="wallet-card">
            <Text color="textSecondary">CHIP Balance</Text>
            <BalanceDisplay data-testid="chip-balance">{balance.chip?.toLocaleString() || 0} CHIP</BalanceDisplay>
            <Container flexDirection="row" gap="1rem" marginTop="1rem">
              <ActionButton primary data-testid="transfer-btn">Transfer</ActionButton>
              <ActionButton data-testid="history-btn">History</ActionButton>
            </Container>
          </WalletCard>

          {balance.pendingReward > 0 && (
            <RewardDisplay data-testid="pending-reward">
              <Container flexDirection="row" justifyContent="space-between" alignItems="center">
                <div>
                  <Text color="white">Pending Rewards</Text>
                  <Heading as="h3">{balance.pendingReward?.toFixed(2)} CHIP</Heading>
                </div>
                <ActionButton primary onClick={() => handleClaimReward()} data-testid="claim-btn">Claim</ActionButton>
              </Container>
            </RewardDisplay>
          )}
        </>
      ) : tab === 'stake' ? (
        <>
          <WalletCard data-testid="stake-card">
            <Container flexDirection="row" justifyContent="space-between" alignItems="center">
              <div>
                <Text color="textSecondary">Total Staked</Text>
                <BalanceDisplay data-testid="staked-amount">{balance.staked?.toLocaleString() || 0} CHIP</BalanceDisplay>
              </div>
              <ActionButton primary onClick={() => handleStake(100, 30)} data-testid="stake-btn">
                Stake CHIP
              </ActionButton>
            </Container>
          </WalletCard>

          <Heading as="h3">Active Stakes</Heading>
          {stakes.length === 0 ? (
            <Text color="textSecondary">No active stakes</Text>
          ) : (
            stakes.map((stake) => (
              <StakingCard key={stake._id}>
                <Container flexDirection="row" justifyContent="space-between" alignItems="center">
                  <div>
                    <Text fontWeight="bold">{stake.amount} CHIP</Text>
                    <Text size="0.8rem" color="textSecondary">
                      Lock: {stake.lockDays} days • 
                      Unlocks: {new Date(stake.unlockAt).toLocaleDateString()}
                    </Text>
                  </div>
                  <Container flexDirection="row" gap="0.5rem">
                    <Text color="primaryCta">+{stake.pendingReward?.toFixed(2)} CHIP</Text>
                    <ActionButton onClick={() => handleUnstake(stake._id)}>Unstake</ActionButton>
                    <ActionButton primary onClick={() => handleClaimReward(stake._id)}>Claim</ActionButton>
                  </Container>
                </Container>
              </StakingCard>
            ))
          )}
        </>
      ) : tab === 'vip' ? (
        <WalletCard data-testid="vip-card">
          <Container flexDirection="column" alignItems="center" gap="1rem">
            <VIPBadge level={vipStatus.level} data-testid="vip-badge">
              {vipStatus.level} VIP
            </VIPBadge>
            <Text size="1.5rem" fontWeight="bold" data-testid="vip-discount">
              {vipStatus.discount}% Rake Discount
            </Text>
            <Text color="textSecondary">
              Stake {vipStatus.requiredStake} CHIP to reach next level
            </Text>
          </Container>

          <Container marginTop="2rem">
            <Heading as="h4">VIP Levels</Heading>
            <Container flexDirection="column" gap="0.5rem" marginTop="1rem">
              <Container flexDirection="row" justifyContent="space-between">
                <VIPBadge level="BRONZE">Bronze</VIPBadge>
                <Text>0% discount • 0 CHIP staked</Text>
              </Container>
              <Container flexDirection="row" justifyContent="space-between">
                <VIPBadge level="SILVER">Silver</VIPBadge>
                <Text>5% discount • 1,000 CHIP staked</Text>
              </Container>
              <Container flexDirection="row" justifyContent="space-between">
                <VIPBadge level="GOLD">Gold</VIPBadge>
                <Text>10% discount • 10,000 CHIP staked</Text>
              </Container>
              <Container flexDirection="row" justifyContent="space-between">
                <VIPBadge level="PLATINUM">Platinum</VIPBadge>
                <Text>20% discount • 100,000 CHIP staked</Text>
              </Container>
            </Container>
          </Container>
        </WalletCard>
      ) : tab === 'history' ? (
        // Task 18.7: Transaction History List
        <>
          <WalletCard>
            <Heading as="h3">Transaction History</Heading>
            <Text color="textSecondary" size="0.8rem">Recent CHIP transactions</Text>
          </WalletCard>

          {transactions.length === 0 ? (
            <Text textCentered color="textSecondary">No transactions yet</Text>
          ) : (
            <Container flexDirection="column" gap="0.5rem">
              {transactions.map((tx, index) => (
                <StakingCard key={tx._id || index}>
                  <Container flexDirection="row" justifyContent="space-between" alignItems="center">
                    <div>
                      <Text fontWeight="bold">
                        {tx.type === 'reward' ? '🎮 Game Reward' :
                         tx.type === 'stake' ? '🔒 Staked' :
                         tx.type === 'unstake' ? '🔓 Unstaked' :
                         tx.type === 'claim' ? '💰 Claimed Reward' :
                         tx.type === 'transfer' ? '↔️ Transfer' :
                         tx.type === 'vip_discount' ? '💎 VIP Discount' :
                         '📝 Transaction'}
                      </Text>
                      <Text size="0.8rem" color="textSecondary">
                        {new Date(tx.timestamp || tx.createdAt).toLocaleString()}
                      </Text>
                      {tx.gameId && (
                        <Text size="0.7rem" color="textSecondary">
                          Game: {tx.gameId}
                        </Text>
                      )}
                    </div>
                    <Text 
                      fontWeight="bold" 
                      color={tx.amount > 0 ? '#4CAF50' : '#f44336'}
                    >
                      {tx.amount > 0 ? '+' : ''}{tx.amount?.toFixed(2)} CHIP
                    </Text>
                  </Container>
                </StakingCard>
              ))}
            </Container>
          )}
        </>
      ) : null}
    </Container>
  );
};

export default CHIPWallet;
