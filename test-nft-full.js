/**
 * 完整NFT测试 - 等待页面加载完成
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log('========================================');
    console.log('🎰 完整NFT测试');
    console.log('========================================\n');

    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    
    await Page.enable();
    await Runtime.enable();

    const screenshot = async (name) => {
        const { data } = await Page.captureScreenshot();
        fs.writeFileSync(`test-results/full-test-${name}.png`, Buffer.from(data, 'base64'));
        console.log(`📸 full-test-${name}.png`);
    };

    const clickBtn = async (text) => {
        const result = await Runtime.evaluate({
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
        return result.result.value;
    };

    const waitForPageLoad = async (maxWait = 30000) => {
        console.log('   等待页面加载...');
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            const result = await Runtime.evaluate({
                expression: `({
                    hasButtons: document.querySelectorAll('button').length > 0,
                    buttonCount: document.querySelectorAll('button').length,
                    bodyText: document.body?.innerText?.substring(0, 200) || ''
                })`,
                returnByValue: true
            });
            
            if (result.result.value.hasButtons) {
                console.log('   页面已加载，按钮数:', result.result.value.buttonCount);
                return true;
            }
            
            await sleep(1000);
        }
        
        console.log('   页面加载超时');
        return false;
    };

    try {
        // Step 1: 强制刷新页面
        console.log('📍 Step 1: 刷新锦标赛页面...');
        await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
        await Page.loadEventFired();
        await waitForPageLoad(30000);
        await screenshot('01-page-loaded');

        // Step 2: 获取页面状态
        console.log('\n📍 Step 2: 获取页面状态...');
        const stateResult = await Runtime.evaluate({
            expression: `({
                buttonTexts: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()),
                bodyText: document.body.innerText.substring(0, 500)
            })`,
            returnByValue: true
        });
        console.log('   按钮:', stateResult.result.value.buttonTexts);
        console.log('   正文:', stateResult.result.value.bodyText?.substring(0, 300));
        await screenshot('02-state');

        // Step 3: 查找锦标赛卡片
        console.log('\n📍 Step 3: 查找锦标赛卡片...');
        const findCardResult = await Runtime.evaluate({
            expression: `(function() {
                // 查找包含玩家数的卡片
                const elements = document.querySelectorAll('*');
                for (const el of elements) {
                    const text = el.innerText || '';
                    if ((text.includes('1 / 2') || text.includes('1/2') || text.includes('WAITING')) && 
                        (text.includes('TRX') || text.includes('人赛'))) {
                        // 找到可点击的父元素
                        let clickable = el;
                        for (let i = 0; i < 5; i++) {
                            if (clickable.onclick || clickable.style.cursor === 'pointer' || 
                                clickable.className?.includes('card') || clickable.className?.includes('Card')) {
                                clickable.click();
                                return { success: true, text: text.substring(0, 150) };
                            }
                            clickable = clickable.parentElement;
                            if (!clickable) break;
                        }
                        // 直接点击元素
                        el.click();
                        return { success: true, text: text.substring(0, 150) };
                    }
                }
                return { success: false, message: 'No tournament card found' };
            })()`,
            returnByValue: true
        });
        console.log('   查找结果:', findCardResult.result.value);
        await sleep(1500);
        await screenshot('03-card-found');

        // Step 4: 点击Confirm
        console.log('\n📍 Step 4: 点击Confirm...');
        const confirmResult = await clickBtn('Confirm');
        console.log('   Confirm:', confirmResult);
        await sleep(3000);
        await screenshot('04-joined');

        // Step 5: 游戏操作循环
        console.log('\n📍 Step 5: 游戏操作...');
        let lastButtons = [];
        let stuckCount = 0;
        
        for (let round = 1; round <= 30; round++) {
            const stateResult = await Runtime.evaluate({
                expression: `({
                    url: window.location.href,
                    buttons: Array.from(document.querySelectorAll('button')).filter(b => !b.disabled).map(b => b.textContent.trim()),
                    bodyText: document.body.innerText.substring(0, 800)
                })`,
                returnByValue: true
            });
            
            const { buttons, bodyText, url } = stateResult.result.value;
            console.log(`\n--- 回合 ${round} ---`);
            console.log('   URL:', url?.substring(0, 50));
            console.log('   按钮:', buttons?.slice(0, 8));
            
            // 检查NFT成就
            if (bodyText?.includes('成就解锁') || bodyText?.includes('NFT')) {
                console.log('\n🎉 检测到NFT成就!');
                await screenshot('nft-achievement');
                
                // 点击铸造
                console.log('   点击铸造NFT...');
                await clickBtn('铸造');
                await sleep(3000);
                await screenshot('after-mint');
                
                // 查询NFT
                const nftResult = await Runtime.evaluate({
                    expression: `(async function() {
                        try {
                            const resp = await fetch('http://127.0.0.1:7778/api/nft/collection/TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv');
                            const data = await resp.json();
                            if (data.nfts && data.nfts.length > 0) {
                                const latest = data.nfts[0];
                                return { success: true, type: latest.achievementType, hand: latest.handDescription };
                            }
                            return { success: false };
                        } catch (e) { return { error: e.message }; }
                    })()`,
                    returnByValue: true,
                    awaitPromise: true
                });
                console.log('   NFT记录:', nftResult.result.value);
                break;
            }
            
            // 检查游戏结束
            if (bodyText?.includes('Winner') || bodyText?.includes('获胜') || bodyText?.includes('结束')) {
                console.log('\n🏆 游戏结束!');
                await screenshot('game-end');
                break;
            }
            
            // 检查卡住
            if (JSON.stringify(buttons) === JSON.stringify(lastButtons)) {
                stuckCount++;
                if (stuckCount > 5) {
                    console.log('   检测到卡住，跳过...');
                    stuckCount = 0;
                }
            } else {
                stuckCount = 0;
            }
            lastButtons = buttons;
            
            // 执行操作
            if (buttons?.includes('Check')) {
                console.log('   ➡️ Check');
                await clickBtn('Check');
            } else if (buttons?.includes('Call')) {
                console.log('   ➡️ Call');
                await clickBtn('Call');
            } else if (buttons?.includes('Raise') && !buttons?.includes('Check')) {
                console.log('   ➡️ Raise');
                await Runtime.evaluate({
                    expression: `(function() {
                        const btns = document.querySelectorAll('button');
                        for (const b of btns) {
                            if (b.textContent.includes('Raise')) { b.click(); return true; }
                        }
                        return false;
                    })()`,
                    returnByValue: true
                });
            }
            
            await sleep(1500);
            
            if (round % 5 === 0) {
                await screenshot(`round-${round}`);
            }
        }

        console.log('\n✅ 测试完成!');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        await screenshot('error');
    }

    await client.close();
}

main().catch(console.error);
