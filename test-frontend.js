const puppeteer = require('puppeteer');

(async () => {
    console.log('🚀 Starting browser test...');

    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Listen to console messages
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        console.log(`[Browser ${type}]`, text);
    });

    // Listen to page errors
    page.on('pageerror', error => {
        console.error('❌ [Page Error]', error.message);
    });

    // Listen to network requests
    page.on('request', request => {
        if (request.url().includes('/api/tournament')) {
            console.log('📤 [Request]', request.method(), request.url());
        }
    });

    page.on('response', response => {
        if (response.url().includes('/api/tournament')) {
            console.log('📥 [Response]', response.status(), response.url());
        }
    });

    console.log('📍 Navigating to tournament page...');
    await page.goto('http://localhost:3000/tournament', {
        waitUntil: 'networkidle2',
        timeout: 30000
    });

    console.log('✅ Page loaded');

    // Wait for the page to be fully rendered
    await page.waitForTimeout(2000);

    // Check if create section exists
    const createSection = await page.$('[data-testid="create-tournament-section"]');
    console.log('Create section exists:', !!createSection);

    // Get all buttons
    const buttons = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.map(b => ({
            text: b.textContent,
            testId: b.getAttribute('data-testid'),
            disabled: b.disabled,
            visible: b.offsetParent !== null
        }));
    });

    console.log('📋 All buttons:', JSON.stringify(buttons, null, 2));

    // Find the create tournament button for config 3
    const btn3 = await page.$('[data-testid="create-tournament-btn-3"]');

    if (!btn3) {
        console.error('❌ Button for config 3 not found!');
        await browser.close();
        return;
    }

    console.log('✅ Found create tournament button (config 3)');

    // Check button state
    const buttonInfo = await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="create-tournament-btn-3"]');
        return {
            text: btn.textContent,
            disabled: btn.disabled,
            visible: btn.offsetParent !== null,
            hasOnClick: !!btn.onclick
        };
    });

    console.log('🔍 Button info:', buttonInfo);

    // Click the button
    console.log('🖱️  Clicking button...');
    await btn3.click();

    console.log('⏳ Waiting for response...');
    await page.waitForTimeout(3000);

    // Check for error messages
    const errorMsg = await page.evaluate(() => {
        const error = document.querySelector('[data-testid="error-message"]');
        return error ? error.textContent : null;
    });

    if (errorMsg) {
        console.error('❌ Error message:', errorMsg);
    } else {
        console.log('✅ No error message');
    }

    // Check tournament list
    const tournaments = await page.evaluate(() => {
        const cards = document.querySelectorAll('[data-testid^="tournament-card-"]');
        return Array.from(cards).map(card => {
            const id = card.getAttribute('data-testid').replace('tournament-card-', '');
            return { id, text: card.textContent.substring(0, 50) };
        });
    });

    console.log('📊 Tournaments on page:', tournaments.length);
    tournaments.forEach(t => console.log('  -', t.id));

    console.log('✅ Test complete');

    // Keep browser open for inspection
    console.log('Browser will stay open for 10 seconds...');
    await page.waitForTimeout(10000);

    await browser.close();
})();
