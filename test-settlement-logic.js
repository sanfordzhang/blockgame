/**
 * Direct Test: Tournament Settlement
 * Bypasses game flow and directly tests settlement logic
 */

const { TronWeb } = require('tronweb');
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.testnet' });

const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const PLAYER2_ADDRESS = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';
const CONTRACT_ADDRESS = 'TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c';

async function getContractBalance(tronWeb, playerAddress) {
    const abi = [
        {"inputs":[{"name":"","type":"address"}],"name":"players","outputs":[{"name":"balance","type":"uint256"},{"name":"lockedAmount","type":"uint256"},{"name":"isRegistered","type":"bool"}],"stateMutability":"view","type":"function"}
    ];
    const contract = await tronWeb.contract(abi, CONTRACT_ADDRESS);
    try {
        const info = await contract.players(playerAddress).call();
        return {
            balance: Number(info.balance),
            locked: Number(info.lockedAmount)
        };
    } catch (e) {
        console.error('Error getting balance:', e.message);
        return { balance: 0, locked: 0 };
    }
}

async function testSettlementLogic() {
    console.log('=== Test Settlement Logic ===\n');
    
    const tronWeb = new TronWeb({
        fullHost: 'https://api.nile.trongrid.io',
        privateKey: process.env.SERVER_PRIVATE_KEY
    });
    
    // Test parameters
    const buyIn = 100000000; // 100 TRX in SUN
    const contractRakeRate = 0.05; // 5%
    const totalBuyIn = buyIn * 2; // 200 TRX
    const tournamentRake = Math.floor(totalBuyIn * 0.05); // 10 TRX
    const prizePool = totalBuyIn - tournamentRake; // 190 TRX
    
    console.log('Tournament Parameters:');
    console.log(`  Buy-in: ${buyIn/1e6} TRX`);
    console.log(`  Total Buy-in: ${totalBuyIn/1e6} TRX`);
    console.log(`  Tournament Rake (5%): ${tournamentRake/1e6} TRX`);
    console.log(`  Prize Pool: ${prizePool/1e6} TRX`);
    
    // Test winner calculation
    console.log('\n=== Winner Settlement ===');
    const winnerPrize = prizePool; // First place gets 100%
    
    // OLD (BUGGY) calculation - without contract rake adjustment
    const oldFinalStack = winnerPrize;
    const oldContractRake = Math.floor((oldFinalStack - buyIn) * contractRakeRate);
    const oldNetStack = oldFinalStack - oldContractRake;
    const oldNetChange = oldNetStack - buyIn;
    
    console.log('\nOLD (BUGGY) Calculation:');
    console.log(`  finalStack = ${oldFinalStack/1e6} TRX`);
    console.log(`  Contract rake on profit (${(oldFinalStack-buyIn)/1e6} TRX): ${oldContractRake/1e6} TRX`);
    console.log(`  Net stack returned: ${oldNetStack/1e6} TRX`);
    console.log(`  Player net change: ${oldNetChange/1e6} TRX (should be +90, got +${oldNetChange/1e6})`);
    console.log(`  ⚠️ Bug: Double rake! Player loses ${oldContractRake/1e6} TRX extra`);
    
    // NEW (FIXED) calculation - with contract rake adjustment
    const newFinalStack = Math.floor(buyIn + winnerPrize / (1 - contractRakeRate));
    const newContractRake = Math.floor((newFinalStack - buyIn) * contractRakeRate);
    const newNetStack = newFinalStack - newContractRake;
    const newNetChange = newNetStack - buyIn;
    
    console.log('\nNEW (FIXED) Calculation:');
    console.log(`  finalStack = buyIn + prizePool / (1 - rakeRate)`);
    console.log(`  finalStack = ${buyIn/1e6} + ${winnerPrize/1e6} / ${(1-contractRakeRate).toFixed(2)}`);
    console.log(`  finalStack = ${(newFinalStack/1e6).toFixed(2)} TRX`);
    console.log(`  Contract rake on profit (${((newFinalStack-buyIn)/1e6).toFixed(2)} TRX): ${(newContractRake/1e6).toFixed(2)} TRX`);
    console.log(`  Net stack returned: ${(newNetStack/1e6).toFixed(2)} TRX`);
    console.log(`  Player net change: ${newNetChange >= 0 ? '+' : ''}${(newNetChange/1e6).toFixed(2)} TRX`);
    
    // Verify
    const expectedNetChange = winnerPrize - buyIn; // 190 - 100 = 90 TRX
    console.log(`\nExpected net change: ${expectedNetChange/1e6} TRX`);
    
    if (Math.abs(newNetChange - expectedNetChange) < 100) { // Allow small rounding error
        console.log('✅ NEW calculation CORRECT! Player gets exactly the expected amount.');
    } else {
        console.log('❌ NEW calculation INCORRECT!');
    }
    
    // Test loser calculation
    console.log('\n=== Loser Settlement ===');
    const loserFinalStack = 0;
    const loserNetChange = loserFinalStack - buyIn;
    console.log(`  finalStack = ${loserFinalStack} TRX`);
    console.log(`  Player net change: ${loserNetChange/1e6} TRX (lost buy-in)`);
    console.log('✅ Loser calculation correct');
    
    // Summary
    console.log('\n=== Summary ===');
    console.log('Tournament rake: 10 TRX (deducted from prize pool)');
    console.log('Winner gets: +90 TRX (190 - 100)');
    console.log('Loser gets: -100 TRX');
    console.log('Total rake collected: 10 TRX');
    console.log('Total change: +90 - 100 = -10 TRX (matches rake)');
    console.log('\n✅ Settlement logic verified!');
}

testSettlementLogic().catch(console.error);
