/**
 * 迁移用户质押：旧合约 -> 新合约
 * 用户地址: TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv
 */

const { TronWeb } = require('tronweb');

const CHIP_TOKEN_ADDRESS = 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';
const OLD_STAKING = 'TLQUifq6SDHz2rNBLTzJ2kEqsbhQXMfRCs';
const NEW_STAKING = 'TBz2FDnQtfAqUfjeZhcTTKhuC15SHqXmdc';

const PRIVATE_KEY = '[REMOVED PRIVATE KEY - SEE .env FOR CONFIG]';

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
        console.log('✅ 领取奖励交易:', claimTx);
        await delay(5000);
        
        const afterClaimBalance = await chipContract.balanceOf(userAddress).call();
        console.log('领取后CHIP余额:', formatChip(afterClaimBalance));
        
    } catch (error) {
        console.log('❌ 领取奖励失败:', error.message);
    }
    
    // 步骤2：从旧合约解除质押
    console.log('\n----------------------------------------');
    console.log('步骤2：从旧合约解除质押（10%惩罚）');
    console.log('----------------------------------------');
    
    try {
        const unstakeTx = await oldStaking.unstake(oldStakeAmount.toString()).send({
            feeLimit: 100_000_000
        });
        console.log('✅ 解除质押交易:', unstakeTx);
        await delay(5000);
        
        const afterUnstakeBalance = await chipContract.balanceOf(userAddress).call();
        console.log('解押后CHIP余额:', formatChip(afterUnstakeBalance));
        
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
        const approveTx = await chipContract.approve(NEW_STAKING, rewardPoolAmount).send({
            feeLimit: 100_000_000
        });
        console.log('Approve交易:', approveTx);
        await delay(3000);
        
        const addRewardTx = await newStaking.addReward(rewardPoolAmount).send({
            feeLimit: 100_000_000
        });
        console.log('✅ 添加奖励池交易:', addRewardTx);
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
    
    console.log('当前CHIP余额:', formatChip(currentBalance));
    
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
        console.log('✅ 质押交易:', stakeTx);
        await delay(5000);
        
        // 验证质押状态
        const newStakeInfo = await newStaking.stakes(userAddress).call();
        console.log('新合约质押金额:', formatChip(newStakeInfo.amount));
        console.log('新合约是否激活:', newStakeInfo.isActive);
        
        const newTotalStaked = await newStaking.totalStaked().call();
        const newLargestStake = await newStaking.largestStake().call();
        console.log('新合约总质押:', formatChip(newTotalStaked));
        console.log('新合约最大质押:', formatChip(newLargestStake));
        
        const newPendingReward = await newStaking.getPendingReward(userAddress).call();
        console.log('新合约待领取奖励:', formatChip(newPendingReward));
        
    } catch (error) {
        console.log('❌ 质押失败:', error.message);
    }
    
    // 最终状态
    console.log('\n========================================');
    console.log('迁移完成');
    console.log('========================================');
    
    const finalChipBalance = await chipContract.balanceOf(userAddress).call();
    console.log('初始CHIP余额:', formatChip(initialChipBalance));
    console.log('最终CHIP余额:', formatChip(finalChipBalance));
    console.log('CHIP变化:', formatChip(BigInt(finalChipBalance) - BigInt(initialChipBalance)));
    
    console.log('\n✅ 迁移成功！新合约地址:', NEW_STAKING);
    console.log('\n新的奖励规则：');
    console.log('- 每日奖励 = clamp(最大质押 × (用户质押/总质押) / 30, 1 CHIP, 1000 CHIP)');
}

main().catch(console.error);
