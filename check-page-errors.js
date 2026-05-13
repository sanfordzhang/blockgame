const CDP = require('chrome-remote-interface');
const fs = require('fs');

(async () => {
  const tabs = await CDP.List({ port: 9222 });
  const t = tabs.find(t => t.url.includes('3001'));
  if (!t) { console.log('NO GAME TAB'); return; }
  
  const c = await CDP({ port: 9222, target: t });
  const { Runtime, Console } = c;
  
  let errors = [];
  Console.messageAdded(msg => {
    if (msg.type === 'error' || msg.level === 'error') {
      errors.push((msg.text || msg.message?.text || '').slice(0, 300));
    }
  });
  await Console.enable();
  
  // Reload page
  await Runtime.evaluate({ expression: 'window.location.reload()' });
  await new Promise(r => setTimeout(r, 8000));
  
  console.log('=== CONSOLE ERRORS (' + errors.length + ') ===');
  errors.slice(0, 10).forEach(e => console.log(e));
  
  // Check for error overlay
  const r = await Runtime.evaluate({
    expression: 'document.querySelector("#error-overlay")?.innerText?.substring(0,1000) || document.querySelector("[class*=error]")?.innerText?.substring(0,1000) || "no-overlay"',
    returnByValue: true
  });
  console.log('=== OVERLAY ===');
  console.log(r.result.value);
  
  // Check root content
  const r2 = await Runtime.evaluate({
    expression: 'document.getElementById("root")?.innerHTML?.length || 0',
    returnByValue: true
  });
  console.log('ROOT HTML LEN:', r2.result.value);
  
  await c.close();
})().catch(e => console.error(e.message));
