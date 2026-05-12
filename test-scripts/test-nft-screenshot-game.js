/**
 * 完整NFT截图测试 - 触发游戏并分析截图
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const PLAYER2_ADDRESS = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';
const SERVER_URL = 'http://127.0.0.1:7778';
const FRONTEND_URL = 'http://127.0.0.1:3001';

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function main() {
    console.log('=== 完整NFT截图测试 ===\n');
    
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
        console.error('创建锦标赛失败:', createData);
        return;
    }
    
    const tournamentId = createData.tournament.tournamentId || createData.tournament.id;
    console.log(`   锦标赛ID: ${tournamentId}`);
    
    // Step 2: 连接Chrome CDP
    console.log('\n2. 连接Chrome CDP...');
    const client = await CDP({ port: 9222 });
    const { Page, Runtime, DOM, Input } = client;
    await Page.enable();
    await Runtime.enable();
    await DOM.enable();
    
    // Step 3: 玩家1加入锦标赛
    console.log('\n3. 玩家1加入锦标赛...');
    await Page.navigate({ url: `${FRONTEND_URL}/tournament/${tournamentId}?address=${PLAYER1_ADDRESS}` });
    await sleep(3000);
    
    // 截图当前状态
    const { data: screenshot1 } = await Page.captureScreenshot();
    fs.writeFileSync('test-results/nft-test-01-joined.png', Buffer.from(screenshot1, 'base64'));
    console.log('   截图: test-results/nft-test-01-joined.png');
    
    // Step 4: 玩家2通过API加入
    console.log('\n4. 玩家2加入锦标赛...');
    const joinResponse = await fetch(`${SERVER_URL}/api/tournament/${tournamentId}/join`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-wallet-address': PLAYER2_ADDRESS
        },
        body: JSON.stringify({
            walletAddress: PLAYER2_ADDRESS
        })
    });
    const joinData = await joinResponse.json();
    console.log('   加入结果:', joinData.success ? '成功' : joinData.error);
    
    await sleep(2000);
    
    // Step 5: 等待游戏开始
    console.log('\n5. 等待游戏开始...');
    await Page.navigate({ url: `${FRONTEND_URL}/tournament/${tournamentId}?address=${PLAYER1_ADDRESS}` });
    await sleep(5000);
    
    // 截图游戏状态
    const { data: screenshot2 } = await Page.captureScreenshot();
    fs.writeFileSync('test-results/nft-test-02-game.png', Buffer.from(screenshot2, 'base64'));
    console.log('   截图: test-results/nft-test-02-game.png');
    
    // 检查游戏状态
    const gameStateResult = await Runtime.evaluate({
        expression: `JSON.stringify({
            hasPlayArea: !!document.querySelector('.play-area'),
            hasPokerTable: !!document.querySelector('.poker-table-wrapper'),
            hasSeats: document.querySelectorAll('[class*="Seat"]').length,
            bodyText: document.body.innerText.substring(0, 200)
        })`
    });
    const gameState = JSON.parse(gameStateResult.result.value || '{}');
    console.log('   游戏状态:', JSON.stringify(gameState, null, 2));
    
    // Step 6: 模拟游戏操作直到完成
    console.log('\n6. 模拟游戏操作...');
    
    // 获取所有按钮
    let round = 0;
    const maxRounds = 50;
    
    while (round < maxRounds) {
        round++;
        
        // 检查是否有操作按钮
        const buttonResult = await Runtime.evaluate({
            expression: `JSON.stringify((function() {
                const buttons = Array.from(document.querySelectorAll('button'));
                const checkBtn = buttons.find(b => /check/i.test(b.innerText));
                const callBtn = buttons.find(b => /call/i.test(b.innerText));
                const raiseBtn = buttons.find(b => /raise/i.test(b.innerText));
                const foldBtn = buttons.find(b => /fold/i.test(b.innerText));
                const mintBtn = buttons.find(b => /mint|nft|铸造/i.test(b.innerText));
                const confirmBtn = buttons.find(b => /confirm|ok|确定|yes/i.test(b.innerText));
                
                return {
                    hasCheck: !!checkBtn,
                    hasCall: !!callBtn,
                    hasRaise: !!raiseBtn,
                    hasFold: !!foldBtn,
                    hasMint: !!mintBtn,
                    hasConfirm: !!confirmBtn,
                    buttonTexts: buttons.map(b => b.innerText.trim()).filter(t => t).slice(0, 10)
                };
            })())`
        });
        
        const buttons = JSON.parse(buttonResult.result.value || '{}');
        
        // 检查是否有NFT弹窗
        if (buttons.hasMint || buttons.hasConfirm) {
            console.log(`   [Round ${round}] 发现NFT/确认按钮!`);
            
            // 点击Mint按钮
            if (buttons.hasMint) {
                await Runtime.evaluate({
                    expression: `(function() {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const mintBtn = buttons.find(b => /mint|nft|铸造/i.test(b.innerText));
                        if (mintBtn) {
                            console.log('点击Mint按钮:', mintBtn.innerText);
                            mintBtn.click();
                            return true;
                        }
                        return false;
                    })()`
                });
                await sleep(3000);
                
                // 截图NFT弹窗
                const { data: screenshot3 } = await Page.captureScreenshot();
                fs.writeFileSync('test-results/nft-test-03-mint-click.png', Buffer.from(screenshot3, 'base64'));
                console.log('   截图: test-results/nft-test-03-mint-click.png');
            }
            
            // 点击确认按钮
            if (buttons.hasConfirm) {
                await Runtime.evaluate({
                    expression: `(function() {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const confirmBtn = buttons.find(b => /confirm|ok|确定|yes/i.test(b.innerText));
                        if (confirmBtn) {
                            confirmBtn.click();
                            return true;
                        }
                        return false;
                    })()`
                });
                await sleep(2000);
            }
            
            continue;
        }
        
        // 游戏操作
        if (buttons.hasCheck || buttons.hasCall || buttons.hasFold) {
            console.log(`   [Round ${round}] 游戏操作按钮:`, buttons.buttonTexts.slice(0, 5));
            
            // 优先check，其次call，最后fold
            if (buttons.hasCheck) {
                await Runtime.evaluate({
                    expression: `(function() {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const checkBtn = buttons.find(b => /check/i.test(b.innerText));
                        if (checkBtn) { checkBtn.click(); return 'check'; }
                        return null;
                    })()`
                });
            } else if (buttons.hasCall) {
                await Runtime.evaluate({
                    expression: `(function() {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const callBtn = buttons.find(b => /call/i.test(b.innerText));
                        if (callBtn) { callBtn.click(); return 'call'; }
                        return null;
                    })()`
                });
            } else if (buttons.hasFold) {
                await Runtime.evaluate({
                    expression: `(function() {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const foldBtn = buttons.find(b => /fold/i.test(b.innerText));
                        if (foldBtn) { foldBtn.click(); return 'fold'; }
                        return null;
                    })()`
                });
            }
            
            await sleep(1500);
        } else {
            // 没有操作按钮，检查游戏是否结束
            const endResult = await Runtime.evaluate({
                expression: `JSON.stringify({
                    hasTournamentEnd: document.body.innerText.includes('Tournament Ended') || 
                                     document.body.innerText.includes('Winner') ||
                                     document.body.innerText.includes('Game Over'),
                    hasNFTGallery: window.location.pathname.includes('/nft')
                })`
            });
            
            const endState = JSON.parse(endResult.result.value || '{}');
            
            if (endState.hasTournamentEnd) {
                console.log(`   [Round ${round}] 游戏结束!`);
                break;
            }
            
            await sleep(1000);
        }
    }
    
    // Step 7: 检查NFT Gallery
    console.log('\n7. 检查NFT Gallery...');
    await Page.navigate({ url: `${FRONTEND_URL}/nft?address=${PLAYER1_ADDRESS}` });
    await sleep(4000);
    
    // 截图NFT Gallery
    const { data: screenshot4 } = await Page.captureScreenshot();
    fs.writeFileSync('test-results/nft-test-04-gallery.png', Buffer.from(screenshot4, 'base64'));
    console.log('   截图: test-results/nft-test-04-gallery.png');
    
    // 检查NFT截图
    const nftResult = await Runtime.evaluate({
        expression: `JSON.stringify((function() {
            const images = document.querySelectorAll('img[src^="data:image"]');
            return {
                screenshotCount: images.length,
                screenshots: Array.from(images).map((img, i) => ({
                    index: i,
                    srcLength: img.src.length,
                    width: img.naturalWidth,
                    height: img.naturalHeight
                }))
            };
        })())`
    });
    
    const nftData = JSON.parse(nftResult.result.value || '{}');
    console.log('   NFT截图:', JSON.stringify(nftData, null, 2));
    
    // Step 8: 分析最新NFT截图
    console.log('\n8. 分析最新NFT截图...');
    
    // 从API获取最新NFT
    const apiResponse = await fetch(`${SERVER_URL}/api/nft/collection/${PLAYER1_ADDRESS}`);
    const apiData = await apiResponse.json();
    
    if (apiData.success && apiData.nfts && apiData.nfts.length > 0) {
        const latestNft = apiData.nfts[0];
        console.log('   最新NFT:', {
            id: latestNft.id,
            type: latestNft.achievementType,
            hasScreenshot: !!latestNft.gameScreenshot,
            screenshotLength: latestNft.gameScreenshot?.length || 0
        });
        
        if (latestNft.gameScreenshot && latestNft.gameScreenshot.length > 100) {
            const buffer = Buffer.from(latestNft.gameScreenshot, 'base64');
            const outputPath = 'test-results/nft-test-latest-screenshot.png';
            fs.writeFileSync(outputPath, buffer);
            console.log('   保存最新截图:', outputPath);
            
            // 分析PNG
            const width = buffer.readUInt32BE(16);
            const height = buffer.readUInt32BE(20);
            console.log('   截图尺寸:', width, 'x', height);
        }
    }
    
    await client.close();
    
    console.log('\n=== 测试完成 ===');
    console.log('\n生成的截图文件:');
    console.log('  - test-results/nft-test-01-joined.png');
    console.log('  - test-results/nft-test-02-game.png');
    console.log('  - test-results/nft-test-03-mint-click.png');
    console.log('  - test-results/nft-test-04-gallery.png');
    console.log('  - test-results/nft-test-latest-screenshot.png');
}

main().catch(err => {
    console.error('错误:', err);
    process.exit(1);
});
