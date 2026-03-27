const http = require('http');
const WebSocket = require('ws');

async function checkPage() {
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

    console.log('✅ Page:', page.url);

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

    const result = await send('Runtime.evaluate', {
        expression: `JSON.stringify({
            url: window.location.href,
            hasCreateSection: !!document.querySelector('[data-testid="create-tournament-section"]'),
            buttonCount: document.querySelectorAll('button').length,
            testIds: Array.from(document.querySelectorAll('[data-testid]')).map(el => el.getAttribute('data-testid')).slice(0, 10)
        })`,
        returnByValue: true
    });

    console.log('📊 Result:', result && result.value ? JSON.parse(result.value) : result);

    ws.close();
}

checkPage().catch(err => console.error('❌ Error:', err.message));
