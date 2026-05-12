const CDP = require('chrome-remote-interface');
const fs = require('fs');
const { execSync } = require('child_process');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

/**
 * UI自动化测试：截屏并打开TronLink钱包
 */
async function automateWalletUI() {
    let client;
    try {
        log('=== TronLink钱包UI自动化测试 ===');
        log('');

        // 连接到Chrome
        log('🔌 连接到Chrome CDP (端口 9222)...');
        client = await CDP({ port: 9222 });
        const { Page, Runtime, Target, Input } = client;

        await Page.enable();
        await Runtime.enable();
        await Target.setDiscoverTargets({ discover: true });

        // 创建结果目录
        if (!fs.existsSync('test-results')) {
            fs.mkdirSync('test-results');
        }

        // ========== 步骤1: 截取主屏幕 ==========
        log('');
        log('📸 [步骤1] 截取主屏幕...');
        const { data: mainScreen } = await Page.captureScreenshot({ format: 'png' });
        fs.writeFileSync('test-results/step1-main-screen.png', Buffer.from(mainScreen, 'base64'));
        log('✅ 主屏幕截图已保存: test-results/step1-main-screen.png');

        // 获取当前页面信息
        const pageInfo = await Runtime.evaluate({
            expression: `({
                url: window.location.href,
                title: document.title,
                width: window.innerWidth,
                height: window.innerHeight
            })`,
            returnByValue: true
        });
        const info = pageInfo.result.value;
        log(`   当前页面: ${info.title}`);
        log(`   URL: ${info.url}`);
        log(`   窗口尺寸: ${info.width}x${info.height}`);

        // ========== 步骤2: 查找TronLink扩展 ==========
        log('');
        log('🔍 [步骤2] 查找TronLink扩展...');
        const targets = await Target.getTargets();

        // 查找TronLink相关的targets
        const tronlinkTargets = targets.targetInfos.filter(t =>
            t.url && t.url.includes('ibnejdfjmmkpcnlpebklmnkoeoihofec')
        );

        log(`   找到 ${tronlinkTargets.length} 个TronLink相关targets:`);
        tronlinkTargets.forEach((t, i) => {
            log(`   ${i + 1}. [${t.type}] ${t.url.substring(0, 80)}`);
        });

        // 检查TronLink是否已注入到当前页面
        const tronCheck = await Runtime.evaluate({
            expression: `({
                hasTronWeb: typeof window.tronWeb !== 'undefined',
                hasTronLink: typeof window.tronLink !== 'undefined',
                ready: window.tronLink?.ready || false,
                address: window.tronWeb?.defaultAddress?.base58 || null
            })`,
            returnByValue: true
        });
        const tronStatus = tronCheck.result.value;
        log('');
        log('   TronLink注入状态:');
        log(`   - window.tronWeb: ${tronStatus.hasTronWeb ? '✅' : '❌'}`);
        log(`   - window.tronLink: ${tronStatus.hasTronLink ? '✅' : '❌'}`);
        log(`   - 连接状态: ${tronStatus.ready ? '已连接' : '未连接'}`);
        log(`   - 钱包地址: ${tronStatus.address || '无'}`);

        // ========== 步骤3: 打开TronLink钱包界面 ==========
        log('');
        log('🎯 [步骤3] 打开TronLink钱包界面...');

        // 查找已存在的popup窗口
        let popupTarget = targets.targetInfos.find(t =>
            t.type === 'page' &&
            t.url &&
            t.url.includes('ibnejdfjmmkpcnlpebklmnkoeoihofec/popup.html')
        );

        let walletClient;
        if (popupTarget) {
            log(`   ✅ 找到已存在的popup窗口: ${popupTarget.targetId}`);
            walletClient = await CDP({ target: popupTarget.targetId, port: 9222 });
        } else {
            log('   创建新的TronLink窗口...');
            const tronlinkUrl = 'chrome-extension://ibnejdfjmmkpcnlpebklmnkoeoihofec/popup.html';
            const newTarget = await Target.createTarget({ url: tronlinkUrl });
            log(`   ✅ 新窗口已创建: ${newTarget.targetId}`);
            await sleep(2000);
            walletClient = await CDP({ target: newTarget.targetId, port: 9222 });
        }

        await walletClient.Page.enable();
        await walletClient.Runtime.enable();

        // ========== 步骤4: 截取钱包界面 ==========
        log('');
        log('📸 [步骤4] 截取TronLink钱包界面...');
        const { data: walletScreen } = await walletClient.Page.captureScreenshot({ format: 'png' });
        fs.writeFileSync('test-results/step4-wallet-interface.png', Buffer.from(walletScreen, 'base64'));
        log('✅ 钱包界面截图已保存: test-results/step4-wallet-interface.png');

        // 获取钱包界面详细信息
        const walletInfo = await walletClient.Runtime.evaluate({
            expression: `({
                title: document.title,
                url: window.location.href,
                bodyText: document.body?.innerText || '',
                buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(Boolean),
                hasContent: document.body?.children.length > 0
            })`,
            returnByValue: true
        });

        const wallet = walletInfo.result.value;
        log('');
        log('   钱包界面信息:');
        log(`   - 标题: ${wallet.title}`);
        log(`   - URL: ${wallet.url}`);
        log(`   - 有内容: ${wallet.hasContent ? '是' : '否'}`);
        log(`   - 按钮数量: ${wallet.buttons.length}`);

        if (wallet.buttons.length > 0) {
            log('   - 可用按钮:');
            wallet.buttons.slice(0, 10).forEach((btn, i) => {
                log(`     ${i + 1}. ${btn}`);
            });
        }

        if (wallet.bodyText.length > 0) {
            log('');
            log('   页面内容预览:');
            log('   ' + wallet.bodyText.substring(0, 300).replace(/\n/g, '\n   '));
        }

        // ========== 步骤5: 系统完整截图 ==========
        log('');
        log('📸 [步骤5] 系统完整截图（包括所有窗口）...');
        execSync('screencapture -x test-results/step5-system-full.png');
        log('✅ 系统截图已保存: test-results/step5-system-full.png');

        // 清理
        await walletClient.close();
        await client.close();

        // ========== 总结 ==========
        log('');
        log('✅ ========== 测试完成 ==========');
        log('');
        log('📁 生成的截图文件:');
        log('   1. step1-main-screen.png - 主屏幕截图');
        log('   2. step4-wallet-interface.png - TronLink钱包界面');
        log('   3. step5-system-full.png - 系统完整截图');
        log('');
        log('📊 测试结果:');
        log(`   - TronLink扩展: ${tronlinkTargets.length > 0 ? '✅ 已安装' : '❌ 未安装'}`);
        log(`   - 钱包注入: ${tronStatus.hasTronWeb ? '✅ 成功' : '❌ 失败'}`);
        log(`   - 钱包连接: ${tronStatus.ready ? '✅ 已连接' : '⚠️  未连接'}`);
        log(`   - 钱包界面: ${wallet.hasContent ? '✅ 正常显示' : '❌ 显示异常'}`);
        log('');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// 运行测试
automateWalletUI();
