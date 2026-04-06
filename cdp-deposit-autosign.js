/**
 * 完整 Deposit + 自动签名流程
 * 
 * 参考: docs/Tronlink_Deposit_AutoSign.md
 * 
 * 流程:
 * 1. 导航到钱包页面
 * 2. 点击 Deposit 按钮
 * 3. 等待 TronLink 签名弹窗
 * 4. 使用 cliclick 自动点击签名按钮
 * 5. 验证充值结果
 * 
 * 使用方法: node cdp-deposit-autosign.js [金额]
 */
const CDP = require('chrome-remote-interface');
const { execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
require('dotenv').config({ path: '.env.testnet' });

const API_URL = 'http://127.0.0.1:7778';
const BASE_URL = 'http://127.0.0.1:3001';

const PLAYER1 = {
    address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
    privateKey: '[REMOVED PRIVATE KEY - SEE .env FOR CONFIG]'
};

// TronLink 签名按钮坐标（逻辑坐标）
const SIGN_BUTTON_COORDS = {
    x: 1406,
    y: 638
};

// Deposit 按钮坐标（归一化坐标 -> 逻辑坐标）
// normX=0.475, normY=0.803, 屏幕 1512x982
const DEPOSIT_BUTTON_COORDS = {
    x: Math.round(1512 * 0.475),  // 718
    y: Math.round(982 * 0.803)    // 788
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

function cliclick(cmd) {
    try {
        const result = execSync(`cliclick ${cmd}`, { encoding: 'utf-8' });
        return result.trim();
    } catch (e) {
        log(`cliclick 错误: ${e.message}`);
        return null;
    }
}

function httpPost(url, data) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const opts = { 
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/json', 
                'Content-Length': Buffer.byteLength(body) 
            } 
        };
        const u = new URL(url);
        const req = http.request({ ...opts, hostname: u.hostname, port: u.port, path: u.pathname }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try { resolve(JSON.parse(d)); } 
                catch { resolve(d); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function test() {
    const depositAmount = process.argv[2] || '10'; // 默认 10 TRX
    
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

    log('========================================');
    log(' 完整 Deposit + 自动签名流程');
    log('========================================');
    log(`充值金额: ${depositAmount} TRX`);
    log(`钱包地址: ${PLAYER1.address}`);

    // ========== Step 1: 导航到钱包页面 ==========
    log('\n[1] 导航到钱包页面');
    await Page.navigate({ url: `${BASE_URL}/wallet?address=${PLAYER1.address}` });
    await Page.loadEventFired();
    await sleep(3000);
    await screenshot('01-wallet-page');

    // ========== Step 2: 检查 TronLink 状态 ==========
    log('[2] 检查 TronLink 状态');
    const tronlinkStatus = await eval_(`({
        hasTronWeb: typeof window.tronWeb !== 'undefined',
        address: window.tronWeb?.defaultAddress?.base58,
        ready: window.tronWeb?.ready,
        network: window.tronWeb?.fullNode?.host
    })`);
    log(`TronLink 状态: ${JSON.stringify(tronlinkStatus)}`);

    if (!tronlinkStatus?.hasTronWeb) {
        log('❌ TronLink 未连接，无法进行充值');
        await client.close();
        return;
    }

    // ========== Step 3: 查找并点击 Deposit 按钮 ==========
    log('\n[3] 查找 Deposit 按钮');
    
    // 先通过 CDP 查找按钮
    const depositButtonInfo = await eval_(`(function() {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
            const text = btn.textContent?.toLowerCase() || '';
            if (text.includes('deposit') || text.includes('充值')) {
                const rect = btn.getBoundingClientRect();
                return {
                    found: true,
                    text: btn.textContent?.trim(),
                    disabled: btn.disabled,
                    position: {
                        x: rect.left + rect.width / 2,
                        y: rect.top + rect.height / 2
                    }
                };
            }
        }
        return { found: false };
    })()`);
    
    log(`Deposit 按钮: ${JSON.stringify(depositButtonInfo)}`);

    // ========== Step 4: 点击 Deposit 按钮 ==========
    log('\n[4] 点击 Deposit 按钮');
    
    if (depositButtonInfo?.found && !depositButtonInfo.disabled) {
        // 方法1: 通过 CDP 点击
        log(`通过 CDP 点击 Deposit 按钮`);
        await eval_(`(function() {
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
                const text = btn.textContent?.toLowerCase() || '';
                if (text.includes('deposit') || text.includes('充值')) {
                    btn.click();
                    return 'clicked';
                }
            }
            return 'not found';
        })()`);
        
        await sleep(2000);
        await screenshot('02-deposit-clicked');
        
        // 检查是否出现输入框
        const inputCheck = await eval_(`(function() {
            const inputs = document.querySelectorAll('input[type="number"], input[type="text"]');
            return {
                inputCount: inputs.length,
                firstInput: inputs[0] ? {
                    placeholder: inputs[0].placeholder,
                    value: inputs[0].value
                } : null
            };
        })()`);
        log(`输入框状态: ${JSON.stringify(inputCheck)}`);
        
        // 如果有输入框，输入金额
        if (inputCheck?.inputCount > 0) {
            log(`[5] 输入充值金额: ${depositAmount}`);
            await eval_(`(function() {
                const inputs = document.querySelectorAll('input[type="number"], input[type="text"]');
                if (inputs.length > 0) {
                    inputs[0].value = '${depositAmount}';
                    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
                    inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
                    return 'amount entered';
                }
                return 'no input';
            })()`);
            await sleep(500);
            await screenshot('03-amount-entered');
            
            // 查找确认按钮
            const confirmBtn = await eval_(`(function() {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const text = btn.textContent?.toLowerCase() || '';
                    if (text.includes('confirm') || text.includes('确认') || 
                        text.includes('submit') || text.includes('提交')) {
                        return {
                            found: true,
                            text: btn.textContent?.trim(),
                            disabled: btn.disabled
                        };
                    }
                }
                return { found: false };
            })()`);
            log(`确认按钮: ${JSON.stringify(confirmBtn)}`);
            
            if (confirmBtn?.found && !confirmBtn.disabled) {
                log('[6] 点击确认按钮');
                await eval_(`(function() {
                    const buttons = document.querySelectorAll('button');
                    for (const btn of buttons) {
                        const text = btn.textContent?.toLowerCase() || '';
                        if (text.includes('confirm') || text.includes('确认') || 
                            text.includes('submit') || text.includes('提交')) {
                            btn.click();
                            return 'confirm clicked';
                        }
                    }
                    return 'not found';
                })()`);
                
                await sleep(2000);
                await screenshot('04-confirm-clicked');
            }
        }
    } else {
        // 方法2: 使用文档中的坐标直接点击
        log(`使用坐标点击 Deposit 按钮: (${DEPOSIT_BUTTON_COORDS.x}, ${DEPOSIT_BUTTON_COORDS.y})`);
        cliclick(`m:${DEPOSIT_BUTTON_COORDS.x},${DEPOSIT_BUTTON_COORDS.y}`);
        await sleep(500);
        cliclick(`c:${DEPOSIT_BUTTON_COORDS.x},${DEPOSIT_BUTTON_COORDS.y}`);
        await sleep(2000);
        await screenshot('02-deposit-clicked-coords');
    }

    // ========== Step 5: 等待 TronLink 签名弹窗 ==========
    log('\n[7] 等待 TronLink 签名弹窗（约 5 秒）');
    await sleep(5000);
    
    // 截图当前状态
    await screenshot('05-before-sign');
    
    // ========== Step 6: 自动点击签名按钮 ==========
    log('\n[8] 自动点击签名按钮');
    log(`签名按钮坐标: (${SIGN_BUTTON_COORDS.x}, ${SIGN_BUTTON_COORDS.y})`);
    
    // 根据文档，需要两次点击
    // 第一次：移动并聚焦
    log('  第一次点击（聚焦窗口）...');
    cliclick(`m:${SIGN_BUTTON_COORDS.x},${SIGN_BUTTON_COORDS.y}`);
    await sleep(2000);
    
    // 第二次：确认签名
    log('  第二次点击（确认签名）...');
    cliclick(`c:${SIGN_BUTTON_COORDS.x},${SIGN_BUTTON_COORDS.y}`);
    await sleep(2000);
    
    // 第三次：确保签名完成
    log('  第三次点击（确保签名）...');
    cliclick(`c:${SIGN_BUTTON_COORDS.x},${SIGN_BUTTON_COORDS.y}`);
    
    await sleep(2000);
    await screenshot('06-after-sign');

    // ========== Step 7: 等待交易确认 ==========
    log('\n[9] 等待交易确认（约 10 秒）');
    await sleep(10000);
    await screenshot('07-transaction-result');

    // ========== Step 8: 验证充值结果 ==========
    log('\n[10] 验证充值结果');
    
    // 检查页面提示
    const resultCheck = await eval_(`(function() {
        const body = document.body?.innerText || '';
        const success = body.toLowerCase().includes('success') || 
                       body.includes('成功') ||
                       body.includes('completed');
        const error = body.toLowerCase().includes('error') ||
                     body.toLowerCase().includes('failed') ||
                     body.includes('失败');
        return {
            success: success,
            error: error,
            bodyPreview: body.substring(0, 500)
        };
    })()`);
    
    log(`结果检测: ${resultCheck?.success ? '✅ 成功' : resultCheck?.error ? '❌ 失败' : '⚠️ 未确定'}`);

    // 检查余额变化
    log('\n[11] 检查合约余额');
    const balanceCheck = await eval_(`(async function() {
        if (!window.tronWeb) return { error: 'No tronWeb' };
        
        try {
            const contractAddr = process.env.REACT_APP_CONTRACT_ADDRESS || window.__CONTRACT_ADDRESS;
            if (!contractAddr) return { error: 'No contract address' };
            
            const contract = await window.tronWeb.contract().at(contractAddr);
            const balance = await contract.balances(window.tronWeb.defaultAddress.base58).call();
            
            return {
                balance: balance.toString ? balance.toString() : balance
            };
        } catch (e) {
            return { error: e.message };
        }
    })()`);
    log(`合约余额: ${JSON.stringify(balanceCheck)}`);

    // 最终截图
    await screenshot('08-final-state');

    log('\n========================================');
    log(' Deposit + 自动签名流程完成');
    log('========================================');
    log(`请查看 test-results/ 目录中的截图验证结果`);

    await client.close();
}

test().catch(e => { console.error(e); process.exit(1); });
