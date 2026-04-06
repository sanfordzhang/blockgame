const CDP = require('chrome-remote-interface');
(async () => {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    
    const result = await Runtime.evaluate({
        expression: `(function() {
            const body = document.body.innerText;
            return JSON.stringify({
                hasChampion: body.includes('Champion'),
                hasAchievement: body.includes('成就'),
                hasMintButton: Array.from(document.querySelectorAll('button'))
                    .some(b => b.textContent.includes('铸造') || b.textContent.includes('NFT')),
                preview: body.substring(0, 400)
            });
        })()`,
        returnByValue: true
    });
    
    const info = JSON.parse(result.result.value);
    console.log('=== 页面状态 ===');
    console.log('锦标赛冠军:', info.hasChampion);
    console.log('成就弹窗:', info.hasAchievement);
    console.log('锻造按钮:', info.hasMintButton);
    console.log('\n内容预览:', info.preview);
    
    const { data } = await Page.captureScreenshot();
    require('fs').writeFileSync('./test-results/current-state.png', Buffer.from(data, 'base64'));
    console.log('\n📸 截图: test-results/current-state.png');
    
    await client.close();
})();
