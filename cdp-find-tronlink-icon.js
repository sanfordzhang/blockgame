const CDP = require('chrome-remote-interface');
const fs = require('fs');
const { execSync } = require('child_process');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

async function findAndClickTronLink() {
    try {
        log('🔌 连接到 Chrome CDP...');
        const client = await CDP({ port: 9222 });
        const { Page, Runtime, Input, DOM, Overlay } = client;

        await Page.enable();
        await Runtime.enable();
        await DOM.enable();
        await Overlay.enable();

        if (!fs.existsSync('test-results')) {
            fs.mkdirSync('test-results');
        }

        // 获取当前页面信息
        const pageInfo = await Runtime.evaluate({
            expression: `({
                url: window.location.href,
                width: window.innerWidth,
                height: window.innerHeight,
                scrollY: window.scrollY,
                devicePixelRatio: window.devicePixelRatio
            })`,
            returnByValue: true
        });
        const info = pageInfo.result.value;
        log(`📄 当前页面: ${info.url}`);
        log(`📐 窗口尺寸: ${info.width}x${info.height}, 滚动位置: ${info.scrollY}, DPR: ${info.devicePixelRatio}`);

        // 截取当前视口
        log('📸 截取当前视口...');
        const { data: viewportScreenshot } = await Page.captureScreenshot({ format: 'png' });
        fs.writeFileSync('test-results/viewport-before-click.png', Buffer.from(viewportScreenshot, 'base64'));
        log('✅ 视口截图: test-results/viewport-before-click.png');

        // 方法1: 尝试通过DOM查找扩展按钮
        log('🔍 方法1: 查找页面中的TronLink相关元素...');
        const tronlinkElements = await Runtime.evaluate({
            expression: `
                Array.from(document.querySelectorAll('*')).filter(el => {
                    const text = el.textContent || '';
                    const id = el.id || '';
                    const className = el.className || '';
                    return text.includes('TronLink') ||
                           text.includes('Tron') ||
                           id.includes('tronlink') ||
                           String(className).includes('tronlink');
                }).map(el => ({
                    tag: el.tagName,
                    id: el.id,
                    className: el.className,
                    text: el.textContent?.substring(0, 50)
                }))
            `,
            returnByValue: true
        });

        if (tronlinkElements.result.value.length > 0) {
            log('✅ 找到TronLink相关元素:');
            tronlinkElements.result.value.forEach((el, i) => {
                log(`   ${i + 1}. <${el.tag}> id="${el.id}" class="${el.className}" text="${el.text}"`);
            });
        } else {
            log('⚠️  页面中未找到TronLink相关元素');
        }

        // 方法2: 直接打开TronLink扩展页面
        log('🎯 方法2: 直接打开TronLink扩展页面...');
        const tronlinkUrl = 'chrome-extension://ibnejdfjmmkpcnlpebklmnkoeoihofec/popup.html';

        await Page.navigate({ url: tronlinkUrl });
        await sleep(2000);

        // 截取TronLink页面
        const { data: tronlinkScreenshot } = await Page.captureScreenshot({ format: 'png' });
        fs.writeFileSync('test-results/tronlink-page.png', Buffer.from(tronlinkScreenshot, 'base64'));
        log('✅ TronLink页面截图: test-results/tronlink-page.png');

        // 获取TronLink页面内容
        const tronlinkContent = await Runtime.evaluate({
            expression: `({
                title: document.title,
                bodyText: document.body?.innerText?.substring(0, 500),
                buttons: Array.from(document.querySelectorAll('button')).map(b => ({
                    text: b.textContent?.trim(),
                    disabled: b.disabled,
                    visible: b.offsetParent !== null
                })),
                links: Array.from(document.querySelectorAll('a')).map(a => ({
                    text: a.textContent?.trim(),
                    href: a.href
                })).slice(0, 10)
            })`,
            returnByValue: true
        });

        const content = tronlinkContent.result.value;
        log('📄 TronLink页面信息:');
        log(`   标题: ${content.title}`);
        log(`   内容: ${content.bodyText}`);
        log(`   按钮数量: ${content.buttons.length}`);
        if (content.buttons.length > 0) {
            log('   按钮列表:');
            content.buttons.forEach((btn, i) => {
                if (btn.text) {
                    log(`      ${i + 1}. "${btn.text}" (disabled: ${btn.disabled}, visible: ${btn.visible})`);
                }
            });
        }

        // 方法3: 使用系统截图捕获整个屏幕（包括扩展图标）
        log('📸 方法3: 使用系统命令截取完整屏幕...');
        execSync('screencapture -x test-results/system-full-screen.png');
        log('✅ 系统截图: test-results/system-full-screen.png');

        // 方法4: 尝试通过键盘快捷键打开扩展
        log('⌨️  方法4: 尝试使用键盘快捷键...');
        log('   (注意: 需要在Chrome中为TronLink设置快捷键)');

        await client.close();
        log('');
        log('✅ 分析完成！生成的文件:');
        log('   - test-results/viewport-before-click.png (当前视口)');
        log('   - test-results/tronlink-page.png (TronLink扩展页面)');
        log('   - test-results/system-full-screen.png (系统完整截图)');
        log('');
        log('💡 建议:');
        log('   1. 查看 system-full-screen.png 找到TronLink图标的实际位置');
        log('   2. 如果TronLink已登录，可以直接通过扩展URL访问');
        log('   3. 可以在Chrome中为TronLink设置键盘快捷键以便自动化');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

findAndClickTronLink();
