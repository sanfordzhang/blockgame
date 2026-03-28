/**
 * 完整截图测试 - 在游戏页面上生成截图并对比
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');
const { execSync } = require('child_process');

const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const PLAYER2_ADDRESS = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function main() {
    console.log('=== 完整游戏截图测试 ===\n');
    
    // Step 1: 创建锦标赛
    console.log('1. 创建2人锦标赛...');
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
    
    if (!createData.success) {
        console.error('创建锦标赛失败:', createData);
        return;
    }
    
    const tournamentId = createData.tournament.tournamentId || createData.tournament.id;
    console.log('   锦标赛ID:', tournamentId);
    
    // Step 2: 启动机器人作为玩家2
    console.log('\n2. 启动机器人...');
    const botProcess = execSync(`JOIN_TOURNAMENT_ID=${tournamentId} node scripts/game-bot.js &`, {
        detached: true,
        stdio: 'ignore'
    });
    console.log('   机器人已启动');
    
    await sleep(2000);
    
    // Step 3: 连接Chrome CDP
    console.log('\n3. 连接Chrome CDP...');
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();
    
    // Step 4: 玩家1加入游戏
    console.log('\n4. 玩家1加入游戏...');
    await Page.navigate({ url: `http://127.0.0.1:3001/tournament/${tournamentId}?address=${PLAYER1_ADDRESS}` });
    await sleep(5000);
    
    // 检查游戏状态
    const gameStateResult = await Runtime.evaluate({
        expression: `JSON.stringify({
            hasPlayArea: !!document.querySelector('.play-area'),
            hasPokerTable: !!document.querySelector('.poker-table-wrapper'),
            hasSeats: document.querySelectorAll('[class*="Seat"], [class*="seat"]').length,
            bodyText: document.body.innerText.substring(0, 300)
        })`
    });
    const gameState = JSON.parse(gameStateResult.result.value || '{}');
    console.log('   游戏状态:', JSON.stringify(gameState, null, 2));
    
    // 浏览器截图
    const { data: browserScreenshot } = await Page.captureScreenshot();
    fs.writeFileSync('test-results/game-browser-view.png', Buffer.from(browserScreenshot, 'base64'));
    console.log('   浏览器截图: test-results/game-browser-view.png');
    
    // Step 5: 注入html2canvas
    console.log('\n5. 注入html2canvas...');
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
    
    // Step 6: 测试不同截图方法
    console.log('\n6. 测试截图方法...');
    
    // 方法1: 截取整个页面
    console.log('   方法1: 截取整个页面...');
    const method1 = await Runtime.evaluate({
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
    
    if (method1.result.value && method1.result.value.includes('base64,')) {
        const base64Data = method1.result.value.split('base64,')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync('test-results/game-method1-fullpage.png', buffer);
        console.log('   保存: test-results/game-method1-fullpage.png');
    }
    
    // 方法2: 截取play-area元素（如果有）
    console.log('   方法2: 截取play-area元素...');
    const method2 = await Runtime.evaluate({
        expression: `(async function() {
            const playArea = document.querySelector('.play-area');
            if (!playArea) return null;
            
            const canvas = await html2canvas(playArea, {
                backgroundColor: '#1a1a2e',
                scale: 1.0,
                logging: false,
                useCORS: true
            });
            return canvas.toDataURL('image/png');
        })()`,
        awaitPromise: true
    });
    
    if (method2.result.value && method2.result.value.includes && method2.result.value.includes('base64,')) {
        const base64Data = method2.result.value.split('base64,')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync('test-results/game-method2-playarea.png', buffer);
        console.log('   保存: test-results/game-method2-playarea.png');
    } else {
        console.log('   play-area元素未找到');
    }
    
    // 方法3: 使用修复后的配置
    console.log('   方法3: 使用修复配置...');
    const method3 = await Runtime.evaluate({
        expression: `(async function() {
            const targetElement = document.querySelector('.play-area') || document.body;
            
            const canvas = await html2canvas(targetElement, {
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
                    
                    // 移除伪元素影响
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
            return canvas.toDataURL('image/png');
        })()`,
        awaitPromise: true
    });
    
    if (method3.result.value && method3.result.value.includes('base64,')) {
        const base64Data = method3.result.value.split('base64,')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync('test-results/game-method3-fixed.png', buffer);
        console.log('   保存: test-results/game-method3-fixed.png');
    }
    
    // Step 7: 等待游戏进行，捕获NFT时刻
    console.log('\n7. 等待游戏进行...');
    
    let round = 0;
    const maxRounds = 30;
    
    while (round < maxRounds) {
        round++;
        await sleep(2000);
        
        // 检查是否有NFT弹窗
        const checkResult = await Runtime.evaluate({
            expression: `JSON.stringify({
                hasNFTPopup: document.body.innerText.includes('成就') || 
                            document.body.innerText.includes('Achievement') ||
                            document.body.innerText.includes('NFT'),
                hasMintButton: Array.from(document.querySelectorAll('button')).some(b => 
                    /mint|铸造|nft/i.test(b.innerText)
                ),
                gameStatus: document.body.innerText.includes('Pre-Flop') || 
                           document.body.innerText.includes('Flop') ||
                           document.body.innerText.includes('Turn') ||
                           document.body.innerText.includes('River')
            })`
        });
        
        const status = JSON.parse(checkResult.result.value || '{}');
        
        if (status.hasNFTPopup || status.hasMintButton) {
            console.log(`   [Round ${round}] 发现NFT弹窗!`);
            
            // 截图NFT弹窗
            const { data: nftScreenshot } = await Page.captureScreenshot();
            fs.writeFileSync(`test-results/game-nft-popup-${round}.png`, Buffer.from(nftScreenshot, 'base64'));
            console.log(`   保存: test-results/game-nft-popup-${round}.png`);
            
            // 点击Mint按钮
            if (status.hasMintButton) {
                await Runtime.evaluate({
                    expression: `(function() {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const mintBtn = buttons.find(b => /mint|铸造|nft/i.test(b.innerText));
                        if (mintBtn) mintBtn.click();
                    })()`
                });
                await sleep(3000);
            }
        }
        
        // 检查游戏是否结束
        const endCheck = await Runtime.evaluate({
            expression: `JSON.stringify({
                hasWinner: document.body.innerText.includes('Winner'),
                hasGameOver: document.body.innerText.includes('Game Over'),
                hasEnded: document.body.innerText.includes('Tournament Ended')
            })`
        });
        const endStatus = JSON.parse(endCheck.result.value || '{}');
        
        if (endStatus.hasWinner || endStatus.hasGameOver || endStatus.hasEnded) {
            console.log('   游戏结束!');
            break;
        }
    }
    
    // Step 8: 检查NFT Gallery
    console.log('\n8. 检查NFT Gallery...');
    await Page.navigate({ url: `http://127.0.0.1:3001/nft?address=${PLAYER1_ADDRESS}` });
    await sleep(3000);
    
    // 截图NFT Gallery
    const { data: galleryScreenshot } = await Page.captureScreenshot();
    fs.writeFileSync('test-results/game-nft-gallery.png', Buffer.from(galleryScreenshot, 'base64'));
    console.log('   保存: test-results/game-nft-gallery.png');
    
    // 检查新生成的NFT截图
    const apiResponse = await fetch(`http://127.0.0.1:7778/api/nft/collection/${PLAYER1_ADDRESS}`);
    const apiData = await apiResponse.json();
    
    if (apiData.success && apiData.nfts && apiData.nfts.length > 0) {
        const latestNft = apiData.nfts[0];
        console.log('   最新NFT:', {
            id: latestNft.id,
            type: latestNft.achievementType,
            gameId: latestNft.gameId,
            hasScreenshot: !!latestNft.gameScreenshot,
            screenshotLength: latestNft.gameScreenshot?.length || 0
        });
        
        // 如果有新截图，保存它
        if (latestNft.gameScreenshot && latestNft.gameScreenshot.length > 100) {
            // 检查是否是新截图（对比之前的ID）
            const buffer = Buffer.from(latestNft.gameScreenshot, 'base64');
            fs.writeFileSync('test-results/game-latest-nft-screenshot.png', buffer);
            console.log('   保存: test-results/game-latest-nft-screenshot.png');
            
            const width = buffer.readUInt32BE(16);
            const height = buffer.readUInt32BE(20);
            console.log('   尺寸:', width, 'x', height);
        }
    }
    
    await client.close();
    
    console.log('\n=== 测试完成 ===');
    console.log('\n生成的文件:');
    console.log('  - test-results/game-browser-view.png (浏览器视图)');
    console.log('  - test-results/game-method1-fullpage.png (整页截图)');
    console.log('  - test-results/game-method2-playarea.png (play-area截图)');
    console.log('  - test-results/game-method3-fixed.png (修复方法截图)');
    console.log('  - test-results/game-nft-gallery.png (NFT Gallery)');
    console.log('  - test-results/game-latest-nft-screenshot.png (最新NFT截图)');
}

main().catch(err => {
    console.error('错误:', err);
    process.exit(1);
});
