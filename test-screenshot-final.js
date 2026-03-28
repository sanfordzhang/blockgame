/**
 * 验证截图修复 - 在实际游戏页面上测试
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const PLAYER2_ADDRESS = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function main() {
    console.log('=== 验证截图修复 ===\n');
    
    // Step 1: 创建锦标赛
    console.log('1. 创建锦标赛...');
    const createResponse = await fetch('http://127.0.0.1:7778/api/tournament/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            configId: 3,
            walletAddress: PLAYER1_ADDRESS,
            mockGame: true
        })
    });
    const createData = await createResponse.json();
    const tournamentId = createData.tournament.tournamentId || createData.tournament.id;
    console.log('   锦标赛ID:', tournamentId);
    
    // Step 2: 玩家2加入
    console.log('\n2. 玩家2加入...');
    await fetch(`http://127.0.0.1:7778/api/tournament/${tournamentId}/join`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-wallet-address': PLAYER2_ADDRESS 
        },
        body: JSON.stringify({ walletAddress: PLAYER2_ADDRESS })
    });
    console.log('   已加入');
    
    // Step 3: 连接浏览器
    console.log('\n3. 导航到游戏页面...');
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();
    
    await Page.navigate({ url: `http://127.0.0.1:3001/tournament/${tournamentId}?address=${PLAYER1_ADDRESS}` });
    await sleep(5000);
    
    // Step 4: 检查游戏状态
    const stateResult = await Runtime.evaluate({
        expression: `JSON.stringify({
            hasPlayArea: !!document.querySelector('.play-area'),
            playAreaSize: (function() {
                const el = document.querySelector('.play-area');
                return el ? { w: el.offsetWidth, h: el.offsetHeight } : null;
            })(),
            containerSize: (function() {
                const el = document.querySelector('[class*="Container"]');
                return el ? { w: el.offsetWidth, h: el.offsetHeight } : null;
            })()
        })`
    });
    const state = JSON.parse(stateResult.result.value || '{}');
    console.log('   页面状态:', JSON.stringify(state, null, 2));
    
    // Step 5: 浏览器截图
    console.log('\n4. 浏览器截图...');
    const { data: browserScreenshot } = await Page.captureScreenshot();
    fs.writeFileSync('test-results/fix-browser.png', Buffer.from(browserScreenshot, 'base64'));
    console.log('   保存: test-results/fix-browser.png');
    
    // Step 6: 注入html2canvas
    console.log('\n5. 测试修复后的截图...');
    await Runtime.evaluate({
        expression: `(function() {
            return new Promise((resolve) => {
                if (typeof html2canvas !== 'undefined') {
                    resolve('loaded');
                    return;
                }
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                script.onload = () => resolve('loaded');
                document.head.appendChild(script);
            });
        })()`,
        awaitPromise: true
    });
    
    // Step 7: 执行截图（使用修复后的配置）
    const screenshotResult = await Runtime.evaluate({
        expression: `(async function() {
            // 查找合适的元素
            const gameElement = document.querySelector('.play-area') || 
                               document.querySelector('[class*="PokerTableWrapper"]') ||
                               document.querySelector('[class*="Container"]');
            
            if (!gameElement) {
                return { error: 'No game element found' };
            }
            
            const elementWidth = gameElement.offsetWidth;
            const elementHeight = gameElement.offsetHeight;
            
            console.log('截图目标:', elementWidth, 'x', elementHeight);
            
            const canvas = await html2canvas(gameElement, {
                backgroundColor: '#0a0a0f',
                scale: 1.0,
                logging: false,
                useCORS: true,
                allowTaint: true,
                width: Math.min(elementWidth, 1920),
                height: Math.min(elementHeight, 1080),
                windowWidth: elementWidth,
                windowHeight: elementHeight,
                x: 0,
                y: 0,
                scrollX: 0,
                scrollY: 0,
                onclone: (clonedDoc) => {
                    const clonedElement = clonedDoc.querySelector('.play-area') || 
                                         clonedDoc.querySelector('[class*="PokerTableWrapper"]') ||
                                         clonedDoc.querySelector('[class*="Container"]');
                    if (clonedElement) {
                        clonedElement.style.background = 'linear-gradient(180deg, #0a0a12 0%, #1a1a2e 50%, #0a0a0f 100%)';
                        clonedElement.style.backgroundImage = 'none';
                        clonedElement.style.boxShadow = 'none';
                        clonedElement.style.filter = 'none';
                        clonedElement.style.overflow = 'hidden';
                    }
                    
                    const style = clonedDoc.createElement('style');
                    style.textContent = \`
                        .play-area::before,
                        .play-area::after {
                            display: none !important;
                            content: none !important;
                        }
                    \`;
                    clonedDoc.head.appendChild(style);
                }
            });
            
            return {
                success: true,
                width: canvas.width,
                height: canvas.height,
                dataUrl: canvas.toDataURL('image/png')
            };
        })()`,
        awaitPromise: true
    });
    
    if (screenshotResult.result.value?.success) {
        const base64Data = screenshotResult.result.value.dataUrl.split('base64,')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync('test-results/fix-screenshot.png', buffer);
        console.log('   保存: test-results/fix-screenshot.png');
        console.log('   尺寸:', screenshotResult.result.value.width, 'x', screenshotResult.result.value.height);
    } else {
        console.log('   错误:', screenshotResult.result.value?.error);
    }
    
    await client.close();
    console.log('\n=== 验证完成 ===');
    console.log('\n对比文件:');
    console.log('  - test-results/fix-browser.png (浏览器截图)');
    console.log('  - test-results/fix-screenshot.png (修复后截图)');
    console.log('\n截图尺寸应该是合理的（如 1200x800 左右），而不是几千或几万像素');
}

main().catch(err => {
    console.error('错误:', err);
    process.exit(1);
});
