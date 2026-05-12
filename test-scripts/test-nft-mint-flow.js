const CDP = require('chrome-remote-interface');
const fs = require('fs');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();

    const screenshot = async (name) => {
        fs.mkdirSync('test-results', { recursive: true });
        const { data } = await Page.captureScreenshot();
        fs.writeFileSync('test-results/' + name + '.png', Buffer.from(data, 'base64'));
        console.log('📸 ' + name);
    };

    const clickBtn = async (name) => {
        return await Runtime.evaluate({
            expression: `(function(){
                const btns = document.querySelectorAll('button');
                for(const b of btns){
                    if(b.textContent.trim()==='${name}' && !b.disabled){
                        b.click();
                        return true;
                    }
                }
                return false;
            })()`,
            returnByValue: true
        });
    };

    const getState = async () => {
        const r = await Runtime.evaluate({
            expression: `({
                buttons: Array.from(document.querySelectorAll('button')).filter(b=>!b.disabled).map(b=>b.textContent.trim()),
                text: document.body.innerText
            })`,
            returnByValue: true
        });
        return r.result.value;
    };

    console.log('========================================');
    console.log('🎮 开始完整NFT Mint流程');
    console.log('========================================');

    // 1. 导航到锦标赛页面
    await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
    await Page.loadEventFired();
    await sleep(3000);
    await screenshot('mint-01-tournament-list');

    // 2. 点击1/2的锦标赛卡片
    console.log('\n--- 点击锦标赛卡片 (1/2) ---');
    const clickCard = await Runtime.evaluate({
        expression: `(function() {
            const all = document.querySelectorAll('*');
            for (const el of all) {
                if (el.children.length === 0 && (el.textContent || '').includes('1 / 2')) {
                    let parent = el;
                    for (let i = 0; i < 5; i++) {
                        parent = parent.parentElement;
                        if (!parent) break;
                        if (parent.onclick || parent.style.cursor === 'pointer' || parent.tagName === 'DIV') {
                            parent.click();
                            return { found: true };
                        }
                    }
                }
            }
            return { found: false };
        })()`,
        returnByValue: true
    });
    console.log('点击结果:', clickCard.result.value);
    await sleep(2000);
    await screenshot('mint-02-card-clicked');

    // 3. 点击Confirm加入
    console.log('\n--- 点击Confirm加入 ---');
    await clickBtn('Confirm');
    await sleep(3000);
    await screenshot('mint-03-joined');

    // 4. 游戏循环
    console.log('\n--- 开始游戏循环 ---');
    let round = 0;
    const maxRounds = 40;

    while (round < maxRounds) {
        await sleep(2500);
        const state = await getState();
        const gameButtons = state.buttons.filter(b => ['Fold','Check','Call','Raise'].includes(b));

        // 检查是否有NFT成就弹窗
        if (state.text.includes('成就解锁') || state.text.includes('铸造 NFT')) {
            console.log('\n🎉 检测到NFT成就弹窗！');
            await screenshot('mint-04-achievement-popup');

            // 点击"铸造 NFT"按钮
            console.log('点击"铸造 NFT"按钮...');
            const mintBtn = await Runtime.evaluate({
                expression: `(function(){
                    const btns = document.querySelectorAll('button');
                    for(const b of btns){
                        if(b.textContent.includes('铸造') && !b.disabled){
                            b.click();
                            return true;
                        }
                    }
                    return false;
                })()`,
                returnByValue: true
            });
            console.log('铸造按钮点击结果:', mintBtn.result.value);

            // 等待mint完成
            await sleep(5000);
            await screenshot('mint-05-minting');

            // 检查mint结果
            const mintResult = await getState();
            console.log('\nMint结果页面内容:');
            console.log(mintResult.text.substring(0, 500));
            await screenshot('mint-06-mint-result');

            // 如果有"查看收藏"按钮，点击它
            if (mintResult.text.includes('查看收藏')) {
                console.log('\n点击"查看收藏"按钮...');
                await clickBtn('查看收藏');
                await sleep(3000);
                await screenshot('mint-07-nft-gallery');
            }

            break;
        }

        // 检查游戏是否结束
        if (state.text.includes('Winner') || state.text.includes('Ranking') ||
            state.text.includes('FINISHED')) {
            console.log('\n🏆 游戏结束！');
            await screenshot('mint-game-finished');
            break;
        }

        if (gameButtons.length > 0) {
            const action = gameButtons.includes('Check') ? 'Check' :
                           gameButtons.includes('Call') ? 'Call' : 'Fold';
            console.log(`Round ${round}: ${action}`);
            await clickBtn(action);
            await sleep(1000);
            if (round % 5 === 0) {
                await screenshot(`mint-round-${round}`);
            }
        }

        round++;
    }

    await screenshot('mint-final');
    console.log('\n✅ NFT Mint流程完成');
    await client.close();
})().catch(console.error);
