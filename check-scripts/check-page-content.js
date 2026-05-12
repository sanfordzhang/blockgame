const CDP = require('chrome-remote-interface');

async function main() {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    
    await Page.enable();
    await Runtime.enable();

    // 刷新页面
    console.log('刷新页面...');
    await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
    await Page.loadEventFired();
    
    // 等待更长时间
    await new Promise(r => setTimeout(r, 5000));

    // 获取页面HTML
    const htmlResult = await Runtime.evaluate({
        expression: `({
            html: document.documentElement.outerHTML.substring(0, 5000),
            title: document.title,
            readyState: document.readyState,
            hasReact: typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined',
            bodyChildren: document.body.children.length,
            allElements: document.querySelectorAll('*').length
        })`,
        returnByValue: true
    });

    console.log('页面状态:', JSON.stringify(htmlResult.result.value, null, 2).substring(0, 3000));

    await client.close();
}

main().catch(console.error);
