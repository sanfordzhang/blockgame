const { chromium } = require('playwright');

async function depositTest() {
    console.log('🚀 Connecting to Chrome via WebSocket...\n');

    const wsUrl = 'ws://localhost:9222/devtools/page/6A332D17F0400C8E9DC1B453D7946F7E';

    try {
        const browser = await chromium.connectOverCDP(wsUrl);
        const context = browser.contexts()[0];
        const page = context.pages()[0];

        console.log('✅ Connected to:', page.url());
        console.log();

        // Find deposit input
        console.log('📝 Looking for deposit form...');
        const input = await page.locator('input[type="number"]').first();

        if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
            console.log('✅ Found deposit input');
            console.log('💰 Filling 100 TRX...');
            await input.fill('100');
            await page.waitForTimeout(500);

            // Click deposit
            console.log('🖱️  Clicking Deposit button...');
            const btn = await page.locator('button:has-text("Deposit")').first();
            await btn.click();
            console.log('✅ Clicked!\n');

            console.log('⏳ Waiting for wallet confirmation...');
            console.log('   (Please confirm in TronLink if popup appears)\n');

            // Monitor server logs
            console.log('👀 Monitoring server logs...\n');
            const { spawn } = require('child_process');
            const tail = spawn('tail', ['-f', '/tmp/server.log']);

            let found = false;
            tail.stdout.on('data', (data) => {
                const log = data.toString();
                if (log.includes('DEPOSIT EVENT')) {
                    console.log('🎉 ' + log.trim());
                    found = true;
                    tail.kill();
                }
            });

            await page.waitForTimeout(30000);
            if (!found) tail.kill();

            console.log(found ? '\n✅ SUCCESS!' : '\n⏳ Still waiting for blockchain confirmation...');
        } else {
            console.log('❌ Deposit form not found. Please ensure you are logged in.');
        }

        await browser.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

depositTest();
