/**
 * E2E Test: Tournament elimination and end - Fast version
 * Tests the critical path: elimination detection, tournament end, SC_TOURNAMENT_ENDED broadcast.
 * 
 * Strategy:
 * 1. Create tournament with small chips
 * 2. Both players join, connect sockets
 * 3. One player folds every hand to drain chips via blinds
 * 4. Verify tournament ends when a player runs out of chips
 * 
 * Per CODEBUDDY.md test guide:
 * - Tests fold actions via socket
 * - Verifies server logs
 * - Confirms tournament completion with rankings
 */

const axios = require('axios');
const { io } = require('socket.io-client');

const API_BASE = 'http://127.0.0.1:7778';
const PLAYER1 = { address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv' };
const PLAYER2 = { address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4' };

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const timer = setTimeout(() => { console.error('TIMEOUT'); process.exit(1); }, 120000);

    let s1, s2;
    const events1 = [], events2 = [];

    try {
        console.log('========================================');
        console.log('  Tournament Elimination E2E Test');
        console.log('========================================\n');

        // Step 1: Create tournament
        console.log('[1] Creating tournament (configId=3, 2 players, 2M chips each, 50K/100K blinds)...');
        const createRes = await axios.post(`${API_BASE}/api/tournament/create`, { configId: 3 });
        const tournamentId = createRes.data.tournament.tournamentId;
        const initialChips = createRes.data.tournament.config.initialChips;
        console.log(`    ID: ${tournamentId}, initialChips: ${initialChips}`);
        // Blind = initialChips / 40 = 50000. SB=50000, BB=100000. Cost per hand = 150000.
        // 2000000 / 150000 = ~13 hands to drain from blinds alone

        // Step 2: Both join
        console.log('[2] Players joining...');
        await axios.post(`${API_BASE}/api/tournament/${tournamentId}/join`,
            { walletAddress: PLAYER1.address },
            { headers: { 'x-wallet-address': PLAYER1.address } }
        );
        await axios.post(`${API_BASE}/api/tournament/${tournamentId}/join`,
            { walletAddress: PLAYER2.address },
            { headers: { 'x-wallet-address': PLAYER2.address } }
        );
        console.log('    Tournament auto-started');

        // Step 3: Connect sockets
        console.log('[3] Connecting sockets...');
        s1 = io(API_BASE, { transports: ['websocket'], reconnection: false, forceNew: true });
        s2 = io(API_BASE, { transports: ['websocket'], reconnection: false, forceNew: true });
        
        s1.on('tournament_game_state', d => events1.push(d));
        s2.on('tournament_game_state', d => events2.push(d));

        const ended1 = new Promise(r => s1.on('SC_TOURNAMENT_ENDED', r));
        const ended2 = new Promise(r => s2.on('SC_TOURNAMENT_ENDED', r));

        await Promise.all([
            new Promise(r => { s1.on('connect', r); setTimeout(r, 5000); }),
            new Promise(r => { s2.on('connect', r); setTimeout(r, 5000); })
        ]);
        console.log(`    P1: ${s1.id}, P2: ${s2.id}`);

        s1.emit('CS_TOURNAMENT_ROOM_JOIN', { tournamentId, walletAddress: PLAYER1.address });
        s2.emit('CS_TOURNAMENT_ROOM_JOIN', { tournamentId, walletAddress: PLAYER2.address });
        await sleep(2000);

        // Step 4: Wait for game state
        console.log('[4] Waiting for game to start...');
        let state;
        for (let i = 0; i < 10; i++) {
            await sleep(1000);
            state = events1[events1.length - 1] || events2[events2.length - 1];
            if (state && state.turn != null) break;
            state = null;
        }
        if (!state) throw new Error('Game never started');
        console.log(`    Game started! turn=${state.turn}, pot=${state.pot}`);

        // Step 5: Play hands - player 2 always folds
        console.log('\n[5] Playing hands (P2 always folds to drain chips via blinds)...\n');

        let handCount = 0;
        let tournamentEnded = false;
        let endResult = null;
        let prevEventLen1 = events1.length;
        let prevEventLen2 = events2.length;

        while (handCount < 40) {
            handCount++;

            // Wait for a fresh active game state
            let activeState = null;
            for (let i = 0; i < 12; i++) {
                await sleep(800);
                const latest = events1[events1.length - 1] || events2[events2.length - 1];
                if (latest && latest.turn != null && !latest.handOver) {
                    // Check if this is a new state (not from previous hand)
                    if (events1.length > prevEventLen1 || events2.length > prevEventLen2 || i === 0) {
                        activeState = latest;
                        break;
                    }
                }
            }

            prevEventLen1 = events1.length;
            prevEventLen2 = events2.length;

            if (!activeState) {
                // Check if tournament ended
                try {
                    endResult = await Promise.race([ended1, ended2, sleep(1000).then(() => null)]);
                    if (endResult) { tournamentEnded = true; break; }
                } catch (e) {}
                
                console.log(`    Hand ${handCount}: waiting for game state...`);
                await sleep(2000);
                continue;
            }

            const turnSeat = activeState.turn;
            
            // Get stacks from latest state
            let stacks = {};
            const latestState = events1[events1.length - 1] || events2[events2.length - 1];
            for (const [id, seat] of Object.entries(latestState.seats || {})) {
                if (seat.player) stacks[id] = seat.stack;
            }

            if (turnSeat === 2) {
                // P2's turn - fold immediately
                s2.emit('CS_TOURNAMENT_FOLD', { tournamentId });
                console.log(`  Hand ${handCount}: P2 folds. Stacks: P1=${stacks[1]?.toLocaleString()}, P2=${stacks[2]?.toLocaleString()}`);
            } else if (turnSeat === 1) {
                // P1's turn first - check, then wait for P2 to act
                s1.emit('CS_TOURNAMENT_CHECK', { tournamentId });
                await sleep(600);
                
                const updated = events1[events1.length - 1] || events2[events2.length - 1];
                if (updated && updated.turn === 2 && !updated.handOver) {
                    s2.emit('CS_TOURNAMENT_FOLD', { tournamentId });
                    console.log(`  Hand ${handCount}: P1 checks, P2 folds. Stacks: P1=${stacks[1]?.toLocaleString()}, P2=${stacks[2]?.toLocaleString()}`);
                } else {
                    console.log(`  Hand ${handCount}: P1 checks. Stacks: P1=${stacks[1]?.toLocaleString()}, P2=${stacks[2]?.toLocaleString()}`);
                }
            }

            // Wait for hand to settle and check for tournament end
            await sleep(1500);

            try {
                endResult = await Promise.race([ended1, ended2, sleep(500).then(() => null)]);
                if (endResult) {
                    tournamentEnded = true;
                    console.log(`\n  >>> TOURNAMENT ENDED after hand ${handCount}!`);
                    break;
                }
            } catch (e) {}

            // Wait for next hand (3s auto-start)
            await sleep(2000);
        }

        // === Results ===
        console.log('\n========================================');
        console.log('  RESULTS');
        console.log('========================================\n');

        if (tournamentEnded && endResult) {
            console.log('[PASS] Tournament ended successfully');
            console.log(`  Rankings: ${JSON.stringify(endResult.rankings)}`);
            console.log(`  Reason: ${endResult.reason || 'elimination'}`);
            console.log(`  Total hands: ${endResult.totalHands}`);
            console.log(`  Test hands: ${handCount}`);
        } else {
            console.log('[FAIL] Tournament did NOT end within hand limit');
            console.log(`  Hands attempted: ${handCount}`);
            
            // Get final stacks from server log
            const { execSync } = require('child_process');
            try {
                const elimLog = execSync("grep -E '(eliminated|Remaining player|endTournament|TOURNAMENT ENDED|SC_TOURNAMENT_ENDED)' /tmp/server-debug.log | tail -20").toString();
                console.log('\n  Server elimination logs:\n' + elimLog);
            } catch (e) {}
        }

        // DB verification
        console.log('\n[DB] Checking database...');
        try {
            const dbRes = await axios.get(`${API_BASE}/api/tournament/${tournamentId}`);
            const dbTournament = dbRes.data?.tournament || dbRes.data;
            console.log(`  Status: ${dbTournament.status}`);
            console.log(`  Rankings: ${JSON.stringify(dbTournament.rankings)}`);
            if (dbTournament.status === 'COMPLETED') {
                console.log('[PASS] Database correctly shows COMPLETED');
            } else {
                console.log(`[FAIL] Database shows ${dbTournament.status}, expected COMPLETED`);
            }
        } catch (e) {
            console.log(`  Error: ${e.message}`);
        }

        console.log('\n========================================');

    } catch (err) {
        console.error('\n[FATAL]', err.message);
    } finally {
        if (s1) s1.disconnect();
        if (s2) s2.disconnect();
        clearTimeout(timer);
        process.exit(0);
    }
}

main();
