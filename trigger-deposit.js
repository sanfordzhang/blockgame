const http = require('http');

async function triggerDeposit() {
    console.log('🔌 Connecting to Chrome CDP...');

    // Get WebSocket URL
    const wsUrl = await new Promise((resolve, reject) => {
        http.get('http://localhost:9222/json', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const pages = JSON.parse(data);
                if (pages.length > 0) {
                    resolve(pages[0].webSocketDebuggerUrl);
                } else {
                    reject(new Error('No pages found'));
                }
            });
        }).on('error', reject);
    });

    console.log('✅ Connected to:', wsUrl);
    console.log('\n📝 Please manually deposit in browser');
    console.log('👀 Watching server logs...\n');

    // Monitor server logs
    const { spawn } = require('child_process');
    const tail = spawn('tail', ['-f', '/tmp/server.log']);

    tail.stdout.on('data', (data) => {
        const log = data.toString();
        if (log.includes('DEPOSIT EVENT') || log.includes('Polled')) {
            console.log(log.trim());
        }
    });

    await new Promise(resolve => setTimeout(resolve, 60000));
    tail.kill();
}

triggerDeposit().catch(console.error);
