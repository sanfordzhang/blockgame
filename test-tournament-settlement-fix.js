/**
 * Test Tournament Settlement Fix
 * Verify that tournament settlement correctly handles rake without double-charging
 */

const { TronWeb } = require('tronweb');
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.testnet' });

const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const PLAYER2_ADDRESS = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';
const CONTRACT_ADDRESS = 'TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c';

async function getContractBalance(tronWeb, contractAddress, playerAddress) {
    const abi = [
        {"inputs":[{"name":"","type":"address"}],"name":"players","outputs":[{"name":"balance","type":"uint256"},{"name":"lockedAmount","type":"uint256"},{"name":"isRegistered","type":"bool"}],"stateMutability":"view","type":"function"}
    ];
    const contract = await tronWeb.contract(abi, contractAddress);
    try {
        const info = await contract.players(playerAddress).call();
        return {
            balance: Number(info.balance) / 1e6,
            locked: Number(info.lockedAmount) / 1e6
        };
    } catch (e) {
        return { balance: 0, locked: 0 };
    }
}

async function getTournamentPrizePool(tronWeb, contractAddress) {
    const abi = [
        {"inputs":[],"name":"rakeRate","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
    ];
    const contract = await tronWeb.contract(abi, contractAddress);
    try {
        const rate = await contract.rakeRate().call();
        return Number(rate);
    } catch (e) {
        return 500; // Default 5%
    }
}

async function main() {
    console.log('=== Tournament Settlement Fix Test ===\n');
    
    const tronWeb = new TronWeb({
        fullHost: 'https://api.nile.trongrid.io',
        privateKey: process.env.SERVER_PRIVATE_KEY
    });
    
    // Get initial balances
    console.log('Initial Contract Balances:');
    const p1Before = await getContractBalance(tronWeb, CONTRACT_ADDRESS, PLAYER1_ADDRESS);
    const p2Before = await getContractBalance(tronWeb, CONTRACT_ADDRESS, PLAYER2_ADDRESS);
    console.log(`  Player 1 (${PLAYER1_ADDRESS.substring(0, 10)}...): ${p1Before.balance.toFixed(2)} TRX (locked: ${p1Before.locked.toFixed(2)})`);
    console.log(`  Player 2 (${PLAYER2_ADDRESS.substring(0, 10)}...): ${p2Before.balance.toFixed(2)} TRX (locked: ${p2Before.locked.toFixed(2)})`);
    
    // Get contract rake rate
    const rakeRate = await getTournamentPrizePool(tronWeb, CONTRACT_ADDRESS);
    console.log(`\nContract rake rate: ${rakeRate/100}%`);
    
    // Connect to MongoDB and get recent tournament
    await mongoose.connect('mongodb://localhost:27017/bridge-poker');
    const Tournament = mongoose.model('Tournament', new mongoose.Schema({}, { strict: false }));
    
    const recentTournament = await Tournament.findOne({ 
        status: 'COMPLETED',
        configId: 3  // 2-player tournament
    }).sort({ finishedAt: -1 });
    
    if (!recentTournament) {
        console.log('No completed 2-player tournaments found');
        await mongoose.disconnect();
        return;
    }
    
    console.log(`\nRecent Tournament: ${recentTournament.tournamentId}`);
    console.log(`  Buy-in: ${(recentTournament.buyIn/1e6).toFixed(0)} TRX`);
    console.log(`  Rake: ${(recentTournament.rakeAmount/1e6).toFixed(2)} TRX`);
    console.log(`  Rankings:`);
    
    for (const r of recentTournament.rankings || []) {
        console.log(`    #${r.position}: ${r.address?.substring(0, 10)}... prize=${(r.prize/1e6).toFixed(2)} TRX`);
    }
    
    // Calculate expected balances after settlement
    console.log('\n=== Expected Settlement Calculation ===');
    
    const buyIn = recentTournament.buyIn || 100000000; // 100 TRX in SUN
    const totalBuyIn = buyIn * 2;
    const tournamentRake = recentTournament.rakeAmount || 10000000; // 10 TRX in SUN
    const prizePool = totalBuyIn - tournamentRake;
    
    console.log(`Total Buy-in: ${totalBuyIn/1e6} TRX`);
    console.log(`Tournament Rake: ${tournamentRake/1e6} TRX (5%)`);
    console.log(`Prize Pool: ${prizePool/1e6} TRX`);
    
    // For winner (position 1)
    const winner = recentTournament.rankings?.find(r => r.position === 1);
    const loser = recentTournament.rankings?.find(r => r.position === 2);
    
    if (winner && loser) {
        console.log('\nWinner Expected Net Change:');
        console.log(`  Prize Amount: ${prizePool/1e6} TRX`);
        console.log(`  Net Change: +${(prizePool - buyIn)/1e6} TRX (prize - buyIn)`);
        
        // With contract rake adjustment
        const contractRakeRate = rakeRate / 10000; // Convert basis points to decimal
        const adjustedFinalStack = Math.floor(buyIn + prizePool / (1 - contractRakeRate));
        const contractRake = Math.floor((adjustedFinalStack - buyIn) * contractRakeRate);
        const netStack = adjustedFinalStack - contractRake;
        
        console.log(`\nWith Contract Rake Adjustment:`);
        console.log(`  Adjusted finalStack: ${(adjustedFinalStack/1e6).toFixed(2)} TRX`);
        console.log(`  Contract will take rake: ${(contractRake/1e6).toFixed(2)} TRX`);
        console.log(`  Net stack returned: ${(netStack/1e6).toFixed(2)} TRX`);
        console.log(`  Player net change: +${((netStack - buyIn)/1e6).toFixed(2)} TRX`);
        
        console.log('\nLoser Expected Net Change:');
        console.log(`  Final Stack: 0 TRX`);
        console.log(`  Net Change: -${buyIn/1e6} TRX (lost buyIn)`);
    }
    
    await mongoose.disconnect();
    
    console.log('\n=== Test Complete ===');
    console.log('\nTo verify, run a new tournament and check balance changes:');
    console.log('  node cdp-play-game.js');
}

main().catch(console.error);
