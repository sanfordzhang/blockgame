const CDP = require('chrome-remote-interface');

(async () => {
  let client;
  try {
    client = await CDP({ port: 9222, timeout: 10000 });
    const { Page, Runtime } = client;

    await Page.enable();
    
    console.log('[1] Navigate to /dao');
    await Page.navigate({ url: 'http://43.163.114.175:3001/dao' });
    await new Promise(r => setTimeout(r, 12000));

    // Simple text extraction
    const r1 = await Runtime.evaluate({ 
      expression: 'document.querySelector("body") ? document.body.innerText : "no body"',
      returnByValue: true,
      timeout: 5000
    });
    
    if (!r1 || !r1.result) { console.log('No result'); return; }
    const t = r1.result.value || '';
    const chipLine = (t.split('\n').filter(l => l.includes('CHIP Balance') || l.match(/\d+.*CHIP/)))[0];
    console.log('\n[RESULT] ' + (chipLine || 'NO CHIP FOUND'));
    
    client.close();
  } catch(e) {
    console.error('ERR:', e.message);
    try { if(client) client.close(); } catch(x) {}
  }
})();
