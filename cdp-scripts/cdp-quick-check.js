const CDP = require('chrome-remote-interface');

(async () => {
    const client = await CDP({ port: 9222 });
    const { Runtime } = client;
    
    try {
        const result = await Runtime.evaluate({
            expression: `(function() {
                var body = document.body.innerText;
                var btns = document.querySelectorAll('button');
                var inftTabBtn = null;
                for (var i = 0; i < btns.length; i++) {
                    if ((btns[i].textContent || '').indexOf('0G') !== -1) {
                        inftTabBtn = btns[i];
                        break;
                    }
                }
                var tabMatch = body.match(/0G\\/ INFT\\s*\\(([^)]+)\\)/);
                var imgs = document.querySelectorAll('img');
                var dataImgs = 0;
                for (var j = 0; j < imgs.length; j++) {
                    if ((imgs[j].src || '').indexOf('data:') === 0) dataImgs++;
                }
                return JSON.stringify({
                    inftTabText: inftTabBtn ? inftTabBtn.textContent.trim() : 'NOT FOUND',
                    inftCountInTab: tabMatch ? tabMatch[1] : 'none',
                    hasINFT1: body.indexOf('INFT #1') !== -1,
                    hasINFT2: body.indexOf('INFT #2') !== -1,
                    dataImageCount: dataImgs,
                    totalImageCount: imgs.length
                });
            })()`,
            returnByValue: true
        });
        console.log(result.result.value || 'NO RESULT');
    } catch(e) { 
        console.error('Error:', e.message); 
    }
    await client.close();
})().catch(console.error);
