const http = require('http');
const WebSocket = require('ws');

async function testAuthorizeDetailed() {
    console.log('🔌 Connecting to Chrome CDP...');

    const pages = await new Promise((resolve, reject) => {
        http.get('http://localhost:9222/json', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
            res.on('error', reject);
        });
    });

    const page = pages.find(p => p.url.includes('3000'));
    if (!page) {
        console.error('❌ Page not found');
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

    await send('Runtime.enable');
    await send('Console.enable');
    await send('Network.enable');

    // Capture all console logs
    ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.method === 'Runtime.consoleAPICalled') {
            const args = msg.params.args.map(arg => {
                if (arg.value !== undefined) return arg.value;
                if (arg.description) return arg.description;
                return JSON.stringify(arg);
            }).join(' ');
            console.log(`[Console] ${args}`);
        }
        if (msg.method === 'Runtime.exceptionThrown') {
            console.error(`[Error] ${msg.params.exceptionDetails.text}`);
        }
    });

    console.log('🖱️  Clicking authorize button...');

    await send('Runtime.evaluate', {
        expression: `
            (function() {
                const allButtons = Array.from(document.querySelectorAll('button'));
                const authorizeBtn = allButtons.find(b => b.textContent.includes('授权'));
                if (authorizeBtn) {
                    console.log('[CDP] Clicking authorize button');
                    authorizeBtn.click();
                    return 'clicked';
                }
                return 'not found';
            })()
        `,
        awaitPromise: false
    });

    console.log('⏳ Monitoring logs for 15 seconds...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    console.log('✅ Test complete');
    ws.close();
}

testAuthorizeDetailed().catch(console.error);
