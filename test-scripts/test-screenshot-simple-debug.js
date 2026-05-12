/**
 * 简单调试测试 - 直接执行截图
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function main() {
    console.log('=== 简单调试 ===\n');
    
    const client = await CDP({ port: 9222 });
    const { Page, Runtime, Console } = client;
    await Page.enable();
    await Runtime.enable();
    Console.enable();
    
    Console.messageAdded((params) => {
        const text = params.message.text;
        if (text.length < 200 && !text.includes('Warning') && !text.includes('Deprecation')) {
            console.log('[浏览器]', text);
        }
    });
    
    // 直接在当前页面测试
    console.log('1. 检查当前页面...');
    const urlResult = await Runtime.evaluate({ expression: 'window.location.href' });
    console.log('   URL:', urlResult.result.value);
    
    const stateResult = await Runtime.evaluate({
        expression: `JSON.stringify({
            hasPlayArea: !!document.querySelector('.play-area'),
            playAreaSize: (function() {
                const el = document.querySelector('.play-area');
                return el ? { w: el.offsetWidth, h: el.offsetHeight } : null;
            })()
        })`
    });
    console.log('   状态:', stateResult.result.value);
    
    // 注入html2canvas
    console.log('\n2. 注入html2canvas...');
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
    
    // 检查html2canvas
    const h2cCheck = await Runtime.evaluate({ expression: 'typeof html2canvas' });
    console.log('   html2canvas:', h2cCheck.result.value);
    
    // 简单截图测试
    console.log('\n3. 简单截图测试...');
    const result = await Runtime.evaluate({
        expression: `(async function() {
            try {
                const playArea = document.querySelector('.play-area');
                if (!playArea) {
                    return { error: 'play-area not found' };
                }
                
                console.log('找到play-area:', playArea.offsetWidth, 'x', playArea.offsetHeight);
                
                const canvas = await html2canvas(playArea, {
                    backgroundColor: '#0a0a0f',
                    scale: 1,
                    logging: true
                });
                
                console.log('截图完成:', canvas.width, 'x', canvas.height);
                
                const dataUrl = canvas.toDataURL('image/png');
                
                return {
                    success: true,
                    w: canvas.width,
                    h: canvas.height,
                    dataUrl: dataUrl
                };
            } catch (e) {
                return { error: e.message };
            }
        })()`,
        awaitPromise: true,
        returnByValue: true
    });
    
    console.log('   结果:', result.result?.value?.success ? '成功' : '失败');
    
    if (result.result?.value?.error) {
        console.log('   错误:', result.result.value.error);
    }
    
    if (result.result?.value?.success && result.result?.value?.dataUrl) {
        const dataUrl = result.result.value.dataUrl;
        console.log('   dataUrl长度:', dataUrl.length);
        
        const base64Data = dataUrl.split('base64,')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync('test-results/simple-test-screenshot.png', buffer);
        console.log('   保存: test-results/simple-test-screenshot.png');
        console.log('   尺寸:', result.result.value.w, 'x', result.result.value.h);
    }
    
    await client.close();
    console.log('\n=== 完成 ===');
}

main().catch(console.error);
