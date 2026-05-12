const { execSync } = require('child_process');
const fs = require('fs');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

/**
 * 纯鼠标控制：自动截图分析并点击TronLink图标
 */
async function autoClickTronLink() {
    try {
        log('=== 自动截图分析并点击TronLink图标 ===');
        log('');

        if (!fs.existsSync('test-results')) {
            fs.mkdirSync('test-results');
        }

        // 步骤1: 截取完整屏幕
        log('📸 [步骤1] 截取完整屏幕进行分析...');
        execSync('screencapture -x test-results/screen-before.png');
        log('✅ 保存: test-results/screen-before.png');

        // 步骤2: 获取屏幕分辨率
        log('');
        log('📐 [步骤2] 获取屏幕分辨率...');
        const displayInfo = execSync('system_profiler SPDisplaysDataType | grep Resolution', { encoding: 'utf8' });
        log(`   ${displayInfo.trim()}`);

        // 从截图分析，假设主显示器分辨率为3024x1964（Retina）
        // 实际点击坐标需要除以2（因为Retina显示器的逻辑像素）

        // 步骤3: 计算TronLink图标位置
        log('');
        log('🎯 [步骤3] 计算TronLink图标位置...');
        log('   基于标准Chrome浏览器布局分析：');
        log('   - 扩展图标位于浏览器右上角');
        log('   - 通常距离右边缘100-150像素');
        log('   - 距离顶部50-70像素');

        // 根据用户提供的截图，浏览器窗口约1430像素宽
        // TronLink图标在右上角，红色箭头指示位置
        // 假设浏览器在屏幕左侧，从屏幕左边缘开始

        // 尝试多个可能的位置
        const possiblePositions = [
            { x: 1290, y: 60, desc: '标准位置（基于截图估算）' },
            { x: 1320, y: 60, desc: '稍微靠右' },
            { x: 1260, y: 60, desc: '稍微靠左' },
            { x: 1290, y: 50, desc: '稍微靠上' },
            { x: 1290, y: 70, desc: '稍微靠下' },
            { x: 1350, y: 60, desc: '更靠右' },
            { x: 1230, y: 60, desc: '更靠左' }
        ];

        log(`   将尝试 ${possiblePositions.length} 个可能的位置`);

        let successPosition = null;
        const beforeSize = fs.statSync('test-results/screen-before.png').size;

        // 步骤4: 逐个尝试位置
        log('');
        log('🖱️  [步骤4] 开始尝试点击...');

        for (let i = 0; i < possiblePositions.length; i++) {
            const pos = possiblePositions[i];
            log('');
            log(`   尝试 ${i + 1}/${possiblePositions.length}: ${pos.desc}`);
            log(`   坐标: (${pos.x}, ${pos.y})`);

            // 移动鼠标
            execSync(`cliclick m:${pos.x},${pos.y}`);
            await sleep(300);

            // 截图查看鼠标位置
            execSync(`screencapture -x test-results/try-${i + 1}-mouse.png`);
            log(`   📸 鼠标位置截图: test-results/try-${i + 1}-mouse.png`);

            // 点击
            execSync(`cliclick c:${pos.x},${pos.y}`);
            log(`   🖱️  已点击`);

            // 等待反应
            await sleep(1500);

            // 截图查看结果
            execSync(`screencapture -x test-results/try-${i + 1}-after.png`);
            const afterSize = fs.statSync(`test-results/try-${i + 1}-after.png`).size;
            const sizeDiff = Math.abs(beforeSize - afterSize);

            log(`   📊 屏幕变化: ${(sizeDiff / 1024).toFixed(2)} KB`);

            if (sizeDiff > 10000) {
                log(`   ✅ 成功！屏幕内容发生明显变化`);
                successPosition = pos;
                break;
            } else {
                log(`   ⚠️  变化不明显，继续尝试下一个位置...`);
            }
        }

        // 步骤5: 最终截图
        log('');
        log('📸 [步骤5] 最终状态截图...');
        await sleep(1000);
        execSync('screencapture -x test-results/final-state.png');
        log('✅ 保存: test-results/final-state.png');

        // 步骤6: 总结
        log('');
        log('✅ ========== 测试完成 ==========');
        log('');

        if (successPosition) {
            log('🎉 成功找到TronLink图标位置！');
            log(`   成功坐标: (${successPosition.x}, ${successPosition.y})`);
            log(`   描述: ${successPosition.desc}`);
            log('');
            log('💾 保存此坐标以供后续使用：');
            log(`   const TRONLINK_X = ${successPosition.x};`);
            log(`   const TRONLINK_Y = ${successPosition.y};`);
        } else {
            log('⚠️  未能自动找到准确位置');
            log('');
            log('💡 建议：');
            log('   1. 查看 test-results/ 目录中的截图');
            log('   2. 找到鼠标最接近TronLink图标的截图');
            log('   3. 手动调整坐标后重试');
        }

        log('');
        log('📁 生成的文件:');
        log('   - test-results/screen-before.png (初始状态)');
        log('   - test-results/try-*-mouse.png (各次尝试的鼠标位置)');
        log('   - test-results/try-*-after.png (各次尝试的点击结果)');
        log('   - test-results/final-state.png (最终状态)');
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
