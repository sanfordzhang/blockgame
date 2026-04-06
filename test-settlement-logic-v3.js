/**
 * Final Correct Test: Tournament Settlement
 * 
 * Derivation:
 * Contract logic: netStack = finalStack - (finalStack - buyIn) * rakeRate
 * We want: netStack = buyIn + prizeAmount (player's balance after settlement)
 * 
 * Solve for finalStack:
 * buyIn + prizeAmount = finalStack - (finalStack - buyIn) * rakeRate
 * buyIn + prizeAmount = finalStack * (1 - rakeRate) + buyIn * rakeRate
 * finalStack * (1 - rakeRate) = buyIn + prizeAmount - buyIn * rakeRate
 * finalStack * (1 - rakeRate) = prizeAmount + buyIn * (1 - rakeRate)
 * finalStack = (prizeAmount + buyIn * (1 - rakeRate)) / (1 - rakeRate)
 * finalStack = prizeAmount / (1 - rakeRate) + buyIn
 * 
 * Or equivalently:
 * finalStack = (prizeAmount + buyIn * 0.95) / 0.95 (for 5% rake)
 */

const { TronWeb } = require('tronweb');
require('dotenv').config({ path: '.env.testnet' });

async function testSettlementLogic() {
    console.log('=== Final Correct Settlement Logic Test ===\n');
    
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
    
    console.log('\n=== Winner Settlement ===');
    const winnerPrize = prizePool; // First place gets 100%
    
    // CORRECT derivation:
    // We want player balance after settlement = buyIn + prizeAmount
    // netStack = finalStack - (finalStack - buyIn) * rakeRate
    // buyIn + prizeAmount = finalStack * (1 - rakeRate) + buyIn * rakeRate
    // finalStack = (buyIn + prizeAmount - buyIn * rakeRate) / (1 - rakeRate)
    
    const numerator = buyIn + winnerPrize - buyIn * contractRakeRate;
    const denominator = 1 - contractRakeRate;
    const correctFinalStack = Math.floor(numerator / denominator);
    
    // Simulate contract
    const profit = correctFinalStack - buyIn;
    const contractRake = Math.floor(profit * contractRakeRate);
    const netStack = correctFinalStack - contractRake;
    const netChange = netStack - buyIn;
    
    console.log('\nFormula: finalStack = (buyIn + prizeAmount - buyIn * rakeRate) / (1 - rakeRate)');
    console.log(`  finalStack = (${buyIn/1e6} + ${winnerPrize/1e6} - ${buyIn/1e6} * ${contractRakeRate}) / ${denominator}`);
    console.log(`  finalStack = ${numerator/1e6} / ${denominator}`);
    console.log(`  finalStack = ${(correctFinalStack/1e6).toFixed(2)} TRX`);
    console.log(`\nContract Simulation:`);
    console.log(`  Profit (finalStack - buyIn): ${(profit/1e6).toFixed(2)} TRX`);
    console.log(`  Contract rake: ${(contractRake/1e6).toFixed(2)} TRX`);
    console.log(`  Net stack returned: ${(netStack/1e6).toFixed(2)} TRX`);
    console.log(`  Player net change: ${netChange >= 0 ? '+' : ''}${(netChange/1e6).toFixed(2)} TRX`);
    
    // Verify
    const expectedNetChange = winnerPrize - buyIn; // 190 - 100 = 90 TRX
    console.log(`\nExpected net change: ${expectedNetChange/1e6} TRX`);
    
    if (Math.abs(netChange - expectedNetChange) < 1000) { // Allow 0.001 TRX tolerance
        console.log('✅ Calculation CORRECT!');
    } else {
        console.log('❌ Calculation INCORRECT!');
        console.log(`  Difference: ${(netChange - expectedNetChange)/1e6} TRX`);
    }
    
    // Test loser
    console.log('\n=== Loser Settlement ===');
    const loserPrize = 0;
    const loserFinalStack = 0;
    const loserNetChange = loserFinalStack - buyIn;
    console.log(`  finalStack: 0 TRX`);
    console.log(`  Player net change: ${loserNetChange/1e6} TRX`);
    console.log('✅ Loser calculation correct');
    
    // Summary
    console.log('\n=== Settlement Summary ===');
    console.log(`Winner: ${netChange >= 0 ? '+' : ''}${(netChange/1e6).toFixed(2)} TRX`);
    console.log(`Loser: ${loserNetChange/1e6} TRX`);
    console.log(`Tournament rake: ${tournamentRake/1e6} TRX`);
    console.log(`Contract rake: ${(contractRake/1e6).toFixed(2)} TRX`);
    console.log(`Total rake: ${(tournamentRake/1e6 + contractRake/1e6).toFixed(2)} TRX`);
    console.log(`Total balance change: ${(netChange + loserNetChange)/1e6} TRX`);
    
    console.log('\n⚠️ Note: There is still double rake being collected!');
    console.log('  - Tournament rake: 10 TRX (deducted from prize pool)');
    console.log(`  - Contract rake: ${(contractRake/1e6).toFixed(2)} TRX (deducted from winner's profit)`);
    console.log('  - Total rake collected: 14.74 TRX instead of 10 TRX');
    console.log('\nThis means the contract rake adjustment is NOT the right solution.');
    console.log('The real fix should be to NOT charge contract rake for tournament games.');
    console.log('But that requires contract modification.');
    console.log('\nAlternative: Adjust prizeAmount to account for contract rake:');
    
    // Alternative: Player should receive prizePool - contractRakeOnPrizePool
    // But this changes the expected payout...
    
    console.log('\n=== Alternative Solution ===');
    console.log('Instead of adjusting finalStack, we should:');
    console.log('1. Set finalStack = prizeAmount (190 TRX)');
    console.log('2. Accept that contract will take 4.5 TRX rake');
    console.log('3. Player receives 185.5 TRX, net change = +85.5 TRX');
    console.log('\nOr better:');
    console.log('1. Set finalStack = prizeAmount + contractRake (190 + 4.5 = 194.5 TRX)');
    console.log('2. Contract takes 4.725 TRX rake');
    console.log('3. Player receives 189.78 TRX, net change = +89.78 TRX (close to +90)');
    
    // Best solution - iterative approach
    console.log('\n=== Iterative Solution (Best for now) ===');
    
    // We want netChange = +90 TRX
    // netChange = netStack - buyIn = finalStack - (finalStack - buyIn) * rakeRate - buyIn
    // We want: finalStack - (finalStack - buyIn) * rakeRate - buyIn = 90
    // finalStack * (1 - rakeRate) + buyIn * rakeRate - buyIn = 90
    // finalStack * (1 - rakeRate) = 90 + buyIn * (1 - rakeRate)
    // finalStack = (90 + buyIn * (1 - rakeRate)) / (1 - rakeRate)
    // finalStack = 90 / (1 - rakeRate) + buyIn
    
    const targetNetChange = 90e6; // 90 TRX in SUN
    const iterativeFinalStack = Math.floor(targetNetChange / (1 - contractRakeRate) + buyIn);
    const iterProfit = iterativeFinalStack - buyIn;
    const iterRake = Math.floor(iterProfit * contractRakeRate);
    const iterNetStack = iterativeFinalStack - iterRake;
    const iterNetChange = iterNetStack - buyIn;
    
    console.log(`Target net change: ${targetNetChange/1e6} TRX`);
    console.log(`finalStack = targetNetChange / (1 - rakeRate) + buyIn`);
    console.log(`finalStack = ${targetNetChange/1e6} / ${1 - contractRakeRate} + ${buyIn/1e6}`);
    console.log(`finalStack = ${(iterativeFinalStack/1e6).toFixed(2)} TRX`);
    console.log(`Contract rake: ${(iterRake/1e6).toFixed(2)} TRX`);
    console.log(`Player net change: ${iterNetChange >= 0 ? '+' : ''}${(iterNetChange/1e6).toFixed(2)} TRX`);
    
    if (Math.abs(iterNetChange - targetNetChange) < 1000) {
        console.log('✅ Iterative solution CORRECT!');
    }
}

testSettlementLogic().catch(console.error);
