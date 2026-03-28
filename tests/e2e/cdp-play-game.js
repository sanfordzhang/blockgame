/**
 * CDP游戏测试 - 连接当前浏览器，加入游戏，点击操作
 */

const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');

const CDP_PORT = 9222;
const SCREENSHOT_DIR = '/Users/yingfengzhang/1JackSource/blockchain/game-core/test-results';

let screenshotCount = 0;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(Page, name = '') {
    screenshotCount++;
    const filename = `cdp-game-${String(screenshotCount).padStart(2, '0')}${name ? '-' + name : ''}.png`;
    const filepath = path.join(SCREENSHOT_DIR, filename);
    
    const { data } = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(data, 'base64'));
    console.log(`📸 截图保存: ${filename}`);
    return filepath;
}

async function getPageInfo(Runtime) {
    try {
        const result = await Runtime.evaluate({
            expression: `
                (function() {
                    const info = {
                        url: window.location.href,
                        title: document.title,
                        buttons: [],
                        text: document.body.innerText.substring(0, 500)
                    };
                    
                    document.querySelectorAll('button').forEach(btn => {
                        const text = btn.textContent.trim();
                        if (text && btn.offsetParent !== null) {
                            info.buttons.push({
                                text: text.substring(0, 30),
                                disabled: btn.disabled
                            });
                        }
                    });
                    
                    return JSON.stringify(info);
                })()
            `,
            returnByValue: true
        });
        
        if (result.result && result.result.value) {
            return JSON.parse(result.result.value);
        }
        return { url: '', title: '', buttons: [], text: '' };
    } catch (e) {
        return { url: '', title: '', buttons: [], text: '' };
    }
}

async function clickTournamentCard(Runtime) {
    // 使用正确的选择器点击锦标赛卡片
    const result = await Runtime.evaluate({
        expression: `
            (function() {
                // 方法1: 通过className找到卡片
                const cards = document.querySelectorAll('[class*="lniqUP"], [class*="card"]');
                for (const card of cards) {
                    const text = card.innerText || '';
                    // 找到WAITING的2人赛
                    if (text.includes('WAITING') && text.includes('2人赛') && !text.includes('1 / 2')) {
                        console.log('找到锦标赛卡片');
                        card.click();
                        return { success: true, method: 'className', text: text.substring(0, 80) };
                    }
                }
                
                // 方法2: 通过文本内容查找
                const allDivs = document.querySelectorAll('div');
                for (const div of allDivs) {
                    const text = div.innerText || '';
                    if (text.includes('WAITING') && text.includes('Players') && text.includes('0 / 2')) {
                        div.click();
                        return { success: true, method: 'textSearch', text: text.substring(0, 80) };
                    }
                }
                
                return { success: false };
            })()
        `,
        returnByValue: true
    });
    
    return result.result?.value || { success: false };
}

async function main() {
    console.log('\n========================================');
    console.log('🎮 CDP 游戏测试');
    console.log('========================================\n');
    
    try {
        // 连接浏览器
        console.log('连接浏览器...');
        const client = await CDP({ port: CDP_PORT });
        const { Page, Runtime } = client;
        
        await Page.enable();
        await Runtime.enable();
        console.log('✅ 浏览器已连接\n');
        
        // 截图1：当前状态
        await takeScreenshot(Page, 'initial');
        
        // 获取页面信息
        let info = await getPageInfo(Runtime);
        console.log('当前页面:', info.url);
        console.log('页面内容预览:', info.text.substring(0, 200));
        
        // 点击锦标赛卡片
        console.log('\n查找并点击锦标赛卡片...');
        let clickResult = await clickTournamentCard(Runtime);
        console.log('点击结果:', clickResult);
        
        await sleep(2000);
        await takeScreenshot(Page, 'after-click-card');
        
        // 检查是否有确认弹窗或按钮
        info = await getPageInfo(Runtime);
        console.log('点击后按钮:', info.buttons);
        
        // 查找确认/加入按钮
        const confirmResult = await Runtime.evaluate({
            expression: `
                (function() {
                    const buttons = document.querySelectorAll('button');
                    for (const btn of buttons) {
                        const text = btn.textContent.trim().toLowerCase();
                        if ((text.includes('join') || text.includes('加入') || text.includes('confirm') || text.includes('确认') || text.includes('enter')) && !btn.disabled) {
                            btn.click();
                            return { success: true, clicked: btn.textContent.trim() };
                        }
                    }
                    return { success: false };
                })()
            `,
            returnByValue: true
        });
        
        if (confirmResult.result?.value?.success) {
            console.log('点击确认按钮:', confirmResult.result.value.clicked);
            await sleep(2000);
            await takeScreenshot(Page, 'after-confirm');
        }
        
        // 检查URL是否变化（进入游戏）
        info = await getPageInfo(Runtime);
        console.log('当前URL:', info.url);
        
        // 游戏循环
        console.log('\n========================================');
        console.log('开始游戏循环...');
        console.log('========================================\n');
        
        for (let round = 1; round <= 10; round++) {
            console.log(`\n--- 回合 ${round} ---`);
            
            await sleep(2000);
            await takeScreenshot(Page, `round-${round}`);
            
            info = await getPageInfo(Runtime);
            console.log('按钮:', info.buttons.filter(b => !b.disabled));
            console.log('URL:', info.url);
            
            // 检查是否在游戏页面
            if (info.url.includes('/play') || info.url.includes('/tournament/')) {
                // 查找游戏操作按钮
                const actionResult = await Runtime.evaluate({
                    expression: `
                        (function() {
                            const buttons = document.querySelectorAll('button');
                            const actions = ['check', 'call', 'raise', 'fold', 'all-in'];
                            for (const btn of buttons) {
                                const text = btn.textContent.trim().toLowerCase();
                                for (const action of actions) {
                                    if (text.includes(action) && !btn.disabled) {
                                        btn.click();
                                        return { success: true, action: btn.textContent.trim() };
                                    }
                                }
                            }
                            return { success: false };
                        })()
                    `,
                    returnByValue: true
                });
                
                if (actionResult.result?.value?.success) {
                    console.log('✅ 执行操作:', actionResult.result.value.action);
                    await sleep(1500);
                    await takeScreenshot(Page, `round-${round}-after`);
                } else {
                    console.log('没有可点击的游戏按钮');
                }
            } else {
                console.log('未进入游戏页面');
            }
        }
        
        // 最终截图
        await takeScreenshot(Page, 'final');
        
        console.log('\n========================================');
        console.log('✅ 测试完成');
        console.log(`📸 共保存 ${screenshotCount} 张截图`);
        console.log('========================================\n');
        
        await client.close();
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

main();
