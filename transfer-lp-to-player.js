/**
 * 将 Deployer 的 LP Token 转账给 PLAYER1
 */
const { TronWeb } = require('tronweb');
require('dotenv').config({ path: '.env.testnet' });

const POOL_ADDRESS = 'TDoYGYAgPLrWTSjsANUuAjEFaAKr3oBo3v';
const PLAYER1 = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

async function transferLP() {
    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io',
        privateKey: process.env.SERVER_PRIVATE_KEY
    });
    
    console.log('=== 转移 LP Token 给 PLAYER1 ===\n');
    
    try {
        // 查询 Deployer 的 LP Token 余额
        const poolContract = await tronWeb.contract().at(POOL_ADDRESS);
        const deployerBalance = await poolContract.balanceOf(tronWeb.defaultAddress.base58).call();
        
        console.log(`Deployer LP Token: ${deployerBalance.toString()}`);
        console.log(`显示值: ${(parseInt(deployerBalance.toString()) / 1e8).toFixed(4)}\n`);
        
        if (deployerBalance.toString() === '0') {
            console.log('❌ Deployer 没有 LP Token');
            return;
        }
        
        console.log(`准备转移全部 LP Token 到 ${PLAYER1}...`);
        
        // 转账 LP Token
        const tx = await poolContract.transfer(PLAYER1, deployerBalance.toString()).send({
            feeLimit: 100_000_000
        });
        
        console.log(`✅ 转账成功！`);
        console.log(`交易哈希: ${tx}`);
        console.log(`\n查看交易: https://nile.tronscan.org/#/transaction/${tx}`);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

transferLP();
