const { execSync } = require('child_process');
const fs = require('fs');
const CDP = require('chrome-remote-interface');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

/**
 * 自动分析并点击TronLink图标
 */
async function autoClickTronLink() {
    try {
        log('=== 自动分析并点击TronLink图标 ===');
        log('');

        if (!fs.existsSync('test-results')) {
            fs.mkdirSync('test-results');
        }

        // 步骤1: 连接Chrome获取窗口信息
        log('🔌 [步骤1] 连接Chrome获取浏览器窗口信息...');
        const client = await CDP({ port: 9222 });
        const { Page, Runtime, Browser } = client;
        await Page.enable();
        await Runtime.enable();

        // 获取浏览器窗口位置和大小
        const windowInfo = await Browser.getWindowForTarget();
        log(`   窗口信息: ${JSON.stringify(windowInfo)}`);

        // 获取页面视口信息
        const viewport = await Runtime.evaluate({
            expression: `({
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                outerWidth: window.outerWidth,
                outerHeight: window.outerHeight,
                screenX: window.screenX,
                screenY: window.screenY,
                devicePixelRatio: window.devicePixelRatio
            })`,
            returnByValue: true
        });
        const viewportInfo = viewport.result.value;
        log(`   视口信息: ${JSON.stringify(viewportInfo)}`);

        await client.close();

        // 步骤2: 截取完整屏幕
        log('');
        log('📸 [步骤2] 截取完整屏幕...');
        execSync('screencapture -x test-results/screen-analysis.png');
        log('✅ 保存: test-results/screen-analysis.png');

        // 步骤3: 计算TronLink图标位置
        log('');
        log('🎯 [步骤3] 计算TronLink图标位置...');

        // 根据Chrome浏览器的标准布局：
        // - 扩展图标位于地址栏右侧
        // - 通常在窗口右上角，距离右边缘约40-150像素
        // - 垂直位置在工具栏中间，约为窗口顶部+60像素

        const browserX = viewportInfo.screenX || 0;
        const browserY = viewportInfo.screenY || 0;
        const browserWidth = viewportInfo.outerWidth || 1430;
        const browserHeight = viewportInfo.outerHeight || 900;

        log(`   浏览器位置: (${browserX}, ${browserY})`);
        log(`   浏览器大小: ${browserWidth}x${browserHeight}`);

        // TronLink图标通常在浏览器右上角
        // 从右边缘往左约100-130像素（扩展图标区域）
        // 从顶部往下约60像素（工具栏高度）
        const iconX = browserX + browserWidth - 130;
        const iconY = browserY + 60;

        log(`   计算的图标位置: (${iconX}, ${iconY})`);

        // 步骤4: 移动鼠标到图标位置
        log('');
        log('🖱️  [步骤4] 移动鼠标到TronLink图标...');
        execSync(`cliclick m:${iconX},${iconY}`);
        log(`   ✅ 鼠标已移动到 (${iconX}, ${iconY})`);
        await sleep(500);

        // 步骤5: 截图验证鼠标位置
        log('');
        log('📸 [步骤5] 截图验证鼠标位置...');
        execSync('screencapture -x test-results/mouse-on-icon.png');
        log('✅ 保存: test-results/mouse-on-icon.png');

        // 步骤6: 执行点击
        log('');
        log('🖱️  [步骤6] 点击TronLink图标...');
        execSync(`cliclick c:${iconX},${iconY}`);
        log('   ✅ 点击完成');

        // 步骤7: 等待钱包弹窗
        log('');
        log('⏳ [步骤7] 等待TronLink钱包弹窗...');
        await sleep(2000);

        // 步骤8: 截取点击后的屏幕
        log('');
        log('📸 [步骤8] 截取点击后的屏幕...');
        execSync('screencapture -x test-results/after-auto-click.png');
        log('✅ 保存: test-results/after-auto-click.png');

        // 步骤9: 分析结果
        log('');
        log('📊 [步骤9] 分析结果...');
        const beforeSize = fs.statSync('test-results/screen-analysis.png').size;
        const afterSize = fs.statSync('test-results/after-auto-click.png').size;
        const sizeDiff = Math.abs(beforeSize - afterSize);

        log(`   点击前: ${(beforeSize / 1024).toFixed(2)} KB`);
        log(`   点击后: ${(afterSize / 1024).toFixed(2)} KB`);
        log(`   差异: ${(sizeDiff / 1024).toFixed(2)} KB`);

        if (sizeDiff > 10000) {
            log('   ✅ 屏幕内容发生明显变化，TronLink钱包可能已打开');
        } else {
            log('   ⚠️  屏幕内容变化不明显');
            log('');
            log('   尝试备用位置...');

            // 尝试其他可能的位置
            const alternativePositions = [
                { x: browserX + browserWidth - 100, y: browserY + 60, desc: '更靠右' },
                { x: browserX + browserWidth - 160, y: browserY + 60, desc: '更靠左' },
                { x: browserX + browserWidth - 130, y: browserY + 50, desc: '更靠上' },
                { x: browserX + browserWidth - 130, y: browserY + 70, desc: '更靠下' }
            ];

            for (let i = 0; i < alternativePositions.length; i++) {
                const pos = alternativePositions[i];
                log(`   尝试位置${i + 1} (${pos.desc}): (${pos.x}, ${pos.y})`);

                execSync(`cliclick m:${pos.x},${pos.y}`);
                await sleep(300);
                execSync(`cliclick c:${pos.x},${pos.y}`);
                await sleep(1500);

                execSync(`screencapture -x test-results/attempt-${i + 1}.png`);
                const attemptSize = fs.statSync(`test-results/attempt-${i + 1}.png`).size;
                const attemptDiff = Math.abs(beforeSize - attemptSize);

                if (attemptDiff > 10000) {
                    log(`   ✅ 位置${i + 1}成功！差异: ${(attemptDiff / 1024).toFixed(2)} KB`);
                    log(`   成功坐标: (${pos.x}, ${pos.y})`);
                    break;
                }
            }
        }

        log('');
        log('✅ ========== 测试完成 ==========');
        log('');
        log('📁 生成的文件:');
        log('   - test-results/screen-analysis.png (初始屏幕)');
        log('   - test-results/mouse-on-icon.png (鼠标移动后)');
        log('   - test-results/after-auto-click.png (点击后)');
        log('');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// 运行
autoClickTronLink();
