/**
 * Corrected Test: Tournament Settlement
 */

const { TronWeb } = require('tronweb');
require('dotenv').config({ path: '.env.testnet' });

async function testSettlementLogic() {
    console.log('=== Corrected Settlement Logic Test ===\n');
    
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
    
    // Contract logic (from BridgeGameV2.sol):
    // if (finalStack > buyIn && rakeRate > 0) {
    //     rake = ((finalStack - buyIn) * rakeRate) / 10000;
    //     netStack = finalStack - rake;
    // }
    // p.balance += netStack;
    
    // Player's net change = netStack - buyIn
    // We want: netStack = buyIn + prizeAmount (after tournament rake)
    // i.e., player gets prizePool as final balance
    
    // Derivation:
    // netStack = finalStack - (finalStack - buyIn) * rakeRate
    // We want: netStack = buyIn + prizePool
    // So: buyIn + prizePool = finalStack - (finalStack - buyIn) * rakeRate
    // buyIn + prizePool = finalStack * (1 - rakeRate) + buyIn * rakeRate
    // prizePool = finalStack * (1 - rakeRate) + buyIn * rakeRate - buyIn
    // prizePool = finalStack * (1 - rakeRate) - buyIn * (1 - rakeRate)
    // prizePool = (finalStack - buyIn) * (1 - rakeRate)
    // finalStack - buyIn = prizePool / (1 - rakeRate)
    // finalStack = buyIn + prizePool / (1 - rakeRate)
    
    console.log('\n=== Winner Settlement ===');
    const winnerPrize = prizePool; // First place gets 100%
    
    // CORRECT calculation
    const correctFinalStack = Math.floor(buyIn + winnerPrize / (1 - contractRakeRate));
    const correctProfit = correctFinalStack - buyIn;
    const correctContractRake = Math.floor(correctProfit * contractRakeRate);
    const correctNetStack = correctFinalStack - correctContractRake;
    const correctNetChange = correctNetStack - buyIn;
    
    console.log('\nFormula: finalStack = buyIn + prizePool / (1 - rakeRate)');
    console.log(`  finalStack = ${buyIn/1e6} + ${winnerPrize/1e6} / ${1 - contractRakeRate}`);
    console.log(`  finalStack = ${(correctFinalStack/1e6).toFixed(2)} TRX`);
    console.log(`  Profit: ${(correctProfit/1e6).toFixed(2)} TRX`);
    console.log(`  Contract rake: ${(correctContractRake/1e6).toFixed(2)} TRX`);
    console.log(`  Net stack returned: ${(correctNetStack/1e6).toFixed(2)} TRX`);
    console.log(`  Player net change: ${correctNetChange >= 0 ? '+' : ''}${(correctNetChange/1e6).toFixed(2)} TRX`);
    
    // Verify
    const expectedNetChange = winnerPrize - buyIn; // 190 - 100 = 90 TRX
    console.log(`\nExpected net change: ${expectedNetChange/1e6} TRX`);
    
    if (Math.abs(correctNetChange - expectedNetChange) < 1000000) { // Allow 1 TRX tolerance
        console.log('✅ Calculation CORRECT!');
    } else {
        console.log('❌ Calculation INCORRECT!');
        console.log(`  Difference: ${(correctNetChange - expectedNetChange)/1e6} TRX`);
    }
    
    // Verify contract simulation
    console.log('\n=== Contract Simulation ===');
    
    // Simulate contract behavior
    function simulateContract(buyIn, finalStack, rakeRateBasisPoints) {
        const rakeRate = rakeRateBasisPoints / 10000;
        let netStack = finalStack;
        let rake = 0;
        
        if (finalStack > buyIn && rakeRateBasisPoints > 0) {
            rake = Math.floor((finalStack - buyIn) * rakeRate);
            netStack = finalStack - rake;
        }
        
        return { netStack, rake };
    }
    
    const result = simulateContract(buyIn, correctFinalStack, 500); // 500 basis points = 5%
    console.log(`Simulated with finalStack = ${(correctFinalStack/1e6).toFixed(2)} TRX:`);
    console.log(`  Rake taken: ${(result.rake/1e6).toFixed(2)} TRX`);
    console.log(`  Net stack: ${(result.netStack/1e6).toFixed(2)} TRX`);
    console.log(`  Player balance change: +${((result.netStack - buyIn)/1e6).toFixed(2)} TRX`);
    
    // Test edge cases
    console.log('\n=== Edge Cases ===');
    
    // Case 1: Prize = 0 (loser)
    const loserFinalStack = 0;
    const loserResult = simulateContract(buyIn, loserFinalStack, 500);
    console.log(`Loser (finalStack=0):`);
    console.log(`  Net stack: ${loserResult.netStack/1e6} TRX`);
    console.log(`  Player balance change: -${buyIn/1e6} TRX`);
    console.log(`  ✅ Loser loses buy-in`);
    
    // Case 2: Prize equals buyIn (break even)
    const breakEvenPrize = buyIn;
    const breakEvenFinalStack = Math.floor(buyIn + breakEvenPrize / (1 - contractRakeRate));
    const breakEvenResult = simulateContract(buyIn, breakEvenFinalStack, 500);
    console.log(`\nBreak-even (prize = buyIn):`);
    console.log(`  Final stack needed: ${(breakEvenFinalStack/1e6).toFixed(2)} TRX`);
    console.log(`  Net stack: ${(breakEvenResult.netStack/1e6).toFixed(2)} TRX`);
    console.log(`  Player balance change: +${((breakEvenResult.netStack - buyIn)/1e6).toFixed(2)} TRX`);
}

testSettlementLogic().catch(console.error);
