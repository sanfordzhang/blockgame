/**
 * ChipService
 * Manages CHIP token rewards, VIP status, and staking integration
 * 
 * Note: Staking data is read directly from blockchain (on-chain source of truth)
 * Database (ChipTransaction) is only used for operation history/logs
 */

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
     * Get CHIP balance for address (on-chain)
     */
    async getBalance(address) {
        if (!this.tokenContract) return 0;
        
        const balance = await this.tokenContract.balanceOf(address).call();
        return this.tronWeb.toDecimal(balance);
    }
    
    /**
     * Get user info (balance, staked, VIP status) - all from on-chain
     */
    async getUserInfo(address) {
        const balance = await this.getBalance(address);
        const stakeInfo = await this.getOnChainStakeInfo(address);
        const pendingReward = await this.getPendingReward(address);
        const vipStatus = this.getVipStatus(balance);
        
        return {
            address,
            balance,
            stakedAmount: stakeInfo.amount,
            pendingReward,
            totalValue: balance + stakeInfo.amount,
            isVip: vipStatus.isVip,
            isSuperVip: vipStatus.isSuperVip,
            discount: vipStatus.discount
        };
    }
    
    /**
     * Get VIP status based on balance
     */
    getVipStatus(balance) {
        const vipThreshold = 10000 * 1e6;     // 10,000 CHIP
        const superVipThreshold = 100000 * 1e6; // 100,000 CHIP
        
        if (balance >= superVipThreshold) {
            return { isVip: true, isSuperVip: true, discount: 10, level: 'PLATINUM' };
        } else if (balance >= vipThreshold) {
            return { isVip: true, isSuperVip: false, discount: 5, level: 'GOLD' };
        }
        
        return { isVip: false, isSuperVip: false, discount: 0, level: 'BRONZE' };
    }
    
    // ============ Staking (On-chain only) ============
    
    /**
     * Get staked amount for address (from on-chain)
     */
    async getStakedAmount(address) {
        const stakeInfo = await this.getOnChainStakeInfo(address);
        return stakeInfo && stakeInfo.amount > 0 ? stakeInfo.amount : 0;
    }
    
    /**
     * Get on-chain stake info from staking contract
     */
    async getOnChainStakeInfo(address) {
        if (!this.stakingContract) {
            return { amount: 0, startTime: null, lockedUntil: null, isActive: false };
        }
        
        try {
            const result = await this.stakingContract.stakes(address).call();
            
            const amount = Number(result.amount) / 1e6; // Convert from SUN to CHIP
            const startTime = Number(result.startTime) * 1000;
            const lockedUntil = Number(result.lockedUntil) * 1000;
            const isActive = result.isActive;
            
            return {
                amount,
                startTime: startTime > 0 ? new Date(startTime) : null,
                lockedUntil: lockedUntil > 0 ? new Date(lockedUntil) : null,
                isActive,
                isLocked: Date.now() < lockedUntil,
                remainingLockMs: Math.max(0, lockedUntil - Date.now()),
                remainingLockDays: Math.max(0, Math.floor((lockedUntil - Date.now()) / (1000 * 60 * 60 * 24)))
            };
        } catch (error) {
            console.error('[ChipService] Error getting on-chain stake info:', error.message);
            return { amount: 0, startTime: null, lockedUntil: null, isActive: false };
        }
    }
    
    /**
     * Get pending reward from staking contract
     */
    async getPendingReward(address) {
        if (!this.stakingContract) return 0;
        
        try {
            const reward = await this.stakingContract.getPendingReward(address).call();
            return Number(reward) / 1e6;
        } catch (error) {
            console.error('[ChipService] Error getting pending reward:', error.message);
            return 0;
        }
    }
    
    /**
     * Get total staked in contract
     */
    async getTotalStaked() {
        if (!this.stakingContract) return 0;
        
        try {
            const total = await this.stakingContract.totalStaked().call();
            return Number(total) / 1e6;
        } catch (error) {
            console.error('[ChipService] Error getting total staked:', error.message);
            return 0;
        }
    }
    
    /**
     * Prepare stake transaction data for frontend to sign
     * User calls contract directly via TronLink
     */
    prepareStakeData(amount, lockDurationSeconds) {
        if (!this.stakingAddress) {
            throw new Error('Staking contract not configured');
        }
        
        const amountInSun = Math.floor(amount * 1e6);
        
        return {
            stakingContract: this.stakingAddress,
            chipToken: this.tokenAddress,
            method: 'stake(uint256,uint256)',
            params: {
                amount: amountInSun,
                lockDuration: lockDurationSeconds
            },
            // User needs to approve CHIP token first
            needsApproval: true,
            approveSpender: this.stakingAddress,
            approveAmount: amountInSun
        };
    }
    
    /**
     * Prepare unstake transaction data for frontend to sign
     */
    prepareUnstakeData(amount) {
        if (!this.stakingAddress) {
            throw new Error('Staking contract not configured');
        }
        
        const amountInSun = Math.floor(amount * 1e6);
        
        return {
            stakingContract: this.stakingAddress,
            method: 'unstake(uint256)',
            params: { amount: amountInSun }
        };
    }
    
    /**
     * Prepare claim reward transaction data for frontend to sign
     */
    prepareClaimRewardData() {
        if (!this.stakingAddress) {
            throw new Error('Staking contract not configured');
        }
        
        return {
            stakingContract: this.stakingAddress,
            method: 'claimReward()',
            params: {}
        };
    }
    
    // ============ On-chain Operations ============
    
    /**
     * Get on-chain CHIP balance for address
     */
    async getOnChainBalance(address) {
        if (!this.tokenContract) return 0;
        
        try {
            const balance = await this.tokenContract.balanceOf(address).call();
            return Number(balance) / 1e6;
        } catch (error) {
            console.error('[ChipService] Error getting on-chain balance:', error.message);
            return 0;
        }
    }
    
    /**
     * Withdraw CHIP from treasury to user's wallet
     */
    async withdrawToWallet(userAddress, amount) {
        if (!this.tokenContract) {
            throw new Error('CHIP token contract not initialized');
        }
        
        const privateKey = process.env.TESTNET_PRIVATE_KEY || process.env.MAINNET_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('No private key configured for withdrawals');
        }
        
        const { TronWeb } = require('tronweb');
        const tronWebWithPK = new TronWeb({
            fullHost: this.tronWeb.fullNode.host,
            privateKey: privateKey
        });
        
        const treasuryResult = await tronWebWithPK.address.fromPrivateKey(privateKey);
        const treasuryAddress = typeof treasuryResult === 'string' ? treasuryResult : treasuryResult.address;
        
        const amountInSun = Math.floor(amount * 1e6);
        
        const treasuryBalance = await this.tokenContract.balanceOf(treasuryAddress).call();
        const treasuryBalanceNum = this.tronWeb.toDecimal(treasuryBalance);
        
        if (treasuryBalanceNum < amountInSun) {
            throw new Error(`Insufficient treasury balance. Has ${treasuryBalanceNum / 1e6} CHIP`);
        }
        
        const contractWithPK = await tronWebWithPK.contract().at(this.tokenAddress);
        
        const tx = await contractWithPK.transfer(userAddress, amountInSun).send({
            feeLimit: 100_000_000
        });
        
        const newBalance = await this.getOnChainBalance(userAddress);
        
        return {
            txid: tx,
            from: treasuryAddress,
            to: userAddress,
            amount: amount,
            newBalance: newBalance
        };
    }
    
    // ============ Rewards ============
    
    /**
     * Reward player for gameplay
     */
    async rewardGameplay(playerAddress, rakeAmount) {
        const reward = Math.floor(rakeAmount * this.gameRewardRate);
        if (reward > 0) {
            console.log(`[ChipService] Gameplay reward: ${reward} CHIP to ${playerAddress}`);
        }
        return reward;
    }
    
    /**
     * Reward player for tournament
     */
    async rewardTournament(playerAddress, rakeAmount) {
        const reward = Math.floor(rakeAmount * this.tournamentRewardRate);
        if (reward > 0) {
            console.log(`[ChipService] Tournament reward: ${reward} CHIP to ${playerAddress}`);
        }
        return reward;
    }
}

// Singleton instance
let chipServiceInstance = null;

/**
 * Initialize ChipService singleton
 */
async function initChipService(tronWeb, config = {}) {
    if (!chipServiceInstance) {
        chipServiceInstance = new ChipService({
            tronWeb,
            chipTokenAddress: config.chipTokenAddress || process.env.CHIP_TOKEN_ADDRESS,
            stakingAddress: config.stakingAddress || process.env.STAKING_CONTRACT_ADDRESS,
            gameRewardRate: config.gameRewardRate,
            tournamentRewardRate: config.tournamentRewardRate
        });
        
        try {
            await chipServiceInstance.init();
            console.log('[ChipService] Initialized successfully');
        } catch (err) {
            console.warn('[ChipService] Failed to initialize:', err.message);
        }
    }
    return chipServiceInstance;
}

// Export
module.exports = {
    ChipService,
    initChipService,
    getChipService: () => chipServiceInstance,
    
    // Proxy methods
    getBalance: async (address) => {
        if (!chipServiceInstance) return 0;
        return chipServiceInstance.getBalance(address);
    },
    getUserInfo: async (address) => {
        if (!chipServiceInstance) return { balance: 0, stakedAmount: 0, pendingReward: 0, isVip: false };
        return chipServiceInstance.getUserInfo(address);
    },
    getVIPStatus: (balance) => {
        if (!chipServiceInstance) return { isVip: false, isSuperVip: false, discount: 0 };
        return chipServiceInstance.getVipStatus(balance);
    },
    getOnChainStakeInfo: async (address) => {
        if (!chipServiceInstance) return { amount: 0, startTime: null, lockedUntil: null, isActive: false };
        return chipServiceInstance.getOnChainStakeInfo(address);
    },
    getPendingRewards: async (address) => {
        if (!chipServiceInstance) return 0;
        return chipServiceInstance.getPendingReward(address);
    },
    getPendingStakeReward: async (address) => {
        if (!chipServiceInstance) return 0;
        return chipServiceInstance.getPendingReward(address);
    },
    getTotalStaked: async () => {
        if (!chipServiceInstance) return 0;
        return chipServiceInstance.getTotalStaked();
    },
    getOnChainBalance: async (address) => {
        if (!chipServiceInstance) return 0;
        return chipServiceInstance.getOnChainBalance(address);
    },
    withdrawToWallet: async (userAddress, amount) => {
        if (!chipServiceInstance) throw new Error('ChipService not initialized');
        return chipServiceInstance.withdrawToWallet(userAddress, amount);
    },
    prepareStakeData: (amount, lockDuration) => {
        if (!chipServiceInstance) throw new Error('ChipService not initialized');
        return chipServiceInstance.prepareStakeData(amount, lockDuration);
    },
    prepareUnstakeData: (amount) => {
        if (!chipServiceInstance) throw new Error('ChipService not initialized');
        return chipServiceInstance.prepareUnstakeData(amount);
    },
    prepareClaimRewardData: () => {
        if (!chipServiceInstance) throw new Error('ChipService not initialized');
        return chipServiceInstance.prepareClaimRewardData();
    },
    getStakeInfo: async (address) => {
        if (!chipServiceInstance) return { stakes: [], pendingReward: 0 };
        const info = await chipServiceInstance.getOnChainStakeInfo(address);
        const pendingReward = await chipServiceInstance.getPendingReward(address);
        return {
            stakes: info.isActive ? [info] : [],
            totalStaked: info.amount,
            pendingReward
        };
    },
    getSupplyInfo: async () => {
        return { totalSupply: 0, stakedSupply: 0, circulatingSupply: 0 };
    },
    getTransactionHistory: async () => {
        return { history: [], total: 0 };
    },
    claimRewards: async (address) => {
        if (!chipServiceInstance) return { claimedAmount: 0 };
        const reward = await chipServiceInstance.getPendingReward(address);
        return { claimedAmount: reward };
    },
    // Legacy methods (no longer write to database)
    createStake: async () => {
        console.log('[ChipService] createStake: Use frontend to call contract directly');
        return { success: true, message: 'Use prepareStakeData and call contract from frontend' };
    },
    unstake: async () => {
        console.log('[ChipService] unstake: Use frontend to call contract directly');
        return { success: true, message: 'Use prepareUnstakeData and call contract from frontend' };
    },
    claimStakeReward: async (address) => {
        if (!chipServiceInstance) return { claimedAmount: 0 };
        const reward = await chipServiceInstance.getPendingReward(address);
        return { claimedAmount: reward };
    },
    getStakingStats: async () => {
        if (!chipServiceInstance) return { totalStaked: 0, totalStakers: 0 };
        const totalStaked = await chipServiceInstance.getTotalStaked();
        return { totalStaked, totalStakers: 0 };
    },
    transfer: async () => {
        return { success: true, txHash: 'pending' };
    }
};
