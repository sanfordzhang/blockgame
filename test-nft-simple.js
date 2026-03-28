/**
 * Simple test to debug page state
 */

const CDP = require('chrome-remote-interface');
const axios = require('axios');

const API_BASE = 'http://127.0.0.1:7778';
const FRONTEND_URL = 'http://127.0.0.1:3001';

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('Connecting to Chrome...');
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;

    await Page.enable();
    await Runtime.enable();

    // Navigate and wait
    console.log('Navigating to tournament page...');
    await Page.navigate({ url: `${FRONTEND_URL}/tournament` });
    await delay(5000);

    // Get full page content
    console.log('\n=== Page Content ===');
    const pageContent = await Runtime.evaluate({ 
        expression: `document.documentElement.outerHTML.substring(0, 5000)` 
    });
    console.log(pageContent.result.value);

    // Get page text
    console.log('\n=== Page Text ===');
    const pageText = await Runtime.evaluate({ 
        expression: `document.body.innerText.substring(0, 2000)` 
    });
    console.log(pageText.result.value);

    // Check mock checkbox status
    console.log('\n=== Mock Checkbox ===');
    const mockInfo = await Runtime.evaluate({
        expression: `
            (function() {
                const section = document.querySelector('[data-testid="mock-game-section"]');
                const checkbox = document.querySelector('[data-testid="mock-game-checkbox"]');
                return {
                    sectionExists: !!section,
                    checkboxExists: !!checkbox,
                    checkboxChecked: checkbox ? checkbox.checked : null,
                    localStorage: localStorage.getItem('mockGame')
                };
            })()
        `
    });
    console.log('Mock Info:', JSON.stringify(mockInfo.result.value, null, 2));

    // Set localStorage
    console.log('\n=== Setting localStorage ===');
    await Runtime.evaluate({
        expression: `localStorage.setItem('mockGame', 'true'); 'Set to: ' + localStorage.getItem('mockGame')`
    });

    // Get buttons
    console.log('\n=== Buttons ===');
    const buttons = await Runtime.evaluate({
        expression: `
            Array.from(document.querySelectorAll('button')).map(b => ({
                text: b.textContent.substring(0, 50),
                visible: b.offsetParent !== null,
                disabled: b.disabled
            }))
        `
    });
    console.log('Buttons:', JSON.stringify(buttons.result.value, null, 2));

    // Try to create tournament via API directly
    console.log('\n=== Creating Tournament via API ===');
    const createRes = await axios.post(`${API_BASE}/api/tournament/create`, {
        configId: 3,
        walletAddress: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
        mockGame: true
    });
    console.log('API Response:', JSON.stringify(createRes.data, null, 2));

    const tournamentId = createRes.data.tournament?.tournamentId;
    console.log(`\nTournament ID: ${tournamentId}`);
    console.log(`Mock Mode: ${createRes.data.tournament?.mockGame}`);

    // Reload page
    console.log('\n=== Reloading page ===');
    await Page.reload();
    await delay(3000);

    // Check if new tournament appears
    const newText = await Runtime.evaluate({
        expression: `document.body.innerText.substring(0, 2000)`
    });
    console.log('After reload:', newText.result.value?.substring(0, 500));

    await client.close();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
