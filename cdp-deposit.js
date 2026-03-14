const http = require('http');
const WebSocket = require('ws');

async function triggerDeposit() {
    console.log('🔌 Connecting to Chrome CDP...');

    // Get page info
    const pages = await new Promise((resolve, reject) => {
        http.get('http://localhost:9222/json', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });

    const appPage = pages.find(p => p.url.includes('192.168.10.46:3000'));
    if (!appPage) {
        console.log('❌ App page not found');
        return;
    }

    console.log('✅ Found page:', appPage.url);

    const ws = new WebSocket(appPage.webSocketDebuggerUrl);

    ws.on('open', async () => {
        console.log('💰 Filling deposit amount...');

        // Fill input
        ws.send(JSON.stringify({
            id: 1,
            method: 'Runtime.evaluate',
            params: {
                expression: `
                    const input = document.querySelector('input[type="number"]');
                    if (input) { input.value = '100'; 'OK' } else { 'NOT_FOUND' }
                `
            }
        }));

        setTimeout(() => {
            console.log('🖱️  Clicking Deposit button...');
            ws.send(JSON.stringify({
                id: 2,
                method: 'Runtime.evaluate',
                params: {
                    expression: `
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const btn = buttons.find(b => b.textContent.includes('Deposit'));
                        if (btn) { btn.click(); 'CLICKED' } else { 'NOT_FOUND' }
                    `
                }
            }));

            setTimeout(() => {
                console.log('✅ Deposit triggered!');
                console.log('⏳ Confirm in TronLink wallet');
                ws.close();
            }, 1000);
        }, 1000);
    });
}

triggerDeposit();
