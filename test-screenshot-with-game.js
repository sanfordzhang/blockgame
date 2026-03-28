/**
 * 完整游戏截图测试 - 确保游戏开始后再截图
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');
const { spawn } = require('child_process');

const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const PLAYER2_ADDRESS = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function main() {
    console.log('=== 完整游戏截图测试 ===\n');
    
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
    
    // Step 2: 玩家2加入（通过API）
    console.log('\n2. 玩家2加入锦标赛...');
    const joinResponse = await fetch(`http://127.0.0.1:7778/api/tournament/${tournamentId}/join`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-wallet-address': PLAYER2_ADDRESS 
        },
        body: JSON.stringify({ walletAddress: PLAYER2_ADDRESS })
    });
    const joinData = await joinResponse.json();
    console.log('   加入结果:', joinData.success ? '成功' : joinData.error);
    
    // Step 3: 连接Chrome
    console.log('\n3. 导航到游戏页面...');
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();
    
    const gameUrl = `http://127.0.0.1:3001/tournament/${tournamentId}?address=${PLAYER1_ADDRESS}`;
    await Page.navigate({ url: gameUrl });
    await sleep(5000);
    
    // Step 4: 检查游戏状态
    console.log('\n4. 检查游戏状态...');
    let hasPlayArea = false;
    for (let i = 0; i < 10; i++) {
        const stateResult = await Runtime.evaluate({
            expression: `JSON.stringify({
                hasPlayArea: !!document.querySelector('.play-area'),
                bodyText: document.body.innerText.substring(0, 150)
            })`
        });
        const state = JSON.parse(stateResult.result.value || '{}');
        console.log(`   [${i+1}/10] hasPlayArea: ${state.hasPlayArea}`);
        
        if (state.hasPlayArea) {
            hasPlayArea = true;
            console.log('   bodyText:', state.bodyText);
            break;
        }
        
        await sleep(2000);
    }
    
    if (!hasPlayArea) {
        console.log('   游戏未开始，无法测试截图');
        await client.close();
        return;
    }
    
    // Step 5: 浏览器截图
    console.log('\n5. 浏览器截图...');
    const { data: browserScreenshot } = await Page.captureScreenshot();
    fs.writeFileSync('test-results/complete-browser.png', Buffer.from(browserScreenshot, 'base64'));
    console.log('   保存: test-results/complete-browser.png');
    
    // Step 6: 注入html2canvas
    console.log('\n6. 测试截图...');
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
    
    // 截取play-area
    const playAreaResult = await Runtime.evaluate({
        expression: `(async function() {
            const playArea = document.querySelector('.play-area');
            if (!playArea) return { error: 'play-area not found' };
            
            const canvas = await html2canvas(playArea, {
                backgroundColor: '#0a0a0f',
                scale: 1.0,
                logging: false,
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
        fs.writeFileSync('test-results/complete-playarea.png', buffer);
        console.log('   保存: test-results/complete-playarea.png');
        console.log('   尺寸:', playAreaResult.result.value.width, 'x', playAreaResult.result.value.height);
    } else {
        console.log('   错误:', playAreaResult.result.value);
    }
    
    // Step 7: 模拟游戏操作
    console.log('\n7. 模拟游戏操作...');
    for (let i = 0; i < 20; i++) {
        await sleep(2000);
        
        // 检查是否有NFT弹窗
        const checkResult = await Runtime.evaluate({
            expression: `JSON.stringify({
                hasMintBtn: Array.from(document.querySelectorAll('button')).some(b => /mint|铸造/i.test(b.innerText)),
                hasGameBtn: Array.from(document.querySelectorAll('button')).some(b => /check|call|fold|raise/i.test(b.innerText)),
                isEnded: document.body.innerText.includes('Winner') || document.body.innerText.includes('Ended')
            })`
        });
        
        const status = JSON.parse(checkResult.result.value || '{}');
        
        if (status.hasMintBtn) {
            console.log('   发现NFT弹窗!');
            const { data: nftPopup } = await Page.captureScreenshot();
            fs.writeFileSync('test-results/complete-nft-popup.png', Buffer.from(nftPopup, 'base64'));
            
            // 点击铸造按钮
            await Runtime.evaluate({
                expression: `(function() {
                    const btn = Array.from(document.querySelectorAll('button')).find(b => /mint|铸造/i.test(b.innerText));
                    if (btn) btn.click();
                })()`
            });
            await sleep(3000);
        }
        
        if (status.hasGameBtn) {
            // 点击check或call
            await Runtime.evaluate({
                expression: `(function() {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const checkBtn = buttons.find(b => /check/i.test(b.innerText));
                    const callBtn = buttons.find(b => /call/i.test(b.innerText));
                    if (checkBtn) checkBtn.click();
                    else if (callBtn) callBtn.click();
                })()`
            });
        }
        
        if (status.isEnded) {
            console.log('   游戏结束');
            break;
        }
    }
    
    // Step 8: 检查最新NFT
    console.log('\n8. 检查最新NFT...');
    await Page.navigate({ url: `http://127.0.0.1:3001/nft?address=${PLAYER1_ADDRESS}` });
    await sleep(3000);
    
    const { data: nftGallery } = await Page.captureScreenshot();
    fs.writeFileSync('test-results/complete-nft-gallery.png', Buffer.from(nftGallery, 'base64'));
    
    // 获取最新NFT截图
    const apiResponse = await fetch(`http://127.0.0.1:7778/api/nft/collection/${PLAYER1_ADDRESS}`);
    const apiData = await apiResponse.json();
    
    if (apiData.success && apiData.nfts?.length > 0) {
        const latestNft = apiData.nfts[0];
        console.log('   最新NFT:', {
            id: latestNft.id,
            type: latestNft.achievementType,
            gameId: latestNft.gameId,
            hasScreenshot: !!latestNft.gameScreenshot,
            screenshotLength: latestNft.gameScreenshot?.length || 0
        });
        
        // 检查是否是新截图
        if (latestNft.gameId?.includes(tournamentId)) {
            console.log('   这是新锦标赛的NFT!');
            if (latestNft.gameScreenshot) {
                const buffer = Buffer.from(latestNft.gameScreenshot, 'base64');
                fs.writeFileSync('test-results/complete-new-nft-screenshot.png', buffer);
                console.log('   保存: test-results/complete-new-nft-screenshot.png');
            }
        } else {
            console.log('   这是旧锦标赛的NFT');
        }
    }
    
    await client.close();
    console.log('\n=== 测试完成 ===');
}

main().catch(err => {
    console.error('错误:', err);
    process.exit(1);
});
