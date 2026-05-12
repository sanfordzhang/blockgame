/**
 * 检查最近添加流动性的交易记录
 * 找出 LP Token 为什么在 Deployer 地址
 */
const { TronWeb } = require('tronweb');
require('dotenv').config({ path: '.env.testnet' });

const POOL_ADDRESS = 'TDoYGYAgPLrWTSjsANUuAjEFaAKr3oBo3v';
const ROUTER_ADDRESS = 'TXfeHckcmZeigv1ixUyFkTc9q7NHNGfcPJ';
const CHIP_TOKEN = 'TFWScXGFALnK9D79zf5Jrnw5on7aqJiaY3';
const PLAYER1 = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const DEPLOYER = 'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA';

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io'
});
tronWeb.setAddress('T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb');

async function checkRecentTransactions() {
    console.log('=== 检查最近添加流动性的交易 ===\n');
    
    try {
        // 1. 检查当前 LP Token 余额
        console.log('--- LP Token 持有情况 ---');
        const poolContract = await tronWeb.contract().at(POOL_ADDRESS);
        
        const deployerLP = await poolContract.balanceOf(DEPLOYER).call();
        const player1LP = await poolContract.balanceOf(PLAYER1).call();
        const totalSupply = await poolContract.totalSupply().call();
        
        console.log(`Deployer (${DEPLOYER}): ${(parseInt(deployerLP.toString()) / 1e8).toFixed(4)} LP Tokens`);
        console.log(`PLAYER1 (${PLAYER1}): ${(parseInt(player1LP.toString()) / 1e8).toFixed(4)} LP Tokens`);
        console.log(`Total Supply: ${(parseInt(totalSupply.toString()) / 1e8).toFixed(4)} LP Tokens\n`);
        
        // 2. 分析问题
        console.log('--- 问题分析 ---');
        if (parseInt(player1LP.toString()) > 0) {
            console.log(`✅ PLAYER1 已经有 ${(parseInt(player1LP.toString()) / 1e8).toFixed(4)} LP Tokens`);
        } else {
            console.log('❌ PLAYER1 没有 LP Token');
            console.log('可能原因：');
            console.log('1. 注入交易可能还在处理中');
            console.log('2. 或者注入时 LP Token 发给了错误地址');
        }
        
        // 3. 查看交易指引
        console.log('\n--- 查看 TronScan 交易记录 ---');
        console.log('Router 合约交易历史:');
        console.log(`https://nile.tronscan.org/#/contract/${ROUTER_ADDRESS}/transactions`);
        console.log('\nPool 合约交易历史:');
        console.log(`https://nile.tronscan.org/#/contract/${POOL_ADDRESS}/transactions`);
        console.log('\nPLAYER1 交易历史:');
        console.log(`https://nile.tronscan.org/#/address/${PLAYER1}`);
        
        // 4. 检查 Pool 合约的 Mint 事件
        console.log('\n--- 检查 Pool 合约事件 ---');
        try {
            const events = await tronWeb.getEventResult(POOL_ADDRESS, {
                eventName: 'Mint',
                limit: 5
            });
            
            if (events && events.length > 0) {
                console.log('最近 Mint 事件：\n');
                for (const event of events) {
                    console.log(`Block: ${event.block_number}`);
                    console.log(`  Sender: ${event.result.sender}`);
                    console.log(`  Amount0 (TRX): ${event.result.amount0}`);
                    console.log(`  Amount1 (CHIP): ${event.result.amount1}`);
                    console.log(`  Liquidity: ${event.result.liquidity}`);
                    console.log('');
                }
            }
        } catch (e) {
            console.log('无法获取事件，请手动查看 TronScan');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkRecentTransactions();
