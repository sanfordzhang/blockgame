/**
 * CDP 测试：打开 TronLink 扩展并获取收藏品页面内容
 * 
 * 使用方法: node cdp-tronlink-collectibles.js
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

async function test() {
    if (!fs.existsSync('test-results')) fs.mkdirSync('test-results');

    const client = await CDP({ port: 9222 });
    const { Page, Runtime, Target } = client;
    await Page.enable();
    await Runtime.enable();

    const screenshot = async (name) => {
        try {
            const { data } = await Page.captureScreenshot();
            fs.writeFileSync(`test-results/${name}.png`, Buffer.from(data, 'base64'));
            log(`📸 ${name}`);
        } catch (e) {
            log(`⚠️ 截图失败: ${e.message}`);
        }
    };

    const eval_ = async (expr) => {
        const r = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
        return r.result?.value;
    };

    log('=== TronLink 收藏品检查 ===');

    // TronLink 扩展 ID
    const TRONLINK_EXT_ID = 'ibnejdfjmmkpcnlpebklmnkoeoihofec';

    // 1. 创建 TronLink 弹窗
    log('[1] 打开 TronLink 弹窗');
    const popupUrl = `chrome-extension://${TRONLINK_EXT_ID}/popup.html`;
    
    try {
        const { targetId } = await Target.createTarget({
            url: popupUrl,
            width: 375,
            height: 600,
            newWindow: true
        });
        log(`创建窗口: ${targetId}`);
        await sleep(3000);
    } catch (e) {
        log(`创建窗口失败: ${e.message}`);
    }

    // 2. 获取所有 targets
    log('[2] 查找 TronLink 窗口');
    const { targetInfos } = await Target.getTargets();
    
    const tronlinkTargets = targetInfos.filter(t => 
        t.url?.includes(TRONLINK_EXT_ID) && t.type === 'page'
    );
    
    log(`找到 ${tronlinkTargets.length} 个 TronLink 窗口`);
    
    if (tronlinkTargets.length === 0) {
        log('未找到 TronLink 窗口，尝试直接获取页面内容');
    }

    // 3. 对每个 TronLink 窗口操作
    for (const target of tronlinkTargets) {
        log(`\n[3] 操作窗口: ${target.title}`);
        await Target.activateTarget({ targetId: target.targetId });
        await sleep(1000);
        await screenshot('tronlink-initial');

        // 获取页面内容
        const pageContent = await eval_(`(function() {
            return {
                title: document.title,
                url: window.location.href,
                bodyText: document.body?.innerText?.substring(0, 500),
                buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).slice(0, 20),
                tabs: Array.from(document.querySelectorAll('[role="tab"], .tab, div[class*="tab"]')).map(t => t.textContent?.trim()).slice(0, 10),
                navItems: Array.from(document.querySelectorAll('nav *')).map(n => n.textContent?.trim()).filter(t => t).slice(0, 20)
            };
        })()`);
        
        log(`页面标题: ${pageContent?.title}`);
        log(`按钮列表: ${JSON.stringify(pageContent?.buttons)}`);
        log(`标签页: ${JSON.stringify(pageContent?.tabs)}`);
        log(`导航项: ${JSON.stringify(pageContent?.navItems)}`);
        log(`页面内容预览: ${pageContent?.bodyText?.substring(0, 200)}`);

        // 4. 查找并点击收藏品/NFT 标签
        log('\n[4] 查找收藏品标签');
        const collectiblesResult = await eval_(`(function() {
            // 查找包含收藏品/NFT 关键字的元素
            const keywords = ['收藏品', 'collectibles', 'nft', 'NFT', '收藏', '资产', 'assets'];
            const elements = document.querySelectorAll('*');
            
            for (const el of elements) {
                const text = (el.textContent || '').toLowerCase();
                const tagName = el.tagName.toLowerCase();
                
                // 只检查可点击元素
                if (tagName === 'button' || tagName === 'a' || 
                    el.onclick || el.getAttribute('role') === 'tab' ||
                    el.className?.includes('tab') || el.className?.includes('nav') ||
                    el.className?.includes('menu')) {
                    
                    for (const keyword of keywords) {
                        if (text.includes(keyword.toLowerCase()) && text.length < 50) {
                            el.click();
                            return { 
                                clicked: true, 
                                text: el.textContent?.trim(),
                                tag: tagName,
                                class: el.className
                            };
                        }
                    }
                }
            }
            return { clicked: false };
        })()`);
        
        if (collectiblesResult?.clicked) {
            log(`✅ 点击了: "${collectiblesResult.text}"`);
            await sleep(2000);
            await screenshot('tronlink-collectibles-clicked');
            
            // 获取收藏品页面内容
            const collectiblesContent = await eval_(`(function() {
                const items = [];
                
                // 查找收藏品列表
                const nftItems = document.querySelectorAll('[class*="nft"], [class*="collectible"], [class*="item"], img[src*="nft"], img[src*="token"]');
                
                // 或者查找图片列表
                const images = document.querySelectorAll('img');
                images.forEach((img, i) => {
                    if (i < 20 && img.offsetWidth > 30 && img.offsetHeight > 30) {
                        items.push({
                            src: img.src?.substring(0, 100),
                            alt: img.alt
                        });
                    }
                });
                
                // 查找数字（可能是数量）
                const text = document.body?.innerText || '';
                const numbers = text.match(/\d+/g) || [];
                
                return {
                    bodyText: text.substring(0, 1000),
                    imageCount: images.length,
                    items: items.slice(0, 10),
                    numbers: numbers.slice(0, 20)
                };
            })()`);
            
            log(`\n收藏品页面内容:`);
            log(`图片数量: ${collectiblesContent?.imageCount}`);
            log(`数字: ${collectiblesContent?.numbers?.join(', ')}`);
            log(`内容预览: ${collectiblesContent?.bodyText?.substring(0, 300)}`);
            
            await screenshot('tronlink-collectibles-final');
        } else {
            log('未找到收藏品标签');
        }
    }

    // 5. 同时从当前游戏页面获取 NFT 数量
    log('\n[5] 从当前页面获取 NFT 信息');
    
    // 切换回游戏页面
    const gameTargets = targetInfos.filter(t => t.url?.includes('127.0.0.1:3001'));
    if (gameTargets.length > 0) {
        await Target.activateTarget({ targetId: gameTargets[0].targetId });
        await sleep(500);
    }
    
    const nftFromGame = await eval_(`(async function() {
        if (!window.tronWeb) return { error: 'No tronWeb' };
        
        const address = window.tronWeb.defaultAddress?.base58;
        const contractAddress = window.__NFT_CONTRACT_ONCHAIN || 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';
        
        try {
            const contract = await window.tronWeb.contract().at(contractAddress);
            const balance = await contract.balanceOf(address).call();
            const total = parseInt(balance.toString ? balance.toString() : balance);
            
            return {
                address: address,
                balance: total,
                message: \`钱包 ${address.substring(0, 10)}... 共有 ${total} 个 NFT 收藏品\`
            };
        } catch (e) {
            return { error: e.message };
        }
    })()`);
    
    if (nftFromGame?.balance !== undefined) {
        log(`\n========================================`);
        log(`📍 ${nftFromGame.message}`);
        log(`========================================`);
    } else {
        log(`获取 NFT 信息失败: ${JSON.stringify(nftFromGame)}`);
    }

    await client.close();
    log('\n✅ 完成');
}

test().catch(e => { console.error(e); process.exit(1); });
