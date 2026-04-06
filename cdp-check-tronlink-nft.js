/**
 * CDP 测试：检查 TronLink 钱包中的 NFT 收藏品
 * 
 * 使用方法: node cdp-check-tronlink-nft.js
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
            log(`⚠️ 截图失败 ${name}: ${e.message}`);
        }
    };

    const eval_ = async (expr) => {
        const r = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
        return r.result?.value;
    };

    log('=== 检查 TronLink 钱包 NFT 收藏品 ===');

    // 1. 获取当前页面截图
    log('[1] 获取当前页面');
    await screenshot('01-current-page');

    // 2. 查找 TronLink 扩展图标
    log('[2] 查找 TronLink 扩展图标');
    
    // 检查页面上是否有 TronLink 相关元素
    const tronlinkInfo = await eval_(`({
        hasTronLink: typeof window.tronWeb !== 'undefined',
        tronWebAddress: window.tronWeb?.defaultAddress?.base58,
        tronWebReady: window.tronWeb?.ready
    })`);
    log(`TronLink 状态: ${JSON.stringify(tronlinkInfo)}`);

    // 3. 尝试通过扩展 ID 打开 TronLink 弹窗
    // TronLink 扩展通常的 ID 格式
    const tronlinkExtensionIds = [
        'ibnejdfjmmkpcnlpebklmnkoeoihofec', // Chrome Web Store ID
        'nkbihfbeogaeaoehlefnkodbefgpgknn', // 常见格式
    ];

    // 4. 获取所有 targets（包括扩展页面）
    log('[3] 获取浏览器 targets');
    const { targetInfos } = await Target.getTargets();
    
    const tronlinkTargets = targetInfos.filter(t => 
        t.url?.includes('tronlink') || 
        t.title?.toLowerCase().includes('tronlink') ||
        t.url?.includes('ibnejdfjmmkpcnlpebklmnkoeoihofec')
    );
    
    log(`找到 ${tronlinkTargets.length} 个 TronLink 相关 target`);
    tronlinkTargets.forEach((t, i) => {
        log(`  [${i}] ${t.type}: ${t.title} - ${t.url?.substring(0, 50)}`);
    });

    // 5. 尝试点击页面上的 TronLink 按钮（如果有）
    log('[4] 尝试点击页面上的 TronLink 元素');
    
    // 点击可能的 TronLink 按钮
    const clicked = await eval_(`(function() {
        // 查找可能的 TronLink 连接按钮
        const buttons = document.querySelectorAll('button, [role="button"], .btn');
        for (const btn of buttons) {
            const text = btn.textContent?.toLowerCase() || '';
            if (text.includes('tronlink') || text.includes('connect') || text.includes('wallet')) {
                console.log('[CDP] Found wallet button:', btn.textContent?.trim());
                // btn.click();
                return { found: true, text: btn.textContent?.trim() };
            }
        }
        
        // 查找扩展弹窗触发器（通常在右上角）
        const header = document.querySelector('header') || document.body;
        const allElements = header.querySelectorAll('*');
        for (const el of allElements) {
            if (el.offsetWidth < 50 && el.offsetHeight < 50) {
                // 可能是图标
                const style = window.getComputedStyle(el);
                if (style.cursor === 'pointer' || el.onclick) {
                    return { found: true, element: el.tagName, class: el.className };
                }
            }
        }
        
        return { found: false };
    })()`);
    log(`点击结果: ${JSON.stringify(clicked)}`);

    // 6. 如果有 TronLink target，切换到它
    if (tronlinkTargets.length > 0) {
        log('[5] TronLink 弹窗已存在，尝试操作');
        
        // 连接到 TronLink popup
        const tronlinkTarget = tronlinkTargets[0];
        try {
            const { targetId } = await Target.activateTarget({ targetId: tronlinkTarget.targetId });
            
            // 等待一下
            await sleep(1000);
            
            // 尝试查找"收藏品"或"NFT"按钮
            const nftButton = await eval_(`(function() {
                const buttons = document.querySelectorAll('button, [role="tab"], .tab, .nav-item');
                for (const btn of buttons) {
                    const text = btn.textContent?.toLowerCase() || '';
                    if (text.includes('收藏品') || text.includes('collectibles') || text.includes('nft')) {
                        btn.click();
                        return { clicked: true, text: btn.textContent?.trim() };
                    }
                }
                return { clicked: false };
            })()`);
            
            if (nftButton?.clicked) {
                log(`✅ 点击了收藏品按钮: ${nftButton.text}`);
                await sleep(2000);
                await screenshot('02-tronlink-nft');
            }
        } catch (e) {
            log(`操作 TronLink target 失败: ${e.message}`);
        }
    }

    // 7. 获取收藏品数量（通过 API 或 DOM）
    log('[6] 获取 NFT 收藏品信息');
    
    // 方法1: 通过 tronWeb API
    const nftInfo = await eval_(`(async function() {
        if (!window.tronWeb) return { error: 'No tronWeb' };
        
        const address = window.tronWeb.defaultAddress?.base58;
        if (!address) return { error: 'No address' };
        
        // 尝试获取 NFT 列表
        try {
            const contractAddress = window.__NFT_CONTRACT_ONCHAIN || 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';
            const contract = await window.tronWeb.contract().at(contractAddress);
            
            // 获取用户持有的 NFT 数量
            const balance = await contract.balanceOf(address).call();
            
            return {
                address: address,
                contract: contractAddress,
                balance: balance.toString ? balance.toString() : balance
            };
        } catch (e) {
            return { error: e.message, address: address };
        }
    })()`);
    
    log(`NFT 合约信息: ${JSON.stringify(nftInfo)}`);

    // 8. 最终截图
    await screenshot('03-final');

    // 9. 获取控制台日志
    log('[7] 获取浏览器控制台日志');
    const consoleLogs = await eval_(`(function() {
        // 返回一些诊断信息
        return {
            url: window.location.href,
            title: document.title,
            tronLink: {
                installed: typeof window.tronWeb !== 'undefined',
                ready: window.tronWeb?.ready,
                address: window.tronWeb?.defaultAddress?.base58
            }
        };
    })()`);
    log(`页面信息: ${JSON.stringify(consoleLogs)}`);

    await client.close();
    log('✅ 检查完成');
}

test().catch(e => { console.error(e); process.exit(1); });
