const { execSync } = require('child_process');
const fs = require('fs');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

/**
 * 广泛搜索TronLink图标位置
 */
async function searchTronLinkIcon() {
    try {
        log('=== 广泛搜索TronLink图标位置 ===');
        log('');

        if (!fs.existsSync('test-results')) {
            fs.mkdirSync('test-results');
        }

        // 步骤1: 初始截图
        log('📸 [步骤1] 初始截图...');
        execSync('screencapture -x test-results/search-initial.png');
        log('✅ 保存: test-results/search-initial.png');

        // 步骤2: 生成搜索网格
        log('');
        log('🎯 [步骤2] 生成搜索网格...');
        log('   搜索区域: 浏览器右上角');
        log('   X范围: 1100-1400 (步长30)');
        log('   Y范围: 40-100 (步长15)');

        const searchGrid = [];
        for (let x = 1100; x <= 1400; x += 30) {
            for (let y = 40; y <= 100; y += 15) {
                searchGrid.push({ x, y });
            }
        }

        log(`   总共 ${searchGrid.length} 个搜索点`);

        // 步骤3: 逐点搜索
        log('');
        log('🔍 [步骤3] 开始搜索...');
        log('   (每5个点显示一次进度)');

        const beforeSize = fs.statSync('test-results/search-initial.png').size;
        let bestMatch = null;
        let maxDiff = 0;

        for (let i = 0; i < searchGrid.length; i++) {
            const pos = searchGrid[i];

            // 移动并点击
            execSync(`cliclick m:${pos.x},${pos.y}`);
            await sleep(100);
            execSync(`cliclick c:${pos.x},${pos.y}`);
            await sleep(800);

            // 截图
            const filename = `test-results/search-${i}.png`;
            execSync(`screencapture -x ${filename}`);
            const afterSize = fs.statSync(filename).size;
            const diff = Math.abs(beforeSize - afterSize);

            // 记录最大变化
            if (diff > maxDiff) {
                maxDiff = diff;
                bestMatch = { ...pos, index: i, diff };
            }

            // 显示进度
            if ((i + 1) % 5 === 0 || diff > 10000) {
                log(`   进度: ${i + 1}/${searchGrid.length} | 当前: (${pos.x},${pos.y}) | 变化: ${(diff / 1024).toFixed(2)}KB | 最大: ${(maxDiff / 1024).toFixed(2)}KB`);
            }

            // 如果发现明显变化，立即停止
            if (diff > 50000) {
                log('');
                log(`   🎉 找到明显变化！坐标: (${pos.x}, ${pos.y})`);
                log(`   变化大小: ${(diff / 1024).toFixed(2)} KB`);
                bestMatch = { ...pos, index: i, diff };
                break;
            }

            // 清理旧截图（保留最近10张）
            if (i > 10) {
                try {
                    fs.unlinkSync(`test-results/search-${i - 10}.png`);
                } catch (e) {}
            }
        }

        // 步骤4: 结果分析
        log('');
        log('📊 [步骤4] 搜索结果分析...');

        if (bestMatch) {
            log(`   最佳匹配位置: (${bestMatch.x}, ${bestMatch.y})`);
            log(`   屏幕变化: ${(bestMatch.diff / 1024).toFixed(2)} KB`);
            log(`   搜索索引: ${bestMatch.index}`);

            // 保存最佳匹配的截图
            if (fs.existsSync(`test-results/search-${bestMatch.index}.png`)) {
                fs.copyFileSync(
                    `test-results/search-${bestMatch.index}.png`,
                    'test-results/best-match.png'
                );
                log('   ✅ 最佳匹配截图: test-results/best-match.png');
            }

            if (bestMatch.diff > 10000) {
                log('');
                log('✅ 成功找到TronLink图标位置！');
                log('');
                log('💾 使用以下坐标：');
                log(`   const TRONLINK_X = ${bestMatch.x};`);
                log(`   const TRONLINK_Y = ${bestMatch.y};`);
            } else {
                log('');
                log('⚠️  找到的位置变化较小，可能不准确');
                log('   建议手动检查 test-results/best-match.png');
            }
        } else {
            log('   ❌ 未找到明显变化的位置');
        }

        // 步骤5: 最终截图
        log('');
        log('📸 [步骤5] 最终截图...');
        await sleep(1000);
        execSync('screencapture -x test-results/search-final.png');
        log('✅ 保存: test-results/search-final.png');

        log('');
        log('✅ ========== 搜索完成 ==========');
        log('');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

// 运行
searchTronLinkIcon();
