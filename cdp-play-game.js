const CDP = require('chrome-remote-interface');
const fs = require('fs');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function test() {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    
    await Page.enable();
    await Runtime.enable();
    
    const screenshot = async (name) => {
        const { data } = await Page.captureScreenshot();
        fs.writeFileSync(`test-results/${name}.png`, Buffer.from(data, 'base64'));
        console.log(`📸 ${name}`);
    };
    
    const getState = async () => {
        const result = await Runtime.evaluate({
            expression: `({
                url: window.location.href,
                buttons: Array.from(document.querySelectorAll('button')).filter(b => !b.disabled).map(b => b.textContent.trim()),
                text: document.body.innerText.substring(0, 800)
            })`,
            returnByValue: true
        });
        return result.result.value;
    };
    
    const clickBtn = async (name) => {
        return await Runtime.evaluate({
            expression: `
                (function() {
                    const buttons = document.querySelectorAll('button');
                    for (const btn of buttons) {
                        if (btn.textContent.trim() === '${name}' && !btn.disabled) {
                            btn.click();
                            return true;
                        }
                    }
                    return false;
                })()
            `,
            returnByValue: true
        });
    };
    
    console.log('========================================');
    console.log('🎮 CDP游戏测试 (支持Mock模式)');
    console.log('========================================\n');
    
    // 导航到锦标赛页面
    await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
    await Page.loadEventFired();
    await sleep(3000);
    await screenshot('cdp-game-01-initial');
    
    // 勾选 Mock 游戏开关
    console.log('\n--- 勾选 Mock 游戏开关 ---');
    const mockResult = await Runtime.evaluate({
        expression: `
            (function() {
                const checkbox = document.querySelector('input[data-testid="mock-game-checkbox"]');
                if (checkbox && !checkbox.checked) {
                    checkbox.click();
                    return { success: true, checked: checkbox.checked };
                }
                return { success: false, message: 'Checkbox not found or already checked' };
            })()
        `,
        returnByValue: true
    });
    console.log('Mock开关:', mockResult.result.value);
    
    await sleep(1000);
    await screenshot('cdp-game-02-mock-enabled');
    
    // 创建新的带 mock 模式的锦标赛
    console.log('\n--- 创建 Mock 锦标赛 ---');
    const createResult = await Runtime.evaluate({
        expression: `
            (function() {
                // 点击"双人赛 (10 TRX)"按钮创建锦标赛
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const text = btn.textContent.trim();
                    if (text.includes('双人赛') || text.includes('2人赛')) {
                        btn.click();
                        return { success: true, text: text };
                    }
                }
                return { success: false, message: '创建按钮未找到' };
            })()
        `,
        returnByValue: true
    });
    console.log('创建锦标赛:', createResult.result.value);
    
    await sleep(3000);
    await screenshot('cdp-game-03-tournament-created');
    
    // 等待机器人加入
    console.log('\n--- 等待机器人加入... ---');
    await sleep(5000);
    
    // 点击锦标赛卡片
    console.log('\n--- 点击锦标赛卡片 ---');
    const clickCard = await Runtime.evaluate({
        expression: `
            (function() {
                const cards = document.querySelectorAll('.sc-bypJrT.ilegoF');
                for (const card of cards) {
                    if ((card.innerText || '').includes('1 / 2')) {
                        card.click();
                        return { success: true };
                    }
                }
                return { success: false };
            })()
        `,
        returnByValue: true
    });
    console.log('点击卡片:', clickCard.result.value);
    
    await sleep(2000);
    await screenshot('cdp-game-04-after-click-card');
    
    // 点击 Confirm 加入
    console.log('\n--- 点击Confirm ---');
    await clickBtn('Confirm');
    await sleep(3000);
    await screenshot('cdp-game-05-joined');
    
    let state = await getState();
    console.log('游戏按钮:', state.buttons);
    
    // 游戏循环
    let round = 1;
    const maxRounds = 20;
    
    while (round <= maxRounds) {
        await sleep(2500);
        state = await getState();
        
        console.log(`\n=== 回合 ${round} ===`);
        console.log('按钮:', state.buttons.filter(b => ['Fold', 'Check', 'Call', 'Raise'].includes(b)));
        
        // 检查是否有操作按钮
        const gameButtons = state.buttons.filter(b => ['Fold', 'Check', 'Call', 'Raise'].includes(b));
        
        if (gameButtons.length > 0) {
            let action = gameButtons.includes('Check') ? 'Check' : 
                         gameButtons.includes('Call') ? 'Call' : 
                         gameButtons.includes('Fold') ? 'Fold' : null;
            
            if (action) {
                console.log(`➡️ 执行: ${action}`);
                await clickBtn(action);
                await sleep(1500);
                await screenshot(`cdp-game-round-${round}`);
            }
        } else if (state.text.includes('Winner') || state.text.includes('Game Over') || 
                   state.text.includes('Ranking') || state.text.includes('NFT')) {
            console.log('\n🏆 游戏结束!');
            
            // 检查是否有 NFT 成就提示
            if (state.text.includes('NFT') || state.text.includes('Straight') || state.text.includes('顺子')) {
                console.log('🎉 检测到 NFT 成就!');
            }
            break;
        }
        
        round++;
    }
    
    await screenshot('cdp-game-final');
    console.log('\n✅ 测试完成!');
    
    // 检查最终页面是否有 NFT 相关内容
    const nftCheck = await Runtime.evaluate({
        expression: `
            (function() {
                const text = document.body.innerText;
                return {
                    hasNFT: text.includes('NFT') || text.includes('Achievement') || text.includes('Straight'),
                    bodyText: text.substring(0, 500)
                };
            })()
        `,
        returnByValue: true
    });
    
    if (nftCheck.result.value.hasNFT) {
        console.log('\n🎉 NFT 成就检测成功!');
    }
    
    await client.close();
}

test().catch(console.error);
