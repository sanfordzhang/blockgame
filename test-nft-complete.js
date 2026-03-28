/**
 * NFT牌型截图测试 - 按步骤间断性截图
 * 测试流程: 启动机器人 -> 勾选Mock -> 创建锦标赛 -> 加入游戏 -> 完成牌局 -> 生成NFT
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log('========================================');
    console.log('🎰 NFT牌型截图测试 (Mock模式生成顺子)');
    console.log('========================================\n');

    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    
    await Page.enable();
    await Runtime.enable();

    // 截图辅助函数
    const screenshot = async (name) => {
        const { data } = await Page.captureScreenshot();
        fs.writeFileSync(`test-results/nft-test-${name}.png`, Buffer.from(data, 'base64'));
        console.log(`📸 截图: nft-test-${name}.png`);
    };

    // 获取页面状态
    const getState = async () => {
        const result = await Runtime.evaluate({
            expression: `({
                url: window.location.href,
                title: document.title,
                buttons: Array.from(document.querySelectorAll('button')).filter(b => !b.disabled).map(b => b.textContent.trim()),
                hasMockCheckbox: !!document.querySelector('input[data-testid="mock-game-checkbox"]'),
                mockChecked: document.querySelector('input[data-testid="mock-game-checkbox"]')?.checked || false,
                cards: (document.querySelectorAll('.sc-bypJrT.ilegoF') || []).length,
                cardTexts: Array.from(document.querySelectorAll('.sc-bypJrT.ilegoF') || []).map(c => c.innerText?.substring(0, 50))
            })`,
            returnByValue: true
        });
        return result.result.value;
    };

    // 点击按钮
    const clickBtn = async (name) => {
        return await Runtime.evaluate({
            expression: `(function() {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    if (btn.textContent.trim() === '${name}' && !btn.disabled) {
                        btn.click();
                        return true;
                    }
                }
                return false;
            })()`,
            returnByValue: true
        });
    };

    try {
        // Step 1: 导航到锦标赛页面
        console.log('📍 Step 1: 导航到锦标赛页面...');
        await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
        await Page.loadEventFired();
        await sleep(2000);
        await screenshot('01-tournament-page');

        // Step 2: 勾选Mock游戏开关
        console.log('\n📍 Step 2: 勾选Mock游戏开关 (生成顺子牌型)...');
        const mockResult = await Runtime.evaluate({
            expression: `(function() {
                const checkbox = document.querySelector('input[data-testid="mock-game-checkbox"]');
                if (checkbox && !checkbox.checked) {
                    checkbox.click();
                    return { success: true, message: 'Mock开关已勾选' };
                }
                return { success: false, message: 'Mock开关已存在或找不到' };
            })()`,
            returnByValue: true
        });
        console.log('   Mock开关:', mockResult.result.value);
        await sleep(500);
        await screenshot('02-mock-enabled');

        // Step 3: 等待机器人创建的锦标赛
        console.log('\n📍 Step 3: 等待机器人创建的锦标赛...');
        let state = await getState();
        console.log('   当前卡片数:', state.cards);
        
        if (state.cards === 0) {
            console.log('   没有找到锦标赛，请确保机器人已启动: node scripts/game-bot.js');
            console.log('   等待10秒...');
            await sleep(10000);
            state = await getState();
        }
        await screenshot('03-check-tournaments');

        // Step 4: 点击有1/2玩家的锦标赛卡片
        console.log('\n📍 Step 4: 点击锦标赛卡片 (1/2玩家)...');
        const clickCardResult = await Runtime.evaluate({
            expression: `(function() {
                const cards = document.querySelectorAll('.sc-bypJrT.ilegoF');
                for (const card of cards) {
                    if ((card.innerText || '').includes('1 / 2') || (card.innerText || '').includes('1/2')) {
                        card.click();
                        return { success: true, text: card.innerText.substring(0, 100) };
                    }
                }
                // 如果没有1/2的，点击第一个可用卡片
                if (cards.length > 0) {
                    cards[0].click();
                    return { success: true, text: cards[0].innerText.substring(0, 100) };
                }
                return { success: false, cards: cards.length };
            })()`,
            returnByValue: true
        });
        console.log('   点击卡片:', clickCardResult.result.value);
        await sleep(1500);
        await screenshot('04-card-clicked');

        // Step 5: 点击Confirm加入
        console.log('\n📍 Step 5: 点击Confirm加入游戏...');
        const confirmResult = await clickBtn('Confirm');
        console.log('   Confirm结果:', confirmResult.result.value);
        await sleep(2000);
        await screenshot('05-joined');

        // Step 6: 游戏操作循环
        console.log('\n📍 Step 6: 开始游戏操作...');
        let round = 0;
        const maxRounds = 30;
        
        while (round < maxRounds) {
            round++;
            state = await getState();
            
            console.log(`\n--- 回合 ${round} ---`);
            console.log('   URL:', state.url?.substring(0, 50));
            console.log('   按钮数:', state.buttons?.length);
            
            // 检查游戏是否结束
            if (state.buttons.length === 0) {
                // 检查是否有结束标志
                const endCheck = await Runtime.evaluate({
                    expression: `({
                        hasNFT: document.body.innerText.includes('NFT') || document.body.innerText.includes('成就'),
                        hasWinner: document.body.innerText.includes('Winner') || document.body.innerText.includes('获胜'),
                        hasEnded: document.body.innerText.includes('Tournament Ended') || document.body.innerText.includes('游戏结束')
                    })`,
                    returnByValue: true
                });
                console.log('   结束检查:', endCheck.result.value);
                
                if (endCheck.result.value.hasEnded || endCheck.result.value.hasWinner || endCheck.result.value.hasNFT) {
                    console.log('\n🏆 游戏结束!');
                    break;
                }
                
                await sleep(2000);
                continue;
            }

            // 执行操作: Check > Call > Fold
            let action = null;
            if (state.buttons.includes('Check')) {
                action = 'Check';
            } else if (state.buttons.includes('Call')) {
                action = 'Call';
            } else if (state.buttons.includes('Fold')) {
                action = 'Fold';
            } else if (state.buttons.includes('Raise')) {
                action = 'Raise';
            }

            if (action) {
                console.log(`   ➡️ 执行: ${action}`);
                await clickBtn(action);
                await sleep(1500);
                
                // 每3回合截图一次
                if (round % 3 === 0) {
                    await screenshot(`round-${round}`);
                }
            } else {
                console.log('   等待...');
                await sleep(1000);
            }
        }

        // Step 7: 最终状态
        console.log('\n📍 Step 7: 检查最终状态...');
        await sleep(2000);
        await screenshot('final');

        // 检查NFT成就
        const nftCheck = await Runtime.evaluate({
            expression: `(function() {
                const text = document.body.innerText;
                return {
                    hasNFT: text.includes('NFT') || text.includes('成就') || text.includes('Straight'),
                    hasMint: text.includes('Mint') || text.includes('铸造'),
                    bodyPreview: text.substring(0, 500)
                };
            })()`,
            returnByValue: true
        });
        console.log('   NFT检查:', nftCheck.result.value);

        console.log('\n✅ 测试完成!');
        console.log('📁 截图保存在: test-results/nft-test-*.png');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        await screenshot('error');
    }

    await client.close();
}

main().catch(console.error);
