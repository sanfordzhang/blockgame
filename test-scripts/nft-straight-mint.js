/**
 * 模拟点击"锻造NFT"按钮，触发锻造流程
 * 使用CDP控制浏览器 + cliclick自动签名
 */

const CDP = require('chrome-remote-interface');
const { execSync } = require('child_process');
const fs = require('fs');

const CONFIG = {
    cdpPort: 9222,
    testResultsDir: './test-results',
    // TronLink坐标（来自deposit-auto-final.sh）
    signBtnX: 1414,
    signBtnY: 635,
    tronlinkIconX: 1238,
    tronlinkIconY: 50
};

function log(msg) {
    console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(Page, filename) {
    try {
        const { data } = await Page.captureScreenshot();
        const filepath = `${CONFIG.testResultsDir}/${filename}`;
        fs.writeFileSync(filepath, Buffer.from(data, 'base64'));
        log(`📸 截图: ${filename}`);
    } catch (error) {
        log(`截图失败: ${error.message}`);
    }
}

async function main() {
    let client;
    
    try {
        // 确保目录存在
        if (!fs.existsSync(CONFIG.testResultsDir)) {
            fs.mkdirSync(CONFIG.testResultsDir, { recursive: true });
        }
        
        log('========================================');
        log('  锻造NFT流程');
        log('========================================');
        
        // 连接CDP
        log('连接Chrome CDP...');
        client = await CDP({ port: CONFIG.cdpPort });
        const { Page, Runtime } = client;
        
        await Page.enable();
        await Runtime.enable();
        
        // 初始截图
        await takeScreenshot(Page, 'nft-mint-01-initial.png');
        
        // 查找"锻造NFT"按钮
        log('查找"锻造NFT"按钮...');
        
        const findMintButton = async () => {
            const result = await Runtime.evaluate({
                expression: `
                    (function() {
                        // 查找所有可能的锻造按钮
                        const buttons = document.querySelectorAll('button');
                        const candidates = [];
                        
                        for (const btn of buttons) {
                            const text = btn.textContent.trim();
                            const disabled = btn.disabled;
                            
                            // 匹配各种可能的按钮文本
                            if (text.includes('锻造') || text.includes('NFT') || 
                                text.includes('Mint') || text.includes('铸造') ||
                                text.includes('准备锻造') || text.includes('立即锻造')) {
                                candidates.push({
                                    text: text,
                                    disabled: disabled,
                                    found: true
                                });
                                
                                // 点击第一个可用的按钮
                                if (!disabled) {
                                    btn.click();
                                    return JSON.stringify({
                                        clicked: true,
                                        text: text
                                    });
                                }
                            }
                        }
                        
                        // 查找成就弹窗
                        const popup = document.querySelector('[class*="achievement"], [class*="nft"], [class*="NFT"]');
                        if (popup) {
                            const popupButtons = popup.querySelectorAll('button');
                            for (const btn of popupButtons) {
                                if (!btn.disabled && (btn.textContent.includes('锻造') || btn.textContent.includes('Mint'))) {
                                    btn.click();
                                    return JSON.stringify({
                                        clicked: true,
                                        text: btn.textContent.trim()
                                    });
                                }
                            }
                        }
                        
                        return JSON.stringify({
                            clicked: false,
                            candidates: candidates
                        });
                    })()
                `,
                returnByValue: true
            });
            
            log(`[DEBUG] Runtime.evaluate result: ${JSON.stringify(result)}`);
            
            if (result.result && result.result.value) {
                try {
                    return typeof result.result.value === 'string' 
                        ? JSON.parse(result.result.value) 
                        : result.result.value;
                } catch (e) {
                    return { clicked: false, error: e.message };
                }
            }
            
            return { clicked: false, error: 'No result' };
        };
        
        // 尝试查找并点击按钮
        let buttonResult = await findMintButton();
        log(`按钮查找结果: ${JSON.stringify(buttonResult)}`);
        
        if (!buttonResult.clicked) {
            log('未找到可用的锻造按钮，等待页面加载...');
            
            // 等待几秒后重试
            for (let i = 0; i < 5; i++) {
                await sleep(2000);
                buttonResult = await findMintButton();
                
                if (buttonResult.clicked) {
                    break;
                }
                
                log(`重试 ${i + 1}/5...`);
            }
        }
        
        if (buttonResult.clicked) {
            log(`✓ 已点击按钮: ${buttonResult.text}`);
            await takeScreenshot(Page, 'nft-mint-02-button-clicked.png');
            
            // 等待TronLink签名请求
            log('等待TronLink签名请求...');
            await sleep(3000);
            
            await takeScreenshot(Page, 'nft-mint-03-tronlink-wait.png');
            
            // 打开TronLink窗口
            log('打开TronLink窗口...');
            try {
                execSync(`cliclick c:${CONFIG.tronlinkIconX},${CONFIG.tronlinkIconY}`);
                await sleep(2000);
            } catch (error) {
                log(`点击TronLink图标失败: ${error.message}`);
            }
            
            // 点击签名按钮
            log('点击签名按钮...');
            try {
                // 多次点击确保成功
                execSync(`cliclick c:${CONFIG.signBtnX},${CONFIG.signBtnY}`);
                await sleep(1000);
                execSync(`cliclick c:${CONFIG.signBtnX},${CONFIG.signBtnY}`);
                await sleep(1000);
                execSync(`cliclick c:${CONFIG.signBtnX},${CONFIG.signBtnY}`);
                
                log('✓ 已点击签名按钮 3 次');
            } catch (error) {
                log(`点击签名按钮失败: ${error.message}`);
            }
            
            // 等待交易确认
            log('等待交易确认...');
            await sleep(5000);
            
            await takeScreenshot(Page, 'nft-mint-04-final.png');
            
            // 验证结果
            log('验证锻造结果...');
            const verifyResult = await Runtime.evaluate({
                expression: `
                    (() => {
                        // 检查是否显示成功消息
                        const success = document.querySelector('[class*="success"], [class*="Success"]');
                        const nftCard = document.querySelector('[class*="nft-card"], [class*="NFTCard"]');
                        
                        // 检查按钮状态
                        const buttons = document.querySelectorAll('button');
                        let hasPendingButton = false;
                        
                        for (const btn of buttons) {
                            const text = btn.textContent.trim();
                            if (text.includes('锻造中') || text.includes('Pending') || text.includes('处理中')) {
                                hasPendingButton = true;
                            }
                        }
                        
                        return {
                            hasSuccess: !!success,
                            hasNFTCard: !!nftCard,
                            hasPendingButton: hasPendingButton,
                            successText: success ? success.textContent : null
                        };
                    })()
                `
            });
            
            log(`验证结果: ${JSON.stringify(verifyResult.result.value)}`);
            
        } else {
            log('❌ 未找到锻造按钮');
            
            // 显示当前页面所有按钮
            const allButtons = await Runtime.evaluate({
                expression: `
                    (() => {
                        const buttons = document.querySelectorAll('button');
                        return Array.from(buttons).map(btn => ({
                            text: btn.textContent.trim(),
                            disabled: btn.disabled
                        }));
                    })()
                `
            });
            
            log(`当前页面按钮: ${JSON.stringify(allButtons.result.value, null, 2)}`);
        }
        
        log('========================================');
        log('流程完成');
        log('========================================');
        
    } catch (error) {
        log(`❌ 错误: ${error.message}`);
        console.error(error);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

main().catch(console.error);
