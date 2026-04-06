/**
 * CDP 测试：打开 TronLink 钱包扩展并查看 NFT 收藏品
 * 
 * 使用方法: node cdp-open-tronlink.js
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

async function test() {
    if (!fs.existsSync('test-results')) fs.mkdirSync('test-results');

    const client = await CDP({ port: 9222 });
    const { Page, Runtime, Target, Browser } = client;
    await Page.enable();
    await Runtime.enable();

    const screenshot = async (name) => {
        try {
            const { data } = await Page.captureScreenshot();
            fs.writeFileSync(`test-results/${name}.png`, Buffer.from(data, 'base64'));
            log(`📸 ${name}`);
        } catch (e) {
            log(`⚠️ 截图失败 ${name}: ${e.message}`);
        }
    };

    const eval_ = async (expr) => {
        const r = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
        return r.result?.value;
    };

    log('=== 打开 TronLink 钱包扩展 ===');

    // 1. 获取当前页面信息
    log('[1] 当前页面状态');
    const currentInfo = await eval_(`({
        url: window.location.href,
        title: document.title,
        tronLink: {
            installed: typeof window.tronWeb !== 'undefined',
            address: window.tronWeb?.defaultAddress?.base58
        }
    })`);
    log(`页面: ${currentInfo?.url}`);
    log(`TronLink: ${currentInfo?.tronLink?.installed ? '已连接' : '未连接'}`);
    await screenshot('01-current');

    // 2. TronLink 扩展 ID
    const TRONLINK_EXT_ID = 'ibnejdfjmmkpcnlpebklmnkoeoihofec';

    // 3. 尝试打开 TronLink 扩展弹窗
    // 方法1: 通过扩展 URL 直接打开
    log('[2] 尝试打开 TronLink 扩展弹窗');
    
    try {
        // 打开扩展 popup 页面
        const popupUrl = `chrome-extension://${TRONLINK_EXT_ID}/popup.html`;
        
        // 使用 Browser.setPermission 允许扩展访问
        // 然后创建新窗口打开扩展
        const { targetId } = await Target.createTarget({
            url: popupUrl,
            width: 375,
            height: 600,
            newWindow: true
        });
        
        log(`打开扩展窗口: targetId=${targetId}`);
        await sleep(3000);
        
        // 切换到扩展窗口
        await Target.activateTarget({ targetId });
        await sleep(1000);
        await screenshot('02-tronlink-popup');
        
    } catch (e) {
        log(`打开扩展失败: ${e.message}`);
        
        // 方法2: 尝试模拟点击扩展图标
        log('[3] 尝试通过扩展 API 触发');
        
        // 获取所有扩展 targets
        const { targetInfos } = await Target.getTargets();
        log(`找到 ${targetInfos.length} 个 targets`);
        
        // 查找 TronLink 相关页面
        const tronlinkTargets = targetInfos.filter(t => 
            t.url?.includes(TRONLINK_EXT_ID) || 
            t.title?.toLowerCase().includes('tronlink')
        );
        log(`TronLink targets: ${tronlinkTargets.length}`);
        tronlinkTargets.forEach(t => log(`  - ${t.type}: ${t.title}`));
    }

    // 4. 获取 NFT 信息（通过合约）
    log('[4] 获取 NFT 收藏品数量');
    const nftInfo = await eval_(`(async function() {
        if (!window.tronWeb) return { error: 'No tronWeb' };
        
        const address = window.tronWeb.defaultAddress?.base58;
        const contractAddress = window.__NFT_CONTRACT_ONCHAIN || 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';
        
        try {
            const contract = await window.tronWeb.contract().at(contractAddress);
            const balance = await contract.balanceOf(address).call();
            
            // 尝试获取 token IDs
            const tokenIds = [];
            const total = parseInt(balance.toString ? balance.toString() : balance);
            
            // 获取用户持有的 tokenId 列表（如果合约支持）
            try {
                for (let i = 0; i < Math.min(total, 50); i++) {
                    // 某些合约支持 tokenOfOwnerByIndex
                    try {
                        const tokenId = await contract.tokenOfOwnerByIndex(address, i).call();
                        tokenIds.push(tokenId.toString ? tokenId.toString() : tokenId);
                    } catch (_) {
                        break;
                    }
                }
            } catch (_) {}
            
            return {
                address: address,
                contract: contractAddress,
                balance: total,
                tokenIds: tokenIds.slice(0, 10) // 只显示前10个
            };
        } catch (e) {
            return { error: e.message, address: address };
        }
    })()`);
    
    if (nftInfo?.balance !== undefined) {
        log(`\n========================================`);
        log(`📍 钱包地址: ${nftInfo.address}`);
        log(`📍 NFT 合约: ${nftInfo.contract}`);
        log(`📍 NFT 收藏品数量: **${nftInfo.balance} 个**`);
        if (nftInfo.tokenIds?.length > 0) {
            log(`📍 Token IDs: ${nftInfo.tokenIds.join(', ')}...`);
        }
        log(`========================================\n`);
    } else {
        log(`获取 NFT 信息失败: ${nftInfo?.error}`);
    }

    // 5. 检查所有扩展窗口
    log('[5] 检查所有浏览器窗口');
    const { targetInfos: allTargets } = await Target.getTargets();
    
    // 查找可能打开的 TronLink 窗口
    const popupTargets = allTargets.filter(t => 
        t.type === 'page' && 
        (t.url?.includes(TRONLINK_EXT_ID) || t.title?.toLowerCase().includes('tron'))
    );
    
    if (popupTargets.length > 0) {
        log(`找到 ${popupTargets.length} 个 TronLink 窗口`);
        
        for (const target of popupTargets) {
            log(`切换到: ${target.title}`);
            await Target.activateTarget({ targetId: target.targetId });
            await sleep(1000);
            await screenshot(`tronlink-window-${Date.now()}`);
            
            // 尝试查找收藏品按钮
            const collectBtn = await eval_(`(function() {
                const buttons = document.querySelectorAll('button, [role="tab"], .tab, .nav-item, div[class*="tab"], div[class*="nav"]');
                for (const btn of buttons) {
                    const text = (btn.textContent || '').toLowerCase();
                    if (text.includes('收藏品') || text.includes('collectibles') || text.includes('nft') || text.includes('收藏')) {
                        btn.click();
                        return { clicked: true, text: btn.textContent?.trim() };
                    }
                }
                return { clicked: false };
            })()`);
            
            if (collectBtn?.clicked) {
                log(`✅ 点击收藏品按钮: ${collectBtn.text}`);
                await sleep(2000);
                await screenshot('tronlink-collectibles');
            }
        }
    }

    // 6. 最终截图
    await screenshot('final-state');

    await client.close();
    log('✅ 完成');
    
    return nftInfo;
}

test().catch(e => { console.error(e); process.exit(1); });
