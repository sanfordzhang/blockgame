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
     * Get VIP status based on STAKED amount (not balance)
     * VIP levels based on staking:
     * - Bronze: 0 CHIP staked
     * - Silver: 1,000 CHIP staked
     * - Gold: 10,000 CHIP staked
     * - Platinum: 100,000 CHIP staked
     */
    async getVipStatusByStaking(address) {
        const stakeInfo = await this.getOnChainStakeInfo(address);
        const stakedAmount = stakeInfo && stakeInfo.amount ? stakeInfo.amount : 0;

        const silverThreshold = 1000 * 1e6;      // 1,000 CHIP
        const goldThreshold = 10000 * 1e6;       // 10,000 CHIP
        const platinumThreshold = 100000 * 1e6;  // 100,000 CHIP

        if (stakedAmount >= platinumThreshold) {
            return { level: 'PLATINUM', discount: 20, chipRewardRate: 3.0, stakedAmount };
        } else if (stakedAmount >= goldThreshold) {
            return { level: 'GOLD', discount: 10, chipRewardRate: 2.0, stakedAmount };
        } else if (stakedAmount >= silverThreshold) {
            return { level: 'SILVER', discount: 5, chipRewardRate: 1.5, stakedAmount };
        }

        return { level: 'BRONZE', discount: 0, chipRewardRate: 1.0, stakedAmount };
    }

    /**
     * Get VIP status based on balance (legacy method for backwards compatibility)
     */
    getVipStatus(balance) {
        const silverThreshold = 1000 * 1e6;      // 1,000 CHIP
        const goldThreshold = 10000 * 1e6;       // 10,000 CHIP
        const platinumThreshold = 100000 * 1e6;  // 100,000 CHIP

        if (balance >= platinumThreshold) {
            return { isVip: true, isSuperVip: true, discount: 20, level: 'PLATINUM' };
        } else if (balance >= goldThreshold) {
            return { isVip: true, isSuperVip: false, discount: 10, level: 'GOLD' };
        } else if (balance >= silverThreshold) {
            return { isVip: true, isSuperVip: false, discount: 5, level: 'SILVER' };
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

    /**
     * Reward tournament winner with CHIP based on VIP level
     * CHIP reward = rakeAmount (TRX) × chipRewardRate
     *
     * VIP levels:
     * - Bronze: 1x rake = 5 CHIP for 5 TRX rake
     * - Silver: 1.5x rake = 7.5 CHIP for 5 TRX rake
     * - Gold: 2x rake = 10 CHIP for 5 TRX rake
     * - Platinum: 3x rake = 15 CHIP for 5 TRX rake
     *
     * @param {string} winnerAddress - Winner's wallet address
     * @param {number} rakeAmount - Rake amount in TRX (not SUN)
     * @returns {Promise<object>} Reward result
     */
    async rewardWinnerWithChipBonus(winnerAddress, rakeAmount) {
        try {
            // Get VIP status based on staked amount
            const vipStatus = await this.getVipStatusByStaking(winnerAddress);

            // Calculate CHIP reward: rake (TRX) × chipRewardRate
            // e.g., 5 TRX rake × 1.0 = 5 CHIP for Bronze
            const chipReward = Math.floor(rakeAmount * vipStatus.chipRewardRate);

            if (chipReward <= 0) {
                console.log(`[ChipService] No CHIP reward for ${winnerAddress} (rake: ${rakeAmount})`);
                return { success: true, chipReward: 0, vipLevel: vipStatus.level };
            }

            console.log(`[ChipService] Rewarding ${chipReward} CHIP to ${winnerAddress} (${vipStatus.level} VIP, rake: ${rakeAmount} TRX)`);

            // Send CHIP from treasury to winner
            const result = await this.withdrawToWallet(winnerAddress, chipReward);

            console.log(`[ChipService] CHIP reward sent: ${chipReward} CHIP to ${winnerAddress}, tx: ${result.txid}`);

            return {
                success: true,
                chipReward,
                vipLevel: vipStatus.level,
                txid: result.txid
            };
        } catch (error) {
            console.error(`[ChipService] Failed to reward winner ${winnerAddress}:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Reward player with CHIP based on position and VIP level
     * Used for all players (including those who left/disconnected)
     * 
     * @param {string} playerAddress - Player's wallet address
     * @param {number} rakeAmount - Rake amount in TRX (not SUN)
     * @param {number} multiplier - Position multiplier (1.0 for 1st, 0.3 for 2nd, etc.)
     * @param {number} position - Player's finishing position
     * @returns {Promise<object>} Reward result
     */
    async rewardPlayerWithChipBonus(playerAddress, rakeAmount, multiplier = 1.0, position = 1) {
        try {
            // Get VIP status based on staked amount
            const vipStatus = await this.getVipStatusByStaking(playerAddress);

            // Calculate CHIP reward: rake (TRX) × chipRewardRate × positionMultiplier
            // e.g., 5 TRX rake × 1.0 (VIP rate) × 0.3 (2nd place) = 1.5 CHIP
            const baseReward = Math.floor(rakeAmount * vipStatus.chipRewardRate);
            const chipReward = Math.floor(baseReward * multiplier);

            if (chipReward <= 0) {
                console.log(`[ChipService] No CHIP reward for ${playerAddress} (rake: ${rakeAmount}, multiplier: ${multiplier})`);
                return { success: true, chipReward: 0, vipLevel: vipStatus.level, position };
            }

            console.log(`[ChipService] Rewarding ${chipReward} CHIP to ${playerAddress} (${vipStatus.level} VIP, position: ${position}, rake: ${rakeAmount} TRX, multiplier: ${multiplier})`);

            // Send CHIP from treasury to player
            const result = await this.withdrawToWallet(playerAddress, chipReward);

            console.log(`[ChipService] CHIP reward sent: ${chipReward} CHIP to ${playerAddress}, tx: ${result.txid}`);

            return {
                success: true,
                chipReward,
                vipLevel: vipStatus.level,
                position,
                txid: result.txid
            };
        } catch (error) {
            console.error(`[ChipService] Failed to reward player ${playerAddress}:`, error.message);
            return {
                success: false,
                error: error.message,
                position
            };
        }
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
        if (!chipServiceInstance) return { isVip: false, isSuperVip: false, discount: 0, level: 'BRONZE' };
        return chipServiceInstance.getVipStatus(balance);
    },
    getVipStatusByStaking: async (address) => {
        if (!chipServiceInstance) return { level: 'BRONZE', discount: 0, chipRewardRate: 1.0, stakedAmount: 0 };
        return chipServiceInstance.getVipStatusByStaking(address);
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
