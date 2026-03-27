const http = require('http');
const WebSocket = require('ws');

async function testTournamentCreate() {
    console.log('🔌 Connecting to Chrome CDP...');

    // Get page info
    const pages = await new Promise((resolve, reject) => {
        http.get('http://localhost:9222/json', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });

    const page = pages.find(p => p.url.includes('localhost:3000') || p.url.includes('192.168.10.46:3000'));
    if (!page) {
        console.error('❌ No page found on localhost:3000 or 192.168.10.46:3000');
        console.log('Available pages:', pages.map(p => p.url));
        return;
    }

    console.log('✅ Found page:', page.url);

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
    await send('Page.enable');
    console.log('✅ Enabled CDP domains');

    // Listen for console messages
    ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.method === 'Console.messageAdded') {
            const consoleMsg = msg.params.message;
            console.log(`[Console ${consoleMsg.level}]`, consoleMsg.text);
        }
        if (msg.method === 'Network.requestWillBeSent') {
            const req = msg.params.request;
            if (req.url.includes('/api/tournament')) {
                console.log(`[Network] ${req.method} ${req.url}`);
            }
        }
        if (msg.method === 'Network.responseReceived') {
            const resp = msg.params.response;
            if (resp.url.includes('/api/tournament')) {
                console.log(`[Network] Response ${resp.status} ${resp.url}`);
            }
        }
    });

    // Navigate to tournament page
    console.log('📍 Navigating to /tournament page...');
    await send('Page.navigate', { url: 'http://localhost:3000/tournament' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get page content
    const doc = await send('Runtime.evaluate', {
        expression: 'document.body.innerHTML',
        returnByValue: true
    });

    console.log('📄 Page loaded');

    // Find and click the create tournament button for config 3 (双人赛)
    console.log('🔍 Looking for create tournament button (config 3)...');

    const buttonExists = await send('Runtime.evaluate', {
        expression: `
            const btn = document.querySelector('[data-testid="create-tournament-btn-3"]');
            btn ? 'found' : 'not found'
        `,
        returnByValue: true
    });

    console.log('Button status:', buttonExists.value);

    if (buttonExists.value === 'not found') {
        console.log('❌ Button not found, checking all buttons...');
        const allButtons = await send('Runtime.evaluate', {
            expression: `
                Array.from(document.querySelectorAll('button')).map(b => ({
                    text: b.textContent,
                    testId: b.getAttribute('data-testid'),
                    disabled: b.disabled
                }))
            `,
            returnByValue: true
        });
        console.log('All buttons:', JSON.stringify(allButtons.value, null, 2));
        return;
    }

    // Click the button
    console.log('🖱️  Clicking create tournament button...');
    await send('Runtime.evaluate', {
        expression: `
            const btn = document.querySelector('[data-testid="create-tournament-btn-3"]');
            console.log('Button found:', btn);
            console.log('Button disabled:', btn.disabled);
            console.log('Button onclick:', btn.onclick);
            btn.click();
            'clicked'
        `,
        returnByValue: true
    });

    console.log('✅ Button clicked, waiting for response...');

    // Wait for network activity
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if tournament was created
    const tournaments = await send('Runtime.evaluate', {
        expression: `
            fetch('http://localhost:7777/api/tournament/list')
                .then(r => r.json())
                .then(data => data.tournaments.length)
        `,
        awaitPromise: true,
        returnByValue: true
    });

    console.log('📊 Total tournaments:', tournaments.value);

    // Check for errors
    const errors = await send('Runtime.evaluate', {
        expression: `
            document.querySelector('[data-testid="error-message"]')?.textContent || 'no error'
        `,
        returnByValue: true
    });

    console.log('❌ Error message:', errors.value);

    ws.close();
    console.log('✅ Test complete');
}

testTournamentCreate().catch(err => {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
});
