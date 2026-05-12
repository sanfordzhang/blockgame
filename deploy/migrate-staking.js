/**
 * 迁移质押从旧合约到新合约
 * 1. 从旧合约领取奖励
 * 2. 从旧合约解除质押
 * 3. 在新合约重新质押
 */

const { TronWeb } = require('tronweb');

const CHIP_TOKEN_ADDRESS = 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';
const OLD_STAKING = 'TLQUifq6SDHz2rNBLTzJ2kEqsbhQXMfRCs';  // 旧合约
const NEW_STAKING = 'TBz2FDnQtfAqUfjeZhcTTKhuC15SHqXmdc';  // 新合约

const PRIVATE_KEY = 'b185b511ad8314b5cf787108676581223ce354321428f6efb46ef2370c882905';

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: PRIVATE_KEY
});

function formatChip(amount) {
    return (Number(amount) / 1e6).toFixed(2) + ' CHIP';
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('========================================');
    console.log('质押迁移：旧合约 -> 新合约');
    console.log('========================================\n');
    
    // 获取账户地址
    const account = tronWeb.address.fromPrivateKey(PRIVATE_KEY);
    const userAddress = typeof account === 'object' ? account.address : account;
    console.log('用户地址:', userAddress);
    
    // 获取合约实例
    const chipContract = await tronWeb.contract().at(CHIP_TOKEN_ADDRESS);
    const oldStaking = await tronWeb.contract().at(OLD_STAKING);
    const newStaking = await tronWeb.contract().at(NEW_STAKING);
    
    // 步骤0：查看当前状态
    console.log('\n----------------------------------------');
    console.log('步骤0：查看当前状态');
    console.log('----------------------------------------');
    
    const initialChipBalance = await chipContract.balanceOf(userAddress).call();
    console.log('初始CHIP余额:', formatChip(initialChipBalance));
    
    const oldStakeInfo = await oldStaking.stakes(userAddress).call();
    const oldStakeAmount = oldStakeInfo.amount || oldStakeInfo[0];
    const oldIsActive = oldStakeInfo.isActive || oldStakeInfo[4];
    console.log('旧合约质押金额:', formatChip(oldStakeAmount));
    console.log('旧合约是否激活:', oldIsActive);
    
    const oldPendingReward = await oldStaking.getPendingReward(userAddress).call();
    console.log('旧合约待领取奖励:', formatChip(oldPendingReward));
    
    if (!oldIsActive || oldStakeAmount === 0n) {
        console.log('\n❌ 旧合约没有活跃的质押，无需迁移');
        return;
    }
    
    // 步骤1：从旧合约领取奖励
    console.log('\n----------------------------------------');
    console.log('步骤1：从旧合约领取奖励');
    console.log('----------------------------------------');
    
    try {
        const claimTx = await oldStaking.claimReward().send({
            feeLimit: 100_000_000
        });
        console.log('领取奖励交易:', claimTx);
        await delay(5000);
        
        const afterClaimBalance = await chipContract.balanceOf(userAddress).call();
        console.log('领取后CHIP余额:', formatChip(afterClaimBalance));
        
    } catch (error) {
        console.log('❌ 领取奖励失败:', error.message);
    }
    
    // 步骤2：从旧合约解除质押
    console.log('\n----------------------------------------');
    console.log('步骤2：从旧合约解除质押');
    console.log('----------------------------------------');
    
    // 检查是否锁定
    const lockedUntil = oldStakeInfo.lockedUntil || oldStakeInfo[2];
    const isLocked = Date.now() / 1000 < Number(lockedUntil);
    
    if (isLocked) {
        console.log('⚠️ 质押仍在锁定期，提前解押将有10%惩罚');
    }
    
    try {
        const unstakeTx = await oldStaking.unstake(oldStakeAmount.toString()).send({
            feeLimit: 100_000_000
        });
        console.log('解除质押交易:', unstakeTx);
        await delay(5000);
        
        const afterUnstakeBalance = await chipContract.balanceOf(userAddress).call();
        console.log('解押后CHIP余额:', formatChip(afterUnstakeBalance));
        
        // 计算惩罚
        const expectedWithoutPenalty = BigInt(initialChipBalance) + oldPendingReward + oldStakeAmount;
        const actualBalance = BigInt(afterUnstakeBalance);
        const penalty = expectedWithoutPenalty - actualBalance;
        if (penalty > 0n) {
            console.log('惩罚金额:', formatChip(penalty));
        }
        
    } catch (error) {
        console.log('❌ 解除质押失败:', error.message);
        return;
    }
    
    // 步骤3：在新合约添加奖励池
    console.log('\n----------------------------------------');
    console.log('步骤3：在新合约添加奖励池');
    console.log('----------------------------------------');
    
    const rewardPoolAmount = 100000n * 1000000n; // 100,000 CHIP
    
    try {
        // Approve
        const approveTx = await chipContract.approve(NEW_STAKING, rewardPoolAmount).send({
            feeLimit: 100_000_000
        });
        console.log('Approve交易:', approveTx);
        await delay(3000);
        
        // Add reward
        const addRewardTx = await newStaking.addReward(rewardPoolAmount).send({
            feeLimit: 100_000_000
        });
        console.log('添加奖励池交易:', addRewardTx);
        await delay(3000);
        
        const totalRewardPool = await newStaking.totalRewardPool().call();
        console.log('新合约奖励池:', formatChip(totalRewardPool));
        
    } catch (error) {
        console.log('❌ 添加奖励池失败:', error.message);
    }
    
    // 步骤4：在新合约重新质押
    console.log('\n----------------------------------------');
    console.log('步骤4：在新合约重新质押');
    console.log('----------------------------------------');
    
    const currentBalance = await chipContract.balanceOf(userAddress).call();
    const stakeAmount = 1000n * 1000000n; // 1000 CHIP
    
    if (BigInt(currentBalance) < stakeAmount) {
        console.log('❌ CHIP余额不足，无法质押1000 CHIP');
        console.log('当前余额:', formatChip(currentBalance));
        return;
    }
    
    try {
        // Approve
        const approveTx = await chipContract.approve(NEW_STAKING, stakeAmount).send({
            feeLimit: 100_000_000
        });
        console.log('Approve交易:', approveTx);
        await delay(3000);
        
        // Stake (30天锁定期)
        const lockDuration = 30 * 24 * 60 * 60;
        const stakeTx = await newStaking.stake(stakeAmount, lockDuration).send({
            feeLimit: 100_000_000
        });
        console.log('质押交易:', stakeTx);
        await delay(5000);
        
        // 验证质押状态
        const newStakeInfo = await newStaking.stakes(userAddress).call();
        console.log('新合约质押金额:', formatChip(newStakeInfo.amount));
        console.log('新合约是否激活:', newStakeInfo.isActive);
        
        const newTotalStaked = await newStaking.totalStaked().call();
        const newLargestStake = await newStaking.largestStake().call();
        console.log('新合约总质押:', formatChip(newTotalStaked));
        console.log('新合约最大质押:', formatChip(newLargestStake));
        
    } catch (error) {
        console.log('❌ 质押失败:', error.message);
    }
    
    // 最终状态
    console.log('\n========================================');
    console.log('迁移完成');
    console.log('========================================');
    
    const finalChipBalance = await chipContract.balanceOf(userAddress).call();
    console.log('最终CHIP余额:', formatChip(finalChipBalance));
    
    // 旧合约状态
    const oldStakeFinal = await oldStaking.stakes(userAddress).call();
    console.log('旧合约质押:', formatChip(oldStakeFinal.amount || oldStakeFinal[0]));
    
    // 新合约状态
    const newStakeFinal = await newStaking.stakes(userAddress).call();
    const newPendingReward = await newStaking.getPendingReward(userAddress).call();
    console.log('新合约质押:', formatChip(newStakeFinal.amount));
    console.log('新合约待领取奖励:', formatChip(newPendingReward));
    
    console.log('\n✅ 迁移完成！新合约地址:', NEW_STAKING);
}

main().catch(console.error);
