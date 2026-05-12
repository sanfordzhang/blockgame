/**
 * 测试质押合约流程：stake -> claim -> unstake
 * 验证CHIP余额变化是否正确
 */

const { TronWeb } = require('tronweb');
const fs = require('fs');
const path = require('path');

// 配置
const CHIP_TOKEN_ADDRESS = 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';
const PRIVATE_KEY = 'b185b511ad8314b5cf787108676581223ce354321428f6efb46ef2370c882905';

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: PRIVATE_KEY
});

// 格式化CHIP金额
function formatChip(amount) {
    return (Number(amount) / 1e6).toFixed(2) + ' CHIP';
}

// 延迟函数
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('========================================');
    console.log('质押合约测试流程');
    console.log('========================================\n');
    
    // 获取测试账户地址
    const account = tronWeb.address.fromPrivateKey(PRIVATE_KEY);
    const testAddress = typeof account === 'object' ? account.address : account;
    console.log('测试账户:', testAddress);
    
    // 读取编译后的合约
    let contractJson;
    try {
        contractJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'build/contracts/Staking.json'), 'utf8'));
    } catch (e) {
        console.log('\n❌ 错误：找不到编译后的合约文件');
        return;
    }
    
    const bytecode = contractJson.bytecode;
    const abi = contractJson.abi;
    
    // 获取CHIP合约
    const chipContract = await tronWeb.contract().at(CHIP_TOKEN_ADDRESS);
    
    // 步骤0：查看初始余额
    console.log('\n----------------------------------------');
    console.log('步骤0：查看初始余额');
    console.log('----------------------------------------');
    
    const initialChipBalance = await chipContract.balanceOf(testAddress).call();
    console.log('初始CHIP余额:', formatChip(initialChipBalance));
    
    // 步骤1：部署新质押合约
    console.log('\n----------------------------------------');
    console.log('步骤1：部署新质押合约');
    console.log('----------------------------------------');
    
    let stakingAddress;
    let stakingContract;
    
    try {
        const contractInstance = await tronWeb.contract().new({
            bytecode: bytecode,
            abi: abi,
            parameters: [CHIP_TOKEN_ADDRESS],
            feeLimit: 1000_000_000,
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10_000_000
        });
        
        stakingAddress = contractInstance.address;
        stakingContract = contractInstance;
        console.log('✅ 质押合约部署成功:', stakingAddress);
        
        // 验证chipToken地址
        const storedChipToken = await stakingContract.chipToken().call();
        const storedAddr = tronWeb.address.fromHex(storedChipToken);
        console.log('存储的CHIP地址:', storedAddr, storedAddr === CHIP_TOKEN_ADDRESS ? '✅' : '❌');
        
    } catch (error) {
        console.log('❌ 部署失败:', error.message);
        return;
    }
    
    // 步骤2：添加奖励到奖池
    console.log('\n----------------------------------------');
    console.log('步骤2：添加奖励到奖池（10000 CHIP）');
    console.log('----------------------------------------');
    
    const rewardAmount = 10000n * 1000000n; // 10000 CHIP
    
    try {
        // 先approve
        const approveTx = await chipContract.approve(stakingAddress, rewardAmount).send({
            feeLimit: 100_000_000
        });
        console.log('Approve交易:', approveTx);
        await delay(3000);
        
        // 添加奖励
        const addRewardTx = await stakingContract.addReward(rewardAmount).send({
            feeLimit: 100_000_000
        });
        console.log('添加奖励交易:', addRewardTx);
        await delay(3000);
        
        const totalRewardPool = await stakingContract.totalRewardPool().call();
        console.log('奖池总额:', formatChip(totalRewardPool));
        
    } catch (error) {
        console.log('❌ 添加奖励失败:', error.message);
    }
    
    // 步骤3：质押CHIP
    console.log('\n----------------------------------------');
    console.log('步骤3：质押 1000 CHIP');
    console.log('----------------------------------------');
    
    const stakeAmount = 1000n * 1000000n; // 1000 CHIP
    
    try {
        // 先approve
        const approveTx = await chipContract.approve(stakingAddress, stakeAmount).send({
            feeLimit: 100_000_000
        });
        console.log('Approve交易:', approveTx);
        await delay(3000);
        
        // 质押（锁定期30天）
        const lockDuration = 30 * 24 * 60 * 60; // 30天
        const stakeTx = await stakingContract.stake(stakeAmount, lockDuration).send({
            feeLimit: 100_000_000
        });
        console.log('质押交易:', stakeTx);
        await delay(3000);
        
        // 查看质押状态
        const stakeInfo = await stakingContract.getStakeInfo(testAddress).call();
        console.log('质押金额:', formatChip(stakeInfo.amount));
        console.log('是否锁定:', stakeInfo.isLocked);
        console.log('锁定期至:', new Date(Number(stakeInfo.lockedUntil) * 1000).toISOString());
        
        // 查看全局状态
        const totalStaked = await stakingContract.totalStaked().call();
        const largestStake = await stakingContract.largestStake().call();
        console.log('总质押:', formatChip(totalStaked));
        console.log('最大质押:', formatChip(largestStake));
        
    } catch (error) {
        console.log('❌ 质押失败:', error.message);
        return;
    }
    
    // 步骤4：等待一段时间后领取奖励
    console.log('\n----------------------------------------');
    console.log('步骤4：等待10秒后领取奖励');
    console.log('----------------------------------------');
    
    console.log('等待10秒...');
    await delay(10000);
    
    // 查看待领取奖励
    const pendingReward = await stakingContract.getPendingReward(testAddress).call();
    console.log('待领取奖励:', formatChip(pendingReward));
    
    try {
        const claimTx = await stakingContract.claimReward().send({
            feeLimit: 100_000_000
        });
        console.log('领取奖励交易:', claimTx);
        await delay(3000);
        
        const totalUserRewards = await stakingContract.totalUserRewardsClaimed(testAddress).call();
        console.log('用户累计领取奖励:', formatChip(totalUserRewards));
        
    } catch (error) {
        console.log('❌ 领取奖励失败:', error.message);
    }
    
    // 步骤5：提前解押（有10%惩罚）
    console.log('\n----------------------------------------');
    console.log('步骤5：提前解押（10%惩罚）');
    console.log('----------------------------------------');
    
    // 查看解押前余额
    const balanceBeforeUnstake = await chipContract.balanceOf(testAddress).call();
    console.log('解押前CHIP余额:', formatChip(balanceBeforeUnstake));
    
    try {
        const unstakeTx = await stakingContract.unstake(stakeAmount).send({
            feeLimit: 100_000_000
        });
        console.log('解押交易:', unstakeTx);
        await delay(3000);
        
        // 查看解押后余额
        const balanceAfterUnstake = await chipContract.balanceOf(testAddress).call();
        console.log('解押后CHIP余额:', formatChip(balanceAfterUnstake));
        
        // 计算实际收益
        const chipDiff = BigInt(balanceAfterUnstake) - BigInt(balanceBeforeUnstake);
        console.log('\n📊 CHIP变化:', formatChip(chipDiff > 0n ? chipDiff : chipDiff));
        
        // 查看质押状态
        const stakeInfoAfter = await stakingContract.getStakeInfo(testAddress).call();
        console.log('剩余质押金额:', formatChip(stakeInfoAfter.amount));
        console.log('质押是否激活:', stakeInfoAfter.isActive);
        
    } catch (error) {
        console.log('❌ 解押失败:', error.message);
    }
    
    // 步骤6：总结
    console.log('\n========================================');
    console.log('测试总结');
    console.log('========================================');
    
    const finalChipBalance = await chipContract.balanceOf(testAddress).call();
    const totalUserRewards = await stakingContract.totalUserRewardsClaimed(testAddress).call();
    
    console.log('初始CHIP余额:', formatChip(initialChipBalance));
    console.log('最终CHIP余额:', formatChip(finalChipBalance));
    console.log('CHIP变化:', formatChip(BigInt(finalChipBalance) - BigInt(initialChipBalance)));
    console.log('累计领取奖励:', formatChip(totalUserRewards));
    
    // 计算理论惩罚
    const penalty = Number(stakeAmount) / 1e6 * 0.1;
    const rewardChip = Number(totalUserRewards) / 1e6;
    console.log('\n理论计算:');
    console.log('- 质押本金: 1000 CHIP');
    console.log('- 提前解押惩罚(10%):', penalty.toFixed(2), 'CHIP');
    console.log('- 返还金额:', (1000 - penalty).toFixed(2), 'CHIP');
    console.log('+ 领取奖励:', rewardChip.toFixed(2), 'CHIP');
    console.log('= 理论净收益:', (rewardChip - penalty).toFixed(2), 'CHIP (奖励 - 惩罚)');
    
    console.log('\n✅ 测试完成！');
    console.log('\n请将新合约地址添加到 .env.testnet:');
    console.log(`STAKING_CONTRACT_ADDRESS=${stakingAddress}`);
}

main().catch(console.error);
