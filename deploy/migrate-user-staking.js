/**
 * 检查用户质押状态并提供迁移指导
 * 用户地址: TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv
 */

const { TronWeb } = require('tronweb');

const CHIP_TOKEN_ADDRESS = 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';
const OLD_STAKING = 'TLQUifq6SDHz2rNBLTzJ2kEqsbhQXMfRCs';
const NEW_STAKING = 'TBz2FDnQtfAqUfjeZhcTTKhuC15SHqXmdc';

const USER_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: '0000000000000000000000000000000000000000000000000000000000000001' // 任意私钥用于读取
});

function formatChip(amount) {
    return (Number(amount) / 1e6).toFixed(2) + ' CHIP';
}

async function main() {
    console.log('========================================');
    console.log('用户质押状态检查');
    console.log('========================================\n');
    
    console.log('用户地址:', USER_ADDRESS);
    
    const chipContract = await tronWeb.contract().at(CHIP_TOKEN_ADDRESS);
    const oldStaking = await tronWeb.contract().at(OLD_STAKING);
    const newStaking = await tronWeb.contract().at(NEW_STAKING);
    
    // CHIP余额
    const chipBalance = await chipContract.balanceOf(USER_ADDRESS).call();
    console.log('\nCHIP余额:', formatChip(chipBalance));
    
    // 旧合约状态
    console.log('\n----------------------------------------');
    console.log('旧合约状态 (TLQUifq6SDHz2rNBLTzJ2kEqsbhQXMfRCs)');
    console.log('----------------------------------------');
    
    const oldStake = await oldStaking.stakes(USER_ADDRESS).call();
    const oldAmount = oldStake.amount || oldStake[0];
    const oldIsActive = oldStake.isActive || oldStake[4];
    const oldLockedUntil = oldStake.lockedUntil || oldStake[2];
    const oldLastClaim = oldStake.lastClaimTime || oldStake[3];
    
    console.log('质押金额:', formatChip(oldAmount));
    console.log('是否激活:', oldIsActive);
    console.log('锁定至:', new Date(Number(oldLockedUntil) * 1000).toISOString());
    console.log('上次领取:', new Date(Number(oldLastClaim) * 1000).toISOString());
    
    const oldPending = await oldStaking.getPendingReward(USER_ADDRESS).call();
    console.log('待领取奖励:', formatChip(oldPending));
    
    const oldTotalStaked = await oldStaking.totalStaked().call();
    console.log('总质押:', formatChip(oldTotalStaked));
    
    // 新合约状态
    console.log('\n----------------------------------------');
    console.log('新合约状态 (TBz2FDnQtfAqUfjeZhcTTKhuC15SHqXmdc)');
    console.log('----------------------------------------');
    
    const newStake = await newStaking.stakes(USER_ADDRESS).call();
    console.log('质押金额:', formatChip(newStake.amount));
    console.log('是否激活:', newStake.isActive);
    
    const newTotalStaked = await newStaking.totalStaked().call();
    const newLargestStake = await newStaking.largestStake().call();
    const newRewardPool = await newStaking.totalRewardPool().call();
    
    console.log('总质押:', formatChip(newTotalStaked));
    console.log('最大质押:', formatChip(newLargestStake));
    console.log('奖励池:', formatChip(newRewardPool));
    
    // 迁移指导
    console.log('\n========================================');
    console.log('迁移指导');
    console.log('========================================');
    
    if (oldIsActive && oldAmount > 0n) {
        console.log('\n📌 您需要在钱包页面操作以下步骤：');
        console.log('\n步骤1: 领取旧合约奖励');
        console.log('  - 当前待领取: ' + formatChip(oldPending));
        console.log('  - 点击 "Claim" 按钮（使用旧合约地址）');
        
        console.log('\n步骤2: 解除旧合约质押');
        console.log('  - 质押金额: ' + formatChip(oldAmount));
        console.log('  - ⚠️ 提前解押会有10%惩罚');
        const penalty = Number(oldAmount) / 1e6 * 0.1;
        console.log('  - 预计惩罚: ' + penalty.toFixed(2) + ' CHIP');
        console.log('  - 点击 "Unstake" 按钮');
        
        console.log('\n步骤3: 在新合约质押');
        console.log('  - 新合约地址: ' + NEW_STAKING);
        console.log('  - 输入质押金额和锁定期');
        console.log('  - 点击 "Stake" 按钮');
        
        console.log('\n💡 提示: 前端已更新为使用新合约地址');
    } else {
        console.log('\n✅ 旧合约无活跃质押，无需迁移');
    }
    
    // 检查新合约奖励池
    if (Number(newRewardPool) < 100000000000n) { // < 100,000 CHIP
        console.log('\n⚠️ 新合约奖励池不足，需要先添加奖励');
        console.log('   请运行: node add-staking-reward.js');
    }
}

main().catch(console.error);
