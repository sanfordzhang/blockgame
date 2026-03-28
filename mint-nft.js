// 点击铸造NFT按钮并验证截图
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log('========================================');
    console.log('🎯 铸造NFT并验证截图');
    console.log('========================================\n');

    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    
    await Page.enable();
    await Runtime.enable();

    const screenshot = async (name) => {
        const { data } = await Page.captureScreenshot();
        fs.writeFileSync(`test-results/mint-${name}.png`, Buffer.from(data, 'base64'));
        console.log(`📸 截图: mint-${name}.png`);
    };

    try {
        // Step 1: 检查当前状态
        console.log('📍 Step 1: 检查当前页面状态...');
        const stateResult = await Runtime.evaluate({
            expression: `({
                hasNFTDialog: document.body.innerText.includes('成就解锁'),
                hasMintBtn: !!document.querySelector('button') && Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('铸造')),
                bodyPreview: document.body.innerText.substring(0, 300)
            })`,
            returnByValue: true
        });
        console.log('   状态:', stateResult.result.value);
        await screenshot('01-before-mint');

        // Step 2: 点击铸造NFT按钮
        console.log('\n📍 Step 2: 点击铸造NFT按钮...');
        const mintResult = await Runtime.evaluate({
            expression: `(function() {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    if (btn.textContent.includes('铸造') || btn.textContent.includes('Mint')) {
                        btn.click();
                        return { success: true, text: btn.textContent.trim() };
                    }
                }
                return { success: false, buttons: Array.from(buttons).map(b => b.textContent.trim()).slice(0, 10) };
            })()`,
            returnByValue: true
        });
        console.log('   铸造结果:', mintResult.result.value);
        
        // Step 3: 等待铸造完成
        console.log('\n📍 Step 3: 等待铸造完成...');
        await sleep(3000);
        await screenshot('02-minting');

        // Step 4: 检查铸造结果
        console.log('\n📍 Step 4: 检查铸造结果...');
        const finalResult = await Runtime.evaluate({
            expression: `({
                hasSuccess: document.body.innerText.includes('成功') || document.body.innerText.includes('Success'),
                hasError: document.body.innerText.includes('错误') || document.body.innerText.includes('Error'),
                hasNFTGallery: document.body.innerText.includes('NFT') || document.body.innerText.includes('Gallery'),
                bodyPreview: document.body.innerText.substring(0, 500)
            })`,
            returnByValue: true
        });
        console.log('   最终状态:', finalResult.result.value);
        await screenshot('03-after-mint');

        // Step 5: 查询最新NFT记录
        console.log('\n📍 Step 5: 查询最新NFT记录...');
        const nftQuery = await Runtime.evaluate({
            expression: `(async function() {
                try {
                    const resp = await fetch('http://127.0.0.1:7778/api/nft/collection/TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv');
                    const data = await resp.json();
                    if (data.nfts && data.nfts.length > 0) {
                        const latest = data.nfts[0];
                        return {
                            success: true,
                            achievementType: latest.achievementType,
                            handDescription: latest.handDescription,
                            gameId: latest.gameId,
                            screenshotLength: latest.gameScreenshot?.length || 0
                        };
                    }
                    return { success: false, message: 'No NFTs found' };
                } catch (e) {
                    return { success: false, error: e.message };
                }
            })()`,
            returnByValue: true,
            awaitPromise: true
        });
        console.log('   最新NFT:', nftQuery.result.value);

        console.log('\n✅ 铸造完成!');
        console.log('📁 截图保存在: test-results/mint-*.png');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        await screenshot('error');
    }

    await client.close();
}

main().catch(console.error);
