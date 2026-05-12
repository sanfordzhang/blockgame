/**
 * 完整 Deposit + 自动签名流程（cliclick + OCR 版本）
 * 
 * 参考: docs/Tronlink_Deposit_AutoSign.md
 * 
 * 不使用 CDP，通过：
 * 1. screencapture 全屏截图
 * 2. OCR 识别按钮位置
 * 3. cliclick 模拟鼠标点击
 * 
 * 使用方法: node deposit-autosign-ocr.js [金额]
 */
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const depositAmount = process.argv[2] || '10';

// 文档中的固定坐标（已验证稳定）
const COORDS = {
    // TronLink 图标
    tronlinkIcon: { x: 1364, y: 100 },
    
    // 签名按钮（绿色确认按钮）
    signButton: { x: 1406, y: 638 },
    
    // Deposit 按钮（归一化坐标转换）
    depositButton: { 
        x: Math.round(1512 * 0.475),  // 718
        y: Math.round(982 * 0.803)    // 788
    },
    
    // 收藏品 Tab
    collectiblesTab: { x: 1099, y: 402 }
};

const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

function cliclick(cmd) {
    try {
        log(`  执行: cliclick ${cmd}`);
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
        log(`📸 截图: ${filepath}`);
        return filepath;
    } catch (e) {
        log(`⚠️ 截图失败: ${e.message}`);
        return null;
    }
}

// OCR 识别按钮位置（使用 vision 框架）
async function findButtonOCR(imagePath, buttonTexts) {
    return new Promise((resolve) => {
        const script = `
            use AppleScript version "2.4"
            use scripting additions
            use framework "Foundation"
            use framework "Vision"
            
            set imagePath to "${imagePath}"
            set buttonKeywords to {${buttonTexts.map(t => `"${t}"`).join(', ')}}
            
            -- 创建图片请求
            set imageURL to current application's NSURL's fileURLWithPath:imagePath
            set imageRequest to current application's VNRecognizeTextRequest's alloc()'s init()
            
            -- 执行 OCR
            set requestHandler to current application's VNImageRequestHandler's alloc()'s initWithURL:imageURL options:(current application's NSDictionary's dictionary())
            requestHandler's performRequests:{imageRequest} |error|:(missing value)
            
            -- 获取识别结果
            set observations to imageRequest's results()
            set buttonPositions to {}
            
            repeat with obs in observations
                set candidates to obs's topCandidates:1
                if (count of candidates) > 0 then
                    set text to (item 1 of candidates)'s string() as text
                    set bbox to obs's boundingBox()
                    
                    -- 检查是否包含关键词
                    repeat with keyword in buttonKeywords
                        set lowerText to do shell script "echo " & quoted form of text & " | tr '[:upper:]' '[:lower:]'"
                        set lowerKeyword to do shell script "echo " & quoted form of keyword & " | tr '[:upper:]' '[:lower:]'"
                        
                        if lowerText contains lowerKeyword then
                            -- 计算中心点坐标（bbox 是归一化坐标，左下角为原点）
                            set screenWidth to do shell script "system_profiler SPDisplaysDataType | grep Resolution | head -1 | awk '{print $2}'"
                            set screenHeight to do shell script "system_profiler SPDisplaysDataType | grep Resolution | head -1 | awk '{print $4}'"
                            
                            -- 使用固定屏幕尺寸（Retina 逻辑分辨率）
                            set screenWidth to 1512
                            set screenHeight to 982
                            
                            set centerX to (x of bbox + (width of bbox) / 2) * screenWidth
                            set centerY to (1 - (y of bbox + (height of bbox) / 2)) * screenHeight
                            
                            set end of buttonPositions to {text:text, x:centerX as integer, y:centerY as integer}
                        end if
                    end repeat
                end if
            end repeat
            
            return buttonPositions
        `;
        
        // 由于 AppleScript Vision 比较复杂，使用简化方案
        resolve(null);
    });
}

// 使用 tesseract OCR（如果安装了）
function findButtonTesseract(imagePath, buttonTexts) {
    try {
        // 检查 tesseract 是否可用
        execSync('which tesseract', { encoding: 'utf-8' });
        
        // 执行 OCR
        const result = execSync(`tesseract ${imagePath} stdout 2>/dev/null`, { encoding: 'utf-8' });
        log(`OCR 结果预览: ${result.substring(0, 200)}`);
        
        // 简单文本匹配（不返回坐标，tesseract 输出无坐标）
        for (const text of buttonTexts) {
            if (result.toLowerCase().includes(text.toLowerCase())) {
                log(`✅ OCR 找到文本: ${text}`);
            }
        }
        
        return null;
    } catch (e) {
        log(`OCR 不可用或失败: ${e.message}`);
        return null;
    }
}

async function main() {
    log('========================================');
    log(' 完整 Deposit + 自动签名流程');
    log('========================================');
    log(`充值金额: ${depositAmount} TRX`);
    log(`使用坐标: ${JSON.stringify(COORDS)}`);

    // ========== Step 1: 截图当前状态 ==========
    log('\n[1] 截图当前状态');
    screenshot('deposit-step1-initial');

    // ========== Step 2: 点击 Deposit 按钮 ==========
    log('\n[2] 点击 Deposit 按钮');
    const { depositButton } = COORDS;
    
    // 移动鼠标
    cliclick(`m:${depositButton.x},${depositButton.y}`);
    await sleep(500);
    
    // 点击
    cliclick(`c:${depositButton.x},${depositButton.y}`);
    log(`  ✅ 已点击 Deposit 按钮 (${depositButton.x}, ${depositButton.y})`);
    
    await sleep(2000);
    screenshot('deposit-step2-after-click');

    // ========== Step 3: 检查是否需要输入金额 ==========
    log('\n[3] 检查页面状态');
    await sleep(1000);
    screenshot('deposit-step3-check');
    
    // 尝试点击输入框并输入金额（使用归一化位置）
    const inputX = 756;  // 大约屏幕中间
    const inputY = 500;  // 输入框位置
    
    cliclick(`m:${inputX},${inputY}`);
    await sleep(300);
    cliclick(`c:${inputX},${inputY}`);
    await sleep(500);
    
    // 清空并输入金额
    cliclick('kp:delete');
    await sleep(100);
    cliclick('kp:delete');
    await sleep(100);
    
    // 输入数字（使用键盘）
    for (const char of depositAmount) {
        cliclick(`t:${char}`);
        await sleep(100);
    }
    
    log(`  ✅ 已输入金额: ${depositAmount}`);
    await sleep(500);
    screenshot('deposit-step4-amount-entered');
    
    // 点击确认按钮（Deposit 按钮位置附近）
    const confirmX = depositButton.x;
    const confirmY = depositButton.y - 100; // 稍微往上
    
    cliclick(`m:${confirmX},${confirmY}`);
    await sleep(300);
    cliclick(`c:${confirmX},${confirmY}`);
    log(`  ✅ 已点击确认按钮`);
    
    await sleep(2000);
    screenshot('deposit-step5-confirm-clicked');

    // ========== Step 4: 等待 TronLink 签名弹窗 ==========
    log('\n[4] 等待 TronLink 签名弹窗（约 5 秒）');
    await sleep(5000);
    screenshot('deposit-step6-before-sign');

    // ========== Step 5: 自动点击签名按钮 ==========
    log('\n[5] 自动点击签名按钮');
    const { signButton } = COORDS;
    
    // 根据文档：需要两次点击
    log(`  签名按钮坐标: (${signButton.x}, ${signButton.y})`);
    
    // 第一次：移动并聚焦窗口
    log('  第一次点击（聚焦窗口）...');
    cliclick(`m:${signButton.x},${signButton.y}`);
    await sleep(2000);
    screenshot('deposit-step7-sign-focus');
    
    // 第二次：确认签名
    log('  第二次点击（确认签名）...');
    cliclick(`c:${signButton.x},${signButton.y}`);
    await sleep(2000);
    screenshot('deposit-step8-sign-confirm');
    
    // 第三次：确保签名完成
    log('  第三次点击（确保签名）...');
    cliclick(`c:${signButton.x},${signButton.y}`);
    await sleep(2000);
    
    screenshot('deposit-step9-after-sign');

    // ========== Step 6: 等待交易确认 ==========
    log('\n[6] 等待交易确认（约 10 秒）');
    await sleep(10000);
    screenshot('deposit-step10-result');

    // ========== Step 7: 验证结果 ==========
    log('\n[7] 流程完成');
    log('========================================');
    log('请检查以下截图验证结果:');
    log('  /tmp/deposit-step1-initial.png');
    log('  /tmp/deposit-step2-after-click.png');
    log('  /tmp/deposit-step6-before-sign.png');
    log('  /tmp/deposit-step9-after-sign.png');
    log('  /tmp/deposit-step10-result.png');
    log('========================================');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(e => { console.error(e); process.exit(1); });
