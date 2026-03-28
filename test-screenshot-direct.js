/**
 * 直接在游戏页面测试截图效果
 * 对比原始方法和修复方法
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function main() {
    console.log('=== 游戏截图直接测试 ===\n');
    
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();
    
    // 导航到游戏页面
    console.log('1. 导航到游戏页面...');
    await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
    await sleep(3000);
    
    // 检查当前页面
    const checkResult = await Runtime.evaluate({
        expression: `JSON.stringify({
            hasPlayArea: !!document.querySelector('.play-area'),
            url: window.location.href,
            title: document.title
        })`
    });
    console.log('   页面状态:', checkResult.result.value);
    
    // 如果是锦标赛列表，尝试加入一个锦标赛
    const joinResult = await Runtime.evaluate({
        expression: `JSON.stringify((function() {
            const buttons = Array.from(document.querySelectorAll('button'));
            const joinBtn = buttons.find(b => /双人赛|join/i.test(b.innerText));
            if (joinBtn) {
                joinBtn.click();
                return { clicked: true };
            }
            return { clicked: false, buttons: buttons.map(b => b.innerText).slice(0, 5) };
        })())`
    });
    console.log('   点击结果:', joinResult.result.value);
    
    await sleep(3000);
    
    // 再次检查是否在游戏页面
    const gameCheck = await Runtime.evaluate({
        expression: `JSON.stringify({
            hasPlayArea: !!document.querySelector('.play-area'),
            hasPokerTable: !!document.querySelector('.poker-table-wrapper'),
            currentUrl: window.location.href
        })`
    });
    const gameState = JSON.parse(gameCheck.result.value || '{}');
    console.log('   游戏页面:', gameState.hasPlayArea);
    
    // 截取浏览器视图
    console.log('\n2. 截取浏览器视图...');
    const { data: browserScreenshot } = await Page.captureScreenshot();
    fs.writeFileSync('test-results/direct-browser-view.png', Buffer.from(browserScreenshot, 'base64'));
    console.log('   保存: test-results/direct-browser-view.png');
    
    // 注入html2canvas
    console.log('\n3. 注入html2canvas...');
    await Runtime.evaluate({
        expression: `(function() {
            if (typeof html2canvas === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                document.head.appendChild(script);
            }
        })()`
    });
    await sleep(2000);
    
    // 方法1: 原始方法（旧代码方式）
    console.log('\n4. 测试原始方法...');
    const originalResult = await Runtime.evaluate({
        expression: `(async function() {
            const gameElement = document.querySelector('.poker-table-wrapper') || 
                                document.querySelector('.play-area') ||
                                document.body;
            
            const canvas = await html2canvas(gameElement, {
                backgroundColor: '#1a1a2e',
                scale: 0.8,
                logging: false,
                useCORS: true
            });
            
            return {
                dataUrl: canvas.toDataURL('image/png'),
                width: canvas.width,
                height: canvas.height
            };
        })()`,
        awaitPromise: true
    });
    
    if (originalResult.result.value && originalResult.result.value.dataUrl) {
        const base64Data = originalResult.result.value.dataUrl.split('base64,')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync('test-results/direct-original-method.png', buffer);
        console.log('   保存: test-results/direct-original-method.png');
        console.log('   尺寸:', originalResult.result.value.width, 'x', originalResult.result.value.height);
    }
    
    // 方法2: 修复方法
    console.log('\n5. 测试修复方法...');
    const fixedResult = await Runtime.evaluate({
        expression: `(async function() {
            const gameElement = document.querySelector('.play-area') || 
                                document.querySelector('.poker-table-wrapper') ||
                                document.body;
            
            const canvas = await html2canvas(gameElement, {
                backgroundColor: '#0a0a0f',
                scale: 1.0,
                logging: false,
                useCORS: true,
                allowTaint: true,
                onclone: (clonedDoc) => {
                    const clonedElement = clonedDoc.querySelector('.play-area') || clonedDoc.body;
                    
                    // 应用修复样式
                    clonedElement.style.background = 'linear-gradient(180deg, #0a0a12 0%, #1a1a2e 50%, #0a0a0f 100%)';
                    clonedElement.style.backgroundImage = 'none';
                    clonedElement.style.boxShadow = 'none';
                    clonedElement.style.filter = 'none';
                    
                    // 添加样式隐藏伪元素
                    const style = clonedDoc.createElement('style');
                    style.textContent = \`
                        .play-area::before,
                        .play-area::after {
                            display: none !important;
                            content: none !important;
                        }
                    \`;
                    clonedDoc.head.appendChild(style);
                    
                    // 移除backdrop-filter
                    clonedDoc.querySelectorAll('*').forEach(el => {
                        el.style.backdropFilter = 'none';
                        el.style.webkitBackdropFilter = 'none';
                    });
                }
            });
            
            return {
                dataUrl: canvas.toDataURL('image/png'),
                width: canvas.width,
                height: canvas.height
            };
        })()`,
        awaitPromise: true
    });
    
    if (fixedResult.result.value && fixedResult.result.value.dataUrl) {
        const base64Data = fixedResult.result.value.dataUrl.split('base64,')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync('test-results/direct-fixed-method.png', buffer);
        console.log('   保存: test-results/direct-fixed-method.png');
        console.log('   尺寸:', fixedResult.result.value.width, 'x', fixedResult.result.value.height);
    }
    
    await client.close();
    
    console.log('\n=== 测试完成 ===');
    console.log('\n请对比以下文件:');
    console.log('  1. test-results/direct-browser-view.png - 浏览器实际显示');
    console.log('  2. test-results/direct-original-method.png - 原始截图方法');
    console.log('  3. test-results/direct-fixed-method.png - 修复后截图方法');
    console.log('\n如果原始方法截图有黑色阴影而修复方法没有，说明修复有效。');
}

main().catch(err => {
    console.error('错误:', err);
    process.exit(1);
});
