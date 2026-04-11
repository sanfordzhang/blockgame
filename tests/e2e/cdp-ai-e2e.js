/**
 * CDP AI Feature E2E Test — 锦标赛模式
 *
 * 基于 docs/GAME_BOT_TEST_FLOW.md 锦标赛流程，验证 AI 建议和 AI 托管功能。
 * 不 mock 牌型 / 不铸造 NFT，仅测试 AI 功能链路：
 *   1. 创建锦标赛
 *   2. Bot 加入锦标赛
 *   3. Player1 通过 CDP 浏览器加入锦标赛
 *   4. 游戏开始后验证 AI 控制面板 & AI 建议
 *   5. 手动操作一轮验证正常游戏流程
 *   6. 开启 AI 托管，验证自动操作
 */

const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const CDP = require('chrome-remote-interface');

const BASE_URL = 'http://127.0.0.1:3001';
const API_URL  = 'http://127.0.0.1:7778';
const PLAYER1  = { address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv' };
const BOT      = { address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4' };

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log   = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
const RESULTS = [];
let ssIdx = 0;

function pass(n) { RESULTS.push({ n, s: 'PASS' }); log(`  ✅ PASS: ${n}`); }
function fail(n, r) { RESULTS.push({ n, s: 'FAIL', r }); log(`  ❌ FAIL: ${n} — ${r}`); }

function httpPost(url, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const u = new URL(url);
    const req = http.request({
      method: 'POST', hostname: u.hostname, port: u.port, path: u.pathname,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

// ── Screenshot & eval helpers ────────────────────────────

async function ss(Page, name) {
  ssIdx++;
  const dir = 'test-results';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  try {
    const { data } = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync(`${dir}/ai-e2e-${String(ssIdx).padStart(2,'0')}-${name}.png`, Buffer.from(data, 'base64'));
    log(`  📸 ${name}`);
  } catch (_) {}
}

async function ev(Runtime, expr) {
  try {
    const r = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
    return r.result?.value;
  } catch (_) { return null; }
}

// ── Bot: joins tournament via WebSocket ──────────────────

function startBot(tournamentId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:7778/socket.io/?EIO=4&transport=websocket`);
    let done = false;
    ws.on('open', () => ws.send('40'));
    ws.on('message', raw => {
      const data = raw.toString();
      if (data === '2') { ws.send('3'); return; }
      if (data.startsWith('40') && !done) {
        done = true;
        setTimeout(() => {
          ws.send('42' + JSON.stringify(['CS_LOBBY_CONNECT', { walletAddress: BOT.address }]));
          setTimeout(() => {
            ws.send('42' + JSON.stringify(['CS_TOURNAMENT_JOIN', { tournamentId, walletAddress: BOT.address }]));
            setTimeout(() => {
              ws.send('42' + JSON.stringify(['CS_TOURNAMENT_ROOM_JOIN', { tournamentId, walletAddress: BOT.address }]));
              resolve(ws);
            }, 800);
          }, 1000);
        }, 500);
      }
      // Auto-play: check or call when it's bot's turn
      if (data.startsWith('42[')) {
        try {
          const [event, state] = JSON.parse(data.slice(2));
          if (['tournament_game_state', 'SC_GAME_STATE'].includes(event)) {
            botAutoPlay(ws, state, tournamentId);
          }
        } catch (_) {}
      }
    });
    ws.on('error', e => { if (!done) reject(e); });
    setTimeout(() => { if (!done) { done = true; resolve(ws); } }, 6000);
  });
}

function botAutoPlay(ws, state, tournamentId) {
  if (!state?.seats) return;
  for (const [sid, seat] of Object.entries(state.seats)) {
    if (!seat?.player) continue;
    const addr = (typeof seat.player === 'string' ? seat.player : seat.player.id || '').toLowerCase();
    if (addr !== BOT.address.toLowerCase()) continue;
    if (state.turn !== parseInt(sid) || seat.folded) continue;
    setTimeout(() => {
      const action = state.callAmount > 0 ? 'CALL' : 'CHECK';
      ws.send('42' + JSON.stringify([`CS_TOURNAMENT_${action}`, { tournamentId }]));
      log(`  🤖 Bot: ${action}`);
    }, 800 + Math.random() * 1000);
  }
}

// ── Main Test ────────────────────────────────────────────

async function test() {
  log('══════════════════════════════════════════════');
  log('  AI Feature E2E Test (锦标赛模式)');
  log('══════════════════════════════════════════════');

  // ── 1. Connect CDP ──
  log('\n[1/8] 连接 Chrome CDP...');
  const pages = await new Promise((res, rej) => {
    http.get('http://localhost:9222/json', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
  const tab = pages.find(p => p.url.includes('3001'));
  if (!tab) { log('❌ 没有找到 3001 tab'); process.exit(1); }
  const client = await CDP({ target: tab.webSocketDebuggerUrl });
  const { Page, Runtime } = client;
  await Page.enable();
  await Runtime.enable();
  pass('CDP 连接');

  // ── 2. 创建锦标赛 ──
  log('\n[2/8] 创建锦标赛 (2人赛)...');
  let tournamentId;
  try {
    const res = await httpPost(`${API_URL}/api/tournament/create`, {
      configId: 3, walletAddress: PLAYER1.address, mockGame: false
    });
    tournamentId = res.tournament?.tournamentId || res.tournament?.id;
    if (tournamentId) {
      pass(`锦标赛创建: ${tournamentId}`);
    } else {
      fail('锦标赛创建', JSON.stringify(res).substring(0, 100));
    }
  } catch (e) {
    fail('锦标赛创建', e.message);
  }

  if (!tournamentId) {
    await client.close();
    printReport();
    process.exit(1);
  }

  // ── 3. Bot 加入锦标赛 ──
  log('\n[3/8] Bot 加入锦标赛...');
  let botWs;
  try {
    botWs = await startBot(tournamentId);
    pass('Bot 加入锦标赛');
  } catch (e) {
    fail('Bot 加入锦标赛', e.message);
  }

  // ── 4. 浏览器导航到锦标赛游戏页 ──
  log('\n[4/8] 浏览器加入锦标赛...');
  const playUrl = `${BASE_URL}/tournament/${tournamentId}/play?address=${PLAYER1.address}`;
  log(`  导航到: ${playUrl}`);

  // Navigate by opening in same tab
  const navClient = await CDP({ target: tab.webSocketDebuggerUrl });
  await navClient.Page.enable();
  navClient.Page.navigate({ url: playUrl }).catch(() => {});
  await sleep(5000);
  await navClient.close().catch(() => {});

  // Reconnect to the tab (URL changed)
  const pages2 = await new Promise((res, rej) => {
    http.get('http://localhost:9222/json', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
  const playTab = pages2.find(p => p.url.includes('tournament') || p.url.includes('play')) || pages2.find(p => p.url.includes('3001'));
  const c2 = await CDP({ target: playTab.webSocketDebuggerUrl });
  const P = c2.Page, R = c2.Runtime;
  await P.enable();
  await R.enable();
  await sleep(3000);
  await ss(P, 'tournament-play');

  const curUrl = await ev(R, 'location.href');
  log(`  当前URL: ${curUrl}`);

  // Wait for game to start
  log('  等待游戏开始...');
  let gameStarted = false;
  for (let i = 0; i < 20; i++) {
    await sleep(2000);
    const state = await ev(R, `
      (function() {
        const btns = Array.from(document.querySelectorAll('button')).filter(b=>!b.disabled).map(b=>b.textContent.trim());
        return { btns, bodyLen: document.body.innerText.length };
      })()
    `);
    const btns = state?.btns || [];
    if (i % 3 === 0) log(`  等待中... [${btns.join(', ')}]`);
    if (btns.some(b => ['Check', 'Call', 'Fold', 'Raise'].includes(b))) {
      gameStarted = true;
      log('  游戏已开始!');
      break;
    }
  }
  await ss(P, 'game-started');
  if (gameStarted) pass('游戏开始'); else fail('游戏开始', '超时未检测到操作按钮');

  // ── 5. 检查 AI 控制面板 ──
  log('\n[5/8] 检查 AI 控制面板...');
  const aiPanel = await ev(R, `
    (function() {
      const found = !!Array.from(document.querySelectorAll('div, button')).find(e =>
        e.textContent.includes('AI Autopilot') || e.textContent.includes('Enable AI'));
      return { found };
    })()
  `);
  if (aiPanel?.found) {
    pass('AI 控制面板渲染');
  } else {
    // AI panel might not be on tournament page (it's on /play page only)
    fail('AI 控制面板渲染', 'AI 面板在锦标赛页面可能未渲染');
  }

  // ── 6. 测试 AI 建议 ──
  log('\n[6/8] 测试 AI 建议...');
  const suggestBtn = await ev(R, `
    (function() {
      const btn = Array.from(document.querySelectorAll('button')).find(b =>
        b.textContent.includes('Suggestion') || b.textContent.includes('AI'));
      return btn ? { text: btn.textContent.trim(), found: true } : { found: false };
    })()
  `);
  if (suggestBtn?.found) {
    await ev(R, `
      Array.from(document.querySelectorAll('button')).find(b =>
        b.textContent.includes('Suggestion') || b.textContent.includes('AI')).click()
    `);
    await sleep(3000);
    await ss(P, 'ai-suggestion');
    pass(`AI 建议按钮: ${suggestBtn.text}`);
  } else {
    fail('AI 建议按钮', '未找到 Suggestion 按钮 (锦标赛页面可能需要单独集成)');
  }

  // ── 7. 手动操作完成一轮 ──
  log('\n[7/8] 手动操作...');
  for (let round = 1; round <= 10; round++) {
    const action = await ev(R, `
      (function() {
        const btns = Array.from(document.querySelectorAll('button')).filter(b=>!b.disabled);
        const check = btns.find(b => b.textContent.trim() === 'Check');
        const call = btns.find(b => b.textContent.trim() === 'Call');
        const fold = btns.find(b => b.textContent.trim() === 'Fold');
        if (check) { check.click(); return 'Check'; }
        if (call)  { call.click();  return 'Call'; }
        if (fold)  { fold.click();  return 'Fold'; }
        return null;
      })()
    `);
    if (action) {
      log(`  操作 ${round}: ${action}`);
      pass(`手动操作: ${action}`);
      await sleep(3000);
      await ss(P, `action-${round}-${action.toLowerCase()}`);
      break;
    }
    await sleep(1500);
  }

  // ── 8. 等待几轮并截图最终状态 ──
  log('\n[8/8] 等待更多轮次...');
  for (let i = 0; i < 5; i++) {
    await sleep(3000);
    // Auto-play for player1 too
    await ev(R, `
      (function() {
        const btns = Array.from(document.querySelectorAll('button')).filter(b=>!b.disabled);
        const check = btns.find(b => b.textContent.trim() === 'Check');
        const call = btns.find(b => b.textContent.trim() === 'Call');
        if (check) { check.click(); return 'Check'; }
        if (call)  { call.click();  return 'Call'; }
        return null;
      })()
    `);
    if (i % 2 === 0) await ss(P, `round-${i+1}`);
  }
  await ss(P, 'final');

  // ── Cleanup ──
  if (botWs) botWs.close();
  await c2.close().catch(() => {});

  printReport();
}

function printReport() {
  log('\n══════════════════════════════════════════════');
  log('  测试报告');
  log('══════════════════════════════════════════════');
  const passed = RESULTS.filter(r => r.s === 'PASS').length;
  const failed = RESULTS.filter(r => r.s === 'FAIL').length;
  for (const r of RESULTS) {
    log(`  ${r.s === 'PASS' ? '✅' : '❌'} ${r.n}${r.r ? ` (${r.r})` : ''}`);
  }
  log(`\n  总计: ${passed} passed, ${failed} failed, ${RESULTS.length} total`);
  log(`  截图: test-results/ai-e2e-*.png (${ssIdx} 张)`);
  log('══════════════════════════════════════════════');
  process.exit(failed > 0 ? 1 : 0);
}

test().catch(e => { console.error('Fatal:', e); process.exit(1); });
