const CDP = require('chrome-remote-interface');

async function debug() {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime, DOM, Console } = client;
    
    await Promise.all([Page.enable(), Runtime.enable(), DOM.enable()]);
    
    // 刷新页面
    console.log('Navigating to tournament page...');
    await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
    await Page.loadEventFired();
    await new Promise(r => setTimeout(r, 4000));
    
    // 点击WAITING卡片
    const clickResult = await Runtime.evaluate({
        expression: `
            (function() {
                const allCards = document.querySelectorAll('[data-testid^="tournament-card-"]');
                for (const card of allCards) {
                    if (card.textContent.includes('WAITING')) {
                        card.click();
                        return { clicked: true };
                    }
                }
                return { clicked: false };
            })()
        `,
        returnByValue: true
    });
    console.log('Clicked:', clickResult.result?.value);
    
    await new Promise(r => setTimeout(r, 1000));
    
    // 详细检查模态框样式
    const styleCheck = await Runtime.evaluate({
        expression: `
            (function() {
                const wrapper = document.getElementById('wrapper');
                if (!wrapper) return { exists: false };
                
                const style = window.getComputedStyle(wrapper);
                const rect = wrapper.getBoundingClientRect();
                
                return {
                    exists: true,
                    display: style.display,
                    visibility: style.visibility,
                    opacity: style.opacity,
                    position: style.position,
                    zIndex: style.zIndex,
                    rect: {
                        width: rect.width,
                        height: rect.height,
                        top: rect.top,
                        left: rect.left
                    },
                    parentDisplay: wrapper.parentElement ? 
                        window.getComputedStyle(wrapper.parentElement).display : null
                };
            })()
        `,
        returnByValue: true
    });
    console.log('Style check:', JSON.stringify(styleCheck.result?.value, null, 2));
    
    // 尝试手动显示模态框
    const forceShow = await Runtime.evaluate({
        expression: `
            (function() {
                const wrapper = document.getElementById('wrapper');
                if (wrapper) {
                    wrapper.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; display: flex !important; justify-content: center !important; align-items: center !important; background: rgba(0,0,0,0.5) !important; z-index: 9999 !important;';
                    return { forced: true };
                }
                return { forced: false };
            })()
        `,
        returnByValue: true
    });
    console.log('Force show:', forceShow.result?.value);
    
    await new Promise(r => setTimeout(r, 1000));
    
    // 检查是否可见
    const afterCheck = await Runtime.evaluate({
        expression: `
            (function() {
                const wrapper = document.getElementById('wrapper');
                const rect = wrapper?.getBoundingClientRect();
                return {
                    visible: rect && rect.width > 0 && rect.height > 0,
                    rect
                };
            })()
        `,
        returnByValue: true
    });
    console.log('After force:', afterCheck.result?.value);
    
    // 点击Confirm按钮
    const confirmClick = await Runtime.evaluate({
        expression: `
            (function() {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    if (btn.textContent.includes('Confirm')) {
                        btn.click();
                        return { clicked: true };
                    }
                }
                return { clicked: false };
            })()
        `,
        returnByValue: true
    });
    console.log('Confirm clicked:', confirmClick.result?.value);
    
    await new Promise(r => setTimeout(r, 2000));
    
    // 检查结果
    const resultCheck = await Runtime.evaluate({
        expression: `
            (function() {
                return {
                    url: window.location.href,
                    errorEl: document.querySelector('[data-testid="error-message"]')?.textContent,
                    wrapperExists: !!document.getElementById('wrapper')
                };
            })()
        `,
        returnByValue: true
    });
    console.log('Result:', resultCheck.result?.value);
    
    await client.close();
}

debug().catch(console.error);
