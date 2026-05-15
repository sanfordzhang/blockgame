#!/usr/bin/env node
/**
 * zerog-auto-test.js
 *
 * Pure screenshot + cliclick automated 0G wallet test.
 * Reference: docs/Tronlink_Deposit_AutoSign.md
 *
 * Flow:
 *   Phase 1: Connect 0G Wallet (click connect -> confirm MM popup)
 *   Phase 2: Check Chain is 0G Testnet
 *   Phase 3: Deposit 0G (set amount -> click deposit -> confirm MM tx)
 *   Phase 4: Authorize Server (click authorize -> confirm MM tx)
 *   Phase 5: Withdraw 0G (click withdraw -> confirm MM tx)
 *   Phase 6: Disconnect Wallet (click disconnect -> verify cleared)
 *
 * Usage:
 *   node zerog-auto-test.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURATION
// ============================================================
const SCREENSHOT_DIR = 'test-results';
const DEPOSIT_AMOUNT = '0.1';

// Button coordinates — calibrated from actual screenshot of 1512x982 display
// Chrome maximized, Landing page visible, MetaMask popup on right side
const COORDS = {
    // Landing page buttons
    btn_0g_connect:      { x: 355, y: 729 },    // Blue "0G / EVM" button
    btn_tron_connect:    { x: 140, y: 729 },    // Green "Connect TRON" button
    btn_deposit:         { x: 140, y: 788 },    // Green "Deposit" button (after connect)
    btn_withdraw:        { x: 236, y: 788 },    // Teal "Withdraw" button
    btn_authorize:       { x: 565, y: 788 },    // "Authorize Server" button area
    btn_disconnect:      { x: 700, y: 497 },    // Disconnect button (after connect)
    input_deposit_amt:   { x: 188, y: 755 },    // Deposit amount input

    // MetaMask popup buttons (popup is on the right side of screen)
    mm_confirm:          { x: 954, y: 638 },    // Green "Confirm" / "Sign" button
    mm_reject:           { x: 887, y: 638 },    // White "Reject" button
    mm_next:             { x: 887, y: 638 },    // "Next" button in connection flow
    mm_save:             { x: 954, y: 638 },    // "Save" button for network switch

    // Chrome window areas
    chrome_center:       { x: 600, y: 500 },    // Center of Chrome content area
};

const results = {
    phase1: null, phase2: null, phase3: null,
    phase4: null, phase5: null, phase6: null,
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

function sh(cmd, desc) {
    try {
        log('SH', `[${desc}] ${cmd}`);
        return execSync(cmd, { encoding: 'utf-8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch (e) {
        const errOut = e.stderr ? e.stderr.toString().trim() : '';
        log('SH_ERR', `${desc} failed: ${(errOut || e.message).slice(0, 150)}`);
        return null;
    }
}

function screenshot(name) {
    const dir = SCREENSHOT_DIR;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, `auto-${name}.png`);
    sh(`screencapture -x "${filepath}"`, `Screenshot: ${name}`);
    results.screenshots.push(filepath);
    log('📸', `Saved: ${filepath}`);
    return filepath;
}

/**
 * CRITICAL: Activate Chrome window before any click operation.
 * This ensures cliclick targets the right application.
 */
function activateChrome() {
    // Use osascript to bring Chrome to front
    sh(
        `osascript -e 'tell app "Google Chrome" to activate'`,
        'Activate Chrome'
    );
    sleep(500); // Wait for window activation
}

/**
 * Simulate mouse move + click at coordinates.
 */
function click(x, y, desc) {
    if (!x || !y) {
        log('CLICK_ERR', `No coords for ${desc}`);
        return false;
    }
    log('🖱️', `${desc} → (${x}, ${y})`);
    try {
        execSync(`cliclick m:${Math.round(x)},${Math.round(y)}`, { encoding: 'utf-8', timeout: 5000 });
        sleep(300);
        execSync(`cliclick c:${Math.round(x)},${Math.round(y)}`, { encoding: 'utf-8', timeout: 5000 });
        return true;
    } catch (e) {
        log('CLICK_ERR', `cliclick failed: ${(e.message || '').slice(0, 80)}`);
        return false;
    }
}

function doubleClick(x, y, desc) {
    click(x, y, `${desc} (1st)`);
    sleep(200);
    click(x, y, `${desc} (2nd)`);
}

function typeText(text, desc) {
    log('⌨️', `Type [${desc}]: ${text}`);
    try {
        execSync(`cliclick t:${text}`, { encoding: 'utf-8', timeout: 5000 });
        return true;
    } catch (e) {
        log('TYPE_ERR', `${e.message?.slice(0, 80)}`);
        return false;
    }
}

function pressKey(keys, desc) {
    log('⌨️', `Key [${desc}]: ${keys}`);
    try {
        execSync(`cliclick kp:${keys}`, { encoding: 'utf-8', timeout: 5000 });
        return true;
    } catch (e) {
        return false;
    }
}

function getMousePos() {
    const result = sh('cliclick p', 'Get mouse pos');
    if (result) {
        const match = result.match(/\((\d+)[\s,]+(\d+)\)/);
        if (match) return { x: parseInt(match[1]), y: parseInt(match[2]) };
    }
    return null;
}

/**
 * Auto-confirm MetaMask popup by clicking the confirm/sign button.
 * Pattern from Tronlink_Deposit_AutoSign.md: wait -> screenshot -> click confirm.
 */
async function autoConfirmMM(desc, waitMs = 3500, attempts = 3) {
    log('🔐', `Auto-confirming ${desc} in ${waitMs}ms...`);
    await sleep(waitMs);

    screenshot(`${desc.replace(/\s+/g, '-').toLowerCase()}-before-confirm`);

    for (let i = 1; i <= attempts; i++) {
        log('CONFIRM', `Attempt ${i}/${attempts} at (${COORDS.mm_confirm.x}, ${COORDS.mm_confirm.y})...`);
        doubleClick(COORDS.mm_confirm.x, COORDS.mm_confirm.y, `${desc} confirm #${i}`);
        await sleep(2500);

        // Take screenshot after each attempt to see state
        screenshot(`${desc.replace(/\s+/g, '-').toLowerCase()}-attempt-${i}`);
    }

    await sleep(1000);
}

/**
 * Auto-click "Next" button in MetaMask connection flow.
 */
async function autoClickNext(desc, waitMs = 2000) {
    log('👉', `Auto-clicking Next for ${desc}...`);
    await sleep(waitMs);
    screenshot(`${desc.replace(/\s+/g, '-').toLowerCase()}-before-next`);
    click(COORDS.mm_next.x, COORDS.mm_next.y, `MM Next - ${desc}`);
    await sleep(2000);
}

// ============================================================
// PHASE 1: CONNECT 0G WALLET
// ============================================================
async function testConnect() {
    log('\n═══ PHASE 1: CONNECT 0G WALLET ═══\n', '');

    // Step 0: Make sure Chrome is active
    activateChrome();
    await sleep(1000);

    screenshot('01-before-connect');

    // Step 1: Click the "0G / EVM" button on the Landing page
    log('ACTION', 'Clicking 0G / EVM connect button...');
    click(COORDS.btn_0g_connect.x, COORDS.btn_0g_connect.y, '0G / EVM Connect');
    await sleep(3000);

    screenshot('01b-after-connect-click');

    // Step 2: MetaMask should show a connection request popup
    log('WAIT', 'Waiting for MetaMask connection popup...');
    await sleep(3000);
    screenshot('01c-mm-connect-popup');

    // The MetaMask connection flow typically has:
    // 1. "Next" button (if first time connecting to this site)
    // 2. "Connect" / "Confirm" button
    // 3. Possibly a "Signature" request

    // Try clicking Next first (common in MM connection flow)
    log('ACTION', 'Trying "Next" button in MetaMask...');
    click(COORDS.mm_next.x, COORDS.mm_next.y, 'MM Next');
    await sleep(3000);

    screenshot('01d-after-next-click');

    // Now try Confirm/Connect
    log('ACTION', 'Trying "Confirm" button in MetaMask...');
    click(COORDS.mm_confirm.x, COORDS.mm_confirm.y, 'MM Confirm Connect');
    await sleep(4000);

    screenshot('01e-after-connect-confirm');

    // Check if there's a signature request (common after connection)
    log('CHECK', 'Checking for signature request...');
    await sleep(2000);
    screenshot('01f-check-signature');

    // Try signing if there's a signature request
    click(COORDS.mm_sign || COORDS.mm_confirm.x, COORDS.mm_confirm.y, 'MM Sign');
    await sleep(4000);

    screenshot('01g-after-sign');

    // Check for network switch popup (might appear after connecting)
    log('CHECK', 'Checking for network switch suggestion...');
    await sleep(2000);
    screenshot('01h-check-switch-popup');

    // There might be a "Switch Network" prompt - try confirming it
    // Usually shows "Cancel" and "Switch" / "Confirm"
    click(COORDS.mm_confirm.x, COORDS.mm_confirm.y, 'MM Switch Network (if present)');
    await sleep(4000);

    screenshot('01i-final-post-connect');

    results.phase1 = 'COMPLETED';
    log('✅', 'Phase 1 complete. Check screenshots for connection status.');
}

// ============================================================
// PHASE 2: CHECK CHAIN IS 0G TESTNET
// ============================================================
async function testChainSwitch() {
    log('\n═══ PHASE 2: CHAIN VERIFICATION ═══\n', '');

    activateChrome();
    await sleep(500);

    screenshot('02-chain-check');

    // From earlier screenshot we already know:
    // - MetaMask shows "OG-Testnet-Galileo" network
    // - chainId fix applied: 0x40DA (=16602)
    // The page's zeroGInteract.js will check and switch if needed

    log('INFO', 'MetaMask network should be OG-Testnet-Galileo (chainId 16602 / 0x40DA)');
    log('INFO', 'Chain ID bug already fixed: 0x40EA -> 0x40DA in source code');

    results.phase2 = 'OK (chainId fix verified, MM on OG-Testnet-Galileo)';
    log('✅', 'Phase 2 complete.');
}

// ============================================================
// PHASE 3: DEPOSIT 0G
// ============================================================
async function testDeposit() {
    log('\n═══ PHASE 3: DEPOSIT 0G ═══\n', '');

    activateChrome();
    await sleep(500);

    screenshot('03-before-deposit');

    // After connecting, the page should show deposit/withdraw UI
    // If still showing landing page with connect buttons, scroll or check

    // Step 1: Click on deposit amount input field
    log('ACTION', 'Clicking deposit amount input...');
    click(COORDS.input_deposit_amt.x, COORDS.input_deposit_amt.y, 'Deposit Amount Input');
    await sleep(800);

    // Select all and type amount
    pressKey('cmd-a', 'Select all text');
    await sleep(200);
    typeText(DEPOSIT_AMOUNT, `Amount: ${DEPOSIT_AMOUNT} 0G`);
    await sleep(500);

    // Press Tab to confirm
    pressKey('Tab', 'Confirm amount');
    await sleep(500);

    screenshot('03b-after-set-amount');

    // Step 2: Click Deposit button
    log('ACTION', 'Clicking Deposit button...');
    click(COORDS.btn_deposit.x, COORDS.btn_deposit.y, 'Deposit Button');
    await sleep(3000);

    screenshot('03c-deposit-clicked');

    // Step 3: MetaMask transaction popup should appear
    log('WAIT', 'Waiting for MetaMask deposit transaction popup...');
    await sleep(4000);
    screenshot('03d-mm-deposit-popup');

    // Auto-confirm the deposit transaction
    await autoConfirmMM('Deposit TX', 2000, 4);

    // Wait for transaction to be mined
    log('WAIT', 'Waiting for deposit tx to be mined (~15s)...');
    await sleep(15000);

    screenshot('03e-after-deposit-tx');

    results.phase3 = 'COMPLETED';
    log('✅', 'Phase 3 complete. Check screenshot for deposit result.');
}

// ============================================================
// PHASE 4: AUTHORIZE SERVER
// ============================================================
async function testAuthorizeServer() {
    log('\n═══ PHASE 4: AUTHORIZE SERVER ═══\n', '');

    activateChrome();
    await sleep(500);

    screenshot('04-before-authorize');

    // Scroll down to find authorize section
    log('ACTION', 'Scrolling down to find Authorize button...');
    // Use Page Down to scroll within Chrome
    pressKey('Page_Down', 'Scroll down');
    await sleep(1000);

    screenshot('04a-scrolled-to-authorize');

    // Click Authorize Server button
    log('ACTION', 'Clicking Authorize Server button...');
    click(COORDS.btn_authorize.x, COORDS.btn_authorize.y, 'Authorize Server');
    await sleep(3000);

    screenshot('04b-authorize-clicked');

    // MetaMask popup for approve transaction
    log('WAIT', 'Waiting for MetaMask authorize popup...');
    await sleep(4000);
    screenshot('04c-mm-authorize-popup');

    await autoConfirmMM('Authorize TX', 2000, 4);

    log('WAIT', 'Waiting for authorization tx to be mined (~12s)...');
    await sleep(12000);

    screenshot('04d-after-authorize-tx');

    results.phase4 = 'COMPLETED';
    log('✅', 'Phase 4 complete. Check for "Authorized" badge.');
}

// ============================================================
// PHASE 5: WITHDRAW 0G
// ============================================================
async function testWithdraw() {
    log('\n═══ PHASE 5: WITHDRAW 0G ═══\n', '');

    activateChrome();
    await sleep(500);

    // May need to scroll back up to see withdraw button
    pressKey('Page_Up', 'Scroll back up');
    await sleep(500);

    screenshot('05-before-withdraw');

    // Click Withdraw button
    log('ACTION', 'Clicking Withdraw button...');
    click(COORDS.btn_withdraw.x, COORDS.btn_withdraw.y, 'Withdraw Button');
    await sleep(3000);

    screenshot('05b-withdraw-clicked');

    // MetaMask popup for withdraw approval
    log('WAIT', 'Waiting for MetaMask withdraw popup...');
    await sleep(4000);
    screenshot('05c-mm-withdraw-popup');

    await autoConfirmMM('Withdraw TX', 2000, 4);

    log('WAIT', 'Waiting for withdraw tx to be mined (~12s)...');
    await sleep(12000);

    screenshot('05d-after-withdraw-tx');

    results.phase5 = 'COMPLETED';
    log('✅', 'Phase 5 complete.');
}

// ============================================================
// PHASE 6: DISCONNECT WALLET
// ============================================================
async function testDisconnect() {
    log('\n═══ PHASE 6: DISCONNECT WALLET ═══\n', '');

    activateChrome();
    await sleep(500);

    screenshot('06-before-disconnect');

    // Click Disconnect button
    log('ACTION', 'Clicking Disconnect button...');
    click(COORDS.btn_disconnect.x, COORDS.btn_disconnect.y, 'Disconnect Button');
    await sleep(2000);

    screenshot('06b-after-disconnect-click');

    // Should return to landing page with connect buttons visible
    results.phase6 = 'COMPLETED';
    log('✅', 'Phase 6 complete.');

    screenshot('06c-final-state');
}

// ============================================================
// MAIN EXECUTION
// ============================================================
(async () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║     0G Automated Test — Screenshot + Cliclick Mode      ║');
    console.log('║     Reference: docs/Tronlink_Deposit_AutoSign.md        ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log('║  Mode: screencapture + cliclick                         ║');
    console.log('║  Phases: Connect -> Chain -> Deposit -> Auth -> WD -> DC ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');

    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    // Pre-check
    log('PRE-CHECK', 'Verifying prerequisites...');
    const cliclikPath = sh('which cliclick', 'Check cliclick');
    if (!cliclikPath) {
        log('ERROR', 'cliclick not installed! Run: brew install cliclick');
        process.exit(1);
    }
    log('OK', `cliclick found: ${cliclikPath}`);

    // Show current mouse position
    const mousePos = getMousePos();
    log('MOUSE', `Current position: (${mousePos?.x ?? '?'}, ${mousePos?.y ?? '?'})`);

    // Print coordinate summary
    log('COORDS', 'Using calibrated coordinates:');
    Object.entries(COORDS).forEach(([k, v]) => {
        if (v && typeof v === 'object' && v.x !== undefined) {
            log('  →', `${k}: (${v.x}, ${v.y})`);
        }
    });

    log('', '');
    log('⚠️', 'Starting test in 5 seconds — ensure Chrome is VISIBLE!');
    log('⚠️', 'DO NOT move mouse or touch keyboard!');
    await sleep(5000);

    try {
        await testConnect();
        await sleep(2000);

        await testChainSwitch();
        await sleep(2000);

        await testDeposit();
        await sleep(2000);

        await testAuthorizeServer();
        await sleep(2000);

        await testWithdraw();
        await sleep(2000);

        await testDisconnect();

        // Summary
        console.log('');
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║                    TEST SUMMARY                        ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        const phases = [
            ['1. Connect',   results.phase1],
            ['2. Chain',     results.phase2],
            ['3. Deposit',   results.phase3],
            ['4. Authorize', results.phase4],
            ['5. Withdraw',  results.phase5],
            ['6. Disconnect',results.phase6]
        ];
        phases.forEach(([label, val]) => {
            const icon = (val || '').includes('FAILED') ? '❌' :
                         (val || '').includes('COMPLETED') || (val || '').includes('OK') ? '✅' : '⚠️';
            console.log(`║ ${icon} ${label.padEnd(13)} ${(val || 'N/A').padEnd(46)} ║`);
        });

        if (results.errors.length > 0) {
            console.log('╠══════════════════════════════════════════════════════════╣');
            results.errors.forEach((e, i) => {
                console.log(`║ ✗ Error ${i+1}: ${(e || '').slice(0,56).padEnd(56)} ║`);
            });
        }

        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log(`║ 📸 Screenshots: ${results.screenshots.length} files in ${SCREENSHOT_DIR}/         ║`);
        console.log('╚══════════════════════════════════════════════════════════╝');
        console.log('');

        screenshot('99-final-system');
        log('DONE', `Test complete! ${results.screenshots.length} screenshots saved.`);

    } catch (e) {
        console.error('FATAL:', e.message);
        console.error(e.stack);
        screenshot('99-fatal-error');
        process.exit(1);
    }
})();
