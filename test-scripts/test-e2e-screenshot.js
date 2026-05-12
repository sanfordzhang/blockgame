/**
 * 完整端到端测试 - 验证NFT截图修复
 * 步骤：
 * 1. 创建锦标赛
 * 2. 启动机器人
 * 3. 玩家1加入游戏
 * 4. 游戏进行中测试截图
 * 5. 触发NFT并验证截图
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');
const { spawn } = require('child_process');

const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const SERVER_URL = 'http://127.0.0.1:7778';
const FRONTEND_URL = 'http://127.0.0.1:3001';

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function main() {
    console.log('=== 完整端到端NFT截图测试 ===\n');
    
    let botProcess = null;
    let client = null;
    
    try {
        // Step 1: 创建锦标赛
        console.log('1. 创建2人锦标赛...');
        const createResponse = await fetch(`${SERVER_URL}/api/tournament/create`, {
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
            throw new Error('创建锦标赛失败: ' + JSON.stringify(createData));
        }
        
        const tournamentId = createData.tournament.tournamentId || createData.tournament.id;
        console.log(`   锦标赛ID: ${tournamentId}`);
        
        // Step 2: 启动机器人
        console.log('\n2. 启动机器人...');
        botProcess = spawn('node', ['scripts/game-bot.js'], {
            env: { ...process.env, JOIN_TOURNAMENT_ID: tournamentId },
            detached: true,
            stdio: 'ignore'
        });
        botProcess.unref();
        console.log('   机器人已启动');
        
        await sleep(2000);
        
        // Step 3: 连接Chrome
        console.log('\n3. 连接Chrome CDP...');
        client = await CDP({ port: 9222 });
        const { Page, Runtime } = client;
        await Page.enable();
        await Runtime.enable();
        
        // Step 4: 玩家1加入游戏
        console.log('\n4. 玩家1加入游戏...');
        await Page.navigate({ url: `${FRONTEND_URL}/tournament/${tournamentId}?address=${PLAYER1_ADDRESS}` });
        await sleep(5000);
        
        // 检查游戏状态
        const gameCheck = await Runtime.evaluate({
            expression: `JSON.stringify({
                hasPlayArea: !!document.querySelector('.play-area'),
                hasSeats: document.querySelectorAll('[class*="seat"], [class*="Seat"]').length,
                bodyPreview: document.body.innerText.substring(0, 200)
            })`
        });
        const gameState = JSON.parse(gameCheck.result.value || '{}');
        console.log('   游戏状态:', JSON.stringify(gameState, null, 2));
        
        // Step 5: 浏览器截图
        console.log('\n5. 截取浏览器视图...');
        const { data: browserScreenshot } = await Page.captureScreenshot();
        fs.writeFileSync('test-results/e2e-browser-view.png', Buffer.from(browserScreenshot, 'base64'));
        console.log('   保存: test-results/e2e-browser-view.png');
        
        // Step 6: 注入html2canvas并测试截图
        console.log('\n6. 测试截图方法...');
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
        
        // 测试截图
        const screenshotResult = await Runtime.evaluate({
            expression: `(async function() {
                const gameElement = document.querySelector('.play-area') || document.body;
                
                const canvas = await html2canvas(gameElement, {
                    backgroundColor: '#0a0a0f',
                    scale: 1.0,
                    logging: false,
                    useCORS: true,
                    allowTaint: true,
                    onclone: (clonedDoc) => {
                        const clonedElement = clonedDoc.querySelector('.play-area');
                        if (clonedElement) {
                            clonedElement.style.background = 'linear-gradient(180deg, #0a0a12 0%, #1a1a2e 50%, #0a0a0f 100%)';
                            clonedElement.style.backgroundImage = 'none';
                            clonedElement.style.boxShadow = 'none';
                            clonedElement.style.filter = 'none';
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
                        
                        clonedDoc.querySelectorAll('[style*="backdrop"], [style*="filter"]').forEach(el => {
                            el.style.backdropFilter = 'none';
                            el.style.webkitBackdropFilter = 'none';
                            el.style.filter = 'none';
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
        
        if (screenshotResult.result.value && screenshotResult.result.value.dataUrl) {
            const base64Data = screenshotResult.result.value.dataUrl.split('base64,')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync('test-results/e2e-screenshot-test.png', buffer);
            console.log('   保存: test-results/e2e-screenshot-test.png');
            console.log('   尺寸:', screenshotResult.result.value.width, 'x', screenshotResult.result.value.height);
        }
        
        // Step 7: 等待游戏进行并检查NFT
        console.log('\n7. 等待游戏进行...');
        
        for (let i = 0; i < 20; i++) {
            await sleep(3000);
            
            // 检查是否有NFT弹窗或游戏结束
            const checkResult = await Runtime.evaluate({
                expression: `JSON.stringify({
                    hasNFT: document.body.innerText.includes('成就') || 
                           document.body.innerText.includes('Achievement'),
                    hasMintButton: Array.from(document.querySelectorAll('button')).some(b => 
                        /mint|铸造/i.test(b.innerText)
                    ),
                    isGameEnd: document.body.innerText.includes('Winner') ||
                              document.body.innerText.includes('Ended')
                })`
            });
            
            const status = JSON.parse(checkResult.result.value || '{}');
            console.log(`   [${i+1}/20] NFT弹窗: ${status.hasNFT}, Mint按钮: ${status.hasMintButton}, 游戏结束: ${status.isGameEnd}`);
            
            if (status.hasMintButton) {
                console.log('   发现Mint按钮!');
                
                // 截图NFT弹窗
                const { data: nftScreenshot } = await Page.captureScreenshot();
                fs.writeFileSync('test-results/e2e-nft-popup.png', Buffer.from(nftScreenshot, 'base64'));
                console.log('   保存: test-results/e2e-nft-popup.png');
                
                // 点击Mint按钮
                await Runtime.evaluate({
                    expression: `(function() {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const mintBtn = buttons.find(b => /mint|铸造/i.test(b.innerText));
                        if (mintBtn) {
                            mintBtn.click();
                            return mintBtn.innerText;
                        }
                        return null;
                    })()`
                });
                
                await sleep(3000);
            }
            
            if (status.isGameEnd) {
                console.log('   游戏已结束');
                break;
            }
        }
        
        // Step 8: 检查NFT Gallery
        console.log('\n8. 检查NFT Gallery...');
        await Page.navigate({ url: `${FRONTEND_URL}/nft?address=${PLAYER1_ADDRESS}` });
        await sleep(3000);
        
        const { data: galleryScreenshot } = await Page.captureScreenshot();
        fs.writeFileSync('test-results/e2e-nft-gallery.png', Buffer.from(galleryScreenshot, 'base64'));
        console.log('   保存: test-results/e2e-nft-gallery.png');
        
        // Step 9: 获取最新NFT截图
        console.log('\n9. 获取最新NFT截图...');
        const apiResponse = await fetch(`${SERVER_URL}/api/nft/collection/${PLAYER1_ADDRESS}`);
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
            
            if (latestNft.gameScreenshot && latestNft.gameScreenshot.length > 100) {
                const buffer = Buffer.from(latestNft.gameScreenshot, 'base64');
                fs.writeFileSync('test-results/e2e-latest-nft.png', buffer);
                
                const width = buffer.readUInt32BE(16);
                const height = buffer.readUInt32BE(20);
                console.log('   保存: test-results/e2e-latest-nft.png');
                console.log('   尺寸:', width, 'x', height);
            }
        }
        
        console.log('\n=== 测试完成 ===');
        console.log('\n生成的文件:');
        console.log('  - test-results/e2e-browser-view.png (浏览器视图)');
        console.log('  - test-results/e2e-screenshot-test.png (截图测试)');
        console.log('  - test-results/e2e-nft-popup.png (NFT弹窗)');
        console.log('  - test-results/e2e-nft-gallery.png (NFT Gallery)');
        console.log('  - test-results/e2e-latest-nft.png (最新NFT截图)');
        
    } catch (err) {
        console.error('错误:', err.message);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

main().catch(console.error);
