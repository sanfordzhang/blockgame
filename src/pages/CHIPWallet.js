import React, { useState, useEffect, useMemo, useContext } from 'react';
import styled from 'styled-components';
import Container from '../components/layout/Container';
import Heading from '../components/typography/Heading';
import Text from '../components/typography/Text';
import Button from '../components/buttons/Button';
import globalContext from '../context/global/globalContext';
import locaContext from '../context/localization/locaContext';

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
  const { walletAddress: contextWalletAddress } = useContext(globalContext);
  const { t } = useContext(locaContext);
  
  // Get wallet address from context, URL params, or localStorage (test mode support)
  const walletAddress = useMemo(() => {
    if (contextWalletAddress) return contextWalletAddress;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('address') || localStorage.getItem('testWalletAddress');
  }, [contextWalletAddress]);
  
  const [tab, setTab] = useState('wallet');
  const [balance, setBalance] = useState({ chip: 0, staked: 0, pendingReward: 0 });
  const [onChainBalance, setOnChainBalance] = useState(0);
  const [vipStatus, setVipStatus] = useState({ level: 'BRONZE', discount: 0, chipRewardRate: 1, stakedAmount: 0, requiredStake: 0 });
  const [stakes, setStakes] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [stakingContractAddress, setStakingContractAddress] = useState(null);
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [stakeAmount, setStakeAmount] = useState('');
  const [stakeLockDays, setStakeLockDays] = useState('30');
  const [staking, setStaking] = useState(false);
  const [chipTokenAddress, setChipTokenAddress] = useState(null);

  useEffect(() => {
    if (walletAddress) {
      fetchData();
    }
  }, [walletAddress]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [balanceRes, vipRes, stakesRes, txRes, nftRes, onChainRes, contractsRes, configRes] = await Promise.all([
        fetch(`/api/chip/balance/${walletAddress}`),
        fetch(`/api/chip/vip-status/${walletAddress}`),
        fetch(`/api/stake/history/${walletAddress}`),
        fetch(`/api/chip/transactions/${walletAddress}`),
        fetch(`/api/nft/collection/${walletAddress}`),
        fetch(`/api/chip/onchain/balance/${walletAddress}`),
        fetch('/api/stake/contracts'),
        fetch('/api/blockchain/config')
      ]);

      const balanceData = await balanceRes.json();
      const vipData = await vipRes.json();
      const stakesData = await stakesRes.json();
      const txData = await txRes.json();
      const nftData = await nftRes.json();
      const onChainData = await onChainRes.json();
      const contractsData = await contractsRes.json();
      const configData = await configRes.json();

      if (balanceData.success) {
        setBalance(balanceData);
      }
      if (vipData.success) {
        setVipStatus(vipData);
      }
      if (stakesData.success) {
        setStakes(stakesData.stakes);
      }
      if (txData.success) {
        setTransactions(txData.transactions || []);
      }
      if (nftData.success) {
        setNfts(nftData.nfts || []);
      }
      if (onChainData.success) {
        setOnChainBalance(onChainData.balance);
      }
      if (contractsData.success) {
        setStakingContractAddress(contractsData.stakingContract);
      }
      if (configData.chipToken) {
        setChipTokenAddress(configData.chipToken);
      }
    } catch (error) {
      console.error('Failed to fetch wallet data:', error);
    }
    setLoading(false);
  };

  // 质押CHIP（通过TronLink签名）
  const handleStake = async () => {
    if (!window.tronWeb) {
      window.alert('TronLink wallet not detected! Please install TronLink extension.');
      return;
    }

    if (!stakingContractAddress) {
      window.alert('质押合约地址未加载，请刷新页面重试');
      return;
    }

    if (!chipTokenAddress) {
      window.alert('CHIP代币合约地址未加载，请刷新页面重试');
      return;
    }

    const amount = parseFloat(stakeAmount);
    const lockDays = parseInt(stakeLockDays);

    if (!amount || amount < 100) {
      window.alert('质押金额至少100 CHIP');
      return;
    }

    if (!lockDays || lockDays < 30) {
      window.alert('锁定期至少30天');
      return;
    }

    if (amount > onChainBalance) {
      window.alert(`链上余额不足。您只有 ${onChainBalance} CHIP 可质押`);
      return;
    }

    setStaking(true);
    try {
      const stakeAmountWei = Math.floor(amount * 1e6);
      const lockDurationSeconds = lockDays * 24 * 60 * 60;

      // 1. Approve CHIP token
      const chipContract = await window.tronWeb.contract().at(chipTokenAddress);
      const approveTx = await chipContract.approve(stakingContractAddress, stakeAmountWei.toString()).send({
        feeLimit: 100_000_000
      });
      console.log('Approve transaction:', approveTx);

      // 2. Stake
      const stakingContract = await window.tronWeb.contract().at(stakingContractAddress);
      const stakeTx = await stakingContract.stake(stakeAmountWei.toString(), lockDurationSeconds).send({
        feeLimit: 100_000_000
      });
      console.log('Stake transaction:', stakeTx);

      // 3. Log to backend
      await fetch('/api/stake/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress
        },
        body: JSON.stringify({ amount, lockDays, txHash: stakeTx })
      });

      setShowStakeModal(false);
      setStakeAmount('');
      setStakeLockDays('30');
      fetchData();
      window.alert(`✅ 质押成功！\n\n交易: ${stakeTx}\n\n查看: https://nile.tronscan.org/#/transaction/${stakeTx}`);

    } catch (error) {
      console.error('Failed to stake:', error);
      window.alert('质押失败: ' + (error.message || 'Unknown error'));
    }
    setStaking(false);
  };

  // 解除质押（通过TronLink签名）
  const handleUnstake = async (stake) => {
    if (!window.tronWeb) {
      alert('TronLink wallet not detected! Please install TronLink extension.');
      return;
    }

    if (!stakingContractAddress) {
      alert('质押合约地址未加载，请刷新页面重试');
      return;
    }

    const amount = stake.amount * 1e6; // 转换为最小单位

    // 检查是否已解锁
    const unlockTime = new Date(stake.unlockAt).getTime();
    const now = Date.now();
    if (now < unlockTime) {
      const daysLeft = Math.ceil((unlockTime - now) / (1000 * 60 * 60 * 24));
      const penalty = stake.amount * 0.1; // 10% 提前解除惩罚
      if (!window.confirm(`⚠️ 质押尚未解锁！\n\n还剩 ${daysLeft} 天解锁\n提前解除将扣除 10% 惩罚金：${penalty.toFixed(2)} CHIP\n\n确定要提前解除吗？`)) {
        return;
      }
    }

    try {
      console.log('Unstaking:', { amount: stake.amount, stakeId: stake._id });

      // 获取质押合约实例
      const contract = await window.tronWeb.contract().at(stakingContractAddress);

      // 调用 unstake 函数
      const tx = await contract.unstake(amount.toString()).send({
        feeLimit: 100_000_000
      });

      console.log('Unstake transaction:', tx);

      // 记录交易到后端（不记录金额到Game Balance，因为链上已处理）
      await fetch('/api/stake/log-unstake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress
        },
        body: JSON.stringify({
          amount: stake.amount,
          txHash: tx
        })
      });

      fetchData();
      alert(`✅ 解除质押成功！\n\n交易: ${tx}\n\n查看: https://nile.tronscan.org/#/transaction/${tx}`);

    } catch (error) {
      console.error('Failed to unstake:', error);
      alert('解除质押失败: ' + (error.message || 'Unknown error'));
    }
  };

  // 领取奖励（通过TronLink签名）
  const handleClaimReward = async () => {
    if (!window.tronWeb) {
      alert('TronLink wallet not detected! Please install TronLink extension.');
      return;
    }

    if (!stakingContractAddress) {
      alert('质押合约地址未加载，请刷新页面重试');
      return;
    }

    try {
      console.log('Claiming reward...');

      // 获取质押合约实例
      const contract = await window.tronWeb.contract().at(stakingContractAddress);

      // 调用 claimReward 函数
      const tx = await contract.claimReward().send({
        feeLimit: 100_000_000
      });

      console.log('Claim transaction:', tx);

      // 注意：不记录金额到后端，因为链上已直接转账到钱包
      // 如果记录金额会导致Game Balance双重计算

      fetchData();
      alert(`✅ 领取奖励成功！\n\n交易: ${tx}\n\n查看: https://nile.tronscan.org/#/transaction/${tx}`);

    } catch (error) {
      console.error('Failed to claim reward:', error);
      alert('领取奖励失败: ' + (error.message || 'Unknown error'));
    }
  };

  // 提现到区块链钱包
  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      alert('请输入有效的提现金额');
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (amount > balance.chip) {
      alert(`余额不足。您只有 ${balance.chip} CHIP 可提现`);
      return;
    }

    setWithdrawing(true);
    try {
      const response = await fetch('/api/chip/withdraw', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress
        },
        body: JSON.stringify({ amount })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        fetchData();
        alert(`✅ 提现成功！\n\n交易: ${data.txid}\n\n查看: https://nile.tronscan.org/#/transaction/${data.txid}`);
      } else {
        alert('提现失败: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to withdraw:', error);
      alert('提现失败: ' + error.message);
    }
    setWithdrawing(false);
  };

  // 链上转账（通过TronLink签名）
  const handleOnChainTransfer = async () => {
    if (!transferTo || !transferAmount) {
      alert('Please enter recipient address and amount');
      return;
    }

    // 检查TronLink是否可用
    if (!window.tronWeb) {
      alert('TronLink wallet not detected! Please install TronLink extension.');
      return;
    }

    setTransferring(true);
    try {
      if (!chipTokenAddress) {
        alert('CHIP代币合约地址未加载，请刷新页面重试');
        setTransferring(false);
        return;
      }

      const amount = parseFloat(transferAmount) * 1e6; // 转换为最小单位

      console.log('On-chain transfer:', { to: transferTo, amount: transferAmount });

      // 获取合约实例
      const contract = await window.tronWeb.contract().at(chipTokenAddress);

      // 调用transfer函数
      const tx = await contract.transfer(transferTo, amount.toString()).send({
        feeLimit: 100_000_000
      });

      console.log('Transaction:', tx);

      setShowTransferModal(false);
      setTransferTo('');
      setTransferAmount('');
      fetchData();

      alert(`✅ On-chain transfer successful!\n\nTransaction: ${tx}\n\nView on TronScan: https://nile.tronscan.org/#/transaction/${tx}`);

    } catch (error) {
      console.error('Failed to transfer on-chain:', error);
      alert('Transfer failed: ' + (error.message || 'Unknown error'));
    }
    setTransferring(false);
  };

  // 游戏内转账（数据库）
  const handleTransfer = async () => {
    if (!transferTo || !transferAmount) {
      alert('Please enter recipient address and amount');
      return;
    }
    
    setTransferring(true);
    try {
      const response = await fetch('/api/chip/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          from: walletAddress, 
          to: transferTo, 
          amount: parseFloat(transferAmount) 
        })
      });
      const data = await response.json();
      if (data.success) {
        setShowTransferModal(false);
        setTransferTo('');
        setTransferAmount('');
        fetchData();
        alert(`Successfully transferred ${transferAmount} CHIP to ${transferTo.substring(0, 8)}...`);
      } else {
        alert('Transfer failed: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to transfer:', error);
      alert('Transfer failed');
    }
    setTransferring(false);
  };

  const handleShowHistory = () => {
    setTab('history');
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
        <Tab active={tab === 'actions'} onClick={() => setTab('actions')}>{t('deposit')} / {t('withdraw')}</Tab>
        <Tab active={tab === 'stake'} onClick={() => setTab('stake')}>Staking</Tab>
        <Tab active={tab === 'nft'} onClick={() => setTab('nft')}>Collection</Tab>
        <Tab active={tab === 'vip'} onClick={() => setTab('vip')}>VIP Status</Tab>
        <Tab active={tab === 'history'} onClick={() => setTab('history')}>History</Tab>
      </Tabs>

      {!walletAddress ? (
        <Text textCentered data-testid="connect-wallet-prompt">Connect your wallet to view your CHIP balance</Text>
      ) : loading ? (
        <Text textCentered data-testid="loading">Loading...</Text>
      ) : tab === 'actions' ? (
        <WalletCard>
          <Heading as="h3">{t('deposit')} / {t('withdraw')}</Heading>
          <Text color="textSecondary" style={{ marginBottom: '1.5rem' }}>
            充值 TRX 到游戏合约，或将余额提现到钱包。
            Deposit TRX to the game contract, or withdraw your balance back to your wallet.
          </Text>
          <Container flexDirection="row" gap="1rem" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
            <ActionButton
              primary
              onClick={() => window.location.href = '/'}
              style={{ minWidth: '140px' }}
            >
              {t('deposit')} (TRX)
            </ActionButton>
            <ActionButton
              onClick={() => setShowWithdrawModal(true)}
              style={{ minWidth: '140px' }}
            >
              {t('withdraw')}
            </ActionButton>
          </Container>
          <hr style={{ margin: '2rem 0', opacity: 0.2 }} />
          <Heading as="h3">{t('register')}</Heading>
          <Text color="textSecondary" style={{ marginBottom: '1rem' }}>
            如果你还没有注册到游戏合约，请前往首页完成注册。
          </Text>
          <ActionButton onClick={() => window.location.href = '/'}>
            前往首页注册 / Go to Register
          </ActionButton>
        </WalletCard>
      ) : tab === 'wallet' ? (
        <>
          <WalletCard data-testid="wallet-card">
            <Text color="textSecondary">游戏内余额 (Game Balance)</Text>
            <BalanceDisplay data-testid="chip-balance">{balance.chip?.toLocaleString() || 0} CHIP</BalanceDisplay>
            <Container flexDirection="row" gap="1rem" marginTop="1rem">
              <ActionButton primary data-testid="transfer-btn" onClick={() => setShowTransferModal(true)}>Transfer</ActionButton>
              <ActionButton data-testid="history-btn" onClick={handleShowHistory}>History</ActionButton>
              <ActionButton 
                style={{ background: '#4CAF50', color: 'white', border: 'none' }}
                onClick={() => setShowWithdrawModal(true)}
              >
                提现到钱包
              </ActionButton>
            </Container>
          </WalletCard>

          <WalletCard>
            <Text color="textSecondary">区块链余额 (On-Chain Balance)</Text>
            <BalanceDisplay style={{ color: '#4CAF50' }} data-testid="onchain-balance">
              {onChainBalance?.toLocaleString() || 0} CHIP
            </BalanceDisplay>
            <Text size="0.8rem" color="textSecondary">
              TronLink钱包余额 • 合约: {chipTokenAddress || '加载中...'}
            </Text>
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
              <ActionButton primary onClick={() => setShowStakeModal(true)} data-testid="stake-btn">
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
                    <ActionButton onClick={() => handleUnstake(stake)}>Unstake</ActionButton>
                    <ActionButton primary onClick={() => handleClaimReward()}>Claim</ActionButton>
                  </Container>
                </Container>
              </StakingCard>
            ))
          )}
        </>
      ) : tab === 'nft' ? (
        <>
          <WalletCard>
            <Container flexDirection="row" justifyContent="space-between" alignItems="center">
              <div>
                <Text color="textSecondary">NFT Collection</Text>
                <BalanceDisplay style={{ fontSize: '2rem' }}>{nfts.length} Items</BalanceDisplay>
              </div>
            </Container>
          </WalletCard>

          {nfts.length === 0 ? (
            <Text textCentered color="textSecondary">No NFTs collected yet. Play games to earn achievements!</Text>
          ) : (
            <Container flexDirection="column" gap="1rem">
              {nfts.map((nft, index) => (
                <StakingCard key={nft._id || index} style={{ borderLeftColor: nft.rarity === 'LEGENDARY' ? '#FFD700' : nft.rarity === 'EPIC' ? '#9C27B0' : nft.rarity === 'RARE' ? '#2196F3' : '#4CAF50' }}>
                  <Container flexDirection="row" justifyContent="space-between" alignItems="center">
                    <div>
                      <Text fontWeight="bold" style={{ color: nft.rarity === 'LEGENDARY' ? '#FFD700' : nft.rarity === 'EPIC' ? '#9C27B0' : nft.rarity === 'RARE' ? '#2196F3' : '#4CAF50' }}>
                        {nft.displayName || nft.achievementType}
                      </Text>
                      <Text size="0.8rem" color="textSecondary">
                        {nft.handDescription || nft.achievementType}
                      </Text>
                      <Text size="0.7rem" color="textSecondary">
                        Token ID: {nft.tokenId} • {new Date(nft.claimedAt).toLocaleDateString()}
                      </Text>
                      {nft.cards && nft.cards.length > 0 && (
                        <Text size="0.7rem" color="textSecondary">
                          Cards: {nft.cards.map(c => `${c.rank}${c.suit}`).join(' ')}
                        </Text>
                      )}
                    </div>
                    <Text fontWeight="bold" style={{ color: nft.rarity === 'LEGENDARY' ? '#FFD700' : nft.rarity === 'EPIC' ? '#9C27B0' : nft.rarity === 'RARE' ? '#2196F3' : '#4CAF50' }}>
                      {nft.rarity}
                    </Text>
                  </Container>
                </StakingCard>
              ))}
            </Container>
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
              CHIP Reward: {vipStatus.chipRewardRate || 1}x per TRX rake
            </Text>
            {vipStatus.requiredStake > 0 && (
              <Text color="textSecondary">
                Stake {vipStatus.requiredStake} CHIP to reach next level
              </Text>
            )}
            {vipStatus.stakedAmount > 0 && (
              <Text color="textSecondary" size="0.9rem">
                Staked: {vipStatus.stakedAmount.toLocaleString()} CHIP
              </Text>
            )}
          </Container>

          <Container marginTop="2rem">
            <Heading as="h4">VIP Levels</Heading>
            <Container flexDirection="column" gap="0.5rem" marginTop="1rem">
              <Container flexDirection="row" justifyContent="space-between">
                <VIPBadge level="BRONZE">Bronze</VIPBadge>
                <Text>1x reward • 0 CHIP staked</Text>
              </Container>
              <Container flexDirection="row" justifyContent="space-between">
                <VIPBadge level="SILVER">Silver</VIPBadge>
                <Text>1.5x reward • 1,000 CHIP staked</Text>
              </Container>
              <Container flexDirection="row" justifyContent="space-between">
                <VIPBadge level="GOLD">Gold</VIPBadge>
                <Text>2x reward • 10,000 CHIP staked</Text>
              </Container>
              <Container flexDirection="row" justifyContent="space-between">
                <VIPBadge level="PLATINUM">Platinum</VIPBadge>
                <Text>3x reward • 100,000 CHIP staked</Text>
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

      {/* Transfer Modal */}
      {showTransferModal && (
        <WalletCard style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, minWidth: '400px' }}>
          <Heading as="h3">Transfer CHIP</Heading>
          <Container flexDirection="column" gap="1rem" marginTop="1rem">
            <div>
              <Text size="0.8rem" color="textSecondary">Recipient Address</Text>
              <input
                type="text"
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                placeholder="TRX address"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>
            <div>
              <Text size="0.8rem" color="textSecondary">Amount</Text>
              <input
                type="number"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="CHIP amount"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>
            <Text size="0.8rem" color="textSecondary">Available: {balance.chip?.toLocaleString() || 0} CHIP (Game)</Text>
            
            {/* 提示信息 */}
            <div style={{ background: '#fff3cd', padding: '0.75rem', borderRadius: '4px', fontSize: '0.85rem' }}>
              <Text size="0.8rem" color="#856404">
                ⚠️ Note: Game Transfer only updates database balance, not blockchain.
              </Text>
            </div>

            <Container flexDirection="row" gap="1rem" marginTop="1rem">
              <ActionButton primary onClick={handleTransfer} disabled={transferring}>
                {transferring ? 'Transferring...' : 'Game Transfer'}
              </ActionButton>
              <ActionButton 
                onClick={handleOnChainTransfer} 
                disabled={transferring}
                style={{ background: '#4CAF50', color: 'white' }}
              >
                {transferring ? 'Transferring...' : 'On-Chain Transfer'}
              </ActionButton>
            </Container>
            <ActionButton onClick={() => setShowTransferModal(false)} style={{ marginTop: '0.5rem' }}>
              Cancel
            </ActionButton>
          </Container>
        </WalletCard>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <WalletCard style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, minWidth: '400px' }}>
          <Heading as="h3">提现 CHIP 到区块链钱包</Heading>
          <Container flexDirection="column" gap="1rem" marginTop="1rem">
            <div>
              <Text size="0.8rem" color="textSecondary">提现金额</Text>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="输入提现金额"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>
            
            <Container flexDirection="row" gap="0.5rem">
              <Text size="0.8rem" color="textSecondary">游戏内余额: {balance.chip?.toLocaleString() || 0} CHIP</Text>
              <button 
                onClick={() => setWithdrawAmount(balance.chip?.toString() || '0')}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
              >
                全部
              </button>
            </Container>
            
            <div style={{ background: '#d4edda', padding: '0.75rem', borderRadius: '4px', fontSize: '0.85rem' }}>
              <Text size="0.8rem" color="#155724">
                ✅ 提现将把游戏内CHIP转到您的TronLink钱包（区块链）
              </Text>
            </div>

            <Container flexDirection="row" gap="1rem" marginTop="1rem">
              <ActionButton 
                primary 
                onClick={handleWithdraw} 
                disabled={withdrawing}
                style={{ background: '#4CAF50', border: 'none' }}
              >
                {withdrawing ? '提现中...' : '确认提现'}
              </ActionButton>
              <ActionButton onClick={() => setShowWithdrawModal(false)}>
                取消
              </ActionButton>
            </Container>
          </Container>
        </WalletCard>
      )}

      {/* Stake Modal */}
      {showStakeModal && (
        <WalletCard style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, minWidth: '400px' }}>
          <Heading as="h3">质押 CHIP</Heading>
          <Container flexDirection="column" gap="1rem" marginTop="1rem">
            <div>
              <Text size="0.8rem" color="textSecondary">质押金额 (最少100 CHIP)</Text>
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder="输入质押金额"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>

            <div>
              <Text size="0.8rem" color="textSecondary">锁定期 (天，最少30天)</Text>
              <input
                type="number"
                value={stakeLockDays}
                onChange={(e) => setStakeLockDays(e.target.value)}
                placeholder="输入锁定期"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>

            <Container flexDirection="row" gap="0.5rem">
              <Text size="0.8rem" color="textSecondary">链上余额: {onChainBalance?.toLocaleString() || 0} CHIP</Text>
              <button
                onClick={() => setStakeAmount(onChainBalance?.toString() || '0')}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
              >
                全部
              </button>
            </Container>

            <div style={{ background: '#fff3cd', padding: '0.75rem', borderRadius: '4px', fontSize: '0.85rem' }}>
              <Text size="0.8rem" color="#856404">
                ⚠️ 质押期间CHIP将被锁定。提前解押将扣除10%惩罚金。
              </Text>
              <Text size="0.75rem" color="#856404" style={{ marginTop: '0.5rem' }}>
                奖励规则: 每日奖励 = clamp(最大质押 × 用户占比 / 30, 1 CHIP, 1000 CHIP)
              </Text>
            </div>

            <Container flexDirection="row" gap="1rem" marginTop="1rem">
              <ActionButton
                primary
                onClick={handleStake}
                disabled={staking}
              >
                {staking ? '质押中...' : '确认质押'}
              </ActionButton>
              <ActionButton onClick={() => setShowStakeModal(false)}>
                取消
              </ActionButton>
            </Container>
          </Container>
        </WalletCard>
      )}
    </Container>
  );
};

export default CHIPWallet;
