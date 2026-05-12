/**
 * 向质押合约注入奖励
 * 用法: node add-staking-reward.js <金额>
 * 示例: node add-staking-reward.js 100000
 */

const { TronWeb } = require('tronweb');
require('dotenv').config({ path: '.env.testnet' });

const CHIP_TOKEN = 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';
const STAKING_CONTRACT = 'TLQUifq6SDHz2rNBLTzJ2kEqsbhQXMfRCs';

async function main() {
    const amount = parseFloat(process.argv[2] || 100000);
    
    const privateKey = process.env.TESTNET_PRIVATE_KEY;
    if (!privateKey) {
        console.error('错误: 未找到 TESTNET_PRIVATE_KEY');
        process.exit(1);
    }
    
    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io',
        privateKey: privateKey
    });
    
    // 获取发送者地址
    const senderResult = await tronWeb.address.fromPrivateKey(privateKey);
    const senderAddress = typeof senderResult === 'string' ? senderResult : senderResult.address;
    
    console.log('========================================');
    console.log('向质押奖励池注入 CHIP');
    console.log('========================================');
    console.log('发送者:', senderAddress);
    console.log('CHIP Token:', CHIP_TOKEN);
    console.log('质押合约:', STAKING_CONTRACT);
    console.log('注入金额:', amount, 'CHIP');
    console.log('');
    
    // 获取合约实例
    const chipContract = await tronWeb.contract().at(CHIP_TOKEN);
    const stakingContract = await tronWeb.contract().at(STAKING_CONTRACT);
    
    // 检查余额
    const balance = await chipContract.balanceOf(senderAddress).call();
    const balanceNum = Number(balance) / 1e6;
    console.log('当前 CHIP 余额:', balanceNum);
    
    const amountInSun = Math.floor(amount * 1e6);
    
    if (balanceNum < amount) {
        console.error(`错误: 余额不足。需要 ${amount} CHIP，当前只有 ${balanceNum} CHIP`);
        process.exit(1);
    }
    
    // 检查当前奖励池
    const currentPool = await stakingContract.totalRewardPool().call();
    console.log('当前奖励池:', Number(currentPool) / 1e6, 'CHIP');
    console.log('');
    
    // Step 1: 授权质押合约使用 CHIP
    console.log('Step 1: 授权质押合约...');
    const allowance = await chipContract.allowance(senderAddress, STAKING_CONTRACT).call();
    const allowanceNum = Number(allowance);
    
    if (allowanceNum < amountInSun) {
        console.log('  当前授权额度不足，正在授权...');
        const approveTx = await chipContract.approve(STAKING_CONTRACT, amountInSun).send({
            feeLimit: 50_000_000
        });
        console.log('  授权交易:', approveTx);
        await new Promise(r => setTimeout(r, 3000));
    } else {
        console.log('  已有足够授权额度:', allowanceNum / 1e6, 'CHIP');
    }
    
    // Step 2: 注入奖励
    console.log('');
    console.log('Step 2: 注入奖励到质押合约...');
    const addRewardTx = await stakingContract.addReward(amountInSun).send({
        feeLimit: 100_000_000
    });
    console.log('  注入交易:', addRewardTx);
    
    // 等待确认
    await new Promise(r => setTimeout(r, 5000));
    
    // 检查结果
    const newPool = await stakingContract.totalRewardPool().call();
    console.log('');
    console.log('========================================');
    console.log('注入成功！');
    console.log('========================================');
    console.log('交易哈希:', addRewardTx);
    console.log('新奖励池总额:', Number(newPool) / 1e6, 'CHIP');
    console.log('');
    console.log('质押者现在可以通过 claimReward() 领取奖励');
}

main().catch(console.error);
