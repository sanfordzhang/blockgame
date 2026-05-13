/**
 * CDP Test: 0G Withdraw from Contract
 * - Navigates to Landing page
 * - Connects 0G wallet
 * - Verifies balances
 * - Clicks Withdraw button
 * - Screenshots before/after for verification
 */
const CDP = require('chrome-remote-interface');

const BASE_URL = 'http://127.0.0.1:3001';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

async function main() {
    let client;
    try {
        // Connect to the specific tab showing our app
        const http = require('http');
        const tabs = await new Promise((resolve, reject) => {
            http.get('http://127.0.0.1:9222/json/list', (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => resolve(JSON.parse(data)));
            }).on('error', reject);
        });

        const targetTab = tabs.find(t => t.url.includes('127.0.0.1:3001'));
        if (!targetTab) {
            log('No 3001 tab found, using first available');
            client = await CDP({ port: 9222 });
        } else {
            log(`Connecting to tab: ${targetTab.url}`);
            client = await CDP({ port: 9222, target: targetTab });
        }
        const { Page, Runtime, Network } = client;

        await Network.enable();
        await Page.enable();

        // Step 1: Navigate to Landing page
        log('Navigating to Landing page...');
        await Page.navigate({ url: BASE_URL + '/' });
        await sleep(3000);

        // Step 2: Screenshot current state
        const screenshot = await Page.captureScreenshot({ format: 'png' });
        require('fs').writeFileSync('logs/cdp-withdraw-before.png', Buffer.from(screenshot.data, 'base64'));
        log('Screenshot saved: logs/cdp-withdraw-before.png');

        // Step 3: Check if 0G wallet is already connected, if not connect it
        const walletState = await Runtime.evaluate({
            expression: `
                (() => {
                    const type = localStorage.getItem('wallet_type');
                    const addr = localStorage.getItem('wallet_address');
                    return { type, addr, hasEthereum: !!window.ethereum };
                })()
            `,
            returnByValue: true
        });
        log(`Wallet state: ${JSON.stringify(walletState.result.value)}`);

        // Step 4: If not connected as 0G, try connecting
        if (walletState.result.value.type !== 'zerog') {
            log('Not connected as 0G, clicking 0G/EVM button...');

            // Click the 0G / EVM button
            await Runtime.evaluate({
                expression: `
                    (() => {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const btn = buttons.find(b => b.textContent.includes('0G') || b.textContent.includes('EVM'));
                        if (btn) { btn.click(); return 'clicked'; }
                        return 'not found';
                    })()
                `,
                returnByValue: true
            });

            await sleep(5000); // Wait for wallet connection

            // Re-check state
            const afterConnect = await Runtime.evaluate({
                expression: `
                    (() => {
                        const type = localStorage.getItem('wallet_type');
                        const addr = localStorage.getItem('wallet_address');
                        return { type, addr };
                    })()
                `,
                returnByValue: true
            });
            log(`After connect attempt: ${JSON.stringify(afterConnect.result.value)}`);
        }

        // Step 5: Take another screenshot after connection
        const ss2 = await Page.captureScreenshot({ format: 'png' });
        require('fs').writeFileSync('logs/cdp-withdraw-connected.png', Buffer.from(ss2.data, 'base64'));
        log('Screenshot saved: logs/cdp-withdraw-connected.png');

        // Step 6: Check current balance info on page
        const balanceInfo = await Runtime.evaluate({
            expression: `
                (() => {
                    // Look for balance text elements
                    const spans = Array.from(document.querySelectorAll('span'));
                    const balanceTexts = [];
                    for (const span of spans) {
                        const text = span.textContent.trim();
                        if (text.includes('0G') || text.includes('TRX') || text.includes('Balance') ||
                            text.includes('Bankroll') || text.includes('Game Balance') || text.includes('Wallet')) {
                            balanceTexts.push(text);
                        }
                    }

                    // Look for Withdraw button
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const withdrawBtn = buttons.find(b =>
                        b.textContent.includes('Withdraw') && !b.textContent.includes('all')
                    );

                    return {
                        balanceTexts,
                        hasWithdrawButton: !!withdrawBtn,
                        withdrawButtonText: withdrawBtn ? withdrawBtn.textContent.trim() : null,
                        withdrawDisabled: withdrawBtn ? withdrawBtn.disabled : null
                    };
                })()
            `,
            returnByValue: true
        });
        log(`Balance info: ${JSON.stringify(balanceInfo.result.value, null, 2)}`);

        // Step 7: Try to find and click Withdraw button
        if (balanceInfo.result.value.hasWithdrawButton && !balanceInfo.result.value.withdrawDisabled) {
            log('Clicking Withdraw button...');

            await Runtime.evaluate({
                expression: `
                    (() => {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const btn = buttons.find(b =>
                            b.textContent.includes('Withdraw') && !b.textContent.includes('all') && !b.disabled
                        );
                        if (btn) { btn.click(); return 'clicked withdraw'; }
                        return 'withdraw button not found or disabled';
                    })()
                `,
                returnByValue: true
            });

            // Wait for transaction to process (MetaMask popup)
            log('Waiting for withdrawal transaction...');
            await sleep(8000);

            // Screenshot after withdraw click
            const ss3 = await Page.captureScreenshot({ format: 'png' });
            require('fs').writeFileSync('logs/cdp-withdraw-after-click.png', Buffer.from(ss3.data, 'base64'));
            log('Screenshot saved: logs/cdp-withdraw-after-click.png');

            // Check for any errors on page
            const errorCheck = await Runtime.evaluate({
                expression: `
                    (() => {
                        const errEl = document.querySelector('p[class*="error"], p[style*="color"]');
                        const errors = [];
                        if (errEl) errors.push(errEl.textContent.trim());

                        // Also check console-like elements
                        const allP = Array.from(document.querySelectorAll('p'));
                        for (const p of allP) {
                            if (p.style.color === 'rgb(233, 69, 96)' ||
                                p.textContent.includes('error') ||
                                p.textContent.includes('Error') ||
                                p.textContent.includes('failed')) {
                                errors.push(p.textContent.trim());
                            }
                        }
                        return { errors };
                    })()
                `,
                returnByValue: true
            });
            log(`Error check after withdraw: ${JSON.stringify(errorCheck.result.value)}`);

        } else if (balanceInfo.result.value.withdrawDisabled) {
            log('Withdraw button is disabled (no balance or locked balance)');
        } else {
            log('No withdraw button found - user may need to deposit first or register');
        }

        // Step 8: Final screenshot
        const finalSS = await Page.captureScreenshot({ format: 'png' });
        require('fs').writeFileSync('logs/cdp-withdraw-final.png', Buffer.from(finalSS.data, 'base64'));
        log('Final screenshot saved: logs/cdp-withdraw-final.png');

        log('=== WITHDRAW TEST COMPLETE ===');

    } catch (err) {
        console.error('CDP test error:', err.message);
    } finally {
        if (client) await client.close();
    }
}

main().catch(console.error);
