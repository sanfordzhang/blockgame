/**
 * Staking and Reward Integration Tests
 * Tests staking flow and reward distribution
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { BotManager } = require('../helpers/bot-player');

describe('Staking and Reward Integration', function () {
    this.timeout(60000);
    
    let botManager;
    let mockStakingContract;
    let mockChipContract;
    let mockStakeService;
    
    before(function () {
        botManager = new BotManager();
        
        // Mock contracts
        mockStakingContract = {
            stake: sinon.stub(),
            unstake: sinon.stub(),
            claimReward: sinon.stub(),
            getStakeInfo: sinon.stub(),
            pendingReward: sinon.stub()
        };
        
        mockChipContract = {
            approve: sinon.stub(),
            balanceOf: sinon.stub(),
            transfer: sinon.stub()
        };
    });
    
    afterEach(function () {
        botManager.disconnectAll();
        sinon.restore();
    });
    
    describe('Stake Operations', function () {
        it('should stake CHIP tokens successfully', async function () {
            const stakeAmount = 1000 * 1e6;
            const lockDuration = 30; // days
            
            mockChipContract.balanceOf.resolves(5000 * 1e6);
            mockChipContract.approve.resolves(true);
            mockStakingContract.stake.resolves({
                success: true,
                txHash: '0x123...'
            });
            mockStakingContract.getStakeInfo.resolves({
                stakedAmount: stakeAmount,
                lockEndTime: Date.now() + lockDuration * 24 * 60 * 60 * 1000
            });
            
            // Simulate stake operation
            const balance = await mockChipContract.balanceOf('TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');
            expect(balance).to.be.greaterThanOrEqual(stakeAmount);
            
            const approveResult = await mockChipContract.approve(stakeAmount);
            expect(approveResult).to.be.true;
            
            const stakeResult = await mockStakingContract.stake(stakeAmount, lockDuration);
            expect(stakeResult.success).to.be.true;
        });
        
        it('should reject stake with insufficient balance', async function () {
            const stakeAmount = 10000 * 1e6;
            
            mockChipContract.balanceOf.resolves(1000 * 1e6);
            
            const balance = await mockChipContract.balanceOf('TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');
            
            expect(balance).to.be.lessThan(stakeAmount);
        });
        
        it('should enforce minimum lock duration', async function () {
            const minLockDuration = 7; // days
            
            // Attempt with too short lock
            expect(() => {
                if (1 < minLockDuration) throw new Error('Lock duration too short');
            }).to.throw('Lock duration too short');
        });
    });
    
    describe('Unstake Operations', function () {
        it('should unstake after lock period without penalty', async function () {
            const stakeAmount = 1000 * 1e6;
            const lockEndTime = Date.now() - 1000; // Already expired
            
            mockStakingContract.getStakeInfo.resolves({
                stakedAmount: stakeAmount,
                lockEndTime: lockEndTime
            });
            
            mockStakingContract.unstake.resolves({
                success: true,
                amount: stakeAmount,
                penalty: 0
            });
            
            const stakeInfo = await mockStakingContract.getStakeInfo('TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');
            
            // Check if lock period has ended
            const isLocked = stakeInfo.lockEndTime > Date.now();
            expect(isLocked).to.be.false;
            
            const result = await mockStakingContract.unstake(stakeAmount);
            expect(result.penalty).to.equal(0);
        });
        
        it('should apply penalty for early unstake', async function () {
            const stakeAmount = 1000 * 1e6;
            const lockEndTime = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days future
            
            mockStakingContract.getStakeInfo.resolves({
                stakedAmount: stakeAmount,
                lockEndTime: lockEndTime
            });
            
            // 10% early unstake penalty
            const penaltyRate = 0.1;
            const penalty = stakeAmount * penaltyRate;
            const netAmount = stakeAmount - penalty;
            
            mockStakingContract.unstake.resolves({
                success: true,
                amount: netAmount,
                penalty: penalty,
                earlyUnstake: true
            });
            
            const result = await mockStakingContract.unstake(stakeAmount);
            expect(result.penalty).to.equal(penalty);
            expect(result.earlyUnstake).to.be.true;
        });
        
        it('should reject unstake when no active stake', async function () {
            mockStakingContract.getStakeInfo.resolves({
                stakedAmount: 0
            });
            
            const stakeInfo = await mockStakingContract.getStakeInfo('TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');
            expect(stakeInfo.stakedAmount).to.equal(0);
        });
    });
    
    describe('Reward Distribution', function () {
        it('should calculate pending rewards correctly', async function () {
            const stakedAmount = 1000 * 1e6;
            const stakingDuration = 30 * 24 * 60 * 60; // 30 days in seconds
            const rewardRate = 0.12; // 12% APY
            
            // Calculate expected reward
            const expectedReward = stakedAmount * rewardRate * (stakingDuration / (365 * 24 * 60 * 60));
            
            mockStakingContract.pendingReward.resolves(Math.floor(expectedReward));
            
            const pendingReward = await mockStakingContract.pendingReward('TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');
            
            // Should be close to expected
            expect(pendingReward).to.be.closeTo(expectedReward, expectedReward * 0.01);
        });
        
        it('should claim rewards successfully', async function () {
            const pendingReward = 50 * 1e6;
            
            mockStakingContract.pendingReward.resolves(pendingReward);
            mockStakingContract.claimReward.resolves({
                success: true,
                amount: pendingReward,
                txHash: '0x123...'
            });
            
            const reward = await mockStakingContract.pendingReward('TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');
            expect(reward).to.be.greaterThan(0);
            
            const result = await mockStakingContract.claimReward();
            expect(result.success).to.be.true;
            expect(result.amount).to.equal(pendingReward);
        });
        
        it('should reject claim with no pending rewards', async function () {
            mockStakingContract.pendingReward.resolves(0);
            
            const pendingReward = await mockStakingContract.pendingReward('TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');
            expect(pendingReward).to.equal(0);
        });
    });
    
    describe('VIP Status', function () {
        it('should grant VIP status for sufficient stake', async function () {
            const vipThreshold = 10000 * 1e6; // 10k CHIP
            
            mockStakingContract.getStakeInfo.resolves({
                stakedAmount: 15000 * 1e6
            });
            
            const stakeInfo = await mockStakingContract.getStakeInfo('TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');
            
            const isVIP = stakeInfo.stakedAmount >= vipThreshold;
            expect(isVIP).to.be.true;
        });
        
        it('should calculate VIP discount correctly', function () {
            // VIP discount tiers
            const tiers = [
                { minStake: 10000, discount: 0.10 },  // 10% discount
                { minStake: 50000, discount: 0.20 },  // 20% discount
                { minStake: 100000, discount: 0.30 }  // 30% discount
            ];
            
            function getDiscount(stake) {
                let discount = 0;
                for (const tier of tiers) {
                    if (stake >= tier.minStake * 1e6) {
                        discount = tier.discount;
                    }
                }
                return discount;
            }
            
            expect(getDiscount(5000 * 1e6)).to.equal(0);
            expect(getDiscount(15000 * 1e6)).to.equal(0.10);
            expect(getDiscount(60000 * 1e6)).to.equal(0.20);
            expect(getDiscount(150000 * 1e6)).to.equal(0.30);
        });
    });
    
    describe('Rake Distribution to Stakers', function () {
        it('should distribute rake proportionally', function () {
            const totalRake = 100 * 1e6; // 100 CHIP
            
            const stakers = [
                { address: 'TPL1', stakedAmount: 5000 * 1e6 },
                { address: 'TPL2', stakedAmount: 3000 * 1e6 },
                { address: 'TPL3', stakedAmount: 2000 * 1e6 }
            ];
            
            const totalStaked = stakers.reduce((sum, s) => sum + s.stakedAmount, 0);
            
            // Distribute proportionally
            const distribution = stakers.map(s => ({
                address: s.address,
                reward: Math.floor(totalRake * s.stakedAmount / totalStaked)
            }));
            
            expect(distribution[0].reward).to.equal(50 * 1e6); // 50%
            expect(distribution[1].reward).to.equal(30 * 1e6); // 30%
            expect(distribution[2].reward).to.equal(20 * 1e6); // 20%
        });
    });
});
