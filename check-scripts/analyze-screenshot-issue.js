/**
 * 详细分析截图问题 - 在实际游戏页面上测试html2canvas
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function main() {
    console.log('=== 详细截图问题分析 ===\n');
    
    const client = await CDP({ port: 9222 });
    const { Page, Runtime, DOM } = client;
    await Page.enable();
    await Runtime.enable();
    await DOM.enable();
    
    // Step 1: 导航到锦标赛页面
    console.log('\n2. 导航到锦标赛列表...');
    await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
    await sleep(3000);
    
    // 截图
    const { data: screenshot1 } = await Page.captureScreenshot();
    fs.writeFileSync('test-results/analysis-01-tournament-list.png', Buffer.from(screenshot1, 'base64'));
    console.log('   截图: test-results/analysis-01-tournament-list.png');
    
    // 检查页面内容
    const pageResult = await Runtime.evaluate({
        expression: `JSON.stringify({
            title: document.title,
            buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(t => t).slice(0, 10),
            hasTournaments: document.body.innerText.includes('Tournament')
        })`
    });
    console.log('   页面状态:', pageResult.result.value);
    
    // Step 2: 点击第一个可用的锦标赛
    console.log('\n3. 尝试加入锦标赛...');
    const joinResult = await Runtime.evaluate({
        expression: `JSON.stringify((function() {
            const buttons = Array.from(document.querySelectorAll('button'));
            const joinBtn = buttons.find(b => /join|加入/i.test(b.innerText));
            if (joinBtn) {
                joinBtn.click();
                return { clicked: true, text: joinBtn.innerText };
            }
            return { clicked: false, buttons: buttons.map(b => b.innerText).slice(0, 5) };
        })())`
    });
    console.log('   点击结果:', joinResult.result.value);
    
    await sleep(3000);
    
    // 截图
    const { data: screenshot2 } = await Page.captureScreenshot();
    fs.writeFileSync('test-results/analysis-02-after-join.png', Buffer.from(screenshot2, 'base64'));
    console.log('   截图: test-results/analysis-02-after-join.png');
    
    // Step 3: 注入html2canvas并测试
    console.log('\n4. 注入html2canvas...');
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
    
    // Step 4: 分析页面元素
    console.log('\n5. 分析页面元素...');
    const elementsResult = await Runtime.evaluate({
        expression: `JSON.stringify((function() {
            const playArea = document.querySelector('.play-area');
            const pokerTable = document.querySelector('.poker-table-wrapper');
            const container = document.querySelector('[class*="Container"]');
            
            return {
                hasPlayArea: !!playArea,
                hasPokerTable: !!pokerTable,
                hasContainer: !!container,
                playAreaStyles: playArea ? {
                    width: playArea.offsetWidth,
                    height: playArea.offsetHeight,
                    background: window.getComputedStyle(playArea).background.substring(0, 100),
                    backgroundImage: window.getComputedStyle(playArea).backgroundImage.substring(0, 100),
                    backgroundColor: window.getComputedStyle(playArea).backgroundColor
                } : null,
                containerStyles: container ? {
                    width: container.offsetWidth,
                    height: container.offsetHeight,
                    background: window.getComputedStyle(container).background.substring(0, 100)
                } : null
            };
        })())`
    });
    console.log('   元素状态:', elementsResult.result.value);
    
    // Step 5: 测试不同的截图方法
    console.log('\n6. 测试截图方法...');
    
    // 方法A: 截取整个body（默认方式）
    const methodA = await Runtime.evaluate({
        expression: `JSON.stringify((async function() {
            try {
                const canvas = await html2canvas(document.body, {
                    backgroundColor: '#1a1a2e',
                    scale: 0.5,
                    logging: false,
                    useCORS: true
                });
                return {
                    method: 'A',
                    width: canvas.width,
                    height: canvas.height,
                    success: true
                };
            } catch (e) {
                return { method: 'A', error: e.message };
            }
        })())`,
        awaitPromise: true
    });
    console.log('   方法A (body, 默认):', methodA.result.value);
    
    // 方法B: 使用onclone修复背景
    const methodB = await Runtime.evaluate({
        expression: `JSON.stringify((async function() {
            try {
                const canvas = await html2canvas(document.body, {
                    backgroundColor: '#0a0a0f',
                    scale: 0.5,
                    logging: false,
                    useCORS: true,
                    onclone: (clonedDoc) => {
                        const body = clonedDoc.body;
                        body.style.background = 'linear-gradient(180deg, #0a0a12 0%, #1a1a2e 50%, #0a0a0f 100%)';
                        body.style.backgroundImage = 'none';
                    }
                });
                return {
                    method: 'B',
                    width: canvas.width,
                    height: canvas.height,
                    success: true
                };
            } catch (e) {
                return { method: 'B', error: e.message };
            }
        })())`,
        awaitPromise: true
    });
    console.log('   方法B (body, onclone):', methodB.result.value);
    
    // 方法C: 截取play-area元素
    const methodC = await Runtime.evaluate({
        expression: `JSON.stringify((async function() {
            const playArea = document.querySelector('.play-area');
            if (!playArea) return { method: 'C', error: 'play-area not found' };
            
            try {
                const canvas = await html2canvas(playArea, {
                    backgroundColor: '#0a0a0f',
                    scale: 0.5,
                    logging: false,
                    useCORS: true,
                    onclone: (clonedDoc) => {
                        const cloned = clonedDoc.querySelector('.play-area');
                        if (cloned) {
                            cloned.style.background = 'linear-gradient(180deg, #0a0a12 0%, #1a1a2e 50%, #0a0a0f 100%)';
                            cloned.style.backgroundImage = 'none';
                            cloned.style.boxShadow = 'none';
                        }
                    }
                });
                return {
                    method: 'C',
                    width: canvas.width,
                    height: canvas.height,
                    success: true
                };
            } catch (e) {
                return { method: 'C', error: e.message };
            }
        })())`,
        awaitPromise: true
    });
    console.log('   方法C (play-area):', methodC.result.value);
    
    // Step 6: 生成实际截图对比
    console.log('\n7. 生成截图对比...');
    
    // 原始方法截图
    const originalScreenshot = await Runtime.evaluate({
        expression: `(async function() {
            const canvas = await html2canvas(document.body, {
                backgroundColor: '#1a1a2e',
                scale: 0.8,
                logging: false,
                useCORS: true
            });
            return canvas.toDataURL('image/png');
        })()`,
        awaitPromise: true
    });
    
    if (originalScreenshot.result.value && originalScreenshot.result.value.includes('base64,')) {
        const base64Data = originalScreenshot.result.value.split('base64,')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync('test-results/analysis-original-method.png', buffer);
        console.log('   保存: test-results/analysis-original-method.png');
    }
    
    // 修复方法截图
    const fixedScreenshot = await Runtime.evaluate({
        expression: `(async function() {
            const canvas = await html2canvas(document.body, {
                backgroundColor: '#0a0a0f',
                scale: 0.8,
                logging: false,
                useCORS: true,
                onclone: (clonedDoc) => {
                    const body = clonedDoc.body;
                    body.style.background = 'linear-gradient(180deg, #0a0a12 0%, #1a1a2e 50%, #0a0a0f 100%)';
                    body.style.backgroundImage = 'none';
                    body.style.boxShadow = 'none';
                    
                    // 移除所有backdrop-filter
                    clonedDoc.querySelectorAll('*').forEach(el => {
                        el.style.backdropFilter = 'none';
                        el.style.webkitBackdropFilter = 'none';
                    });
                }
            });
            return canvas.toDataURL('image/png');
        })()`,
        awaitPromise: true
    });
    
    if (fixedScreenshot.result.value && fixedScreenshot.result.value.includes('base64,')) {
        const base64Data = fixedScreenshot.result.value.split('base64,')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync('test-results/analysis-fixed-method.png', buffer);
        console.log('   保存: test-results/analysis-fixed-method.png');
    }
    
    // 浏览器截图
    const { data: browserScreenshot } = await Page.captureScreenshot();
    fs.writeFileSync('test-results/analysis-browser.png', Buffer.from(browserScreenshot, 'base64'));
    console.log('   保存: test-results/analysis-browser.png');
    
    await client.close();
    
    console.log('\n=== 分析完成 ===');
    console.log('\n对比文件:');
    console.log('  - test-results/analysis-original-method.png (原始方法)');
    console.log('  - test-results/analysis-fixed-method.png (修复方法)');
    console.log('  - test-results/analysis-browser.png (浏览器视图)');
    console.log('\n请打开这些文件对比查看差异');
}

main().catch(err => {
    console.error('错误:', err);
    process.exit(1);
});
