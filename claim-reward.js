/**
 * 领取质押奖励
 * 用法: node claim-reward.js
 */

const { TronWeb } = require('tronweb');
require('dotenv').config({ path: '.env.testnet' });

const STAKING_CONTRACT = 'TLQUifq6SDHz2rNBLTzJ2kEqsbhQXMfRCs';
const WALLET = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

async function main() {
    const privateKey = process.env.TESTNET_PRIVATE_KEY;
    
    // 如果要从用户钱包领取，需要用户私钥
    // 这里演示使用部署者账户
    
    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io',
        privateKey: privateKey
    });
    
    const staking = await tronWeb.contract().at(STAKING_CONTRACT);
    
    // 查询待领取奖励
    const pendingReward = await staking.getPendingReward(WALLET).call();
    console.log('待领取奖励:', Number(pendingReward) / 1e6, 'CHIP');
    
    if (Number(pendingReward) === 0) {
        console.log('没有可领取的奖励');
        return;
    }
    
    console.log('\n正在领取奖励...');
    
    // 注意：claimReward 需要由质押者本人调用
    // 如果您使用的是部署者私钥，只能领取部署者的奖励
    
    console.log('\n请在 TronScan 或前端页面使用您的钱包领取奖励:');
    console.log('1. 访问 https://nile.tronscan.org/#/contract/' + STAKING_CONTRACT);
    console.log('2. 连接 TronLink');
    console.log('3. 调用 claimReward()');
}

main().catch(console.error);
