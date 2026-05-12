const http = require('http');
const WebSocket = require('ws');

async function clickAndMonitor() {
    const pages = await new Promise((resolve, reject) => {
        http.get('http://localhost:9222/json', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });

    const page = pages.find(p => p.url.includes('tournament'));
    if (!page) {
        console.error('❌ No tournament page');
        return;
    }

    console.log('✅ Connected to:', page.url);

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(resolve => ws.once('open', resolve));

    let id = 1;
    const send = (method, params = {}) => {
        return new Promise((resolve) => {
            const msgId = id++;
            const handler = (data) => {
                const msg = JSON.parse(data);
                if (msg.id === msgId) {
                    ws.off('message', handler);
                    resolve(msg.result);
                }
            };
            ws.on('message', handler);
            ws.send(JSON.stringify({ id: msgId, method, params }));
        });
    };

    await send('Runtime.enable');
    await send('Network.enable');
    await send('Console.enable');

    // Monitor network
    ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.method === 'Network.requestWillBeSent') {
            const req = msg.params.request;
            if (req.url.includes('tournament')) {
                console.log(`📤 ${req.method} ${req.url}`);
            }
        }
        if (msg.method === 'Network.responseReceived') {
            const resp = msg.params.response;
            if (resp.url.includes('tournament')) {
                console.log(`📥 ${resp.status} ${resp.url}`);
            }
        }
        if (msg.method === 'Console.messageAdded') {
            const consoleMsg = msg.params.message;
            console.log(`[Console] ${consoleMsg.text}`);
        }
    });

    console.log('🖱️  Clicking button...');
    await send('Runtime.evaluate', {
        expression: `document.querySelector('[data-testid="create-tournament-btn-3"]').click()`,
        returnByValue: true
    });

    console.log('⏳ Waiting 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    ws.close();
    console.log('✅ Done');
}

clickAndMonitor().catch(err => console.error('❌ Error:', err.message));
