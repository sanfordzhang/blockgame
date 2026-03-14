const { chromium } = require('playwright');

async function autoDeposit() {
    console.log('🤖 Automating deposit...');

    try {
        const browser = await chromium.connectOverCDP('ws://localhost:9222/devtools/page/6A332D17F0400C8E9DC1B453D7946F7E');
        const contexts = browser.contexts();
        const context = contexts[0];
        const pages = context.pages();
        const page = pages[0];

        console.log('✅ Connected to page:', page.url());

        // Wait for page to be ready
        await page.waitForLoadState('domcontentloaded');

        // Find deposit input
        console.log('🔍 Looking for deposit input...');
        const input = await page.locator('input[type="number"]').first();

        if (await input.isVisible()) {
            console.log('💰 Filling amount: 100');
            await input.fill('100');

            // Find and click deposit button
            console.log('🖱️  Clicking Deposit button...');
            const button = await page.locator('button:has-text("Deposit")').first();
            await button.click();

            console.log('✅ Deposit button clicked!');
            console.log('⏳ Please confirm in TronLink wallet');
            console.log('👀 Monitoring logs for 30 seconds...\n');

            await page.waitForTimeout(30000);
        } else {
            console.log('❌ Deposit input not found');
        }

        await browser.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

autoDeposit();
