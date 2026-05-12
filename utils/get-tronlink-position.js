const { execSync } = require('child_process');
const readline = require('readline');

const log = msg => console.log(msg);

/**
 * 交互式获取TronLink图标的准确坐标
 */
async function getIconPosition() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (query) => new Promise((resolve) => rl.question(query, resolve));

    try {
        log('=== TronLink图标坐标定位工具 ===');
        log('');
        log('📍 使用说明:');
        log('   1. 请手动将鼠标移动到TronLink图标上（红色箭头指示的位置）');
        log('   2. 鼠标悬停在图标上，不要点击');
        log('   3. 按回车键记录当前鼠标坐标');
        log('');

        await question('准备好后按回车键继续...');

        log('');
        log('🖱️  正在获取鼠标位置...');
        const position = execSync('cliclick p', { encoding: 'utf8' }).trim();
        const [x, y] = position.split(',').map(s => parseInt(s.trim()));

        log(`✅ 当前鼠标坐标: (${x}, ${y})`);
        log('');

        // 截图验证
        log('📸 截取当前屏幕（鼠标在图标上）...');
        execSync('screencapture -x test-results/icon-position.png');
        log('✅ 保存: test-results/icon-position.png');

        log('');
        log('🧪 测试点击...');
        const testClick = await question('是否测试点击这个位置？(y/n): ');

        if (testClick.toLowerCase() === 'y') {
            log('');
            log('🖱️  执行测试点击...');
            execSync(`cliclick c:${x},${y}`);
            log('✅ 点击完成');

            // 等待2秒
            await new Promise(r => setTimeout(r, 2000));

            // 截图
            log('📸 截取点击后的屏幕...');
            execSync('screencapture -x test-results/after-test-click.png');
            log('✅ 保存: test-results/after-test-click.png');

            log('');
            const success = await question('TronLink钱包是否打开了？(y/n): ');

            if (success.toLowerCase() === 'y') {
                log('');
                log('✅ 成功！请在脚本中使用以下坐标:');
                log('');
                log(`   const clickX = ${x};`);
                log(`   const clickY = ${y};`);
                log('');
                log('📝 更新方法:');
                log('   编辑 cdp-click-tronlink-cliclick.js');
                log(`   将 clickX 改为 ${x}`);
                log(`   将 clickY 改为 ${y}`);
            } else {
                log('');
                log('⚠️  位置可能不准确，请重新运行此工具');
                log('   确保鼠标精确悬停在TronLink图标上');
            }
        }

        log('');
        log('📁 生成的文件:');
        log('   - test-results/icon-position.png (鼠标在图标上)');
        if (testClick.toLowerCase() === 'y') {
            log('   - test-results/after-test-click.png (点击后)');
        }

        rl.close();

    } catch (error) {
        console.error('❌ 错误:', error.message);
        rl.close();
        process.exit(1);
    }
}

// 运行
getIconPosition();
