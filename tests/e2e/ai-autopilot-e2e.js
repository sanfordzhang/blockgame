/**
 * AI Autopilot E2E Test
 *
 * Uses: Socket.io (two players) + CDP (browser screenshot)
 * Flow:
 *   1. Player1 connects via socket, joins table
 *   2. Player2 (bot) connects via socket, joins table => hand starts
 *   3. Enable AI autopilot for Player1
 *   4. Wait for AI to make decisions
 *   5. CDP screenshot to verify AI decision is displayed
 */

const io = require('socket.io-client');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

const SERVER = 'http://127.0.0.1:7778';
const PLAYER1 = { address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv', name: 'Player1' };
const PLAYER2 = { address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4', name: 'Bot_P2' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function connectPlayer(address, name) {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER, { transports: ['websocket'], query: { walletAddress: address } });
    socket.on('connect', () => {
      console.log(`[${name}] Connected: ${socket.id}`);
      socket.emit('CS_FETCH_LOBBY_INFO', {
        walletAddress: address,
        socketId: socket.id,
        gameId: 'lobby',
        username: name
      });
      resolve(socket);
    });
    socket.on('connect_error', e => reject(e));
    setTimeout(() => reject(new Error(`${name} connection timeout`)), 10000);
  });
}

async function cdpScreenshot(filename) {
  try {
    const pages = await new Promise((resolve, reject) => {
      http.get('http://localhost:9222/json', res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d)));
      }).on('error', reject);
    });
    const page = pages.find(p => p.url.includes('localhost:3001'));
    if (!page) { console.log('[CDP] No game page'); return; }

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 1;
    const send = (method, params) => new Promise((resolve) => {
      const msgId = id++;
      ws.send(JSON.stringify({ id: msgId, method, params }));
      const handler = msg => {
        const resp = JSON.parse(msg);
        if (resp.id === msgId) { ws.removeListener('message', handler); resolve(resp); }
      };
      ws.on('message', handler);
    });

    await new Promise(r => ws.on('open', r));
    const ss = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filename, Buffer.from(ss.result.data, 'base64'));
    console.log(`[CDP] Screenshot: ${filename}`);

    // Get page text for analysis
    const textResult = await send('Runtime.evaluate', { expression: 'document.body.innerText' });
    ws.close();
    return textResult.result.result.value;
  } catch (e) {
    console.log('[CDP] Error:', e.message);
    return '';
  }
}

async function main() {
  console.log('=== AI Autopilot E2E Test ===\n');

  // Step 1: Connect two players
  console.log('--- Step 1: Connect players ---');
  const s1 = await connectPlayer(PLAYER1.address, PLAYER1.name);
  await sleep(1000);
  const s2 = await connectPlayer(PLAYER2.address, PLAYER2.name);
  await sleep(1000);

  // Track events
  const events = { aiAction: null, tableUpdates: 0, aiEnabled: false };

  s1.on('SC_TABLE_UPDATED', ({ table }) => {
    events.tableUpdates++;
    const turn = table.turn;
    const pot = table.pot;
    console.log(`[P1] Table updated #${events.tableUpdates}: turn=seat${turn}, pot=${pot}, board=${table.board?.length || 0} cards`);
  });

  s1.on('SC_AI_ENABLED', data => {
    events.aiEnabled = true;
    console.log('[P1] AI Enabled:', data);
  });

  s1.on('SC_AI_ACTION', data => {
    events.aiAction = data;
    console.log('[P1] >>> AI ACTION:', data.action, data.amount > 0 ? `$${data.amount}` : '', `(${data.reason})`);
  });

  s1.on('SC_SUGGESTION', data => {
    console.log('[P1] Suggestion:', data.action, data.reason);
  });

  // Bot auto-plays
  s2.on('SC_TABLE_UPDATED', ({ table }) => {
    // Find bot's seat
    for (const [seatId, seat] of Object.entries(table.seats)) {
      if (seat && seat.player && seat.player.id === PLAYER2.address && seat.turn) {
        const callAmount = table.callAmount || 0;
        setTimeout(() => {
          if (callAmount === 0) {
            console.log('[Bot] Checking');
            s2.emit('CS_CHECK', table.id);
          } else {
            console.log('[Bot] Calling', callAmount);
            s2.emit('CS_CALL', table.id);
          }
        }, 1000);
      }
    }
  });

  // Step 2: Join table 1
  console.log('\n--- Step 2: Join table ---');
  s1.emit('CS_JOIN_TABLE', 1);
  await sleep(2000);
  s2.emit('CS_JOIN_TABLE', 1);
  await sleep(3000);

  // Take screenshot - should show game started
  console.log('\n--- Step 3: Game should be starting ---');
  await cdpScreenshot('/tmp/ai-e2e-1-game-started.png');
  await sleep(5000); // Wait for hand to start

  // Step 4: Enable AI autopilot for Player1
  console.log('\n--- Step 4: Enable AI Autopilot (NFSP Hard) ---');
  s1.emit('CS_AI_ENABLE', { tableId: 1, difficulty: 'hard', maxHands: 10 });
  await sleep(2000);
  console.log('AI enabled?', events.aiEnabled);

  // Step 5: Wait for AI decisions (multiple hands)
  console.log('\n--- Step 5: Waiting for AI actions (30 seconds) ---');
  for (let i = 0; i < 6; i++) {
    await sleep(5000);
    const text = await cdpScreenshot(`/tmp/ai-e2e-2-action-${i}.png`);

    // Check for AI action text in the page
    const hasAIAction = text.includes('FOLD') || text.includes('CHECK') || text.includes('CALL') || text.includes('RAISE');
    const hasAutopilot = text.includes('AI Autopilot');
    const hasDifficulty = text.includes('Difficulty');

    console.log(`[Check ${i+1}] AI Action displayed: ${hasAIAction}, Autopilot panel: ${hasAutopilot}, Difficulty shown: ${hasDifficulty}`);
    console.log(`[Check ${i+1}] Last AI action event: ${events.aiAction ? `${events.aiAction.action} (${events.aiAction.reason})` : 'none'}`);

    if (events.aiAction) {
      console.log('\n*** AI ACTION WAS RECEIVED! ***');
      console.log('Action:', events.aiAction.action);
      console.log('Amount:', events.aiAction.amount);
      console.log('Confidence:', events.aiAction.confidence);
      console.log('Reason:', events.aiAction.reason);
    }
  }

  // Final screenshot
  console.log('\n--- Final State ---');
  const finalText = await cdpScreenshot('/tmp/ai-e2e-3-final.png');

  // Extract AI panel section
  if (finalText.includes('AI Autopilot')) {
    const idx = finalText.indexOf('AI Autopilot');
    console.log('AI Panel text:', finalText.substring(idx, idx + 300));
  }

  console.log('\nTable updates received:', events.tableUpdates);
  console.log('AI action received:', events.aiAction ? JSON.stringify(events.aiAction) : 'NONE');
  console.log('AI enabled:', events.aiEnabled);

  // Cleanup
  s1.disconnect();
  s2.disconnect();

  // Check server logs for AI worker
  try {
    const logs = fs.readFileSync('/tmp/server-ai-test.log', 'utf8');
    const aiLines = logs.split('\n').filter(l => l.includes('[AI]') || l.includes('[AI Worker]'));
    console.log('\n--- Server AI logs ---');
    aiLines.slice(-15).forEach(l => console.log(l));
  } catch (e) {}

  console.log('\n=== Test Complete ===');
  process.exit(0);
}

main().catch(e => { console.error('Test failed:', e); process.exit(1); });
