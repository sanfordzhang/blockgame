const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function test() {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    
    const url = 'http://127.0.0.1:3001/wallet?address=TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
    console.log('测试钱包页面NFT显示');
    console.log('URL:', url);
    
    await Page.navigate({ url });
    await Page.loadEventFired();
    await new Promise(r => setTimeout(r, 3000));
    
    // 点击Collection标签
    await Runtime.evaluate({
        expression: `
            (function() {
                const tabs = document.querySelectorAll('button');
                for (const tab of tabs) {
                    if (tab.textContent.includes('Collection')) {
                        tab.click();
                        return 'clicked';
                    }
                }
                return 'not found';
            })()
        `
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    // 检查NFT内容
    const result = await Runtime.evaluate({
        expression: `
            (function() {
                const cards = document.querySelectorAll('[style*=border-left]');
                const nftSection = document.body.innerText;
                return {
                    cardCount: cards.length,
                    hasHandDescription: nftSection.includes('Straight'),
                    hasCards: nftSection.includes('10h') || nftSection.includes('Cards:')
                };
            })()
        `
    });
    
    console.log('NFT卡片数量:', result.result.value.cardCount);
    console.log('包含牌型描述:', result.result.value.hasHandDescription);
    console.log('包含牌型数据:', result.result.value.hasCards);
    
    const shot = await Page.captureScreenshot();
    fs.writeFileSync('wallet-nft-final.png', Buffer.from(shot.data, 'base64'));
    console.log('截图保存: wallet-nft-final.png');
    
    await client.close();
}
test().catch(e => console.error(e));
