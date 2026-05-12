const http = require('http');
const WebSocket = require('ws');

async function testClickButton() {
    console.log('🔌 Connecting to Chrome CDP on port 9222...');

    // Get page info
    const pages = await new Promise((resolve, reject) => {
        http.get('http://localhost:9222/json', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });

    console.log(`📋 Found ${pages.length} pages`);

    // Find tournament page
    const page = pages.find(p => p.url.includes('tournament'));
    if (!page) {
        console.error('❌ No tournament page found');
        console.log('Available pages:');
        pages.forEach(p => console.log('  -', p.url));
        return;
    }

    console.log('✅ Found tournament page:', page.url);

    // Connect to WebSocket
    const ws = new WebSocket(page.webSocketDebuggerUrl);

    await new Promise((resolve) => ws.once('open', resolve));
    console.log('✅ Connected to WebSocket');

    let messageId = 1;
    const send = (method, params = {}) => {
        return new Promise((resolve) => {
            const id = messageId++;
            const handler = (data) => {
                const msg = JSON.parse(data);
                if (msg.id === id) {
                    ws.off('message', handler);
                    resolve(msg.result);
                }
            };
            ws.on('message', handler);
            ws.send(JSON.stringify({ id, method, params }));
        });
    };

    // Enable necessary domains
    await send('Runtime.enable');
    await send('Console.enable');
    await send('Network.enable');
    console.log('✅ Enabled CDP domains');

    // Listen for console messages and network requests
    ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.method === 'Console.messageAdded') {
            const consoleMsg = msg.params.message;
            console.log(`[Browser Console ${consoleMsg.level}]`, consoleMsg.text);
        }
        if (msg.method === 'Network.requestWillBeSent') {
            const req = msg.params.request;
            if (req.url.includes('/api/tournament')) {
                console.log(`[Network Request] ${req.method} ${req.url}`);
            }
        }
        if (msg.method === 'Network.responseReceived') {
            const resp = msg.params.response;
            if (resp.url.includes('/api/tournament')) {
                console.log(`[Network Response] ${resp.status} ${resp.url}`);
            }
        }
    });

    console.log('🔍 Checking page state...');

    // Check if configs are loaded
    const configsState = await send('Runtime.evaluate', {
        expression: `
            (function() {
                const createSection = document.querySelector('[data-testid="create-tournament-section"]');
                const buttons = document.querySelectorAll('[data-testid^="create-tournament-btn-"]');
                return {
                    createSectionExists: !!createSection,
                    buttonCount: buttons.length,
                    buttons: Array.from(buttons).map(b => ({
                        testId: b.getAttribute('data-testid'),
                        text: b.textContent,
                        disabled: b.disabled
                    }))
                };
            })()
        `,
        returnByValue: true
    });

    console.log('📊 Page state:', JSON.stringify(configsState.value, null, 2));

    // Find button for config 3
    const btn3Exists = await send('Runtime.evaluate', {
        expression: `!!document.querySelector('[data-testid="create-tournament-btn-3"]')`,
        returnByValue: true
    });

    if (!btn3Exists.value) {
        console.error('❌ Button for config 3 not found!');
        ws.close();
        return;
    }

    console.log('✅ Found button for config 3');

    // Get button details
    const buttonDetails = await send('Runtime.evaluate', {
        expression: `
            (function() {
                const btn = document.querySelector('[data-testid="create-tournament-btn-3"]');
                return {
                    text: btn.textContent,
                    disabled: btn.disabled,
                    visible: btn.offsetParent !== null,
                    hasClickHandler: !!btn.onclick
                };
            })()
        `,
        returnByValue: true
    });

    console.log('🔍 Button details:', JSON.stringify(buttonDetails.value, null, 2));

    // Click the button
    console.log('🖱️  Clicking button...');
    const clickResult = await send('Runtime.evaluate', {
        expression: `
            (function() {
                const btn = document.querySelector('[data-testid="create-tournament-btn-3"]');
                console.log('[Test] About to click button');
                btn.click();
                console.log('[Test] Button clicked');
                return 'clicked';
            })()
        `,
        returnByValue: true
    });

    console.log('✅ Click executed:', clickResult.value);

    // Wait for response
    console.log('⏳ Waiting 5 seconds for response...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check for errors
    const errorCheck = await send('Runtime.evaluate', {
        expression: `
            (function() {
                const error = document.querySelector('[data-testid="error-message"]');
                return error ? error.textContent : null;
            })()
        `,
        returnByValue: true
    });

    if (errorCheck.value) {
        console.error('❌ Error message:', errorCheck.value);
    } else {
        console.log('✅ No error message displayed');
    }

    // Check tournament list
    const tournamentsCheck = await send('Runtime.evaluate', {
        expression: `
            (function() {
                const cards = document.querySelectorAll('[data-testid^="tournament-card-"]');
                return {
                    count: cards.length,
                    tournaments: Array.from(cards).slice(0, 3).map(c => ({
                        id: c.getAttribute('data-testid'),
                        text: c.textContent.substring(0, 50)
                    }))
                };
            })()
        `,
        returnByValue: true
    });

    console.log('📊 Tournaments on page:', JSON.stringify(tournamentsCheck.value, null, 2));

    ws.close();
    console.log('✅ Test complete');
}

testClickButton().catch(err => {
    console.error('❌ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
});
