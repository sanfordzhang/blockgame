/**
 * 检查玩家合约余额
 */
const { TronWeb } = require('tronweb');
require('dotenv').config({ path: '.env.testnet' });

const PLAYER1 = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const PLAYER2 = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';

// Contract address from env or default
const CONTRACT_ADDRESS = process.env.TESTNET_CONTRACT_ADDRESS || 'TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c';

async function main() {
    const tronWeb = new TronWeb({
        fullHost: process.env.TRON_NODE_URL || 'https://nile.trongrid.io',
        privateKey: process.env.SERVER_PRIVATE_KEY || process.env.PRIVATE_KEY
    });

    console.log('Contract:', CONTRACT_ADDRESS);
    console.log('');

    const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);

    for (const addr of [PLAYER1, PLAYER2]) {
        try {
            const info = await contract.getPlayerInfo(addr).call();
            const balance = tronWeb.toDecimal(info.balance);
            const locked = tronWeb.toDecimal(info.lockedAmount);
            const total = balance + locked;

            console.log(`Player: ${addr}`);
            console.log(`  Balance: ${(balance / 1e6).toFixed(2)} TRX`);
            console.log(`  Locked:  ${(locked / 1e6).toFixed(2)} TRX`);
            console.log(`  Total:   ${(total / 1e6).toFixed(2)} TRX`);
            console.log('');
        } catch (e) {
            console.log(`Player: ${addr}`);
            console.log(`  Error: ${e.message}`);
            console.log('');
        }
    }
}

main().catch(console.error);
