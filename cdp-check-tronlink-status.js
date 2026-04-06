const CDP = require('chrome-remote-interface');
const fs = require('fs');
const { execSync } = require('child_process');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

async function checkTronLinkStatus() {
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

        // 1. 获取所有targets（页面、扩展等）
        log('📋 获取所有Chrome targets...');
        const targets = await Target.getTargets();

        log(`找到 ${targets.targetInfos.length} 个targets:`);
        targets.targetInfos.forEach((target, i) => {
            log(`  ${i + 1}. [${target.type}] ${target.title || '(无标题)'}`);
            log(`     URL: ${target.url}`);
            log(`     ID: ${target.targetId}`);
        });

        // 2. 查找TronLink相关的targets
        log('');
        log('🔍 查找TronLink相关targets...');
        const tronlinkTargets = targets.targetInfos.filter(t =>
            t.url && (
                t.url.includes('tronlink') ||
                t.url.includes('ibnejdfjmmkpcnlpebklmnkoeoihofec')
            )
        );

        if (tronlinkTargets.length > 0) {
            log(`✅ 找到 ${tronlinkTargets.length} 个TronLink相关targets:`);
            tronlinkTargets.forEach((target, i) => {
                log(`  ${i + 1}. [${target.type}] ${target.title || '(无标题)'}`);
                log(`     URL: ${target.url}`);
            });
        } else {
            log('⚠️  未找到TronLink相关targets');
        }

        // 3. 导航到游戏页面并检查TronLink注入
        log('');
        log('🎮 导航到游戏页面...');
        await Page.navigate({ url: 'http://127.0.0.1:3001/' });
        await sleep(3000);

        // 截图
        const { data: gamePageScreenshot } = await Page.captureScreenshot({ format: 'png' });
        fs.writeFileSync('test-results/game-page.png', Buffer.from(gamePageScreenshot, 'base64'));
        log('✅ 游戏页面截图: test-results/game-page.png');

        // 检查window.tronWeb和window.tronLink
        const tronCheck = await Runtime.evaluate({
            expression: `({
                hasTronWeb: typeof window.tronWeb !== 'undefined',
                hasTronLink: typeof window.tronLink !== 'undefined',
                tronWebReady: window.tronWeb?.ready || false,
                tronLinkReady: window.tronLink?.ready || false,
                defaultAddress: window.tronWeb?.defaultAddress?.base58 || null,
                tronLinkVersion: window.tronLink?.version || null
            })`,
            returnByValue: true
        });

        const tronInfo = tronCheck.result.value;
        log('');
        log('🔐 TronLink注入状态:');
        log(`   window.tronWeb: ${tronInfo.hasTronWeb ? '✅' : '❌'}`);
        log(`   window.tronLink: ${tronInfo.hasTronLink ? '✅' : '❌'}`);
        log(`   tronWeb.ready: ${tronInfo.tronWebReady}`);
        log(`   tronLink.ready: ${tronInfo.tronLinkReady}`);
        log(`   默认地址: ${tronInfo.defaultAddress || '未连接'}`);
        log(`   TronLink版本: ${tronInfo.tronLinkVersion || 'N/A'}`);

        // 4. 查找页面上的连接钱包按钮
        log('');
        log('🔘 查找页面上的按钮...');
        const buttons = await Runtime.evaluate({
            expression: `
                Array.from(document.querySelectorAll('button, a, [role="button"]')).map(el => ({
                    tag: el.tagName,
                    text: el.textContent?.trim().substring(0, 50),
                    id: el.id,
                    className: el.className,
                    visible: el.offsetParent !== null,
                    disabled: el.disabled
                })).filter(b => b.text)
            `,
            returnByValue: true
        });

        const buttonList = buttons.result.value;
        log(`找到 ${buttonList.length} 个可点击元素:`);
        buttonList.forEach((btn, i) => {
            if (i < 20) { // 只显示前20个
                log(`  ${i + 1}. <${btn.tag}> "${btn.text}" (visible: ${btn.visible}, disabled: ${btn.disabled})`);
            }
        });

        // 5. 尝试通过Chrome扩展管理页面查看
        log('');
        log('🔧 检查Chrome扩展管理页面...');
        await Page.navigate({ url: 'chrome://extensions/' });
        await sleep(2000);

        const { data: extensionsScreenshot } = await Page.captureScreenshot({ format: 'png' });
        fs.writeFileSync('test-results/chrome-extensions.png', Buffer.from(extensionsScreenshot, 'base64'));
        log('✅ 扩展管理页面截图: test-results/chrome-extensions.png');

        // 6. 系统截图
        log('');
        log('📸 系统完整截图...');
        execSync('screencapture -x test-results/system-screenshot.png');
        log('✅ 系统截图: test-results/system-screenshot.png');

        await client.close();

        log('');
        log('✅ 检查完成！');
        log('');
        log('📁 生成的文件:');
        log('   - test-results/game-page.png (游戏页面)');
        log('   - test-results/chrome-extensions.png (扩展管理页面)');
        log('   - test-results/system-screenshot.png (系统截图)');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

checkTronLinkStatus();
