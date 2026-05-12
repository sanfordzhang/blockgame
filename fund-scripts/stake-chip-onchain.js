/**
 * 质押CHIP到Staking合约
 * 用法: node stake-chip-onchain.js <金额> <锁定天数>
 * 示例: node stake-chip-onchain.js 1000 30
 */

const { TronWeb } = require('tronweb');
require('dotenv').config({ path: '.env.testnet' });

const CHIP_TOKEN = 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';
const STAKING_CONTRACT = 'TBrmQ4pGBYYKrRv8SYaLACkBodwA7f1RGW';

async function stakeCHIP(amount, lockDays) {
    const privateKey = process.env.TESTNET_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('请在.env.testnet中设置TESTNET_PRIVATE_KEY');
    }

    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io',
        privateKey: privateKey
    });

    // 获取钱包地址
    const addressResult = await tronWeb.address.fromPrivateKey(privateKey);
    const walletAddress = typeof addressResult === 'string' ? addressResult : addressResult.address;
    
    console.log('========================================');
    console.log('CHIP Staking 操作');
    console.log('========================================\n');
    console.log('钱包地址:', walletAddress);
    console.log('质押金额:', amount, 'CHIP');
    console.log('锁定天数:', lockDays, '天\n');

    // 获取合约实例
    const chipContract = await tronWeb.contract().at(CHIP_TOKEN);
    const stakingContract = await tronWeb.contract().at(STAKING_CONTRACT);

    // 检查CHIP余额
    const balance = await chipContract.balanceOf(walletAddress).call();
    const balanceNum = parseInt(balance.toString()) / 1e6;
    console.log('CHIP余额:', balanceNum, 'CHIP');

    if (balanceNum < amount) {
        throw new Error(`余额不足！需要 ${amount} CHIP，只有 ${balanceNum} CHIP`);
    }

    // 转换金额到SUN
    const amountInSun = Math.floor(amount * 1e6);
    const lockDuration = lockDays * 24 * 60 * 60; // 转换为秒

    // 检查是否已授权
    const allowance = await chipContract.allowance(walletAddress, STAKING_CONTRACT).call();
    const allowanceNum = parseInt(allowance.toString());

    console.log('\n当前授权额度:', allowanceNum / 1e6, 'CHIP');

    if (allowanceNum < amountInSun) {
        console.log('\n步骤1: 授权Staking合约使用CHIP...');
        const approveTx = await chipContract.approve(STAKING_CONTRACT, amountInSun).send({
            feeLimit: 100_000_000
        });
        console.log('授权交易:', approveTx);
        console.log('等待确认...');
        await new Promise(r => setTimeout(r, 5000));
    }

    console.log('\n步骤2: 执行质押...');
    const stakeTx = await stakingContract.stake(amountInSun, lockDuration).send({
        feeLimit: 100_000_000
    });

    console.log('\n✅ 质押成功！');
    console.log('交易ID:', stakeTx);
    console.log('\n查看交易: https://nile.tronscan.org/#/transaction/' + stakeTx);

    // 查询质押信息
    console.log('\n查询质押信息...');
    await new Promise(r => setTimeout(r, 3000));
    
    const stakeInfo = await stakingContract.stakes(walletAddress).call();
    console.log('\n质押详情:');
    console.log('  金额:', parseInt(stakeInfo.amount.toString()) / 1e6, 'CHIP');
    console.log('  开始时间:', new Date(parseInt(stakeInfo.startTime.toString()) * 1000).toLocaleString());
    console.log('  解锁时间:', new Date(parseInt(stakeInfo.lockedUntil.toString()) * 1000).toLocaleString());
    console.log('  状态:', stakeInfo.isActive ? '活跃' : '已结束');
}

// 主函数
(async () => {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('用法: node stake-chip-onchain.js <金额> <锁定天数>');
        console.log('示例: node stake-chip-onchain.js 1000 30');
        console.log('\n说明:');
        console.log('  金额: CHIP数量（最小100 CHIP）');
        console.log('  锁定天数: 7-365天');
        process.exit(1);
    }

    const amount = parseFloat(args[0]);
    const lockDays = parseInt(args[1]);

    if (amount < 100) {
        console.log('❌ 最小质押金额为 100 CHIP');
        process.exit(1);
    }

    if (lockDays < 7 || lockDays > 365) {
        console.log('❌ 锁定天数必须在 7-365 天之间');
        process.exit(1);
    }

    try {
        await stakeCHIP(amount, lockDays);
    } catch (error) {
        console.error('\n❌ 错误:', error.message);
        process.exit(1);
    }
})();
