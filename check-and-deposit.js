/**
 * 给测试玩家充值
 * 用于测试锦标赛结算
 */
const { TronWeb } = require('tronweb');
require('dotenv').config({ path: '.env.testnet' });

const PLAYER1 = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const PLAYER2 = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';
const CONTRACT_ADDRESS = process.env.TESTNET_CONTRACT_ADDRESS || 'TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c';

async function main() {
    const tronWeb = new TronWeb({
        fullHost: process.env.TRON_NODE_URL || 'https://nile.trongrid.io',
        privateKey: process.env.SERVER_PRIVATE_KEY || process.env.PRIVATE_KEY
    });

    // Get server wallet address
    const serverAddress = tronWeb.address.fromPrivateKey(process.env.SERVER_PRIVATE_KEY || process.env.PRIVATE_KEY);
    console.log('Server wallet:', serverAddress);

    // Check server TRX balance
    const serverBalance = await tronWeb.trx.getBalance(serverAddress);
    console.log('Server TRX balance:', (serverBalance / 1e6).toFixed(2), 'TRX');

    // Check contract balance
    const contractBalance = await tronWeb.trx.getBalance(CONTRACT_ADDRESS);
    console.log('Contract TRX balance:', (contractBalance / 1e6).toFixed(2), 'TRX');

    // Check player balances
    const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);
    
    for (const addr of [PLAYER1, PLAYER2]) {
        const info = await contract.players(addr).call();
        const balance = Number(info.balance.toString());
        const locked = Number(info.lockedAmount.toString());
        console.log(`\nPlayer ${addr}:`);
        console.log(`  Contract balance: ${(balance / 1e6).toFixed(2)} TRX`);
        console.log(`  Locked: ${(locked / 1e6).toFixed(2)} TRX`);
    }

    console.log('\n--- 要充值，请在合约中执行 deposit ---');
    console.log('玩家需要在前端页面进行 deposit 操作');
}

main().catch(console.error);
