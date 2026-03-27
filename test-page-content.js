const http = require('http');
const WebSocket = require('ws');

async function checkPageContent() {
    console.log('🔌 Connecting to Chrome CDP...');

    const pages = await new Promise((resolve, reject) => {
        http.get('http://localhost:9222/json', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });

    const page = pages.find(p => p.url.includes('tournament'));
    if (!page) {
        console.error('❌ No tournament page found');
        return;
    }

    console.log('✅ Found page:', page.url);

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.once('open', resolve));

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

    await send('Runtime.enable');

    // Get page HTML
    const html = await send('Runtime.evaluate', {
        expression: 'document.body.innerHTML',
        returnByValue: true
    });

    console.log('📄 Page HTML length:', html.value.length);
    console.log('📄 First 500 chars:', html.value.substring(0, 500));

    // Check for specific elements
    const elements = await send('Runtime.evaluate', {
        expression: `
            ({
                hasCreateSection: !!document.querySelector('[data-testid="create-tournament-section"]'),
                allTestIds: Array.from(document.querySelectorAll('[data-testid]')).map(el => el.getAttribute('data-testid')),
                allButtons: Array.from(document.querySelectorAll('button')).map(b => ({
                    text: b.textContent.trim().substring(0, 30),
                    className: b.className,
                    id: b.id
                })),
                pageTitle: document.title,
                url: window.location.href
            })
        `,
        returnByValue: true
    });

    console.log('📊 Page elements:', JSON.stringify(elements.value, null, 2));

    ws.close();
}

checkPageContent().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
