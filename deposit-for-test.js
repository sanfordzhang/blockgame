/**
 * 给测试玩家在合约中充值
 * 用于测试锦标赛结算
 * 
 * 注意：合约的 deposit() 方法需要从玩家地址发送 TRX
 * 这里我们模拟服务器给玩家"充值"的方式
 */
const { TronWeb } = require('tronweb');
require('dotenv').config({ path: '.env.testnet' });

const PLAYER1 = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const PLAYER2 = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';
const CONTRACT_ADDRESS = process.env.TESTNET_CONTRACT_ADDRESS || 'TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c';
const DEPOSIT_AMOUNT = 200 * 1e6; // 200 TRX (enough for 2 tournaments)

async function main() {
    const tronWeb = new TronWeb({
        fullHost: process.env.TRON_NODE_URL || 'https://nile.trongrid.io',
        privateKey: process.env.SERVER_PRIVATE_KEY || process.env.PRIVATE_KEY
    });

    const serverAddress = tronWeb.address.fromPrivateKey(process.env.SERVER_PRIVATE_KEY || process.env.PRIVATE_KEY);
    console.log('Server wallet:', serverAddress);

    // Check server TRX balance
    const serverBalance = await tronWeb.trx.getBalance(serverAddress);
    console.log('Server TRX balance:', (serverBalance / 1e6).toFixed(2), 'TRX');

    // Check current player balances
    const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);
    
    console.log('\nCurrent player balances in contract:');
    for (const addr of [PLAYER1, PLAYER2]) {
        const info = await contract.players(addr).call();
        const balance = Number(info.balance.toString());
        const locked = Number(info.lockedAmount.toString());
        console.log(`  ${addr}: balance=${(balance/1e6).toFixed(2)} TRX, locked=${(locked/1e6).toFixed(2)} TRX`);
    }

    console.log('\n--- 说明 ---');
    console.log('合约的 deposit() 方法需要从玩家地址发送 TRX');
    console.log('要给玩家充值，请在前端页面使用玩家钱包进行 deposit');
    console.log('');
    console.log('或者使用测试私钥直接调用：');
    console.log('1. PLAYER1_PRIVATE_KEY - 从私钥对应地址发送 TRX 到合约');
    console.log('2. PLAYER2_PRIVATE_KEY - 同上');
    console.log('');
    console.log('当前服务器钱包可以向玩家钱包地址发送 TRX');
    console.log('但玩家需要自己在前端 deposit 到合约');

    // Option: Send TRX from server to player wallets (for them to deposit)
    console.log('\n--- 选项：服务器发送 TRX 给玩家钱包 ---');
    console.log('这需要玩家随后在前端 deposit 到合约');
    
    // Uncomment to send TRX:
    /*
    for (const addr of [PLAYER1, PLAYER2]) {
        const tx = await tronWeb.trx.sendTrx(addr, DEPOSIT_AMOUNT, serverAddress);
        console.log(`Sent ${DEPOSIT_AMOUNT/1e6} TRX to ${addr}: ${tx}`);
    }
    */
}

main().catch(console.error);
