const CDP = require('chrome-remote-interface');

async function main() {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime, Console } = client;
    
    await Page.enable();
    await Runtime.enable();
    
    // 监听控制台消息
    if (Console) {
        await Console.enable();
        Console.messageAdded((msg) => {
            console.log('Console:', msg.message);
        });
    }

    // 监听错误
    Runtime.exceptionThrown((event) => {
        console.log('Exception:', event.exceptionDetails);
    });

    console.log('刷新页面...');
    await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
    await Page.loadEventFired();
    
    // 等待10秒
    console.log('等待10秒...');
    await new Promise(r => setTimeout(r, 10000));

    // 检查DOM
    const domResult = await Runtime.evaluate({
        expression: `({
            documentElement: document.documentElement.outerHTML.length,
            bodyChildren: document.body ? document.body.children.length : 0,
            bodyHTML: document.body ? document.body.innerHTML.substring(0, 1000) : 'NO BODY',
            rootElement: document.getElementById('root') ? 'root exists' : 'NO ROOT',
            rootChildren: document.getElementById('root') ? document.getElementById('root').children.length : 0,
            rootHTML: document.getElementById('root') ? document.getElementById('root').innerHTML.substring(0, 500) : 'NO ROOT'
        })`,
        returnByValue: true
    });

    console.log('DOM状态:', JSON.stringify(domResult.result.value, null, 2));

    await client.close();
}

main().catch(console.error);
