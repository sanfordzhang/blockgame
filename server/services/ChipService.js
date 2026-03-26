/**
 * ChipService
 * Manages CHIP token rewards, VIP status, and staking integration
 */

const Stake = require('../models/Stake');

class ChipService {
    constructor(config) {
        this.tronWeb = config.tronWeb;
        this.tokenAddress = config.chipTokenAddress;
        this.stakingAddress = config.stakingAddress;
        this.tokenContract = null;
        this.stakingContract = null;
        
        // Reward configuration
        this.gameRewardRate = config.gameRewardRate || 0.01; // 1% of rake
        this.tournamentRewardRate = config.tournamentRewardRate || 0.02; // 2% of rake
    }
    
    /**
     * Initialize the service
     */
    async init() {
        if (this.tokenAddress) {
            this.tokenContract = await this.tronWeb.contract().at(this.tokenAddress);
            console.log('[ChipService] Token contract loaded:', this.tokenAddress);
        }
        
        if (this.stakingAddress) {
            this.stakingContract = await this.tronWeb.contract().at(this.stakingAddress);
            console.log('[ChipService] Staking contract loaded:', this.stakingAddress);
        }
    }
    
    // ============ Balance & Info ============
    
    /**
     * Get CHIP balance for address
     */
    async getBalance(address) {
        if (!this.tokenContract) return 0;
        
        const balance = await this.tokenContract.balanceOf(address).call();
        return this.tronWeb.toDecimal(balance);
    }
    
    /**
     * Get user info (balance, staked, VIP status)
     */
    async getUserInfo(address) {
        const balance = await this.getBalance(address);
        const stakedAmount = await this.getStakedAmount(address);
        const pendingReward = await this.getPendingReward(address);
        const vipStatus = this.getVipStatus(balance);
        
        return {
            address,
            balance,
            stakedAmount,
            pendingReward,
            totalValue: balance + stakedAmount,
            isVip: vipStatus.isVip,
            isSuperVip: vipStatus.isSuperVip,
            discount: vipStatus.discount
        };
    }
    
    /**
     * Get VIP status
     */
    getVipStatus(balance) {
        const vipThreshold = 10000 * 1e6;     // 10,000 CHIP
        const superVipThreshold = 100000 * 1e6; // 100,000 CHIP
        
        if (balance >= superVipThreshold) {
            return { isVip: true, isSuperVip: true, discount: 10 }; // 10%
        } else if (balance >= vipThreshold) {
            return { isVip: true, isSuperVip: false, discount: 5 }; // 5%
        }
        
        return { isVip: false, isSuperVip: false, discount: 0 };
    }
    
    /**
     * Calculate VIP discount for an amount
     */
    calculateVipDiscount(address, originalAmount) {
        // This would check balance in production
        // For now, return original amount
        return originalAmount;
    }
    
    // ============ Rewards ============
    
    /**
     * Reward player for gameplay
     */
    async rewardGameplay(playerAddress, rakeAmount) {
        if (!this.tokenContract) return null;
        
        const reward = Math.floor(rakeAmount * this.gameRewardRate);
        
        if (reward > 0) {
            // Mint reward tokens (requires minter permission)
            // await this.tokenContract.mint(playerAddress, reward).send({ from: serverWallet });
            console.log(`[ChipService] Rewarding ${reward} CHIP to ${playerAddress}`);
        }
        
        return reward;
    }
    
    /**
     * Reward player for tournament
     */
    async rewardTournament(playerAddress, rakeAmount) {
        if (!this.tokenContract) return null;
        
        const reward = Math.floor(rakeAmount * this.tournamentRewardRate);
        
        if (reward > 0) {
            console.log(`[ChipService] Tournament reward: ${reward} CHIP to ${playerAddress}`);
        }
        
        return reward;
    }
    
    // ============ Staking ============
    
    /**
     * Get staked amount for address
     */
    async getStakedAmount(address) {
        const stakes = await Stake.findActiveByPlayer(address);
        return stakes.reduce((sum, s) => sum + s.amount, 0);
    }
    
    /**
     * Get pending reward for address
     */
    async getPendingReward(address) {
        if (!this.stakingContract) return 0;
        
        const reward = await this.stakingContract.getPendingReward(address).call();
        return this.tronWeb.toDecimal(reward);
    }
    
    /**
     * Get stake info for address
     */
    async getStakeInfo(address) {
        const stakes = await Stake.findActiveByPlayer(address);
        const pendingReward = await this.getPendingReward(address);
        
        return {
            stakes: stakes.map(s => ({
                amount: s.amount,
                startTime: s.startTime,
                lockedUntil: s.lockedUntil,
                isLocked: s.isLocked(),
                remainingLockDays: s.getRemainingLockDays()
            })),
            totalStaked: stakes.reduce((sum, s) => sum + s.amount, 0),
            pendingReward
        };
    }
    
    /**
     * Stake CHIP tokens
     */
    async stake(address, amount, lockDuration) {
        // User initiates stake through contract directly
        // This method tracks in database
        
        const stake = new Stake({
            playerAddress: address,
            amount,
            lockDuration,
            isActive: true
        });
        
        await stake.save();
        
        console.log(`[ChipService] Staked ${amount} CHIP for ${lockDuration} days by ${address}`);
        
        return stake;
    }
    
    /**
     * Unstake CHIP tokens
     */
    async unstake(address) {
        const activeStakes = await Stake.findActiveByPlayer(address);
        
        for (const stake of activeStakes) {
            stake.unstake(0.1); // 10% penalty
            await stake.save();
        }
        
        console.log(`[ChipService] Unstaked all CHIP for ${address}`);
        
        return activeStakes;
    }
    
    /**
     * Claim staking rewards
     */
    async claimReward(address) {
        if (!this.stakingContract) return 0;
        
        // User calls contract directly
        // Update database
        
        const pendingReward = await this.getPendingReward(address);
        
        console.log(`[ChipService] Claimed ${pendingReward} CHIP reward for ${address}`);
        
        return pendingReward;
    }
    
    // ============ Distribute Rake ============
    
    /**
     * Distribute rake to stakers
     */
    async distributeRakeToStakers(rakeAmount) {
        if (!this.stakingContract || rakeAmount === 0) return;
        
        // Convert rake (TRX) to CHIP equivalent
        // In production, this would use an oracle or fixed rate
        const chipAmount = Math.floor(rakeAmount * 0.1); // Example rate
        
        // Add reward to staking contract
        // await this.stakingContract.addReward(chipAmount).send({ from: serverWallet });
        
        console.log(`[ChipService] Distributed ${chipAmount} CHIP to stakers from ${rakeAmount} TRX rake`);
        
        return chipAmount;
    }
    
    // ============ VIP Discount ============
    
    /**
     * Apply VIP discount to rake
     */
    applyVipDiscount(playerAddress, originalRake) {
        // Get VIP status from token balance
        // For now, simplified version
        return originalRake;
    }
}

module.exports = ChipService;
