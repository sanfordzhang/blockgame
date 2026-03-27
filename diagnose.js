const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

async function diagnose() {
    console.log('🔌 Connecting to Chrome...');

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

    let msgId = 1;
    const send = (method, params = {}) => {
        return new Promise((resolve) => {
            const id = msgId++;
            const handler = (data) => {
                const msg = JSON.parse(data);
                if (msg.id === id) {
                    ws.off('message', handler);
                    resolve(msg);
                }
            };
            ws.on('message', handler);
            ws.send(JSON.stringify({ id, method, params }));
        });
    };

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Console.enable');
    await send('Log.enable');

    console.log('📸 Taking screenshot...');
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    if (screenshot.result && screenshot.result.data) {
        fs.writeFileSync('tournament-page.png', Buffer.from(screenshot.result.data, 'base64'));
        console.log('✅ Screenshot saved to tournament-page.png');
    }

    console.log('📋 Getting console logs...');
    const logs = await send('Runtime.evaluate', {
        expression: `console.log('=== DIAGNOSTIC START ===');
        console.log('URL:', window.location.href);
        console.log('Buttons:', document.querySelectorAll('button').length);
        console.log('Create section:', !!document.querySelector('[data-testid="create-tournament-section"]'));
        console.log('Btn-3:', !!document.querySelector('[data-testid="create-tournament-btn-3"]'));
        'done'`,
        awaitPromise: false
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('🔍 Checking page elements...');
    const check = await send('Runtime.evaluate', {
        expression: `JSON.stringify({
            url: window.location.href,
            buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim().substring(0, 20)),
            hasCreateSection: !!document.querySelector('[data-testid="create-tournament-section"]'),
            hasBtn3: !!document.querySelector('[data-testid="create-tournament-btn-3"]')
        })`,
        returnByValue: true
    });

    if (check.result && check.result.value) {
        const data = JSON.parse(check.result.value);
        console.log('📊 Page state:', JSON.stringify(data, null, 2));
    }

    ws.close();
    console.log('✅ Done');
}

diagnose().catch(err => console.error('❌ Error:', err.message));
