const { chromium } = require('playwright');

async function completeDeposit() {
    console.log('🚀 Starting complete deposit test...\n');

    try {
        // Connect to existing Chrome
        console.log('1️⃣ Connecting to Chrome...');
        const browser = await chromium.connectOverCDP('http://localhost:9222');

        const contexts = browser.contexts();
        if (contexts.length === 0) {
            throw new Error('No browser contexts found');
        }

        const context = contexts[0];
        let page = context.pages()[0];

        if (!page) {
            page = await context.newPage();
        }

        console.log('✅ Connected to browser\n');

        // Navigate to the app
        console.log('2️⃣ Navigating to http://192.168.10.46:3000/...');
        await page.goto('http://192.168.10.46:3000/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
        console.log('✅ Page loaded\n');

        // Wait for and find deposit input
        console.log('3️⃣ Looking for deposit form...');
        await page.waitForSelector('input[type="number"]', { timeout: 10000 });

        const depositInput = page.locator('input[type="number"]').first();
        console.log('✅ Found deposit input\n');

        // Fill amount
        console.log('4️⃣ Filling deposit amount: 100 TRX...');
        await depositInput.fill('100');
        await page.waitForTimeout(500);
        console.log('✅ Amount filled\n');

        // Click deposit button
        console.log('5️⃣ Clicking Deposit button...');
        const depositButton = page.locator('button:has-text("Deposit")').first();
        await depositButton.click();
        console.log('✅ Deposit button clicked\n');

        // Wait for TronLink popup
        console.log('6️⃣ Waiting for TronLink popup...');
        await page.waitForTimeout(3000);

        // Try to find and click confirm button in TronLink popup
        console.log('7️⃣ Looking for TronLink confirm button...');
        const pages = context.pages();

        for (const p of pages) {
            const url = p.url();
            if (url.includes('tronlink') || url.includes('chrome-extension')) {
                console.log(`   Found TronLink page: ${url}`);
                await p.bringToFront();
                await p.waitForTimeout(1000);

                // Try to find confirm button
                const confirmBtn = p.locator('button:has-text("Accept"), button:has-text("Confirm"), button:has-text("确认")').first();
                if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    console.log('   Clicking confirm button...');
                    await confirmBtn.click();
                    console.log('✅ Transaction confirmed!\n');
                    break;
                }
            }
        }

        // Monitor logs
        console.log('8️⃣ Monitoring server logs for 30 seconds...\n');
        const { spawn } = require('child_process');
        const tail = spawn('tail', ['-f', '/tmp/server.log']);

        let foundEvent = false;
        tail.stdout.on('data', (data) => {
            const log = data.toString();
            if (log.includes('DEPOSIT EVENT')) {
                console.log('🎉 ' + log.trim());
                foundEvent = true;
            } else if (log.includes('Polled') && log.includes('events')) {
                console.log('   ' + log.trim());
            }
        });

        await page.waitForTimeout(30000);
        tail.kill();

        if (foundEvent) {
            console.log('\n✅ SUCCESS: Deposit event captured!');
        } else {
            console.log('\n⚠️  No deposit event captured yet. May need more time for blockchain confirmation.');
        }

        await browser.close();

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

completeDeposit();
