/**
 * Connect to Chrome and trigger deposit
 */

const puppeteer = require('puppeteer-core');

async function testDeposit() {
    console.log('🔌 Connecting to Chrome on port 9222...');

    try {
        const browser = await puppeteer.connect({
            browserURL: 'http://localhost:9222',
            defaultViewport: null
        });

        const pages = await browser.pages();
        console.log(`📄 Found ${pages.length} pages`);

        const page = pages[0];
        console.log(`📍 Current URL: ${page.url()}`);

        // Wait for page to load
        await page.waitForTimeout(2000);

        // Try to find deposit input and button
        console.log('\n🔍 Looking for deposit elements...');

        const depositInput = await page.$('input[type="number"]').catch(() => null);
        const depositButton = await page.$('button:has-text("Deposit")').catch(() => null);

        if (depositInput && depositButton) {
            console.log('✅ Found deposit elements!');
            console.log('💰 Filling amount: 100 TRX');

            await depositInput.click({ clickCount: 3 });
            await depositInput.type('100');

            console.log('🖱️  Clicking Deposit button...');
            await depositButton.click();

            console.log('⏳ Please confirm in TronLink wallet');
            console.log('👀 Watching for 60 seconds...\n');

            await page.waitForTimeout(60000);
        } else {
            console.log('⚠️  Deposit elements not found');
            console.log('   Please ensure you are on the deposit page\n');
        }

        await browser.disconnect();

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testDeposit();
