/**
 * 完整 Deposit + 自动签名流程（增强版）
 * 
 * 1. 先打开 TronLink 钱包确保连接
 * 2. OCR 检测 Deposit 按钮
 * 3. 点击 Deposit，输入金额
 * 4. 等待并检测签名弹窗
 * 5. 自动签名
 * 
 * 使用方法: node deposit-complete.js [金额]
 */
const { execSync } = require('child_process');
const path = require('path');

const depositAmount = process.argv[2] || '10';

// 坐标配置
const COORDS = {
    tronlinkIcon: { x: 1364, y: 100 },
    signButton: { x: 1406, y: 638 },
    depositButton: { x: 718, y: 788 }
};

const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function cliclick(cmd) {
    try {
        log(`  cliclick ${cmd}`);
        execSync(`cliclick ${cmd}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        return true;
    } catch (e) {
        return false;
    }
}

function screenshot(name) {
    execSync(`screencapture -x /tmp/${name}.png`);
    return `/tmp/${name}.png`;
}

function ocrFindButton(imagePath, keywords) {
    try {
        const swiftScript = path.join(__dirname, 'ocr-vision.swift');
        const result = execSync(`swift "${swiftScript}" "${imagePath}"`, { 
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024
        });
        
        const items = JSON.parse(result);
        for (const item of items) {
            for (const keyword of keywords) {
                if (item.text && item.text.toLowerCase().includes(keyword.toLowerCase())) {
                    return item;
                }
            }
        }
        return null;
    } catch (e) {
        return null;
    }
}

async function main() {
    log('========================================');
    log(' 完整 Deposit + 自动签名流程');
    log('========================================');
    log(`充值金额: ${depositAmount} TRX`);

    // ========== Step 1: 打开 TronLink 确保连接 ==========
    log('\n[1] 打开 TronLink 钱包');
    cliclick(`c:${COORDS.tronlinkIcon.x},${COORDS.tronlinkIcon.y}`);
    await sleep(3000);
    screenshot('deposit-01-tronlink-open');
    
    // 关闭弹窗（点击其他区域）
    cliclick('c:400,400');
    await sleep(1000);

    // ========== Step 2: 截图并 OCR 查找 Deposit 按钮 ==========
    log('\n[2] OCR 查找 Deposit 按钮');
    const screenshot1 = screenshot('deposit-02-before');
    
    let depositBtn = ocrFindButton(screenshot1, ['deposit', '充值']);
    if (!depositBtn) {
        depositBtn = COORDS.depositButton;
        log(`  使用固定坐标: (${depositBtn.x}, ${depositBtn.y})`);
    } else {
        log(`  ✅ OCR 找到: "${depositBtn.text}" at (${depositBtn.x}, ${depositBtn.y})`);
    }

    // ========== Step 3: 点击 Deposit ==========
    log('\n[3] 点击 Deposit 按钮');
    cliclick(`m:${depositBtn.x},${depositBtn.y}`);
    await sleep(500);
    cliclick(`c:${depositBtn.x},${depositBtn.y}`);
    await sleep(3000);
    
    const afterDeposit = screenshot('deposit-03-after-deposit');
    
    // 检查是否显示 "Depositing..."
    const depositingBtn = ocrFindButton(afterDeposit, ['depositing', '处理中']);
    if (depositingBtn) {
        log(`  ⚠️ 检测到 "${depositingBtn.text}"，等待完成...`);
        await sleep(5000);
        screenshot('deposit-04-waiting');
    }

    // ========== Step 4: 输入金额 ==========
    log('\n[4] 输入充值金额');
    
    // 点击输入框（Deposit 按钮上方）
    const inputY = depositBtn.y - 100;
    cliclick(`m:${depositBtn.x},${inputY}`);
    await sleep(300);
    cliclick(`c:${depositBtn.x},${inputY}`);
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
    log(`  ✅ 已输入: ${depositAmount}`);
    
    await sleep(500);
    screenshot('deposit-05-amount');

    // ========== Step 5: 点击确认 ==========
    log('\n[5] 点击确认按钮');
    cliclick(`c:${depositBtn.x},${depositBtn.y}`);
    await sleep(3000);
    
    screenshot('deposit-06-confirm');

    // ========== Step 6: 等待 TronLink 签名弹窗 ==========
    log('\n[6] 等待 TronLink 签名弹窗');
    
    // 等待弹窗出现
    for (let i = 0; i < 10; i++) {
        await sleep(1000);
        log(`  等待 ${i + 1} 秒...`);
        
        const currentScreen = screenshot(`deposit-07-wait-${i}`);
        const signBtn = ocrFindButton(currentScreen, ['sign', '签名', '确认', 'approve']);
        
        if (signBtn) {
            log(`  ✅ 检测到签名按钮: "${signBtn.text}" at (${signBtn.x}, ${signBtn.y})`);
            
            // ========== Step 7: 自动签名 ==========
            log('\n[7] 自动签名（三次点击）');
            
            // 第一次：聚焦
            cliclick(`m:${signBtn.x},${signBtn.y}`);
            await sleep(2000);
            
            // 第二次：确认
            cliclick(`c:${signBtn.x},${signBtn.y}`);
            await sleep(2000);
            
            // 第三次：确保
            cliclick(`c:${signBtn.x},${signBtn.y}`);
            await sleep(2000);
            
            break;
        }
        
        // 如果没有检测到签名按钮，可能是弹窗没有出现
        // 使用固定坐标尝试
        if (i === 5) {
            log(`  ⚠️ 未检测到签名按钮，使用固定坐标尝试...`);
            cliclick(`m:${COORDS.signButton.x},${COORDS.signButton.y}`);
            await sleep(2000);
            cliclick(`c:${COORDS.signButton.x},${COORDS.signButton.y}`);
            await sleep(2000);
        }
    }

    // ========== Step 8: 等待交易确认 ==========
    log('\n[8] 等待交易确认');
    await sleep(10000);
    
    const finalScreen = screenshot('deposit-08-result');
    
    // ========== Step 9: 验证结果 ==========
    log('\n[9] 验证结果');
    
    const successBtn = ocrFindButton(finalScreen, ['success', '成功', 'completed']);
    if (successBtn) {
        log(`  ✅ 检测到成功标志: "${successBtn.text}"`);
    }
    
    // 检查余额
    const balanceItems = ocrFindButton(finalScreen, ['trx', 'balance']);
    if (balanceItems) {
        log(`  余额信息: ${balanceItems.text}`);
    }

    log('\n========================================');
    log(' 流程完成');
    log('========================================');
    log('截图保存在 /tmp/deposit-*.png');
    
    // 复制到 test-results
    execSync('cp /tmp/deposit-*.png /Users/yingfengzhang/1JackSource/blockchain/game-core/test-results/ 2>/dev/null || true');
}

main().catch(e => { console.error(e); process.exit(1); });
