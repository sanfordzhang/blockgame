const CDP = require('chrome-remote-interface');
const fs = require('fs');
const { execSync } = require('child_process');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

async function openTronLinkWallet() {
    try {
        log('🔌 连接到 Chrome CDP...');
        const client = await CDP({ port: 9222 });
        const { Page, Runtime, Target } = client;

        await Page.enable();
        await Runtime.enable();
        await Target.setDiscoverTargets({ discover: true });

        if (!fs.existsSync('test-results')) {
            fs.mkdirSync('test-results');
        }

        // 1. 先截取当前主屏幕
        log('📸 截取当前主屏幕...');
        const { data: beforeScreenshot } = await Page.captureScreenshot({ format: 'png' });
        fs.writeFileSync('test-results/01-before-open-wallet.png', Buffer.from(beforeScreenshot, 'base64'));
        log('✅ 保存: test-results/01-before-open-wallet.png');

        // 2. 查找TronLink popup target
        log('');
        log('🔍 查找TronLink popup窗口...');
        const targets = await Target.getTargets();
        const tronlinkPopup = targets.targetInfos.find(t =>
            t.type === 'page' &&
            t.url &&
            t.url.includes('ibnejdfjmmkpcnlpebklmnkoeoihofec/popup.html')
        );

        if (tronlinkPopup) {
            log(`✅ 找到TronLink popup: ${tronlinkPopup.targetId}`);
            log(`   URL: ${tronlinkPopup.url}`);

            // 3. 连接到TronLink popup
            log('');
            log('🔗 连接到TronLink popup窗口...');
            const popupClient = await CDP({ target: tronlinkPopup.targetId, port: 9222 });
            await popupClient.Page.enable();
            await popupClient.Runtime.enable();

            // 4. 截取TronLink钱包界面
            log('📸 截取TronLink钱包界面...');
            const { data: walletScreenshot } = await popupClient.Page.captureScreenshot({ format: 'png' });
            fs.writeFileSync('test-results/02-tronlink-wallet.png', Buffer.from(walletScreenshot, 'base64'));
            log('✅ 保存: test-results/02-tronlink-wallet.png');

            // 5. 获取钱包界面信息
            log('');
            log('📄 获取钱包界面信息...');
            const walletInfo = await popupClient.Runtime.evaluate({
                expression: `({
                    title: document.title,
                    url: window.location.href,
                    bodyText: document.body?.innerText?.substring(0, 800),
                    buttons: Array.from(document.querySelectorAll('button')).map(b => ({
                        text: b.textContent?.trim(),
                        disabled: b.disabled,
                        className: b.className
                    })),
                    inputs: Array.from(document.querySelectorAll('input')).map(i => ({
                        type: i.type,
                        placeholder: i.placeholder,
                        value: i.value?.substring(0, 20)
                    })),
                    divs: Array.from(document.querySelectorAll('div[class*="balance"], div[class*="address"], div[class*="account"]')).map(d => ({
                        className: d.className,
                        text: d.textContent?.trim().substring(0, 100)
                    })).slice(0, 10)
                })`,
                returnByValue: true
            });

            const info = walletInfo.result.value;
            log('钱包信息:');
            log(`  标题: ${info.title}`);
            log(`  URL: ${info.url}`);
            log('');
            log('页面内容:');
            log(info.bodyText);
            log('');
            log(`找到 ${info.buttons.length} 个按钮:`);
            info.buttons.forEach((btn, i) => {
                if (btn.text) {
                    log(`  ${i + 1}. "${btn.text}" (disabled: ${btn.disabled})`);
                }
            });

            if (info.inputs.length > 0) {
                log('');
                log(`找到 ${info.inputs.length} 个输入框:`);
                info.inputs.forEach((input, i) => {
                    log(`  ${i + 1}. type="${input.type}" placeholder="${input.placeholder}"`);
                });
            }

            if (info.divs.length > 0) {
                log('');
                log('关键信息区域:');
                info.divs.forEach((div, i) => {
                    if (div.text) {
                        log(`  ${i + 1}. ${div.text}`);
                    }
                });
            }

            // 6. 激活TronLink窗口（使其显示在最前面）
            log('');
            log('🎯 激活TronLink窗口...');
            await Target.activateTarget({ targetId: tronlinkPopup.targetId });
            await sleep(1000);

            // 7. 再次截图确认
            const { data: activatedScreenshot } = await popupClient.Page.captureScreenshot({ format: 'png' });
            fs.writeFileSync('test-results/03-tronlink-activated.png', Buffer.from(activatedScreenshot, 'base64'));
            log('✅ 保存: test-results/03-tronlink-activated.png');

            await popupClient.close();

        } else {
            log('⚠️  未找到TronLink popup窗口');
            log('');
            log('尝试通过新窗口打开TronLink...');

            // 尝试创建新的TronLink窗口
            const tronlinkUrl = 'chrome-extension://ibnejdfjmmkpcnlpebklmnkoeoihofec/popup.html';
            const newTarget = await Target.createTarget({ url: tronlinkUrl });
            log(`✅ 创建新窗口: ${newTarget.targetId}`);

            await sleep(2000);

            // 连接到新窗口
            const newClient = await CDP({ target: newTarget.targetId, port: 9222 });
            await newClient.Page.enable();

            const { data: newWindowScreenshot } = await newClient.Page.captureScreenshot({ format: 'png' });
            fs.writeFileSync('test-results/02-tronlink-new-window.png', Buffer.from(newWindowScreenshot, 'base64'));
            log('✅ 保存: test-results/02-tronlink-new-window.png');

            await newClient.close();
        }

        // 8. 系统截图（捕获整个屏幕，包括可能的弹窗）
        log('');
        log('📸 系统完整截图...');
        execSync('screencapture -x test-results/04-system-full.png');
        log('✅ 保存: test-results/04-system-full.png');

        await client.close();

        log('');
        log('✅ 完成！生成的截图:');
        log('   1. test-results/01-before-open-wallet.png (打开前)');
        log('   2. test-results/02-tronlink-wallet.png (TronLink钱包)');
        log('   3. test-results/03-tronlink-activated.png (激活后)');
        log('   4. test-results/04-system-full.png (系统完整截图)');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

openTronLinkWallet();
