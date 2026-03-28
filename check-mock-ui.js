const CDP = require('chrome-remote-interface');

async function check() {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    
    await Page.enable();
    await Runtime.enable();
    
    await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
    await Page.loadEventFired();
    
    await new Promise(r => setTimeout(r, 3000));
    
    const result = await Runtime.evaluate({
        expression: `
            (function() {
                const checkbox = document.querySelector('input[data-testid="mock-game-checkbox"]');
                return {
                    hasCheckbox: !!checkbox,
                    checked: checkbox ? checkbox.checked : null,
                    text: document.body.innerText.substring(0, 400)
                };
            })()
        `,
        returnByValue: true
    });
    
    console.log('Mock 开关:', JSON.stringify(result.result.value, null, 2));
    await client.close();
}

check().catch(console.error);
