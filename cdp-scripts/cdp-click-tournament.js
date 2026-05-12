const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function test() {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    
    await Page.enable();
    await Runtime.enable();
    
    console.log('=== 步骤1: 截图当前状态 ===');
    const { data } = await Page.captureScreenshot();
    fs.writeFileSync('test-results/cdp-game-01-initial.png', Buffer.from(data, 'base64'));
    
    // 使用精确的类名选择器点击卡片
    console.log('\n=== 步骤2: 点击锦标赛卡片 ===');
    const clickResult = await Runtime.evaluate({
        expression: `
            (function() {
                // 使用精确的类名选择器
                const cards = document.querySelectorAll('.sc-bypJrT.ilegoF');
                for (const card of cards) {
                    const text = card.innerText || '';
                    // 点击有 "1 / 2" 玩家的卡片
                    if (text.includes('1 / 2')) {
                        card.click();
                        return { success: true, text: text.substring(0, 60) };
                    }
                }
                // 如果没有1/2的，点击第一个
                if (cards.length > 0) {
                    cards[0].click();
                    return { success: true, text: cards[0].innerText.substring(0, 60) };
                }
                return { success: false };
            })()
        `,
        returnByValue: true
    });
    console.log('点击结果:', clickResult.result.value);
    
    // 等待
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('\n=== 步骤3: 截图点击后状态 ===');
    const { data: data2 } = await Page.captureScreenshot();
    fs.writeFileSync('test-results/cdp-game-02-looking.png', Buffer.from(data2, 'base64'));
    
    // 检查页面状态
    const state = await Runtime.evaluate({
        expression: `({
            url: window.location.href,
            buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).slice(0, 10)
        })`,
        returnByValue: true
    });
    console.log('页面状态:', JSON.stringify(state.result.value, null, 2));
    
    // 检查是否需要点击加入按钮
    if (state.result.value.buttons.some(b => b.toLowerCase().includes('join') || b.includes('加入'))) {
        console.log('\n=== 步骤4: 点击加入按钮 ===');
        await Runtime.evaluate({
            expression: `
                (function() {
                    const buttons = document.querySelectorAll('button');
                    for (const btn of buttons) {
                        const text = btn.textContent.trim().toLowerCase();
                        if (text.includes('join') || text.includes('加入')) {
                            btn.click();
                            return true;
                        }
                    }
                    return false;
                })()
            `,
            returnByValue: true
        });
        await new Promise(r => setTimeout(r, 3000));
    }
    
    // 再次检查是否进入游戏
    const gameState = await Runtime.evaluate({
        expression: `({
            url: window.location.href,
            hasGameButtons: document.body.innerText.includes('CHECK') || document.body.innerText.includes('CALL') || document.body.innerText.includes('FOLD'),
            bodyText: document.body.innerText.substring(0, 400)
        })`,
        returnByValue: true
    });
    console.log('\n游戏状态:', JSON.stringify(gameState.result.value, null, 2));
    
    // 最终截图
    const { data: data3 } = await Page.captureScreenshot();
    fs.writeFileSync('test-results/cdp-game-03-joined.png', Buffer.from(data3, 'base64'));
    console.log('\n截图已保存');
    
    await client.close();
}

test().catch(console.error);
