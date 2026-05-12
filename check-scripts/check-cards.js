const CDP = require('chrome-remote-interface');

async function check() {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    
    await Page.enable();
    await Runtime.enable();
    
    const result = await Runtime.evaluate({
        expression: `
            (function() {
                const cards = [];
                document.querySelectorAll('div').forEach((el, i) => {
                    const text = el.innerText || '';
                    if (text.includes('WAITING') && text.includes('人赛')) {
                        cards.push({
                            className: el.className.substring(0, 80),
                            text: text.substring(0, 150)
                        });
                    }
                });
                return JSON.stringify(cards.slice(0, 3), null, 2);
            })()
        `,
        returnByValue: true
    });
    
    console.log('锦标赛卡片:');
    console.log(result.result.value);
    
    await client.close();
}

check().catch(console.error);
