/**
 * cdp-zerog-full-test.js
 *
 * Comprehensive 0G/EVM wallet automated test via Chrome DevTools Protocol (CDP).
 * Reference: docs/Tronlink_Deposit_AutoSign.md (cliclick auto-sign pattern)
 *
 * Tests: Connect → Chain Switch → Deposit → Authorize Server → Withdraw → Disconnect
 * Uses cliclick for automatic MetaMask popup confirmation.
 *
 * Prerequisites:
 *   - Chrome running with --remote-debugging-port=9222
 *   - Frontend at http://127.0.0.1:3001
 *   - Backend at http://127.0.0.1:7778
 *   - cliclick installed: brew install cliclick
 *
 * Usage:
 *   node cdp-zerog-full-test.js
 */

const CDP = require('chrome-remote-interface');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURATION
// ============================================================
const CDP_PORT = 9222;
const FRONTEND_URL = 'http://127.0.0.1:3001';
const DEPOSIT_AMOUNT = '0.1';  // 0G amount to deposit
const SCREENSHOT_DIR = 'test-results';

// MetaMask confirm button coordinates (logical screen coords)
// Adjust based on your screen: run `cliclick p` to find current mouse position
const MM_CONFIRM_BTN = { x: 954, y: 638 };   // MetaMask "Confirm" button
const MM_REJECT_BTN  = { x: 887, y: 638 };   // MetaMask "Reject" button (for reference)

// Test results tracker
const results = {
    phase1_connect:     null,
    phase2_chain:       null,
    phase3_deposit:     null,
    phase4_authorize:   null,
    phase5_withdraw:    null,
    phase6_disconnect:  null,
    errors: [],
    screenshots: []
};

// ============================================================
// UTILITIES
// ============================================================
function log(tag, msg) {
    const ts = new Date().toISOString().slice(11, 19);
    console.log(`[${ts}] ${tag} | ${msg}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Execute a shell command (synchronous, returns stdout)
 */
function shell(cmd, desc) {
    try {
        log('SHELL', `[${desc}] ${cmd}`);
        const result = execSync(cmd, { encoding: 'utf-8', timeout: 15000 }).trim();
        return result;
    } catch (e) {
        log('SHELL_ERR', `[${desc}] failed: ${e.message.slice(0, 100)}`);
        return null;
    }
}

/**
 * Use cliclick to simulate mouse click at given logical coordinates.
 * This is used to auto-confirm MetaMask popup dialogs (like TronLink auto-sign).
 *
 * @param {number} x - Logical X coordinate
 * @param {number} y - Logical Y coordinate
 * @param {string} desc - Description for logging
 */
function cliclickClick(x, y, desc) {
    // Two-phase click: move first, then click (per Tronlink_Deposit_AutoSign.md pattern)
    log('CLICK', `${desc} @ (${x}, ${y})`);
    try {
        execSync(`cliclick m:${x},${y}`, { encoding: 'utf-8', timeout: 5000 });
        sleep(500); // Brief pause after move
        execSync(`cliclick c:${x},${y}`, { encoding: 'utf-8', timeout: 5000 });
        return true;
    } catch (e) {
        log('CLICK_ERR', `cliclick failed for ${desc}: ${e.message.slice(0, 80)}`);
        return false;
    }
}

/**
 * Wait for MetaMask popup and auto-click Confirm button.
 * This is the core auto-sign mechanism from Tronlink_Deposit_AutoSign.md.
 *
 * @param {number} waitMs - How long to wait before clicking (default 4000ms)
 * @param {number} retries - Number of retry attempts if first click misses (default 2)
 */
async function autoConfirmMetaMask(waitMs = 4000, retries = 2) {
    log('AUTOSIGN', `Waiting ${waitMs}ms for MetaMask popup...`);
    await sleep(waitMs);

    for (let i = 1; i <= retries; i++) {
        log('AUTOSIGN', `Attempt ${i}/${retries}: clicking Confirm...`);
        cliclickClick(MM_CONFIRM_BTN.x, MM_CONFIRM_BTN.y, `MetaMask Confirm #${i}`);
        await sleep(2500); // Wait between attempts
    }
}

/**
 * Take a screenshot via CDP Page.captureScreenshot
 */
async function takeScreenshot(Page, name) {
    const dir = SCREENSHOT_DIR;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, `zerog-${name}.png`);
    try {
        const data = await Page.captureScreenshot({
            format: 'png',
            saveBeyondViewport: true
        });
        fs.writeFileSync(filepath, Buffer.from(data.data, 'base64'));
        results.screenshots.push(filepath);
        log('SCREENSHOT', `Saved: ${filepath}`);
        return filepath;
    } catch (e) {
        log('SCREENSHOT_ERR', `Failed: ${e.message}`);
        return null;
    }
}

/**
 * Also take a system-level screenshot (captures MetaMask popup overlay)
 */
function takeSystemScreenshot(name) {
    const dir = SCREENSHOT_DIR;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, `sys-${name}.png`);
    shell(`screencapture -x "${filepath}"`, 'System screenshot');
    results.screenshots.push(filepath);
    log('SYS_SCREENSHOT', `Saved: ${filepath}`);
    return filepath;
}

/**
 * Execute JS in page context with async support
 */
async function evalJs(Runtime, code, desc) {
    try {
        log('EVAL', `${desc} ...`);
        const result = await Runtime.evaluate({
            expression: code,
            returnByValue: true,
            awaitPromise: true
        });
        if (result.exceptionDetails) {
            throw new Error(result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
        }
        return result.result.value;
    } catch (e) {
        log('EVAL_ERR', `[${desc}] ${e.message}`);
        results.errors.push(`${desc}: ${e.message}`);
        return null;
    }
}

/**
 * Find and click a DOM element by text content
 */
async function clickByText(Runtime, text, desc) {
    const code = `
        (() => {
            // Try buttons first
            const btns = [...document.querySelectorAll('button, [role=button], [class*=btn]')];
            const el = btns.find(b => b.textContent.trim().includes('${text}') && b.offsetParent !== null);
            if (el) {
                el.scrollIntoView({ block: 'center' });
                el.click();
                return 'clicked:' + el.textContent.trim().slice(0, 50);
            }

            // Try all elements
            const all = [...document.querySelectorAll('*')];
            const el2 = all.find(e =>
                e.children.length === 0 &&
                e.textContent.trim().includes('${text}') &&
                e.offsetParent !== null &&
                e.offsetHeight > 0 && e.offsetHeight < 100
            );
            if (el2) { el2.click(); return 'clicked-text:' + el2.textContent.trim().slice(0,30); }

            // List available buttons for debugging
            const visibleBtns = btns.filter(b => b.offsetParent !== null).map(b => b.textContent.trim().slice(0, 25));
            return 'not-found:' + text + '|available:[' + visibleBtns.join(',') + ']';
        })()
    `;
    const r = await evalJs(Runtime, code, `Click: ${desc || text}`);
    log('CLICK_RESULT', `${desc || text}: ${r}`);
    return r;
}

/**
 * Get visible error/alert messages from page
 */
async function getErrors(Runtime) {
    const r = await evalJs(Runtime, `
        (() => {
            const msgs = [];
            document.querySelectorAll('[class*=error], [class*="Error"], .alert-danger, [role=alert]').forEach(el => {
                if (el.offsetParent !== null && el.textContent.trim()) {
                    msgs.push(el.textContent.trim().slice(0, 120));
                }
            });
            // Also check for any red/orange styled text
            document.querySelectorAll('*').forEach(el => {
                const style = window.getComputedStyle(el);
                const color = style.color || '';
                if ((color.includes('rgb(255' || color.includes('red') || color.includes('#f00')) &&
                    el.children.length === 0 && el.textContent.trim() && el.offsetHeight > 0 && el.offsetHeight < 50) {
                    msgs.push('[red-text]' + el.textContent.trim().slice(0, 80));
                }
            });
            return [...new Set(msgs)];
        })()
    `, 'Get errors');
    return r || [];
}

/**
 * Read key UI state values from the Landing page
 */
async function readPageState(Runtime) {
    return evalJs(Runtime, `
        (() => ({
            wallet_type: localStorage.getItem('wallet_type'),
            wallet_address: localStorage.getItem('wallet_address'),
            zerog_connected: localStorage.getItem('zerog_connected')
        }))()
    `, 'Read page state');
}

// ============================================================
// PHASE 1: CONNECT 0G WALLET
// ============================================================
async function testConnect(client, Runtime, Page) {
    log('\n═══ PHASE 1: CONNECT 0G WALLET ═══\n', '');

    await takeScreenshot(Page, '01-before-connect');

    // Check MetaMask availability
    const hasMM = await evalJs(Runtime, '!!window.ethereum && !!window.ethereum.isMetaMask', 'Check MetaMask');
    log('INFO', `MetaMask available: ${hasMM}`);
    if (!hasMM) {
        results.phase1_connect = 'SKIP: No MetaMask detected';
        log('WARN', results.phase1_connect);
        return false;
    }

    // Clear any previous state for clean test
    await evalJs(Runtime, `
        localStorage.removeItem('wallet_type');
        localStorage.removeItem('wallet_address');
        localStorage.removeItem('zerog_connected');
        'cleared'
    `, 'Clear old wallet state');

    // Reload page for clean state
    log('ACTION', 'Reloading page for clean connect...');
    await Page.navigate({ url: FRONTEND_URL });
    await Page.loadEventFired();
    await sleep(3000);

    await takeScreenshot(Page, '01b-after-clear-reload');

    // List available buttons for debug
    const btnInfo = await evalJs(Runtime, `
        (() => {
            const btns = [...document.querySelectorAll('button, [role=button], a[class*=btn]')];
            return btns.filter(b => b.offsetParent !== null)
                       .map(b => ({text: b.textContent.trim().slice(0,40), tag: b.tagName, class: b.className.slice(0,40)}));
        })()
    `, 'List visible buttons');
    log('INFO', `Visible buttons: ${JSON.stringify(btnInfo).slice(0, 300)}`);

    // Try to find and click the 0G / EVM connect button
    let clicked = await clickByText(Runtime, '0G / EVM', '0G/EVM Connect button');
    if (!clicked?.startsWith('clicked')) {
        clicked = await clickByText(Runtime, 'EVM', 'EVM button');
    }
    if (!clicked?.startsWith('clicked')) {
        clicked = await clickByText(Runtime, '0G', '0G button fallback');
    }
    if (!clicked?.startsWith('clicked')) {
        // Try finding by data attribute or specific class
        clicked = await evalJs(Runtime, `
            (() => {
                const el = document.querySelector('[data-network="zerog"], .btn-zerog, #connect-0g');
                if (el) { el.click(); return 'clicked-selector:' + el.id + '.' + el.className; }
                return 'not-found-by-selector';
            })()
        `, 'Try selector-based click');
    }

    log('RESULT', `Connect click: ${clicked}`);

    if (clicked?.startsWith('clicked')) {
        // MetaMask connection popup should appear — auto-confirm
        log('WAIT', 'MetaMask connection popup expected, waiting...');
        await sleep(3000);
        takeSystemScreenshot('01c-connect-popup');

        // Auto-confirm MetaMask connection request
        autoConfirmMetaMask(2000, 1); // Don't wait too long, fire-and-forget for connect
        await sleep(5000);
    } else {
        log('WARN', 'Could not find/connect 0G button, trying restore path...');
        // Maybe already connected from localStorage restore? Check state
        await sleep(3000);
    }

    await takeScreenshot(Page, '02-after-connect-attempt');

    // Check connection result
    const state = await readPageState(Runtime);
    log('INFO', `State after connect: type=${state.wallet_type}, addr=${state.wallet_address?.slice(0,12)}...`);

    if (state.wallet_type === 'zerog' && state.wallet_address && state.wallet_address.length > 10) {
        results.phase1_connect = `OK: Connected as ${state.wallet_address}`;
        log('PASS', results.phase1_connect);
        return true;
    } else {
        results.phase1_connect = `PARTIAL: type=${state.wallet_type}, addr=${state.wallet_address || 'none'}`;
        log('WARN', results.phase1_connect);
        return false;
    }
}

// ============================================================
// PHASE 2: CHAIN SWITCH TO 0G TESTNET (16602 / 0x40DA)
// ============================================================
async function testChainSwitch(client, Runtime, Page) {
    log('\n═══ PHASE 2: CHAIN ID CHECK & SWITCH ═══\n', '');

    await takeScreenshot(Page, '03-before-chain-check');

    // Get actual chainId from MetaMask
    const chainIdHex = await evalJs(Runtime,
        `(async () => { try { return await window.ethereum.request({method:'eth_chainId'}); } catch(e) { return 'err:'+e.message; }})()`,
        'Get chainId (async)');
    log('INFO', `Current chainId (hex): ${chainIdHex}`);

    let chainNum = 0;
    if (chainIdHex && !String(chainIdHex).startsWith('err') && chainIdHex !== 'undefined' && chainIdHex !== 'null') {
        chainNum = parseInt(chainIdHex, 16);
    }

    const EXPECTED = 16602; // 0x40DA — CORRECTED from bug (was 0x40EA=16618)

    if (chainNum === EXPECTED) {
        results.phase2_chain = `OK: On correct chain (${EXPECTED}=0x40DA=0G Testnet)`;
        log('PASS', results.phase2_chain);
        await takeScreenshot(Page, '04-chain-ok');
        return true;

    } else if (chainNum > 0) {
        results.phase2_chain = `MISMATCH: on chain ${chainNum}, need ${EXPECTED} (0x40DA). Fixing...`;
        log('WARN', results.phase2_chain);
        results.errors.push(results.phase2_chain);

        // Trigger switchChain through the page's zeroGInteract module
        // First check if we can import/call it
        log('ACTION', 'Attempting programmatic chain switch...');

        const switchResult = await evalJs(Runtime, `
            (async () => {
                try {
                    // Method A: Try calling switchChain from the module if exposed
                    if (typeof window.__zeroGModule !== 'undefined' && typeof window.__zeroGModule.switchChain === 'function') {
                        await window.__zeroGModule.switchChain('testnet');
                        return 'method-A-ok';
                    }

                    // Method B: Direct ethereum.request switch
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: '0x40DA' }]
                    });
                    return 'method-B-switched';

                } catch(e) {
                    // If chain not added (4902), add it first
                    if (e.code === 4902) {
                        try {
                            await window.ethereum.request({
                                method: 'wallet_addEthereumChain',
                                params: [{
                                    chainId: '0x40DA',
                                    chainName: '0G Testnet',
                                    nativeCurrency: { name: '0G Token', symbol: '0G', decimals: 18 },
                                    rpcUrls: ['https://evmrpc-galileo.0g.ai'],
                                    blockExplorerUrls: ['https://chainscan-galileo.0g.ai']
                                }]
                            });
                            // After adding, switch
                            await window.ethereum.request({
                                method: 'wallet_switchEthereumChain',
                                params: [{ chainId: '0x40DA' }]
                            });
                            return 'added-and-switched';
                        } catch(addErr) {
                            return 'add-failed:' + addErr.message;
                        }
                    }
                    return 'switch-err:' + e.code + ':' + e.message;
                }
            })()
        `, 'Switch to 0G Testnet (0x40DA)');

        log('RESULT', `Switch result: ${switchResult}`);

        // MetaMask will show network switch popup — auto-confirm
        log('WAIT', 'Waiting for MetaMask network approval popup...');
        await sleep(3000);
        takeSystemScreenshot('03-chain-switch-popup');
        autoConfirmMetaMask(2000, 1);
        await sleep(5000);

        // Re-check chain
        const newCid = await evalJs(Runtime,
            `(async () => { try { return await window.ethereum.request({method:'eth_chainId'}); } catch(e) { return e.message; }})()`,
            'Re-check chainId after switch');
        const newCidNum = parseInt(newCid, 16);
        log('INFO', `ChainId after switch: ${newCid} (=${newCidNum})`);

        await takeScreenshot(Page, '04-after-chain-switch');

        if (newCidNum === EXPECTED) {
            results.phase2_chain = `FIXED: Now on correct chain (${EXPECTED})`;
            log('PASS', results.phase2_chain);
            return true;
        } else {
            results.phase2_chain = `STILL WRONG: chain ${newCidNum}, expected ${EXPECTED}. User may need to manually approve in MetaMask.`;
            log('FAIL', results.phase2_chain);
            return false;
        }
    } else {
        results.phase2_chain = `UNKNOWN: chainId="${chainIdHex}"`;
        log('WARN', results.phase2_chain);
        return false;
    }
}

// ============================================================
// PHASE 3: DEPOSIT 0G
// ============================================================
async function testDeposit(client, Runtime, Page) {
    log('\n═══ PHASE 3: DEPOSIT 0G ═══\n', '');

    // Verify connected as 0G
    const state = await readPageState(Runtime);
    if (state.wallet_type !== 'zerog') {
        results.phase3_deposit = `SKIP: Not connected as zerog (type=${state.wallet_type})`;
        log('WARN', results.phase3_deposit);
        return false;
    }

    await takeScreenshot(Page, '05-before-deposit');

    // Read current balance before deposit
    const balBefore = await evalJs(Runtime,
        `(document.querySelector('[class*=balance], [class*=Balance]') || {}).textContent || 'N/A'`,
        'Read balance before deposit');
    log('INFO', `Balance before deposit: ${balBefore}`);

    // Find and fill the deposit amount input
    log('ACTION', `Setting deposit amount to ${DEPOSIT_AMOUNT}...`);
    const setInputResult = await evalJs(Runtime, `
        (() => {
            const inputs = document.querySelectorAll('input[type=text], input[type=number], input:not([type])');
            for (const inp of inputs) {
                if (inp.offsetParent === null || inp.type === 'hidden' || inp.type === 'submit') continue;
                const ph = (inp.placeholder || '').toLowerCase();
                const id = (inp.id || '').toLowerCase();
                if (ph.includes('amount') || ph.includes('deposit') || id.includes('deposit') ||
                    id.includes('amount') || ph.includes('0g')) {
                    const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    nativeSet.call(inp, '${DEPOSIT_AMOUNT}');
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                    inp.dispatchEvent(new Event('blur', { bubbles: true }));
                    return 'set:' + (inp.placeholder || inp.id) + '=' + inp.value;
                }
            }
            // Set the first visible non-hidden input
            for (const inp of inputs) {
                if (inp.offsetParent !== null && inp.type !== 'hidden' && inp.type !== 'submit' && inp.type !== 'checkbox') {
                    const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    nativeSet.call(inp, '${DEPOSIT_AMOUNT}');
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                    return 'set-first-visible=' + inp.value;
                }
            }
            return 'no-input-found';
        })()
    `, `Set deposit amount`);
    log('INPUT', setInputResult);
    await sleep(1000);
    await takeScreenshot(Page, '05b-after-set-amount');

    // Click Deposit button
    log('ACTION', 'Clicking Deposit button...');
    const depClicked = await clickByText(Runtime, 'Deposit', 'Deposit button');
    log('RESULT', `Deposit clicked: ${depClicked}`);

    // Wait for MetaMask transaction popup, then auto-confirm
    log('WAIT', 'Waiting for MetaMask deposit tx popup...');
    await sleep(4000);
    takeSystemScreenshot('06-deposit-popup'); // Capture MetaMask popup with system screenshot

    // Auto-confirm the deposit transaction in MetaMask
    await autoConfirmMetaMask(2000, 3); // Up to 3 attempts for deposit confirmation

    // Wait for transaction to be mined/processed
    log('WAIT', 'Waiting for deposit tx to be processed (15s)...');
    await sleep(15000);

    await takeScreenshot(Page, '06-after-deposit');

    // Check for errors on page
    const errs = await getErrors(Runtime);
    if (errs.length > 0) {
        log('ERROR', `Deposit errors: ${errs.join('; ')}`);
        results.errors.push(`Deposit: ${errs[0]}`);
    }

    // Read balance after
    const balAfter = await evalJs(Runtime,
        `(document.querySelector('[class*=balance], [class*=Balance]') || {}).textContent || 'N/A'`,
        'Read balance after deposit');
    log('INFO', `Balance after deposit: ${balAfter}`);

    // Check for success indicators
    const hasSuccess = await evalJs(Runtime, `
        (() => {
            const txt = document.body.innerText;
            return {
                hasTxHash: txt.includes('0x') && /[0-9a-f]{64}/i.test(txt),
                hasSuccess: txt.toLowerCase().includes('success') || txt.toLowerCase().includes('confirmed'),
                hasDepositing: txt.toLowerCase().includes('depositing'),
                bodySnippet: txt.slice(-500)
            };
        })()
    `, 'Check deposit success indicators');
    log('INFO', `Success checks: ${JSON.stringify(hasSuccess)?.slice(0, 200)}`);

    if (errs.length > 0 && !hasSuccess?.hasSuccess) {
        results.phase3_deposit = `FAILED: ${errs[0].slice(0, 70)}`;
        log('FAIL', results.phase3_deposit);
    } else {
        results.phase3_deposit = `COMPLETED (before:${balBefore}, after:${balAfter})`;
        log('PASS', results.phase3_deposit);
    }
    return errs.length === 0;
}

// ============================================================
// PHASE 4: AUTHORIZE SERVER
// ============================================================
async function testAuthorizeServer(client, Runtime, Page) {
    log('\n═══ PHASE 4: AUTHORIZE SERVER ═══\n', '');

    const state = await readPageState(Runtime);
    if (state.wallet_type !== 'zerog') {
        results.phase4_authorize = `SKIP: Not connected as zerog`;
        log('WARN', results.phase4_authorize);
        return false;
    }

    await takeScreenshot(Page, '07-before-authorize');

    // Check current authorization status
    const authStatusBefore = await clickByText(Runtime, 'Authorized', 'Check auth status (will fail if not found)');
    log('INFO', `Auth status check: ${authStatusBefore}`);

    // Click Authorize Server button
    log('ACTION', 'Clicking Authorize Server button...');
    const authClicked = await clickByText(Runtime, 'Authorize', 'Authorize Server button');
    if (!authClicked?.startsWith('clicked')) {
        await clickByText(Server, 'Server Authorization', 'Server Auth button alt');
    }

    log('RESULT', `Auth clicked: ${authClicked}`);

    // Wait for MetaMask approve popup
    log('WAIT', 'Waiting for MetaMask authorize popup...');
    await sleep(4000);
    takeSystemScreenshot('08-authorize-popup');

    // Auto-confirm
    await autoConfirmMetaMask(2000, 3);
    await sleep(12000); // Wait for auth tx to process

    await takeScreenshot(Page, '08-after-authorize');

    const errs = await getErrors(Runtime);
    if (errs.length > 0) {
        log('ERROR', `Authorize errors: ${errs.join('; ')}`);
        results.errors.push(`Authorize: ${errs[0]}`);
    }

    // Check if "Authorized" badge now shows
    const authBadge = await evalJs(Runtime, `
        (() => {
            const txt = document.body.innerText.toLowerCase();
            return {
                isAuthorized: txt.includes('authorized') && !txt.includes('not authorized'),
                notAuthorized: txt.includes('not authorized'),
                snippet: document.body.innerText.slice(-300)
            };
        })()
    `, 'Check authorization badge');
    log('INFO', `Auth badge: ${JSON.stringify(authBadge)?.slice(0, 200)}`);

    if (authBadge?.isAuthorized) {
        results.phase4_authorize = 'OK: Server Authorized ✅';
        log('PASS', results.phase4_authorize);
    } else {
        results.phase4_authorize = errs.length > 0 ? `FAILED: ${errs[0].slice(0, 70)}` : 'PENDING (may need more time)';
        log('WARN', results.phase4_authorize);
    }
    return authBadge?.isAuthorized || false;
}

// ============================================================
// PHASE 5: WITHDRAW
// ============================================================
async function testWithdraw(client, Runtime, Page) {
    log('\n═══ PHASE 5: WITHDRAW 0G ═══\n', '');

    const state = await readPageState(Runtime);
    if (state.wallet_type !== 'zerog') {
        results.phase5_withdraw = `SKIP: Not connected as zerog`;
        log('WARN', results.phase5_withdraw);
        return false;
    }

    await takeScreenshot(Page, '09-before-withdraw');

    // Read balance before withdraw
    const balBefore = await evalJs(Runtime,
        `(document.querySelector('[class*=balance], [class*=Balance]') || {}).textContent || 'N/A'`,
        'Balance before withdraw');
    log('INFO', `Balance before withdraw: ${balBefore}`);

    // Click Withdraw button
    log('ACTION', 'Clicking Withdraw button...');
    const wdClicked = await clickByText(Runtime, 'Withdraw', 'Withdraw button');
    log('RESULT', `Withdraw clicked: ${wdClicked}`);

    // Wait for MetaMask popup
    log('WAIT', 'Waiting for MetaMask withdraw popup...');
    await sleep(4000);
    takeSystemScreenshot('10-withdraw-popup');

    // Auto-confirm
    await autoConfirmMetaMask(2000, 3);
    await sleep(12000);

    await takeScreenshot(Page, '10-after-withdraw');

    const errs = await getErrors(Runtime);
    if (errs.length > 0) {
        log('ERROR', `Withdraw errors: ${errs.join('; ')}`);
        results.errors.push(`Withdraw: ${errs[0]}`);
    }

    const balAfter = await evalJs(Runtime,
        `(document.querySelector('[class*=balance], [class*=Balance]') || {}).textContent || 'N/A'`,
        'Balance after withdraw');
    log('INFO', `Balance after withdraw: ${balAfter}`);

    results.phase5_withdraw = errs.length > 0 ? `FAILED: ${errs[0].slice(0, 70)}` : `COMPLETED (before:${balBefore}, after:${balAfter})`;
    log(errs.length > 0 ? 'FAIL' : 'PASS', results.phase5_withdraw);
    return errs.length === 0;
}

// ============================================================
// PHASE 6: DISCONNECT
// ============================================================
async function testDisconnect(client, Runtime, Page) {
    log('\n═══ PHASE 6: DISCONNECT WALLET ═══\n', '');

    await takeScreenshot(Page, '11-before-disconnect');

    // Try clicking disconnect button
    const discClicked = await clickByText(Runtime, 'Disconnect', 'Disconnect button');
    log('RESULT', `Disconnect click: ${discClicked}`);

    await sleep(2000);

    // Force clear state via localStorage (reliable method)
    await evalJs(Runtime, `
        (() => {
            const keysToRemove = ['wallet_type', 'wallet_address', 'zerog_connected', 'tron_connected'];
            keysToRemove.forEach(k => localStorage.removeItem(k));
            location.reload();
            return 'cleared-' + keysToRemove.length + '-keys';
        })()
    `, 'Clear all wallet state & reload');

    log('WAIT', 'Reloading after disconnect...');
    await sleep(4000);

    await takeScreenshot(Page, '12-after-disconnect');

    const stateAfter = await readPageState(Runtime);
    results.phase6_disconnect =
        (stateAfter.wallet_type === null && stateAfter.wallet_address === null)
            ? 'OK: Fully disconnected'
            : `PARTIAL: type=${stateAfter.wallet_type}, addr=${stateAfter.wallet_address}`;

    log(results.phase6_disconnect.startsWith('OK') ? 'PASS' : 'WARN', results.phase6_disconnect);
    return results.phase6_disconnect.startsWith('OK');
}

// ============================================================
// MAIN EXECUTION
// ============================================================
(async () => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║      0G/EVM Automated Full Test Suite (CDP + cliclick)    ║');
    console.log('║  Reference: docs/Tronlink_Deposit_AutoSign.md              ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  Phases:                                                   ║');
    console.log('║    1. Connect 0G Wallet                                     ║');
    console.log('║    2. Chain Switch to 0G Testnet (16602/0x40DA)           ║');
    console.log('║    3. Deposit 0G                                            ║');
    console.log('║    4. Authorize Server                                      ║');
    console.log('║    5. Withdraw 0G                                           ║');
    console.log('║    6. Disconnect Wallet                                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');

    // Ensure screenshot directory exists
    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    let client;
    try {
        client = await CDP({ port: CDP_PORT });
        log('INIT', 'Connected to Chrome CDP on port ' + CDP_PORT);

        const { Page, Runtime, Network, Console } = client;
        await Promise.all([Page.enable(), Runtime.enable(), Network.enable()]);

        // Capture console logs from page
        Console.messageAdded(({ message }) => {
            if (message.source === 'console-api') {
                const level = message.level;
                const text = message.text?.slice(0, 150) || '';
                if (level === 'error') log('CONSOLE_ERR', text);
                else if (level === 'warning') log('CONSOLE_WARN', text);
                else if (text.length > 0) log('CONSOLE', text);
            }
        });
        await Console.enable();

        // Navigate to frontend
        log('NAVIGATE', `Navigating to ${FRONTEND_URL}...`);
        await Page.navigate({ url: FRONTEND_URL });
        await Page.loadEventFired();
        await sleep(3000);

        // ─── Run all phases sequentially ───
        const p1Ok = await testConnect(client, Runtime, Page);
        const p2Ok = await testChainSwitch(client, Runtime, Page);
        const p3Ok = await testDeposit(client, Runtime, Page);
        const p4Ok = await testAuthorizeServer(client, Runtime, Page);
        const p5Ok = await testWithdraw(client, Runtime, Page);
        const p6Ok = await testDisconnect(client, Runtime, Page);

        // ─── Print final summary table ───
        console.log('');
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║                    FINAL TEST RESULTS                     ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        const phases = [
            ['1. Connect',    results.phase1_connect],
            ['2. Chain',      results.phase2_chain],
            ['3. Deposit',    results.phase3_deposit],
            ['4. Authorize',  results.phase4_authorize],
            ['5. Withdraw',   results.phase5_withdraw],
            ['6. Disconnect', results.phase6_disconnect]
        ];
        phases.forEach(([label, val]) => {
            const status = (val || 'N/A').includes('OK') || (val || '').includes('COMPLETED') || (val || '').includes('PASSED') ? '✅' :
                           (val || '').includes('FAIL') || (val || '').includes('SKIP') ? '❌' : '⚠️';
            console.log(`║ ${status} ${(label + ':').padEnd(13)} ${(val || 'N/A').padEnd(46)} ║`);
        });
        console.log('╠════════════════════════════════════════════════════════════╣');
        const passCount = [p1Ok, p2Ok, p3Ok, p4Ok, p5Ok, p6Ok].filter(Boolean).length;
        console.log(`║ Total: ${passCount}/6 passed                                          ║`);
        if (results.errors.length > 0) {
            console.log('╠════════════════════════════════════════════════════════════╣');
            console.log(`║ Errors (${results.errors.length}):                                   ║`);
            results.errors.forEach((e, i) => {
                console.log(`║   ${i+1}. ${(e || '').slice(0,54).padEnd(54)} ║`);
            });
        }
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log(`║ Screenshots saved: ${results.screenshots.length} files in ${SCREENSHOT_DIR}/          ║`);
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('');

        // Final screenshot
        await takeScreenshot(Page, '99-final-state');
        takeSystemScreenshot('99-final-system');

    } catch (e) {
        console.error('FATAL ERROR:', e.message);
        console.error(e.stack);
        process.exit(1);
    } finally {
        if (client) {
            await client.close().catch(() => {});
            log('CLEANUP', 'CDP client closed');
        }
    }
})();
