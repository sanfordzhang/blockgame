const http = require('http');
const WebSocket = require('ws');

async function testAuthorize() {
    console.log('🔌 Connecting to Chrome CDP...');

    // Get page info
    const pages = await new Promise((resolve, reject) => {
        http.get('http://localhost:9222/json', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
            res.on('error', reject);
        });
    });

    const page = pages.find(p => p.url.includes('192.168.10.46:3000') || p.url.includes('localhost:3000'));
    if (!page) {
        console.error('❌ Page not found. Make sure Chrome is running with debugging enabled.');
        process.exit(1);
    }

    console.log(`✅ Found page: ${page.url}`);

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let msgId = 1;

    const send = (method, params = {}) => {
        return new Promise((resolve) => {
            const id = msgId++;
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

    await new Promise(resolve => ws.once('open', resolve));

    // Enable console and runtime
    await send('Runtime.enable');
    await send('Console.enable');

    // Listen for console logs
    ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.method === 'Console.messageAdded') {
            const { level, text } = msg.params.message;
            console.log(`[Browser ${level}] ${text}`);
        }
        if (msg.method === 'Runtime.consoleAPICalled') {
            const args = msg.params.args.map(arg => arg.value || arg.description).join(' ');
            console.log(`[Browser] ${args}`);
        }
    });

    console.log('🔍 Checking for authorize button...');

    // Check if button exists
    const checkButton = await send('Runtime.evaluate', {
        expression: `
            const btn = document.querySelector('button');
            const allButtons = Array.from(document.querySelectorAll('button'));
            const authorizeBtn = allButtons.find(b => b.textContent.includes('授权') || b.textContent.includes('Authorize'));
            if (authorizeBtn) {
                console.log('[Test] Found authorize button:', authorizeBtn.textContent);
                authorizeBtn;
            } else {
                console.log('[Test] Available buttons:', allButtons.map(b => b.textContent));
                null;
            }
        `,
        returnByValue: false
    });

    if (!checkButton.result || checkButton.result.type === 'undefined') {
        console.log('⚠️  Authorize button not found. Checking page state...');

        // Check wallet connection status
        await send('Runtime.evaluate', {
            expression: `console.log('[Test] Wallet address:', window.tronWeb?.defaultAddress?.base58)`
        });

        await new Promise(resolve => setTimeout(resolve, 2000));
        ws.close();
        return;
    }

    console.log('🖱️  Clicking authorize button...');

    // Click the button
    await send('Runtime.evaluate', {
        expression: `
            const allButtons = Array.from(document.querySelectorAll('button'));
            const authorizeBtn = allButtons.find(b => b.textContent.includes('授权') || b.textContent.includes('Authorize'));
            if (authorizeBtn) {
                console.log('[Test] Clicking button:', authorizeBtn.textContent);
                authorizeBtn.click();
                true;
            } else {
                console.log('[Test] Button not found');
                false;
            }
        `
    });

    console.log('⏳ Waiting for authorization result (10 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check authorization status
    await send('Runtime.evaluate', {
        expression: `
            console.log('[Test] Checking authorization status...');
            fetch('http://localhost:7777/api/check-delegate')
                .then(r => r.json())
                .then(data => console.log('[Test] Delegate status:', data))
                .catch(e => console.log('[Test] Error checking delegate:', e.message));
        `
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('✅ Test complete');
    ws.close();
}

testAuthorize().catch(console.error);
