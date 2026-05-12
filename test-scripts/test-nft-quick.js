/**
 * 改进的NFT测试 - 精确点击锦标赛卡片
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log('========================================');
    console.log('🎰 改进的NFT测试');
    console.log('========================================\n');

    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    
    await Page.enable();
    await Runtime.enable();

    const screenshot = async (name) => {
        const { data } = await Page.captureScreenshot();
        fs.writeFileSync(`test-results/nft-quick-${name}.png`, Buffer.from(data, 'base64'));
        console.log(`📸 nft-quick-${name}.png`);
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

    try {
        // Step 1: 刷新页面
        console.log('📍 Step 1: 刷新锦标赛页面...');
        await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
        await Page.loadEventFired();
        await sleep(3000);
        await screenshot('01-loaded');

        // Step 2: 精确点击带有"1 / 2"的锦标赛卡片
        console.log('\n📍 Step 2: 精确点击锦标赛卡片...');
        const clickResult = await Runtime.evaluate({
            expression: `(function() {
                // 查找所有元素
                const allElements = document.querySelectorAll('*');
                let targetElement = null;
                
                // 遍历所有元素，找到包含"1 / 2"和"TRX"的最小元素
                for (const el of allElements) {
                    const text = el.innerText || '';
                    // 检查是否包含"1 / 2"或"1/2"且包含TRX
                    if ((text.includes('1 / 2') || text.includes('1/2')) && text.includes('TRX')) {
                        // 检查这个元素是否有较少的子元素（是卡片而不是容器）
                        const childCount = el.querySelectorAll('*').length;
                        if (!targetElement || childCount < targetElement.childCount) {
                            targetElement = { element: el, childCount: childCount, text: text };
                        }
                    }
                }
                
                if (targetElement) {
                    // 尝试点击卡片本身
                    targetElement.element.click();
                    return { success: true, childCount: targetElement.childCount, text: targetElement.text.substring(0, 200) };
                }
                
                return { success: false, message: 'No tournament card with 1/2 players found' };
            })()`,
            returnByValue: true
        });
        console.log('   点击结果:', clickResult.result.value);
        await sleep(2000);
        await screenshot('02-after-click');

        // Step 3: 检查是否出现了Confirm按钮
        console.log('\n📍 Step 3: 检查Confirm按钮...');
        const stateResult = await Runtime.evaluate({
            expression: `({
                url: window.location.href,
                buttons: Array.from(document.querySelectorAll('button')).map(b => ({ text: b.textContent.trim(), disabled: b.disabled })),
                bodyText: document.body.innerText.substring(0, 500)
            })`,
            returnByValue: true
        });
        console.log('   URL:', stateResult.result.value.url);
        console.log('   按钮:', stateResult.result.value.buttons);
        
        // 如果有Confirm按钮，点击它
        const confirmBtn = stateResult.result.value.buttons.find(b => b.text === 'Confirm');
        if (confirmBtn) {
            console.log('\n📍 Step 4: 点击Confirm...');
            await clickBtn('Confirm');
            await sleep(3000);
            await screenshot('03-after-confirm');
        }

        // Step 5: 检查游戏状态
        console.log('\n📍 Step 5: 检查游戏状态...');
        const gameState = await Runtime.evaluate({
            expression: `({
                url: window.location.href,
                hasPlayArea: !!document.querySelector('.play-area'),
                buttons: Array.from(document.querySelectorAll('button')).filter(b => !b.disabled).map(b => b.textContent.trim()),
                bodyText: document.body.innerText.substring(0, 500)
            })`,
            returnByValue: true
        });
        console.log('   URL:', gameState.result.value.url);
        console.log('   按钮数:', gameState.result.value.buttons?.length);
        console.log('   按钮列表:', gameState.result.value.buttons?.slice(0, 10));
        await screenshot('04-game-state');

        // Step 6: 如果进入游戏，执行操作
        if (gameState.result.value.buttons?.some(b => ['Fold', 'Check', 'Call', 'Raise'].includes(b))) {
            console.log('\n📍 Step 6: 游戏操作...');
            
            for (let round = 1; round <= 20; round++) {
                const roundState = await Runtime.evaluate({
                    expression: `({
                        buttons: Array.from(document.querySelectorAll('button')).filter(b => !b.disabled).map(b => b.textContent.trim()),
                        bodyText: document.body.innerText.substring(0, 600)
                    })`,
                    returnByValue: true
                });
                
                const { buttons, bodyText } = roundState.result.value;
                console.log(`\n--- 回合 ${round} ---`);
                console.log('   按钮:', buttons?.slice(0, 8));
                
                // 检查NFT成就
                if (bodyText?.includes('成就解锁') || bodyText?.includes('NFT')) {
                    console.log('\n🎉 检测到NFT成就!');
                    await screenshot('nft-detected');
                    
                    // 点击铸造
                    await clickBtn('铸造');
                    await sleep(3000);
                    await screenshot('after-mint');
                    
                    // 查询NFT
                    const nftResult = await Runtime.evaluate({
                        expression: `(async function() {
                            const resp = await fetch('http://127.0.0.1:7778/api/nft/collection/TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv');
                            const data = await resp.json();
                            if (data.nfts && data.nfts.length > 0) {
                                const latest = data.nfts[0];
                                return { success: true, type: latest.achievementType, hand: latest.handDescription };
                            }
                            return { success: false };
                        })()`,
                        returnByValue: true,
                        awaitPromise: true
                    });
                    console.log('   NFT记录:', nftResult.result.value);
                    break;
                }
                
                // 执行操作
                if (buttons?.includes('Check')) {
                    console.log('   ➡️ Check');
                    await clickBtn('Check');
                } else if (buttons?.includes('Call')) {
                    console.log('   ➡️ Call');
                    await clickBtn('Call');
                } else if (buttons?.includes('Fold')) {
                    console.log('   ➡️ Fold');
                    await clickBtn('Fold');
                }
                
                await sleep(1500);
                
                if (round % 5 === 0) {
                    await screenshot(`round-${round}`);
                }
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
