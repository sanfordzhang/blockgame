/**
 * 调试截图问题
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function main() {
    console.log('=== 调试截图 ===\n');
    
    const client = await CDP({ port: 9222 });
    const { Page, Runtime, Console } = client;
    await Page.enable();
    await Runtime.enable();
    Console.enable();
    
    // 监听控制台输出
    Console.messageAdded((params) => {
        const text = params.message.text;
        if (text.length < 500 && !text.includes('Deprecation') && !text.includes('Warning')) {
            console.log('[浏览器]', text);
        }
    });
    
    // 使用现有的游戏页面（用户浏览器可能已经在游戏页面）
    console.log('1. 检查当前页面...');
    const currentUrl = await Runtime.evaluate({
        expression: `window.location.href`
    });
    console.log('   当前URL:', currentUrl.result.value);
    
    // 检查页面状态
    const stateResult = await Runtime.evaluate({
        expression: `JSON.stringify({
            hasPlayArea: !!document.querySelector('.play-area'),
            hasPokerTable: !!document.querySelector('.poker-table-wrapper'),
            bodyPreview: document.body.innerText.substring(0, 100)
        })`
    });
    const state = JSON.parse(stateResult.result.value || '{}');
    console.log('   页面状态:', JSON.stringify(state, null, 2));
    
    // 如果不在游戏页面，导航到锦标赛
    if (!state.hasPlayArea) {
        console.log('\n2. 导航到锦标赛列表...');
        await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
        await new Promise(r => setTimeout(r, 3000));
        
        // 检查是否有可加入的锦标赛
        const joinResult = await Runtime.evaluate({
            expression: `JSON.stringify((function() {
                const buttons = Array.from(document.querySelectorAll('button'));
                const joinBtn = buttons.find(b => /join|加入|双人赛/i.test(b.innerText));
                if (joinBtn) {
                    joinBtn.click();
                    return { clicked: true };
                }
                return { clicked: false, buttons: buttons.map(b => b.innerText).slice(0, 5) };
            })())`
        });
        console.log('   点击结果:', joinResult.result.value);
        
        await new Promise(r => setTimeout(r, 5000));
        
        // 再次检查
        const newStateResult = await Runtime.evaluate({
            expression: `JSON.stringify({
                hasPlayArea: !!document.querySelector('.play-area'),
                bodyPreview: document.body.innerText.substring(0, 100)
            })`
        });
        const newState = JSON.parse(newStateResult.result.value || '{}');
        console.log('   新状态:', JSON.stringify(newState, null, 2));
    }
    
    // 浏览器截图
    console.log('\n3. 浏览器截图...');
    const { data: browserScreenshot } = await Page.captureScreenshot();
    fs.writeFileSync('test-results/debug-browser.png', Buffer.from(browserScreenshot, 'base64'));
    console.log('   保存: test-results/debug-browser.png');
    
    // 注入html2canvas
    console.log('\n4. 注入html2canvas...');
    const injectResult = await Runtime.evaluate({
        expression: `(async function() {
            if (typeof html2canvas !== 'undefined') return 'already loaded';
            
            return new Promise((resolve) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                script.onload = () => resolve('loaded');
                script.onerror = (e) => resolve('error: ' + e);
                document.head.appendChild(script);
                setTimeout(() => resolve('timeout'), 5000);
            });
        })()`,
        awaitPromise: true
    });
    console.log('   注入结果:', injectResult.result.value);
    
    // 检查html2canvas是否可用
    const checkH2c = await Runtime.evaluate({
        expression: `typeof html2canvas`
    });
    console.log('   html2canvas类型:', checkH2c.result.value);
    
    // 执行截图（详细日志）
    console.log('\n5. 执行截图...');
    const screenshotResult = await Runtime.evaluate({
        expression: `(async function() {
            console.log('开始截图测试...');
            
            try {
                // 获取目标元素
                const playArea = document.querySelector('.play-area');
                console.log('playArea元素:', playArea ? 'found' : 'not found');
                
                const target = playArea || document.body;
                console.log('目标元素:', target.tagName, 'size:', target.offsetWidth, 'x', target.offsetHeight);
                
                // 执行截图
                const canvas = await html2canvas(target, {
                    backgroundColor: '#0a0a0f',
                    scale: 0.5,
                    logging: true,
                    useCORS: true,
                    allowTaint: true
                });
                
                console.log('截图完成:', canvas.width, 'x', canvas.height);
                
                // 转换为base64
                const dataUrl = canvas.toDataURL('image/png');
                console.log('dataUrl长度:', dataUrl.length);
                
                return {
                    success: true,
                    width: canvas.width,
                    height: canvas.height,
                    dataUrlLength: dataUrl.length,
                    dataUrl: dataUrl
                };
            } catch (e) {
                console.error('截图错误:', e.message, e.stack);
                return {
                    success: false,
                    error: e.message,
                    stack: e.stack
                };
            }
        })()`,
        awaitPromise: true,
        returnByValue: true
    });
    
    console.log('   结果类型:', typeof screenshotResult.result.value);
    console.log('   结果:', screenshotResult.result.value?.success ? '成功' : '失败');
    
    if (screenshotResult.result.value?.error) {
        console.log('   错误:', screenshotResult.result.value.error);
        console.log('   堆栈:', screenshotResult.result.value.stack?.substring(0, 500));
    }
    
    if (screenshotResult.result.value?.success && screenshotResult.result.value?.dataUrl) {
        const dataUrl = screenshotResult.result.value.dataUrl;
        const base64Data = dataUrl.split('base64,')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync('test-results/debug-screenshot.png', buffer);
        console.log('   保存: test-results/debug-screenshot.png');
        console.log('   尺寸:', screenshotResult.result.value.width, 'x', screenshotResult.result.value.height);
    }
    
    await client.close();
    console.log('\n=== 调试完成 ===');
}

main().catch(err => {
    console.error('错误:', err);
    process.exit(1);
});
