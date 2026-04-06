const CDP = require('chrome-remote-interface');

(async () => {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();
    
    // 截图当前状态
    const { data } = await Page.captureScreenshot();
    require('fs').writeFileSync('./test-results/nft-verification.png', Buffer.from(data, 'base64'));
    console.log('📸 截图保存: test-results/nft-verification.png');
    
    // 检查页面内容
    const result = await Runtime.evaluate({
        expression: `(function() {
            const body = document.body.innerText;
            return JSON.stringify({
                hasNFT: body.includes('NFT') || body.includes('成就'),
                hasSuccess: body.includes('成功') || body.includes('Success'),
                isChampion: body.includes('Champion'),
                preview: body.substring(0, 300)
            });
        })()`,
        returnByValue: true
    });
    
    const info = JSON.parse(result.result.value);
    console.log('\n=== 页面状态 ===');
    console.log('包含NFT内容:', info.hasNFT);
    console.log('包含成功提示:', info.hasSuccess);
    console.log('锦标赛冠军:', info.isChampion);
    console.log('\n内容预览:', info.preview);
    
    await client.close();
})();
