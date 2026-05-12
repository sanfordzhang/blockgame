const { execSync } = require('child_process');
const fs = require('fs');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

/**
 * 使用macOS系统命令模拟鼠标点击TronLink图标
 */
async function clickTronLinkIcon() {
    try {
        log('=== 模拟鼠标点击TronLink图标 ===');
        log('');

        if (!fs.existsSync('test-results')) {
            fs.mkdirSync('test-results');
        }

        // 1. 截取当前屏幕状态
        log('📸 [步骤1] 截取点击前的屏幕...');
        execSync('screencapture -x test-results/before-click.png');
        log('✅ 保存: test-results/before-click.png');

        // 2. 获取屏幕分辨率
        log('');
        log('📐 [步骤2] 获取屏幕分辨率...');
        const resolution = execSync('system_profiler SPDisplaysDataType | grep Resolution', { encoding: 'utf8' });
        log(`   屏幕信息: ${resolution.trim()}`);

        // 从截图分析，TronLink图标位于浏览器右上角
        // 根据标准Chrome布局，扩展图标通常在地址栏右侧约40-80像素处
        // 从截图看，窗口宽度约1430像素，图标位置约在右上角

        // 计算点击坐标（基于截图分析）
        // X坐标：屏幕右侧减去约130像素（扩展图标区域）
        // Y坐标：浏览器工具栏高度约60像素
        const clickX = 1290;  // 从截图红色箭头位置估算
        const clickY = 60;    // 工具栏高度

        log('');
        log('🎯 [步骤3] 计算TronLink图标位置...');
        log(`   目标坐标: (${clickX}, ${clickY})`);
        log('   (基于截图中红色箭头指示的位置)');

        // 3. 检查是否安装了cliclick工具
        log('');
        log('🔧 [步骤4] 检查自动化工具...');
        let useCliclick = false;
        try {
            execSync('which cliclick', { encoding: 'utf8' });
            log('   ✅ 找到cliclick工具');
            useCliclick = true;
        } catch (e) {
            log('   ⚠️  未安装cliclick，将使用AppleScript');
            log('   提示: 可通过 "brew install cliclick" 安装以获得更精确的控制');
        }

        // 4. 移动鼠标并点击
        log('');
        log('🖱️  [步骤5] 模拟鼠标操作...');

        if (useCliclick) {
            // 使用cliclick（更精确）
            log(`   移动鼠标到 (${clickX}, ${clickY})...`);
            execSync(`cliclick m:${clickX},${clickY}`);
            await sleep(500);

            log('   执行点击...');
            execSync(`cliclick c:${clickX},${clickY}`);
            log('   ✅ 点击完成');

        } else {
            // 使用AppleScript（macOS原生）
            const appleScript = `
                tell application "System Events"
                    -- 保存当前鼠标位置
                    set originalPos to position of mouse

                    -- 移动鼠标到目标位置
                    set mouseLoc to {${clickX}, ${clickY}}

                    -- 执行点击
                    do shell script "osascript -e 'tell application \\"System Events\\" to click at {${clickX}, ${clickY}}'"
                end tell
            `;

            log(`   使用AppleScript移动鼠标到 (${clickX}, ${clickY}) 并点击...`);

            // 简化的AppleScript命令
            const simpleScript = `osascript -e 'tell application "System Events" to click at {${clickX}, ${clickY}}'`;

            try {
                execSync(simpleScript, { encoding: 'utf8' });
                log('   ✅ 点击完成');
            } catch (e) {
                log('   ⚠️  AppleScript点击失败，尝试备用方案...');

                // 备用方案：使用CGEvent（需要辅助功能权限）
                const pythonScript = `
import Quartz
import time

def click_at(x, y):
    # 移动鼠标
    move = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventMouseMoved, (x, y), 0)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, move)
    time.sleep(0.3)

    # 按下鼠标
    down = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDown, (x, y), 0)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, down)
    time.sleep(0.1)

    # 释放鼠标
    up = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseUp, (x, y), 0)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, up)

click_at(${clickX}, ${clickY})
print("点击完成")
`;

                fs.writeFileSync('/tmp/click_mouse.py', pythonScript);
                try {
                    execSync('python3 /tmp/click_mouse.py', { encoding: 'utf8' });
                    log('   ✅ 使用Python CGEvent点击完成');
                } catch (e2) {
                    log('   ❌ 所有点击方法都失败了');
                    log('   请确保：');
                    log('   1. 系统偏好设置 > 安全性与隐私 > 辅助功能 中已授权Terminal/iTerm');
                    log('   2. 或者安装cliclick: brew install cliclick');
                }
            }
        }

        // 5. 等待钱包弹窗出现
        log('');
        log('⏳ [步骤6] 等待TronLink钱包弹窗...');
        await sleep(2000);

        // 6. 截取点击后的屏幕
        log('');
        log('📸 [步骤7] 截取点击后的屏幕...');
        execSync('screencapture -x test-results/after-click.png');
        log('✅ 保存: test-results/after-click.png');

        // 7. 对比前后截图
        log('');
        log('📊 [步骤8] 分析结果...');
        const beforeSize = fs.statSync('test-results/before-click.png').size;
        const afterSize = fs.statSync('test-results/after-click.png').size;
        log(`   点击前截图大小: ${(beforeSize / 1024).toFixed(2)} KB`);
        log(`   点击后截图大小: ${(afterSize / 1024).toFixed(2)} KB`);

        if (Math.abs(beforeSize - afterSize) > 10000) {
            log('   ✅ 屏幕内容发生变化，可能已打开钱包弹窗');
        } else {
            log('   ⚠️  屏幕内容变化不明显，请检查点击坐标是否准确');
        }

        log('');
        log('✅ ========== 测试完成 ==========');
        log('');
        log('📁 生成的文件:');
        log('   - test-results/before-click.png (点击前)');
        log('   - test-results/after-click.png (点击后)');
        log('');
        log('💡 提示:');
        log('   1. 对比两张截图查看是否成功打开TronLink钱包');
        log('   2. 如果位置不准确，可以调整脚本中的 clickX 和 clickY 坐标');
        log('   3. 建议安装cliclick以获得更精确的鼠标控制: brew install cliclick');
        log('');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

// 运行
clickTronLinkIcon();
