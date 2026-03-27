const http = require('http');
const WebSocket = require('ws');

async function debugPage() {
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
        return new Promise((resolve, reject) => {
            const id = messageId++;
            const timeout = setTimeout(() => {
                reject(new Error('Timeout'));
            }, 5000);

            const handler = (data) => {
                const msg = JSON.parse(data);
                if (msg.id === id) {
                    clearTimeout(timeout);
                    ws.off('message', handler);
                    resolve(msg.result || msg);
                }
            };
            ws.on('message', handler);
            ws.send(JSON.stringify({ id, method, params }));
        });
    };

    await send('Runtime.enable');
    console.log('✅ Runtime enabled');

    // Simple check
    try {
        const result = await send('Runtime.evaluate', {
            expression: `({
                url: window.location.href,
                title: document.title,
                hasBody: !!document.body,
                bodyText: document.body ? document.body.textContent.substring(0, 200) : 'no body'
            })`,
            returnByValue: true
        });

        console.log('📄 Page info:', JSON.stringify(result.value, null, 2));
    } catch (err) {
        console.error('❌ Error getting page info:', err.message);
    }

    // Check for buttons
    try {
        const buttons = await send('Runtime.evaluate', {
            expression: `Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).slice(0, 10)`,
            returnByValue: true
        });

        console.log('🔘 Buttons found:', buttons.value);
    } catch (err) {
        console.error('❌ Error getting buttons:', err.message);
    }

    // Check for create section
    try {
        const createSection = await send('Runtime.evaluate', {
            expression: `!!document.querySelector('[data-testid="create-tournament-section"]')`,
            returnByValue: true
        });

        console.log('📦 Create section exists:', createSection.value);
    } catch (err) {
        console.error('❌ Error checking create section:', err.message);
    }

    // Try to click button
    try {
        console.log('🖱️  Attempting to click button...');
        const clickResult = await send('Runtime.evaluate', {
            expression: `
                (function() {
                    const btn = document.querySelector('[data-testid="create-tournament-btn-3"]');
                    if (!btn) return 'button not found';
                    btn.click();
                    return 'clicked';
                })()
            `,
            returnByValue: true
        });

        console.log('✅ Click result:', clickResult.value);
    } catch (err) {
        console.error('❌ Error clicking:', err.message);
    }

    ws.close();
    console.log('✅ Done');
}

debugPage().catch(err => {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
});
