/**
 * 在正确游戏页面上测试截图
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function main() {
    console.log('=== 游戏页面截图测试 ===\n');
    
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
    
    // Step 2: 直接导航到游戏页面
    console.log('\n2. 直接导航到游戏页面...');
    const client = await CDP({ port: 9222 });
    const { Page, Runtime, Console } = client;
    await Page.enable();
    await Runtime.enable();
    Console.enable();
    
    Console.messageAdded((params) => {
        if (params.message.text.includes('截图') || params.message.text.includes('html2canvas')) {
            console.log('[浏览器]', params.message.text);
        }
    });
    
    const gameUrl = `http://127.0.0.1:3001/tournament/${tournamentId}?address=${PLAYER1_ADDRESS}`;
    console.log('   URL:', gameUrl);
    await Page.navigate({ url: gameUrl });
    await sleep(5000);
    
    // Step 3: 检查游戏状态
    console.log('\n3. 检查游戏状态...');
    const gameState = await Runtime.evaluate({
        expression: `JSON.stringify({
            hasPlayArea: !!document.querySelector('.play-area'),
            hasPokerTable: !!document.querySelector('.poker-table-wrapper'),
            playAreaSize: (function() {
                const el = document.querySelector('.play-area');
                return el ? { width: el.offsetWidth, height: el.offsetHeight } : null;
            })(),
            bodyText: document.body.innerText.substring(0, 200)
        })`
    });
    console.log('   状态:', gameState.result.value);
    
    // Step 4: 浏览器截图
    console.log('\n4. 浏览器截图...');
    const { data: browserScreenshot } = await Page.captureScreenshot();
    fs.writeFileSync('test-results/gamepage-browser.png', Buffer.from(browserScreenshot, 'base64'));
    console.log('   保存: test-results/gamepage-browser.png');
    
    // Step 5: 注入html2canvas
    console.log('\n5. 注入html2canvas...');
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
                script.onerror = () => resolve('error');
                document.head.appendChild(script);
            });
        })()`,
        awaitPromise: true
    });
    
    // Step 6: 截取play-area
    console.log('\n6. 截取play-area...');
    const playAreaResult = await Runtime.evaluate({
        expression: `(async function() {
            const playArea = document.querySelector('.play-area');
            if (!playArea) {
                return { error: 'play-area not found' };
            }
            
            console.log('play-area尺寸:', playArea.offsetWidth, 'x', playArea.offsetHeight);
            
            const canvas = await html2canvas(playArea, {
                backgroundColor: '#0a0a0f',
                scale: 1.0,
                logging: true,
                useCORS: true,
                allowTaint: true,
                onclone: (clonedDoc) => {
                    const cloned = clonedDoc.querySelector('.play-area');
                    if (cloned) {
                        cloned.style.background = 'linear-gradient(180deg, #0a0a12 0%, #1a1a2e 50%, #0a0a0f 100%)';
                        cloned.style.backgroundImage = 'none';
                    }
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
    
    if (playAreaResult.result.value?.success) {
        const base64Data = playAreaResult.result.value.dataUrl.split('base64,')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync('test-results/gamepage-playarea.png', buffer);
        console.log('   保存: test-results/gamepage-playarea.png');
        console.log('   尺寸:', playAreaResult.result.value.width, 'x', playAreaResult.result.value.height);
    } else {
        console.log('   错误:', playAreaResult.result.value?.error || '未知错误');
    }
    
    // Step 7: 对比 - 截取整个body看看效果
    console.log('\n7. 对比 - 截取整个body...');
    const bodyResult = await Runtime.evaluate({
        expression: `(async function() {
            const canvas = await html2canvas(document.body, {
                backgroundColor: '#0a0a0f',
                scale: 0.5,
                logging: false,
                useCORS: true
            });
            
            return {
                width: canvas.width,
                height: canvas.height,
                dataUrl: canvas.toDataURL('image/png')
            };
        })()`,
        awaitPromise: true
    });
    
    if (bodyResult.result.value?.dataUrl) {
        const base64Data = bodyResult.result.value.dataUrl.split('base64,')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync('test-results/gamepage-body.png', buffer);
        console.log('   保存: test-results/gamepage-body.png');
        console.log('   尺寸:', bodyResult.result.value.width, 'x', bodyResult.result.value.height);
    }
    
    await client.close();
    
    console.log('\n=== 测试完成 ===');
    console.log('\n对比文件:');
    console.log('  - test-results/gamepage-browser.png (浏览器截图)');
    console.log('  - test-results/gamepage-playarea.png (play-area截图)');
    console.log('  - test-results/gamepage-body.png (整个body截图)');
}

main().catch(err => {
    console.error('错误:', err);
    process.exit(1);
});
