const { execSync } = require('child_process');
const fs = require('fs');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

/**
 * 基于用户截图精确定位并点击TronLink
 *
 * 从用户提供的截图分析：
 * - 浏览器窗口宽度约1430像素
 * - TronLink图标在地址栏右侧，红色箭头指示位置
 * - 图标位于浏览器工具栏，距离窗口顶部约60像素
 * - 图标距离浏览器右边缘约130像素
 */
async function clickTronLinkPrecise() {
    try {
        log('=== 精确点击TronLink图标（基于用户截图） ===');
        log('');

        if (!fs.existsSync('test-results')) {
            fs.mkdirSync('test-results');
        }

        // 步骤1: 截取当前屏幕
        log('📸 [步骤1] 截取当前屏幕状态...');
        execSync('screencapture -x test-results/precise-before.png');
        log('✅ 保存: test-results/precise-before.png');

        // 步骤2: 根据用户截图计算精确位置
        log('');
        log('🎯 [步骤2] 计算TronLink图标精确位置...');
        log('   分析依据: 用户提供的截图（红色箭头指示）');

        // 从用户截图看，浏览器窗口约1430像素宽
        // TronLink图标在右上角，具体位置分析：
        // - 浏览器地址栏右侧有多个扩展图标
        // - TronLink图标应该在这些图标中
        // - 红色箭头指向的位置大约在 X=1290, Y=60

        // 但考虑到可能的偏差，我们尝试周围的精确位置
        const precisePositions = [
            // 基于截图的最可能位置
            { x: 1290, y: 60, desc: '截图标注位置' },
            { x: 1285, y: 58, desc: '微调-左上' },
            { x: 1295, y: 62, desc: '微调-右下' },
            { x: 1280, y: 60, desc: '稍左' },
            { x: 1300, y: 60, desc: '稍右' },
            { x: 1290, y: 55, desc: '稍上' },
            { x: 1290, y: 65, desc: '稍下' },
            // 考虑可能是其他扩展图标
            { x: 1260, y: 60, desc: '左侧图标' },
            { x: 1320, y: 60, desc: '右侧图标' },
            { x: 1230, y: 60, desc: '更左侧' },
            { x: 1350, y: 60, desc: '更右侧' }
        ];

        log(`   将尝试 ${precisePositions.length} 个精确位置`);

        const beforeSize = fs.statSync('test-results/precise-before.png').size;
        let successPos = null;

        // 步骤3: 逐个尝试精确位置
        log('');
        log('🖱️  [步骤3] 开始精确点击测试...');

        for (let i = 0; i < precisePositions.length; i++) {
            const pos = precisePositions[i];
            log('');
            log(`   [${i + 1}/${precisePositions.length}] ${pos.desc}`);
            log(`   坐标: (${pos.x}, ${pos.y})`);

            // 移动鼠标
            execSync(`cliclick m:${pos.x},${pos.y}`);
            log(`   ✓ 鼠标已移动`);
            await sleep(500);

            // 截图查看鼠标位置
            execSync(`screencapture -x test-results/precise-${i + 1}-hover.png`);
            log(`   ✓ 悬停截图: test-results/precise-${i + 1}-hover.png`);

            // 点击
            execSync(`cliclick c:${pos.x},${pos.y}`);
            log(`   ✓ 已点击`);

            // 等待反应
            await sleep(2000);

            // 截图查看结果
            execSync(`screencapture -x test-results/precise-${i + 1}-after.png`);
            const afterSize = fs.statSync(`test-results/precise-${i + 1}-after.png`).size;
            const diff = Math.abs(beforeSize - afterSize);

            log(`   ✓ 结果截图: test-results/precise-${i + 1}-after.png`);
            log(`   📊 屏幕变化: ${(diff / 1024).toFixed(2)} KB`);

            if (diff > 10000) {
                log(`   🎉 成功！发现明显变化`);
                successPos = pos;
                break;
            } else {
                log(`   ⚠️  变化不明显，继续下一个...`);
            }
        }

        // 步骤4: 最终状态
        log('');
        log('📸 [步骤4] 最终状态截图...');
        await sleep(1000);
        execSync('screencapture -x test-results/precise-final.png');
        log('✅ 保存: test-results/precise-final.png');

        // 步骤5: 结果总结
        log('');
        log('✅ ========== 测试完成 ==========');
        log('');

        if (successPos) {
            log('🎉 成功找到TronLink图标！');
            log('');
            log(`📍 成功坐标: (${successPos.x}, ${successPos.y})`);
            log(`📝 位置描述: ${successPos.desc}`);
            log('');
            log('💾 保存此坐标供后续使用：');
            log(`   const TRONLINK_ICON_X = ${successPos.x};`);
            log(`   const TRONLINK_ICON_Y = ${successPos.y};`);
        } else {
            log('⚠️  所有位置都未产生明显变化');
            log('');
            log('💡 可能的原因：');
            log('   1. TronLink钱包已经处于打开状态');
            log('   2. 浏览器窗口位置与截图时不同');
            log('   3. 图标位置在截图范围之外');
            log('');
            log('🔍 建议：');
            log('   1. 查看 test-results/precise-*-hover.png 找到鼠标最接近图标的截图');
            log('   2. 确认浏览器窗口位置与截图时相同');
            log('   3. 手动测试: cliclick m:X,Y 然后 cliclick c:X,Y');
        }

        log('');
        log('📁 生成的文件:');
        log('   - test-results/precise-before.png (初始状态)');
        log('   - test-results/precise-*-hover.png (鼠标悬停位置)');
        log('   - test-results/precise-*-after.png (点击后状态)');
        log('   - test-results/precise-final.png (最终状态)');
        log('');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

// 运行
clickTronLinkPrecise();
