/**
 * 简单截图测试 - 直接在游戏页面执行
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function main() {
    console.log('=== 简单截图测试 ===\n');
    
    const client = await CDP({ port: 9222 });
    const { Page, Runtime, Console } = client;
    await Page.enable();
    await Runtime.enable();
    Console.enable();
    
    Console.messageAdded((params) => {
        console.log('[浏览器]', params.message.text);
    });
    
    // 导航到NFT gallery查看现有截图
    console.log('1. 导航到NFT gallery...');
    await Page.navigate({ url: 'http://127.0.0.1:3001/nft?address=TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv' });
    await new Promise(r => setTimeout(r, 3000));
    
    // 浏览器截图
    const { data: browserScreenshot } = await Page.captureScreenshot();
    fs.writeFileSync('test-results/simple-nft-gallery.png', Buffer.from(browserScreenshot, 'base64'));
    console.log('   保存: test-results/simple-nft-gallery.png');
    
    // 获取现有截图信息
    const nftInfo = await Runtime.evaluate({
        expression: `JSON.stringify((function() {
            const images = document.querySelectorAll('img[src^="data:image"]');
            return {
                count: images.length,
                first: images[0] ? {
                    width: images[0].naturalWidth,
                    height: images[0].naturalHeight,
                    srcLength: images[0].src.length
                } : null
            };
        })())`
    });
    console.log('   NFT截图信息:', nftInfo.result.value);
    
    // 导航到游戏页面
    console.log('\n2. 导航到锦标赛页面...');
    await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
    await new Promise(r => setTimeout(r, 3000));
    
    // 点击创建/加入锦标赛
    const joinResult = await Runtime.evaluate({
        expression: `JSON.stringify((function() {
            const buttons = Array.from(document.querySelectorAll('button'));
            const joinBtn = buttons.find(b => /双人赛/i.test(b.innerText));
            if (joinBtn) {
                joinBtn.click();
                return { clicked: true, text: joinBtn.innerText };
            }
            return { clicked: false };
        })())`
    });
    console.log('   点击结果:', joinResult.result.value);
    
    await new Promise(r => setTimeout(r, 5000));
    
    // 检查页面状态
    const pageState = await Runtime.evaluate({
        expression: `JSON.stringify({
            hasPlayArea: !!document.querySelector('.play-area'),
            url: window.location.href,
            title: document.title
        })`
    });
    console.log('   页面状态:', pageState.result.value);
    
    // 浏览器截图
    const { data: gameScreenshot } = await Page.captureScreenshot();
    fs.writeFileSync('test-results/simple-game-page.png', Buffer.from(gameScreenshot, 'base64'));
    console.log('   保存: test-results/simple-game-page.png');
    
    // 注入html2canvas
    console.log('\n3. 注入html2canvas...');
    await Runtime.evaluate({
        expression: `(function() {
            return new Promise((resolve) => {
                if (typeof html2canvas !== 'undefined') {
                    resolve('already loaded');
                    return;
                }
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                script.onload = () => resolve('loaded');
                script.onerror = () => resolve('error');
                document.head.appendChild(script);
            });
        })()`,
        awaitPromise: true
    });
    console.log('   html2canvas加载完成');
    
    await new Promise(r => setTimeout(r, 1000));
    
    // 执行截图
    console.log('\n4. 执行截图...');
    const result = await Runtime.evaluate({
        expression: `(async function() {
            console.log('开始截图...');
            
            const target = document.querySelector('.play-area') || document.body;
            console.log('目标元素:', target.tagName, target.className);
            
            try {
                const canvas = await html2canvas(target, {
                    backgroundColor: '#0a0a0f',
                    scale: 0.8,
                    logging: true,
                    useCORS: true,
                    allowTaint: true
                });
                
                console.log('截图成功:', canvas.width, 'x', canvas.height);
                
                return {
                    success: true,
                    width: canvas.width,
                    height: canvas.height,
                    dataUrl: canvas.toDataURL('image/png')
                };
            } catch (e) {
                console.error('截图失败:', e.message);
                return {
                    success: false,
                    error: e.message
                };
            }
        })()`,
        awaitPromise: true
    });
    
    console.log('   截图结果:', result.result.value?.success, result.result.value?.error);
    
    if (result.result.value?.success && result.result.value?.dataUrl) {
        const base64Data = result.result.value.dataUrl.split('base64,')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync('test-results/simple-html2canvas.png', buffer);
        console.log('   保存: test-results/simple-html2canvas.png');
        console.log('   尺寸:', result.result.value.width, 'x', result.result.value.height);
    }
    
    await client.close();
    console.log('\n=== 测试完成 ===');
}

main().catch(err => {
    console.error('错误:', err);
    process.exit(1);
});
