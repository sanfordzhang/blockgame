/**
 * Connect to existing Chrome debug instance and test deposit
 */

const { chromium } = require('playwright');

async function testDepositDebug() {
    console.log('🔌 Connecting to Chrome debug instance on port 9222...');

    try {
        // Connect to existing browser
        const browser = await chromium.connectOverCDP('http://localhost:9222');
        const contexts = browser.contexts();
        const context = contexts[0];
        const pages = context.pages();

        console.log(`📄 Found ${pages.length} open pages`);

        // Use the first page or create new one
        const page = pages.length > 0 ? pages[0] : await context.newPage();

        console.log('✅ Connected to browser!');
        console.log('📍 Current URL:', page.url());

        // Wait a bit to see current state
        await page.waitForTimeout(2000);

        // Try to find and click deposit button
        console.log('\n🔍 Looking for Deposit button...');

        const depositButton = await page.locator('button:has-text("Deposit")').first();
        const isVisible = await depositButton.isVisible().catch(() => false);

        if (isVisible) {
            console.log('✅ Found Deposit button!');
            console.log('⏳ Please manually:');
            console.log('   1. Enter amount (e.g., 100)');
            console.log('   2. Click Deposit button');
            console.log('   3. Confirm in TronLink');
            console.log('   4. Watch server logs for events\n');
        } else {
            console.log('⚠️  Deposit button not visible yet');
            console.log('   Please connect wallet and register first\n');
        }

        // Keep monitoring
        console.log('👀 Monitoring page for 5 minutes...');
        console.log('   Press Ctrl+C to stop\n');

        await page.waitForTimeout(300000);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testDepositDebug().catch(console.error);
