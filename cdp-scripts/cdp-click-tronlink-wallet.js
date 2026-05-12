const CDP = require('chrome-remote-interface');
const fs = require('fs');
const { execSync } = require('child_process');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

async function clickTronLinkWallet() {
    try {
        log('🔌 连接到 Chrome CDP (端口 9222)...');
        const client = await CDP({ port: 9222 });
        const { Page, Runtime, Input, Target } = client;

        await Page.enable();
        await Runtime.enable();
        await Target.setDiscoverTargets({ discover: true });

        if (!fs.existsSync('test-results')) {
            fs.mkdirSync('test-results');
        }

        // Step 1: 截取主屏幕
        log('📸 截取主屏幕...');
        const { data: mainScreenshot } = await Page.captureScreenshot({ format: 'png' });
        fs.writeFileSync('test-results/main-screen.png', Buffer.from(mainScreenshot, 'base64'));
        log('✅ 主屏幕截图已保存: test-results/main-screen.png');

        // Step 2: 获取浏览器窗口尺寸
        const windowInfo = await Runtime.evaluate({
            expression: `({ width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio })`,
            returnByValue: true
        });
        const { width, height, devicePixelRatio } = windowInfo.result.value;
        log(`📐 窗口尺寸: ${width}x${height}, DPR: ${devicePixelRatio}`);

        // Step 3: 查找TronLink扩展
        log('🔍 查找 TronLink 扩展...');
        const targets = await Target.getTargets();
        const tronlinkExtension = targets.targetInfos.find(t =>
            t.url && (t.url.includes('chrome-extension://') && t.url.includes('ibnejdfjmmkpcnlpebklmnkoeoihofec'))
        );

        if (tronlinkExtension) {
            log(`✅ 找到 TronLink 扩展: ${tronlinkExtension.url}`);
        } else {
            log('⚠️  未找到 TronLink 扩展，尝试通过扩展ID打开...');
        }

        // Step 4: 尝试多种方式打开TronLink
        log('🎯 尝试打开 TronLink 钱包...');

        // 方法1: 通过扩展URL直接打开
        const tronlinkPopupUrl = 'chrome-extension://ibnejdfjmmkpcnlpebklmnkoeoihofec/popup.html';
        log(`方法1: 导航到扩展弹窗页面 ${tronlinkPopupUrl}`);

        try {
            await Page.navigate({ url: tronlinkPopupUrl });
            await sleep(2000);

            const { data: walletScreenshot } = await Page.captureScreenshot({ format: 'png' });
            fs.writeFileSync('test-results/tronlink-wallet.png', Buffer.from(walletScreenshot, 'base64'));
            log('✅ TronLink 钱包截图已保存: test-results/tronlink-wallet.png');

            // 获取钱包页面内容
            const walletContent = await Runtime.evaluate({
                expression: `document.body.innerText.substring(0, 500)`,
                returnByValue: true
            });
            log('📄 钱包页面内容预览:');
            log(walletContent.result.value);

        } catch (e) {
            log(`❌ 方法1失败: ${e.message}`);

            // 方法2: 模拟点击扩展图标位置（通常在右上角）
            log('方法2: 模拟点击扩展图标位置...');

            // TronLink图标通常在浏览器右上角，距离右边缘约40-80px，距离顶部约10-15px
            const clickX = width - 60;
            const clickY = 15;

            log(`🖱️  点击坐标: (${clickX}, ${clickY})`);

            // 移动鼠标到目标位置
            await Input.dispatchMouseEvent({
                type: 'mouseMoved',
                x: clickX,
                y: clickY
            });
            await sleep(300);

            // 点击
            await Input.dispatchMouseEvent({
                type: 'mousePressed',
                x: clickX,
                y: clickY,
                button: 'left',
                clickCount: 1
            });
            await sleep(100);

            await Input.dispatchMouseEvent({
                type: 'mouseReleased',
                x: clickX,
                y: clickY,
                button: 'left',
                clickCount: 1
            });

            log('✅ 已模拟点击扩展图标');
            await sleep(2000);

            // 截图查看结果
            const { data: afterClickScreenshot } = await Page.captureScreenshot({ format: 'png' });
            fs.writeFileSync('test-results/after-click-extension.png', Buffer.from(afterClickScreenshot, 'base64'));
            log('✅ 点击后截图已保存: test-results/after-click-extension.png');
        }

        // Step 5: 尝试查找并切换到TronLink弹窗
        log('🔄 查找 TronLink 弹窗窗口...');
        await sleep(1000);

        const updatedTargets = await Target.getTargets();
        const tronlinkPopup = updatedTargets.targetInfos.find(t =>
            t.type === 'page' && t.url && t.url.includes('ibnejdfjmmkpcnlpebklmnkoeoihofec')
        );

        if (tronlinkPopup) {
            log(`✅ 找到 TronLink 弹窗: ${tronlinkPopup.targetId}`);
            log(`   URL: ${tronlinkPopup.url}`);

            // 切换到TronLink弹窗
            await Target.activateTarget({ targetId: tronlinkPopup.targetId });
            await sleep(1000);

            // 连接到弹窗并截图
            const popupClient = await CDP({ target: tronlinkPopup.targetId, port: 9222 });
            await popupClient.Page.enable();

            const { data: popupScreenshot } = await popupClient.Page.captureScreenshot({ format: 'png' });
            fs.writeFileSync('test-results/tronlink-popup-window.png', Buffer.from(popupScreenshot, 'base64'));
            log('✅ TronLink 弹窗截图已保存: test-results/tronlink-popup-window.png');

            await popupClient.close();
        } else {
            log('⚠️  未找到 TronLink 弹窗窗口');
        }

        // Step 6: 使用系统命令截取整个屏幕（包括扩展弹窗）
        log('📸 使用系统命令截取完整屏幕...');
        try {
            execSync('screencapture -x test-results/full-screen-system.png');
            log('✅ 系统完整截图已保存: test-results/full-screen-system.png');
        } catch (e) {
            log(`⚠️  系统截图失败: ${e.message}`);
        }

        await client.close();
        log('✅ 测试完成！');
        log('');
        log('📁 生成的截图文件：');
        log('   - test-results/main-screen.png (主屏幕)');
        log('   - test-results/tronlink-wallet.png (钱包页面)');
        log('   - test-results/after-click-extension.png (点击扩展后)');
        log('   - test-results/full-screen-system.png (系统完整截图)');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

// 运行测试
clickTronLinkWallet();
