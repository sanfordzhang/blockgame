/**
 * AI Autopilot Stall Detection Test
 * - 通过 CDP 模拟 TronLink 钱包，进入游戏
 * - 启动 Bot (P2) 配对
 * - 在浏览器 UI 中开启 AI Autopilot (Hard/NFSP)
 * - 监控 60 秒，检测是否卡死
 * - 打印服务器 AI 日志分析原因
 */

const io = require('socket.io-client');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

const SERVER = 'http://127.0.0.1:7778';
const PLAYER1_ADDR = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const PLAYER2 = { address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4', name: 'Bot_P2' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── CDP helpers ──────────────────────────────────────────────────────────────
async function cdpOp(fn) {
  const pages = await new Promise((res, rej) =>
    http.get('http://localhost:9222/json', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej)
  );
  const page = pages.find(p => p.url.includes('127.0.0.1:3001') || p.url.includes('localhost:3001'));
  if (!page) { console.log('[CDP] No 3001 page'); return null; }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let mid = 1;
  const send = (m, p) => new Promise(r => {
    const id = mid++;
    ws.send(JSON.stringify({ id, method: m, params: p }));
    const h = msg => { const d = JSON.parse(msg); if (d.id === id) { ws.removeListener('message', h); r(d); } };
    ws.on('message', h);
  });
  await new Promise(r => ws.on('open', r));
  const result = await fn(send);
  ws.close();
  return result;
}

const ev = code => cdpOp(async s => { const r = await s('Runtime.evaluate', { expression: code, awaitPromise: false }); return r.result?.result?.value; });
const ss = file => cdpOp(async s => { const r = await s('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(file, Buffer.from(r.result.data, 'base64')); console.log('[SS]', file); });
const getBodyText = () => ev('document.body.innerText');

// ── Mock TronLink injection ──────────────────────────────────────────────────
async function injectMockTronLink(address) {
  const code = `
  (function() {
    const addr = '${address}';
    // Mock TronWeb
    window.tronWeb = {
      ready: true,
      defaultAddress: { base58: addr, hex: addr },
      trx: {
        getAccount: async () => ({ balance: 1000000000 }),
        getBalance: async () => 1000000000,
      },
      contract: () => ({
        at: async () => ({
          players: { call: async () => ({ balance: { toNumber: () => 100000000 }, lockedAmount: { toNumber: () => 0 }, isRegistered: true }) },
          getPlayerInfo: { call: async () => ({ balance: { toNumber: () => 100000000 }, lockedAmount: { toNumber: () => 0 }, isRegistered: true }) },
          registerPlayer: { send: async () => 'mock-tx' },
          deposit: { send: async () => 'mock-tx' },
          withdraw: { send: async () => 'mock-tx' },
          setDelegate: { send: async () => 'mock-tx' },
          revokeDelegate: { send: async () => 'mock-tx' },
          isAuthorizedDelegate: { call: async () => true },
          getPlayerDelegate: { call: async () => 'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA' },
        })
      }),
      fullNode: { host: 'https://nile.trongrid.io' },
      solidityNode: { host: 'https://nile.trongrid.io' },
      eventServer: { host: 'https://nile.trongrid.io' },
    };
    // Mock TronLink
    window.tronLink = {
      ready: true,
      tronWeb: window.tronWeb,
      request: async (req) => {
        if (req.method === 'tron_requestAccounts') return { code: 200, message: 'ok' };
        return null;
      }
    };
    console.log('[Mock] TronLink injected for', addr);
    return 'injected';
  })()`;
  return ev(code);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== AI Stall Detection Test ===\n');
  const results = { dir: '/tmp/ai-stall-' + Date.now() };
  fs.mkdirSync(results.dir, { recursive: true });

  // 1. Inject mock TronLink into browser
  console.log('[Step 1] Injecting mock TronLink...');
  const injected = await injectMockTronLink(PLAYER1_ADDR);
  console.log('Inject result:', injected);

  // 2. Navigate to home and connect wallet via CDP (simulate button click)
  await ev('window.location.href = "http://127.0.0.1:3001/"');
  await sleep(2500);
  await injectMockTronLink(PLAYER1_ADDR); // re-inject after navigation
  await sleep(500);

  const btns1 = await ev('Array.from(document.querySelectorAll("button")).map(b=>b.textContent.trim()).join("|")');
  console.log('[Step 2] Buttons on home:', btns1);
  await ss(results.dir + '/01-home.png');

  // Click Connect Wallet
  const connectResult = await ev('(()=>{ const b=Array.from(document.querySelectorAll("button")).find(b=>/connect.wallet/i.test(b.textContent)); if(b){b.click();return"clicked";}return"not found"; })()');
  console.log('Connect Wallet click:', connectResult);
  await sleep(2000);
  await injectMockTronLink(PLAYER1_ADDR);
  await sleep(1000);

  const btns2 = await ev('Array.from(document.querySelectorAll("button")).map(b=>b.textContent.trim()).join("|")');
  console.log('[Step 3] Buttons after connect:', btns2?.substring(0, 200));
  await ss(results.dir + '/02-after-connect.png');

  // Try "Skip to Game" first, then "Enter Game"
  let enterResult = await ev('(()=>{ const b=Array.from(document.querySelectorAll("button")).find(b=>/skip.to.game/i.test(b.textContent)); if(b){b.click();return"skip-clicked";}return"not found"; })()');
  if (enterResult === 'not found') {
    enterResult = await ev('(()=>{ const b=Array.from(document.querySelectorAll("button")).find(b=>/enter.game/i.test(b.textContent)); if(b){b.click();return"enter-clicked";}return"not found"; })()');
  }
  console.log('Enter game:', enterResult);
  await sleep(2500);

  const url = await ev('window.location.href');
  const btns3 = await ev('Array.from(document.querySelectorAll("button")).map(b=>b.textContent.trim()).slice(0,8).join("|")');
  console.log('URL:', url, '| Buttons:', btns3?.substring(0, 150));
  await ss(results.dir + '/03-ingame.png');

  const isAtPlay = url && url.includes('/play');
  if (!isAtPlay) {
    console.log('\n[WARN] Not at /play page. Trying direct navigation...');
    // Force navigate to /play with wallet address injected
    await ev(`
      window.__mockWallet = '${PLAYER1_ADDR}';
      window.location.href = '/play';
    `);
    await sleep(3000);
    await injectMockTronLink(PLAYER1_ADDR);
    await sleep(1000);
    const url2 = await ev('window.location.href');
    console.log('URL after force nav:', url2);
    await ss(results.dir + '/03b-force-play.png');
  }

  // 3. Start Bot (P2) via socket
  console.log('\n[Step 4] Starting Bot P2...');
  const s2 = await new Promise((res, rej) => {
    const s = io(SERVER, { transports: ['websocket'], query: { walletAddress: PLAYER2.address } });
    s.on('connect', () => {
      s.emit('CS_FETCH_LOBBY_INFO', { walletAddress: PLAYER2.address, socketId: s.id, gameId: 'lobby', username: PLAYER2.name });
      res(s);
    });
    s.on('connect_error', rej);
    setTimeout(() => rej(new Error('P2 connect timeout')), 8000);
  });
  console.log('[Bot P2] Connected:', s2.id);

  let botMoves = 0;
  let lastBotMove = null;
  s2.on('SC_TABLE_UPDATED', ({ table }) => {
    for (const [, seat] of Object.entries(table.seats || {})) {
      if (seat?.player?.id === PLAYER2.address && seat.turn) {
        botMoves++;
        const ca = table.callAmount || 0;
        lastBotMove = { time: Date.now(), callAmount: ca, street: table.street, pot: table.pot };
        console.log(`[Bot P2] Turn! #${botMoves} street=${table.street} callAmount=${ca}`);
        setTimeout(() => {
          if (ca === 0) s2.emit('CS_CHECK', table.id);
          else s2.emit('CS_CALL', table.id);
        }, 800);
      }
    }
  });
  s2.on('SC_TABLE_LEFT', () => console.log('[Bot P2] Left table'));

  s2.emit('CS_JOIN_TABLE', 1);
  await sleep(2000);

  // 4. Set AI to Hard and Enable via browser button
  console.log('\n[Step 5] Setting AI difficulty to Hard and enabling...');
  // Set select to hard
  await ev('(()=>{ const sel=document.querySelector("select"); if(sel){ sel.value="hard"; sel.dispatchEvent(new Event("change",{bubbles:true})); return "ok"; } return "no select"; })()');
  await sleep(300);

  // Check current AI button state
  const aiBtn = await ev('(()=>{ const b=Array.from(document.querySelectorAll("button")).find(b=>/AI/i.test(b.textContent)); return b?b.textContent.trim():"none"; })()');
  console.log('[AI] Button text:', aiBtn);

  if (aiBtn && aiBtn.includes('Disable')) {
    console.log('[AI] Disabling first...');
    await ev('(()=>{ const b=Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim().includes("Disable AI")); if(b)b.click(); })()');
    await sleep(800);
    await ev('(()=>{ const sel=document.querySelector("select"); if(sel){ sel.value="hard"; sel.dispatchEvent(new Event("change",{bubbles:true})); } })()');
    await sleep(300);
  }

  const enableResult = await ev('(()=>{ const b=Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim().includes("Enable AI")); if(b){b.click();return"enabled";}return"not found"; })()');
  console.log('[AI] Enable result:', enableResult);
  await sleep(2000);
  await ss(results.dir + '/04-ai-enabled.png');

  // 5. Monitor for 90 seconds
  console.log('\n=== Monitoring 90 seconds for stall ===');
  let lastSeenAction = null;
  let sameActionCount = 0;
  let stallDetected = false;
  let totalAIActions = 0;
  let handsCompleted = 0;
  let lastHandsPlayed = 0;

  for (let i = 0; i < 18; i++) {
    await sleep(5000);
    const t = (i + 1) * 5;

    const panel = await ev('(()=>{ const txt=document.body.innerText; const idx=txt.indexOf("AI Autopilot"); return idx>=0?txt.substring(idx,idx+300):"NO_PANEL"; })()') || '';
    const compact = panel.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    // Extract action from panel
    const actionMatch = compact.match(/\b(CHECK|CALL|FOLD|RAISE)\b/);
    const currentAction = actionMatch ? actionMatch[0] : null;

    // Extract hands played
    const handsMatch = compact.match(/Hands played:\s*(\d+)\s*\/\s*(\d+)/);
    const handsNow = handsMatch ? parseInt(handsMatch[1]) : lastHandsPlayed;
    if (handsNow > lastHandsPlayed) { handsCompleted += handsNow - lastHandsPlayed; lastHandsPlayed = handsNow; }

    if (currentAction) {
      totalAIActions++;
      if (currentAction === lastSeenAction) sameActionCount++;
      else { sameActionCount = 0; lastSeenAction = currentAction; }
    }

    // Stall = no new action for 5 consecutive checks (25s)
    const noProgress = !currentAction && i > 3;
    if (sameActionCount >= 5) { stallDetected = true; }

    console.log(`[T+${t}s] Panel: ${compact.substring(0, 120)}`);
    console.log(`         actions=${totalAIActions} sameCount=${sameActionCount} botMoves=${botMoves} hands=${handsNow}`);

    if (stallDetected && !results.stallScreenshot) {
      console.log('\n*** STALL DETECTED ***');
      results.stallScreenshot = results.dir + '/STALL-' + t + 's.png';
      await ss(results.stallScreenshot);
      // Dump server log
      try {
        const log = fs.readFileSync('/tmp/server-ai-test.log', 'utf8');
        const aiLines = log.split('\n').filter(l => l.includes('[AI]') || l.includes('[Socket] ===') || l.includes('handOver') || l.includes('changeTurn') || l.includes('checkAITurn'));
        fs.writeFileSync(results.dir + '/server-ai-log.txt', aiLines.join('\n'));
        console.log('Server AI log saved:', results.dir + '/server-ai-log.txt');
      } catch (e) {}
    }

    if (i % 3 === 2) await ss(results.dir + `/round-${Math.floor(i/3)}.png`);
  }

  // 6. Final analysis
  await ss(results.dir + '/final.png');
  console.log('\n=== FINAL ANALYSIS ===');
  console.log('Total AI actions seen in UI:', totalAIActions);
  console.log('Bot moves:', botMoves);
  console.log('Hands completed:', handsCompleted);
  console.log('Stall detected:', stallDetected);
  console.log('Screenshots in:', results.dir);

  // Server AI log tail
  try {
    const log = fs.readFileSync('/tmp/server-ai-test.log', 'utf8');
    const relevant = log.split('\n').filter(l =>
      l.includes('[AI]') || l.includes('checkAITurn') || l.includes('handOver') ||
      l.includes('changeTurn') || l.includes('[Socket] ===') || l.includes('startHand')
    );
    console.log('\n--- Server AI/Game logs (last 30) ---');
    relevant.slice(-30).forEach(l => console.log(l));
  } catch (e) { console.log('(no server log)'); }

  s2.disconnect();
  process.exit(stallDetected ? 1 : 0);
}

main().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
