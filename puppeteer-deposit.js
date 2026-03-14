const puppeteer = require('puppeteer-core');

(async () => {
    console.log('🔌 Connecting to Chrome...');

    const browser = await puppeteer.connect({
        browserURL: 'http://localhost:9222'
    });

    const pages = await browser.pages();
    const page = pages.find(p => p.url().includes('192.168.10.46:3000'));

    if (!page) {
        console.log('❌ App page not found');
        await browser.disconnect();
        return;
    }

    console.log('✅ Connected to:', page.url());

    // Find and fill deposit input
    console.log('💰 Filling deposit amount...');
    await page.waitForSelector('input[type="number"]', { timeout: 5000 });
    await page.evaluate(() => {
        const input = document.querySelector('input[type="number"]');
        if (input) input.value = '100';
    });

    // Click deposit button
    console.log('🖱️  Clicking Deposit button...');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const depositBtn = buttons.find(b => b.textContent.includes('Deposit'));
        if (depositBtn) depositBtn.click();
    });

    console.log('✅ Deposit triggered!');
    console.log('⏳ Please confirm in TronLink wallet');

    await browser.disconnect();
})();
