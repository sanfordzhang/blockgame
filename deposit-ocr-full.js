/**
 * 完整 Deposit + 自动签名流程（OCR 动态检测版）
 * 
 * 使用 Vision OCR 动态检测按钮位置，然后 cliclick 点击
 * 
 * 使用方法: node deposit-ocr-full.js [金额]
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const depositAmount = process.argv[2] || '10';
const SCREEN_WIDTH = 1512;
const SCREEN_HEIGHT = 982;

const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cliclick(cmd) {
    try {
        log(`  cliclick ${cmd}`);
        const result = execSync(`cliclick ${cmd}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        return result.trim();
    } catch (e) {
        log(`  ⚠️ cliclick 错误: ${e.stderr || e.message}`);
        return null;
    }
}

function screenshot(name) {
    const filepath = `/tmp/${name}.png`;
    try {
        execSync(`screencapture -x ${filepath}`, { encoding: 'utf-8' });
        return filepath;
    } catch (e) {
        log(`⚠️ 截图失败: ${e.message}`);
        return null;
    }
}

// 使用 Swift Vision OCR 识别按钮位置
function ocrFindButtons(imagePath, keywords) {
    try {
        const swiftScript = path.join(__dirname, 'ocr-vision.swift');
        const result = execSync(`swift "${swiftScript}" "${imagePath}"`, { 
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024
        });
        
        const items = JSON.parse(result);
        const found = [];
        
        for (const item of items) {
            for (const keyword of keywords) {
                if (item.text && item.text.toLowerCase().includes(keyword.toLowerCase())) {
                    found.push({
                        text: item.text,
                        x: item.x,
                        y: item.y
                    });
                    break;
                }
            }
        }
        
        return found;
    } catch (e) {
        log(`OCR 失败: ${e.message}`);
        return [];
    }
}

// 使用文档中的固定坐标作为备选
const FALLBACK_COORDS = {
    depositButton: { x: 718, y: 788 },
    signButton: { x: 1406, y: 638 }
};

async function main() {
    log('========================================');
    log(' 完整 Deposit + 自动签名流程 (OCR)');
    log('========================================');
    log(`充值金额: ${depositAmount} TRX`);

    // ========== Step 1: 截图初始状态 ==========
    log('\n[1] 截图初始状态');
    const initialScreenshot = screenshot('deposit-ocr-01-initial');
    
    // ========== Step 2: OCR 查找 Deposit 按钮 ==========
    log('\n[2] OCR 查找 Deposit 按钮');
    let depositPos = null;
    
    if (initialScreenshot) {
        const found = ocrFindButtons(initialScreenshot, ['deposit', '充值']);
        if (found.length > 0) {
            depositPos = found[0];
            log(`✅ OCR 找到 Deposit 按钮: "${depositPos.text}" at (${depositPos.x}, ${depositPos.y})`);
        }
    }
    
    if (!depositPos) {
        depositPos = FALLBACK_COORDS.depositButton;
        log(`⚠️ OCR 未找到，使用固定坐标: (${depositPos.x}, ${depositPos.y})`);
    }

    // ========== Step 3: 点击 Deposit 按钮 ==========
    log('\n[3] 点击 Deposit 按钮');
    cliclick(`m:${depositPos.x},${depositPos.y}`);
    await sleep(500);
    cliclick(`c:${depositPos.x},${depositPos.y}`);
    log(`  ✅ 已点击 Deposit 按钮`);
    
    await sleep(2000);
    screenshot('deposit-ocr-02-after-deposit-click');

    // ========== Step 4: 查找输入框并输入金额 ==========
    log('\n[4] 输入充值金额');
    
    // 查找输入框（通常在 Deposit 按钮上方）
    const inputX = depositPos.x;
    const inputY = depositPos.y - 100;
    
    cliclick(`m:${inputX},${inputY}`);
    await sleep(300);
    cliclick(`c:${inputX},${inputY}`);
    await sleep(500);
    
    // 清空并输入
    cliclick('kp:delete');
    await sleep(100);
    cliclick('kp:delete');
    await sleep(100);
    
    for (const char of depositAmount) {
        cliclick(`t:${char}`);
        await sleep(100);
    }
    log(`  ✅ 已输入金额: ${depositAmount}`);
    
    await sleep(500);
    screenshot('deposit-ocr-03-amount-entered');

    // ========== Step 5: 点击确认按钮 ==========
    log('\n[5] 点击确认按钮');
    const confirmX = depositPos.x;
    const confirmY = depositPos.y;
    
    cliclick(`m:${confirmX},${confirmY}`);
    await sleep(300);
    cliclick(`c:${confirmX},${confirmY}`);
    log(`  ✅ 已点击确认按钮`);
    
    await sleep(2000);
    screenshot('deposit-ocr-04-confirm-clicked');

    // ========== Step 6: 等待 TronLink 签名弹窗 ==========
    log('\n[6] 等待 TronLink 签名弹窗（约 5 秒）');
    await sleep(5000);
    
    const beforeSignScreenshot = screenshot('deposit-ocr-05-before-sign');
    
    // ========== Step 7: OCR 查找签名按钮 ==========
    log('\n[7] OCR 查找签名按钮');
    let signPos = null;
    
    if (beforeSignScreenshot) {
        const found = ocrFindButtons(beforeSignScreenshot, ['sign', '签名', '确认', 'confirm']);
        if (found.length > 0) {
            // 选择最可能是签名按钮的（通常在右侧，包含 "Sign"）
            signPos = found.find(f => f.text.toLowerCase().includes('sign')) || found[0];
            log(`✅ OCR 找到签名按钮: "${signPos.text}" at (${signPos.x}, ${signPos.y})`);
        }
    }
    
    if (!signPos) {
        signPos = FALLBACK_COORDS.signButton;
        log(`⚠️ OCR 未找到，使用固定坐标: (${signPos.x}, ${signPos.y})`);
    }

    // ========== Step 8: 自动签名（三次点击）==========
    log('\n[8] 自动签名（三次点击）');
    
    // 第一次：聚焦窗口
    log('  第一次点击（聚焦窗口）...');
    cliclick(`m:${signPos.x},${signPos.y}`);
    await sleep(2000);
    screenshot('deposit-ocr-06-sign-focus');
    
    // 第二次：确认签名
    log('  第二次点击（确认签名）...');
    cliclick(`c:${signPos.x},${signPos.y}`);
    await sleep(2000);
    screenshot('deposit-ocr-07-sign-confirm');
    
    // 第三次：确保签名完成
    log('  第三次点击（确保签名）...');
    cliclick(`c:${signPos.x},${signPos.y}`);
    await sleep(2000);
    screenshot('deposit-ocr-08-after-sign');

    // ========== Step 9: 等待交易确认 ==========
    log('\n[9] 等待交易确认（约 10 秒）');
    await sleep(10000);
    
    const resultScreenshot = screenshot('deposit-ocr-09-result');
    
    // ========== Step 10: OCR 验证结果 ==========
    log('\n[10] OCR 验证结果');
    
    if (resultScreenshot) {
        const found = ocrFindButtons(resultScreenshot, ['success', '成功', 'completed', 'transaction', '交易']);
        if (found.length > 0) {
            log(`检测到关键词: ${found.map(f => f.text).join(', ')}`);
        }
        
        // 检查余额
        const balanceItems = ocrFindButtons(resultScreenshot, ['trx', 'balance']);
        if (balanceItems.length > 0) {
            log(`余额信息: ${balanceItems.map(b => b.text).join(', ')}`);
        }
    }

    log('\n========================================');
    log(' 流程完成');
    log('========================================');
    log(`截图已保存到 /tmp/ 目录`);
}

main().catch(e => { console.error(e); process.exit(1); });
