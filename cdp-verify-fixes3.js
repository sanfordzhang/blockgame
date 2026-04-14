// 深度CDP验证：检查网络请求、console错误、navbar余额
const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const client = await CDP({ port: 9222 });
  const { Page, Runtime, Network, Console } = client;
  
  await Page.enable();
  await Runtime.enable();
  await Network.enable();
  await Console.enable();

  // Collect console messages
  const consoleMsgs = [];
  Console.messageAdded(({ message }) => {
    consoleMsgs.push({
      level: message.level,
      text: message.text.substring(0, 200),
      source: message.source
    });
  });

  // Collect network responses
  const networkResponses = [];
  Network.responseReceived(({ response }) => {
    networkResponses.push({
      url: response.url.replace('http://43.163.114.175:3001', ''),
      status: response.status,
      method: response.requestMethod
    });
  });
  
  // Track failed requests
  const failedRequests = [];
  Network.loadingFailed(({ requestId, errorText }) => {
    failedRequests.push({ errorText });
  });

  console.log('=== 导航到Wallet页面并等待 ===\n');
  await Page.navigate({ url: 'http://43.163.114.175:3001/wallet' });
  
  // Wait up to 15 seconds for data to load
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    const loaded = await Runtime.evaluate({
      expression: `
        !document.body.innerText.includes('Loading...')
      `,
      returnByValue: true
    });
    if (loaded.result.value) break;
    console.log(`  Still loading... (${i+1}s)`);
  }

  console.log('\n=== 网络请求汇总 ===');
  console.log(`总请求数: ${networkResponses.length}`);
  console.log(`失败请求: ${failedRequests.length}`, failedRequests);
  
  const apiReqs = networkResponses.filter(r => r.url.includes('/api/'));
  console.log(`\nAPI请求:`);
  apiReqs.forEach(r => console.log(`  ${r.method} ${r.url} -> ${r.status}`));

  console.log('\n=== Console消息(最后20条) ===');
  consoleMsgs.slice(-20).forEach(m => console.log(`[${m.level}] ${m.text}`));

  // Get final page state
  const finalState = await Runtime.evaluate({
    expression: `
      (function() {
        const bodyText = document.body.innerText;
        return {
          isLoading: bodyText.includes('Loading...'),
          hasContent: !bodyText.includes('Loading...'),
          snippet: bodyText.substring(0, 2000)
        };
      })()
    `,
    returnByValue: true
  });
  console.log('\n=== 页面最终状态 ===');
  console.log(JSON.stringify(finalState.result.value, null, 2));

  // Take screenshot
  const ss = await Page.captureScreenshot({ format: 'png' });
  fs.writeFileSync('/tmp/cdp-wallet-final.png', Buffer.from(ss.data, 'base64'));
  console.log('\n截图: /tmp/cdp-wallet-final.png');

  // Now specifically check the Navbar balance issue
  console.log('\n\n=== 检查Navbar余额(Bug #3) ===');
  // Check GlobalState chipsAmount value
  const globalStateCheck = await Runtime.evaluate({
    expression: `
      (function() {
        // Try to read from React fiber tree
        const rootEl = document.getElementById('root');
        if (!rootEl) return { error: 'no root' };
        
        const fiberKey = Object.keys(rootEl).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
        if (!fiberKey) return { error: 'no react fiber' };
        
        // Walk fiber tree to find chipsAmount
        let fiber = rootEl[fiberKey];
        let depth = 0;
        while (fiber && depth < 50) {
          if (fiber.memoizedProps && fiber.memoizedProps.chipsAmount !== undefined) {
            return { 
              chipsAmount: fiber.memoizedProps.chipsAmount, 
              walletAddress: fiber.memoizedProps.walletAddress ? 
                (typeof fiber.memoizedProps.walletAddress === 'string' ? 
                  fiber.memoizedProps.walletAddress.substring(0,15) + '...' : 'set') : 'none',
              foundAt: 'memoizedProps'
            };
          }
          if (fiber.memoizedState) {
            // Check hooks state queue
            let stateNode = fiber.memoizedState;
            while (stateNode && depth < 30) {
              if (stateNode.state !== undefined && stateNode.queue && stateNode.queue.lastRenderedState !== undefined) {
                const val = stateNode.queue.lastRenderedState;
                if (val === null || typeof val === 'number') {
                  // Could be chipsAmount
                  return { possibleChipsValue: val, foundInHook: true };
                }
              }
              stateNode = stateNode.next;
            }
          }
          fiber = fiber.child || fiber.return?.sibling || null;
          if (fiber === null) break;
          depth++;
        }
        return { error: 'chipsAmount not found in fiber tree', maxDepth: depth };
      })()
    `,
    returnByValue: true
  });
  console.log('GlobalState chipsAmount:', JSON.stringify(globalStateCheck.result.value, null, 2));

  await client.close();
}

run().catch(e => { console.error('Error:', e); process.exit(1); });
