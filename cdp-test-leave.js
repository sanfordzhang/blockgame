const WebSocket = require('ws');
const { execSync } = require('child_process');

const PAGE_ID = 'FB1A0501AADEEEA8187F4F1B553994D6';
const WS_URL = `ws://localhost:9222/devtools/page/${PAGE_ID}`;

let msgId = 1;
const pending = new Map();

async function cdp() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(WS_URL);
        ws.on('open', () => resolve(ws));
        ws.on('error', reject);
    });
}

function send(ws, method, params = {}) {
    return new Promise((resolve) => {
        const id = msgId++;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
    });
}

async function evaluate(ws, expression) {
    const res = await send(ws, 'Runtime.evaluate', {
        expression,
        returnByValue: true
    });
    return res?.result?.result?.value;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getServerLog(lines = 80) {
    try { return execSync(`tail -${lines} /tmp/server.log`).toString(); }
    catch(e) { return ''; }
}

async function run() {
    console.log('🔌 Connecting to Chrome CDP...');
    const ws = await cdp();
    ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.id && pending.has(msg.id)) {
            pending.get(msg.id)(msg);
            pending.delete(msg.id);
        }
    });

    // Check current state
    const url = await evaluate(ws, 'window.location.href');
    const btns = await evaluate(ws, `Array.from(document.querySelectorAll('button')).map(b=>b.textContent.trim()).filter(t=>t).join('|')`);
    console.log('📍 URL:', url);
    console.log('🔘 Buttons:', btns);

    // If on home page, click Enter Game
    if (!url.includes('/play')) {
        console.log('\n🎯 Clicking Enter Game...');
        const r = await evaluate(ws, `
            const btn = Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Enter Game'));
            if(btn){btn.click();btn.textContent.trim();}else{'not found'}`);
        console.log('Result:', r);
    }

    // Wait for Leave button (up to 60s)
    console.log('\n⏳ Waiting for Leave button (60s)...');
    let leaveFound = false;
    for (let i = 0; i < 60; i++) {
        await sleep(1000);
        const b = await evaluate(ws, `Array.from(document.querySelectorAll('button')).map(b=>b.textContent.trim()).filter(t=>t).join('|')`);
        const u = await evaluate(ws, 'window.location.href');
        if (i % 10 === 0) console.log(`  [${i}s] ${u} | ${b}`);
        if (b && (b.includes('Leave') || b.includes('离开'))) {
            console.log(`✅ Leave button found at ${i}s! Buttons: ${b}`);
            leaveFound = true;
            break;
        }
    }

    if (!leaveFound) {
        console.log('❌ Leave button not found after 60s');
        ws.close();
        return;
    }

    // Record server log position before leave
    const logBefore = getServerLog(200);
    const linesBefore = logBefore.split('\n').length;

    // Click Leave
    console.log('\n🚪 Clicking Leave...');
    const leaveResult = await evaluate(ws, `
        const btn = Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Leave')||b.textContent.includes('离开'));
        if(btn){btn.click();btn.textContent.trim();}else{'not found'}`);
    console.log('Leave click:', leaveResult);

    // Wait for tx to process
    console.log('\n⏳ Waiting 25s for blockchain tx...');
    await sleep(25000);

    // Check new log lines
    const logAfter = getServerLog(200);
    const newLines = logAfter.split('\n').slice(linesBefore);
    const relevant = newLines.filter(l =>
        l.includes('locked') || l.includes('LeftTable') || l.includes('leaveTable') ||
        l.includes('LEAVE') || l.includes('leaveTableFor') || l.includes('lockedAmount')
    );

    console.log('\n📋 New server log (leave-related):');
    relevant.forEach(l => console.log(' ', l));

    const lockedZero = relevant.some(l => /locked[=: ]+0\b/.test(l) || l.includes('lockedAmount: 0') || l.includes('locked=0'));
    const lockedNonZero = relevant.some(l => /locked[=: ]+[1-9]/.test(l));

    console.log('\n🔍 Result:');
    if (lockedZero) console.log('✅ locked = 0 confirmed!');
    else if (lockedNonZero) console.log('❌ locked NOT zero');
    else console.log('⚠️  No locked info in new logs, showing all new lines:');

    if (!lockedZero && !lockedNonZero) {
        newLines.filter(l => l.trim()).forEach(l => console.log(' ', l));
    }

    ws.close();
}

run().catch(console.error);
