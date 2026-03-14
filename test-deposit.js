/**
 * Test script to verify deposit functionality
 * Opens Chrome browser for manual testing with TronLink
 */

const { chromium } = require('playwright');

async function testDeposit() {
    console.log('🚀 Starting Chrome browser for deposit testing...');

    // Launch browser in non-headless mode so you can interact with TronLink
    const browser = await chromium.launch({
        headless: false,
        args: ['--start-maximized']
    });

    const context = await browser.newContext({
        viewport: null
    });

    const page = await context.newPage();

    console.log('📱 Opening application at http://localhost:3000');
    await page.goto('http://localhost:3000');

    console.log('\n✅ Browser opened! Please follow these steps:');
    console.log('1. Connect your TronLink wallet');
    console.log('2. Register if needed');
    console.log('3. Deposit 100 TRX');
    console.log('4. Watch the server logs for deposit events');
    console.log('\n⏳ Browser will stay open. Press Ctrl+C to close.\n');

    // Keep browser open
    await page.waitForTimeout(300000); // 5 minutes
}

testDeposit().catch(console.error);
