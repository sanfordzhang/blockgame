/**
 * NFT牌型截图测试 - 完整流程
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log('========================================');
    console.log('🎰 NFT牌型截图测试');
    console.log('========================================\n');

    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    
    await Page.enable();
    await Runtime.enable();

    const screenshot = async (name) => {
        const { data } = await Page.captureScreenshot();
        fs.writeFileSync(`test-results/nft-flow-${name}.png`, Buffer.from(data, 'base64'));
        console.log(`📸 nft-flow-${name}.png`);
    };

    const clickBtn = async (text) => {
        return await Runtime.evaluate({
            expression: `(function() {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    if (btn.textContent.includes('${text}') && !btn.disabled) {
                        btn.click();
                        return true;
                    }
                }
                return false;
            })()`,
            returnByValue: true
        });
    };

    const getState = async () => {
        const result = await Runtime.evaluate({
            expression: `({
                url: window.location.href,
                title: document.title,
                buttonTexts: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).slice(0, 15),
                bodyText: document.body.innerText.substring(0, 1000)
            })`,
            returnByValue: true
        });
        return result.result.value;
    };

    try {
        // Step 1: 强制刷新页面
        console.log('📍 Step 1: 刷新锦标赛页面...');
        await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
        await Page.loadEventFired();
        await sleep(3000);
        await screenshot('01-refresh');

        // Step 2: 检查页面状态
        console.log('\n📍 Step 2: 检查页面状态...');
        let state = await getState();
        console.log('   URL:', state.url);
        console.log('   按钮:', state.buttonTexts);
        await screenshot('02-state');

        // Step 3: 查找并点击锦标赛卡片
        console.log('\n📍 Step 3: 查找锦标赛卡片...');
        
        // 尝试多种选择器
        const findResult = await Runtime.evaluate({
            expression: `(function() {
                // 方法1: 查找包含1/2的卡片
                const allCards = document.querySelectorAll('[class*="sc-"]');
                for (const card of allCards) {
                    const text = card.innerText || '';
                    if (text.includes('1 / 2') || text.includes('1/2')) {
                        card.click();
                        return { success: true, method: 'sc-class', text: text.substring(0, 100) };
                    }
                }
                
                // 方法2: 查找所有可点击元素
                const clickables = document.querySelectorAll('[role="button"], [onclick], .card, [class*="Card"], [class*="card"]');
                for (const el of clickables) {
                    const text = el.innerText || '';
                    if (text.includes('WAITING') || text.includes('WAITING') || text.includes('2人')) {
                        el.click();
                        return { success: true, method: 'clickable', text: text.substring(0, 100) };
                    }
                }
                
                // 方法3: 查找锦标赛列表项
                const items = document.querySelectorAll('li, [class*="item"], [class*="Item"]');
                for (const item of items) {
                    const text = item.innerText || '';
                    if (text.includes('TRX') && text.includes('/')) {
                        item.click();
                        return { success: true, method: 'list-item', text: text.substring(0, 100) };
                    }
                }
                
                return { success: false, cards: allCards.length };
            })()`,
            returnByValue: true
        });
        console.log('   查找结果:', findResult.result.value);
        await sleep(1500);
        await screenshot('03-find-card');

        // Step 4: 检查是否需要Confirm
        console.log('\n📍 Step 4: 点击Confirm...');
        const confirmResult = await clickBtn('Confirm');
        console.log('   Confirm:', confirmResult.result.value);
        await sleep(2000);
        await screenshot('04-confirm');

        // Step 5: 检查游戏状态
        console.log('\n📍 Step 5: 检查游戏状态...');
        state = await getState();
        console.log('   URL:', state.url);
        console.log('   按钮:', state.buttonTexts?.slice(0, 10));
        await screenshot('05-game-state');

        // Step 6: 游戏操作
        console.log('\n📍 Step 6: 游戏操作...');
        for (let round = 1; round <= 25; round++) {
            state = await getState();
            const buttons = state.buttonTexts || [];
            
            console.log(`\n--- 回合 ${round} ---`);
            console.log('   按钮数:', buttons.length);
            
            // 检查是否有成就弹窗
            if (state.bodyText?.includes('成就') || state.bodyText?.includes('NFT')) {
                console.log('\n🎉 检测到NFT成就!');
                await screenshot('nft-detected');
                break;
            }
            
            // 检查游戏结束
            if (state.bodyText?.includes('Winner') || state.bodyText?.includes('获胜') || state.bodyText?.includes('结束')) {
                console.log('\n🏆 游戏结束!');
                break;
            }
            
            // 执行操作
            if (buttons.includes('Check')) {
                console.log('   ➡️ Check');
                await clickBtn('Check');
            } else if (buttons.includes('Call')) {
                console.log('   ➡️ Call');
                await clickBtn('Call');
            } else if (buttons.includes('Fold') && !buttons.includes('Check') && !buttons.includes('Call')) {
                console.log('   ➡️ Fold');
                await clickBtn('Fold');
            } else {
                console.log('   ⏳ 等待...');
            }
            
            await sleep(1500);
            
            if (round % 5 === 0) {
                await screenshot(`round-${round}`);
            }
        }

        // Step 7: 最终状态
        console.log('\n📍 Step 7: 最终状态...');
        await sleep(2000);
        state = await getState();
        console.log('   正文预览:', state.bodyText?.substring(0, 300));
        await screenshot('final');

        // Step 8: 如果有NFT成就，点击铸造
        if (state.bodyText?.includes('成就') || state.bodyText?.includes('NFT')) {
            console.log('\n📍 Step 8: 点击铸造NFT...');
            await clickBtn('铸造');
            await sleep(3000);
            await screenshot('after-mint');
            
            // 查询NFT记录
            const nftResult = await Runtime.evaluate({
                expression: `(async function() {
                    try {
                        const resp = await fetch('http://127.0.0.1:7778/api/nft/collection/TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv');
                        const data = await resp.json();
                        if (data.nfts && data.nfts.length > 0) {
                            const latest = data.nfts[0];
                            return {
                                success: true,
                                tokenId: latest.tokenId,
                                type: latest.achievementType,
                                hand: latest.handDescription,
                                screenshotLen: latest.gameScreenshot?.length
                            };
                        }
                        return { success: false };
                    } catch (e) {
                        return { error: e.message };
                    }
                })()`,
                returnByValue: true,
                awaitPromise: true
            });
            console.log('   NFT记录:', nftResult.result.value);
        }

        console.log('\n✅ 测试完成!');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        await screenshot('error');
    }

    await client.close();
}

main().catch(console.error);
