const http = require('http');
const WebSocket = require('ws');

async function checkTournaments() {
    const pages = await new Promise((resolve, reject) => {
        http.get('http://localhost:9222/json', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });

    const page = pages.find(p => p.url.includes('tournament'));
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
            tournamentCards: document.querySelectorAll('[data-testid^="tournament-card-"]').length,
            emptyState: !!document.querySelector('[data-testid="empty-state"]'),
            emptyStateVisible: document.querySelector('[data-testid="empty-state"]')?.style.display !== 'none'
        })`,
        returnByValue: true
    });

    console.log('📊 页面状态:', JSON.parse(result.value));
    ws.close();
}

checkTournaments().catch(err => console.error('❌ Error:', err.message));
