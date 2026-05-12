const { execSync } = require('child_process');
const fs = require('fs');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

/**
 * 使用cliclick精确点击TronLink图标
 */
async function clickTronLinkWithCliclick() {
    try {
        log('=== 使用cliclick模拟点击TronLink图标 ===');
        log('');

        if (!fs.existsSync('test-results')) {
            fs.mkdirSync('test-results');
        }

        // 1. 获取当前鼠标位置
        log('🖱️  [步骤1] 获取当前鼠标位置...');
        const currentPos = execSync('cliclick p', { encoding: 'utf8' }).trim();
        log(`   当前鼠标位置: ${currentPos}`);

        // 2. 截取点击前的屏幕
        log('');
        log('📸 [步骤2] 截取点击前的屏幕...');
        execSync('screencapture -x test-results/mouse-before-click.png');
        log('✅ 保存: test-results/mouse-before-click.png');

        // 3. 计算TronLink图标位置
        // 从用户提供的截图分析：
        // - 浏览器窗口宽度约1430像素
        // - TronLink图标在右上角，红色箭头指向的位置
        // - 图标位于地址栏右侧，距离右边缘约130像素
        // - 垂直位置在工具栏中间，约60像素高度

        log('');
        log('🎯 [步骤3] 计算TronLink图标位置...');

        // 根据截图，TronLink图标的大致位置
        const clickX = 1290;  // X坐标
        const clickY = 60;    // Y坐标

        log(`   目标坐标: (${clickX}, ${clickY})`);
        log('   (基于用户截图中红色箭头指示的位置)');

        // 4. 移动鼠标到目标位置
        log('');
        log('🖱️  [步骤4] 移动鼠标到TronLink图标...');
        execSync(`cliclick m:${clickX},${clickY}`);
        log(`   ✅ 鼠标已移动到 (${clickX}, ${clickY})`);

        await sleep(500);

        // 5. 截取鼠标移动后的屏幕（可以看到鼠标位置）
        log('');
        log('📸 [步骤5] 截取鼠标移动后的屏幕...');
        execSync('screencapture -x test-results/mouse-moved.png');
        log('✅ 保存: test-results/mouse-moved.png');

        // 6. 执行点击
        log('');
        log('🖱️  [步骤6] 执行点击操作...');
        execSync(`cliclick c:${clickX},${clickY}`);
        log('   ✅ 点击完成');

        // 7. 等待钱包弹窗出现
        log('');
        log('⏳ [步骤7] 等待TronLink钱包弹窗出现...');
        await sleep(2000);

        // 8. 截取点击后的屏幕
        log('');
        log('📸 [步骤8] 截取点击后的屏幕...');
        execSync('screencapture -x test-results/mouse-after-click.png');
        log('✅ 保存: test-results/mouse-after-click.png');

        // 9. 恢复鼠标到原始位置
        log('');
        log('🖱️  [步骤9] 恢复鼠标位置...');
        const [origX, origY] = currentPos.split(',').map(s => s.trim());
        execSync(`cliclick m:${origX},${origY}`);
        log(`   ✅ 鼠标已恢复到 (${origX}, ${origY})`);

        // 10. 分析结果
        log('');
        log('📊 [步骤10] 分析结果...');
        const beforeSize = fs.statSync('test-results/mouse-before-click.png').size;
        const afterSize = fs.statSync('test-results/mouse-after-click.png').size;
        const sizeDiff = Math.abs(beforeSize - afterSize);

        log(`   点击前截图: ${(beforeSize / 1024).toFixed(2)} KB`);
        log(`   点击后截图: ${(afterSize / 1024).toFixed(2)} KB`);
        log(`   大小差异: ${(sizeDiff / 1024).toFixed(2)} KB`);

        if (sizeDiff > 10000) {
            log('   ✅ 屏幕内容发生明显变化，TronLink钱包可能已打开');
        } else {
            log('   ⚠️  屏幕内容变化不明显');
            log('   可能原因:');
            log('   1. 点击坐标不准确，需要调整 clickX 和 clickY');
            log('   2. TronLink钱包已经处于打开状态');
            log('   3. 浏览器窗口位置或大小与截图不同');
        }

        log('');
        log('✅ ========== 测试完成 ==========');
        log('');
        log('📁 生成的文件:');
        log('   1. test-results/mouse-before-click.png (点击前)');
        log('   2. test-results/mouse-moved.png (鼠标移动后)');
        log('   3. test-results/mouse-after-click.png (点击后)');
        log('');
        log('💡 下一步:');
        log('   1. 对比截图查看TronLink钱包是否打开');
        log('   2. 如果位置不准确，可以:');
        log('      - 手动移动鼠标到TronLink图标上');
        log('      - 运行 "cliclick p" 查看坐标');
        log('      - 更新脚本中的 clickX 和 clickY 值');
        log('');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        if (error.stderr) {
            console.error('错误详情:', error.stderr.toString());
        }
        process.exit(1);
    }
}

// 运行
clickTronLinkWithCliclick();
