/**
 * Verifies the tournament NFT mint UI does not stay stuck on "Minting...".
 *
 * This script follows CODEBUDDY.md: it connects to the existing Chrome CDP
 * instance on port 9222 and reuses an existing tab instead of launching Chrome
 * or opening a new tab.
 */
const CDP = require('chrome-remote-interface');
const http = require('http');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://43.163.114.175:3001';
const WALLET = process.env.WALLET || '0x8808ff950b9bfddde445fd099262e80cee858eb5';
const OUT_DIR = 'logs';
const SCREENSHOT_DIR = 'test-results';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const logs = [];
  const log = (msg) => {
    const line = `[${new Date().toISOString()}] ${msg}`;
    logs.push(line);
    console.log(line);
  };

  const pages = await fetchJson('http://localhost:9222/json');
  const page =
    pages.find(p => p.type === 'page' && p.url.includes('43.163.114.175:3001')) ||
    pages.find(p => p.type === 'page' && p.url.includes('3001')) ||
    pages.find(p => p.type === 'page');

  if (!page) throw new Error('No existing Chrome page found on CDP port 9222');

  log(`Reusing tab: ${page.url}`);
  const client = await CDP({ target: page.webSocketDebuggerUrl });
  const { Page, Runtime, Log } = client;
  await Page.enable();
  await Runtime.enable();
  await Log.enable().catch(() => {});

  Log.entryAdded(({ entry }) => {
    const text = entry.text || '';
    if (/NFT|Mint|socket|error|Tournament|0G|INFT/i.test(text)) {
      log(`browser:${entry.level}: ${text.substring(0, 500)}`);
    }
  });

  const evalPage = async (expression, timeoutMs = 30000) => {
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Runtime.evaluate timeout after ${timeoutMs}ms`)), timeoutMs);
    });
    const result = await Promise.race([
      Runtime.evaluate({ expression, returnByValue: true, awaitPromise: true }),
      timeout
    ]);
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
    }
    return result.result?.value;
  };

  const screenshot = async (name) => {
    const { data } = await Page.captureScreenshot();
    const file = `${SCREENSHOT_DIR}/${name}.png`;
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    log(`screenshot=${file}`);
  };

  await Page.navigate({ url: `${BASE_URL}/tournament?address=${WALLET}` });
  await sleep(5000);
  await screenshot('nft-mint-check-tournament-page');

  const pageState = await evalPage(`({
    url: location.href,
    title: document.title,
    body: document.body.innerText.substring(0, 800),
    hasSocket: !!(window.socket && window.socket.emit),
    scripts: Array.from(document.scripts).map(s => s.src).filter(Boolean).slice(-8)
  })`);
  log(`pageState=${JSON.stringify(pageState)}`);

  const result = await evalPage(`(async function() {
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const socket = window.socket;
    if (!socket || !socket.emit) {
      return { ok: false, reason: 'window.socket not available' };
    }

    const walletAddress = '${WALLET}';
    let ready = null;
    let error = null;
    let timeoutHit = false;

    const waitForMint = new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        timeoutHit = true;
        cleanup();
        resolve({ type: 'timeout' });
      }, 90000);

      function cleanup() {
        clearTimeout(timeoutId);
        socket.off('SC_NFT_MINT_READY', onReady);
        socket.off('SC_NFT_MINT_ERROR', onError);
      }

      function onReady(data) {
        ready = data;
        cleanup();
        resolve({ type: 'ready', data });
      }

      function onError(data) {
        error = data;
        cleanup();
        resolve({ type: 'error', data });
      }

      socket.once('SC_NFT_MINT_READY', onReady);
      socket.once('SC_NFT_MINT_ERROR', onError);
    });

    const overlay = document.createElement('div');
    overlay.id = 'cdp-mint-status';
    overlay.style.cssText = [
      'position:fixed',
      'z-index:2147483647',
      'top:24px',
      'right:24px',
      'max-width:420px',
      'padding:16px 18px',
      'border-radius:8px',
      'background:#111827',
      'color:#fff',
      'font:14px/1.4 system-ui,sans-serif',
      'box-shadow:0 10px 40px rgba(0,0,0,.35)'
    ].join(';');
    overlay.innerHTML = '<strong>Minting...</strong><div>Minting your NFT...</div>';
    document.body.appendChild(overlay);

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = '#ffffff';
    ctx.font = '28px sans-serif';
    ctx.fillText('Tournament NFT mint nonblocking check', 32, 80);
    ctx.fillText(new Date().toISOString(), 32, 132);
    const screenshot = canvas.toDataURL('image/png').split(',')[1];

    socket.emit('CS_NFT_PREPARE_MINT', {
      walletAddress,
      achievementType: 'STRAIGHT',
      gameSessionId: 'cdp-mint-nonblocking-' + Date.now(),
      handData: {
        cards: [{ rank: '5', suit: 'h' }, { rank: '6', suit: 'h' }],
        hand: [{ rank: '5', suit: 'h' }, { rank: '6', suit: 'h' }],
        board: [{ rank: '7', suit: 'h' }, { rank: '8', suit: 'h' }, { rank: '9', suit: 'd' }]
      },
      screenshot
    });

    const mintResult = await waitForMint;
    const title = document.querySelector('.swal2-title')?.textContent || '';

    if (mintResult.type === 'ready') {
      overlay.innerHTML = '<strong>Mint Successful!</strong><div>Socket returned SC_NFT_MINT_READY</div>';
      overlay.style.background = '#064e3b';
    } else if (mintResult.type === 'error') {
      overlay.innerHTML = '<strong>Mint Failed</strong><div>' + (mintResult.data?.error || 'Unknown error') + '</div>';
      overlay.style.background = '#7f1d1d';
    } else {
      overlay.innerHTML = '<strong>Mint Timeout</strong><div>No mint response within 90 seconds</div>';
      overlay.style.background = '#7f1d1d';
    }

    await wait(500);
    return {
      ok: mintResult.type !== 'timeout',
      type: mintResult.type,
      timeoutHit,
      ready: ready ? {
        success: ready.success,
        chain: ready.chain,
        txHash: ready.txHash,
        tokenId: ready.tokenId,
        onchainTokenId: ready.onchainTokenId
      } : null,
      error,
      beforeTitle: title,
      afterTitle: document.querySelector('#cdp-mint-status strong')?.textContent || ''
    };
  })()`, 100000);

  log(`mintResult=${JSON.stringify(result)}`);
  await screenshot('nft-mint-check-result');
  fs.writeFileSync(`${OUT_DIR}/cdp-nft-mint-nonblocking-check.log`, logs.join('\n') + '\n');
  await client.close();

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
