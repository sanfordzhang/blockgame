const CDP = require('chrome-remote-interface');

(async () => {
  const tabs = await CDP.List({ port: 9222 });
  const t = tabs.find(t => t.url.includes('3001'));
  const c = await CDP({ port: 9222, target: t });
  const { Runtime, Network } = c;
  
  let failed = [];
  let ok200 = [];
  Network.requestFailed(req => failed.push(req.url));
  Network.responseReceived(resp => {
    if (resp.response.status === 200 && (resp.response.url.includes('.js') || resp.response.url.includes('.css'))) {
      ok200.push(resp.response.url);
    }
    if (resp.response.status >= 400) console.log('HTTP', resp.response.status, resp.response.url.slice(0,120));
  });
  await Network.enable();
  
  // Reload
  await Runtime.evaluate({ expression: 'location.reload()' });
  await new Promise(r => setTimeout(r, 10000));
  
  console.log('FAILED:', failed.length);
  failed.forEach(f => console.log(' X', f.slice(0,150)));
  console.log('OK JS/CSS:', ok200.length);
  ok200.forEach(u => console.log(' OK', u.slice(0,120)));
  
  await c.close();
})().catch(e => console.error(e.message));
