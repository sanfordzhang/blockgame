const CDP = require('chrome-remote-interface');
const fs = require('fs');

(async () => {
  let client;
  try {
    client = await CDP({ port: 9222, timeout: 10000 });
    const { Page, Runtime } = client;

    await Page.enable();
    
    console.log('[1] Navigate to /dao');
    await Page.navigate({ url: 'http://43.163.114.175:3001/dao' });
    
    await new Promise(r => setTimeout(r, 8000));
    
    var r = await Runtime.evaluate({ expression: 'document.body.innerText', returnByValue: true, timeout: 3000 }).catch(function() { return { result: { value: '' } }; });
    var t = r && r.result ? r.result.value : '';
    var lines = t.split('\n').filter(function(l) { return l.indexOf('CHIP') >= 0 || l.indexOf('Proposal') >= 0; });
    console.log('\n[T+8s] ' + lines.length + ' lines:');
    for (var i = 0; i < lines.length; i++) {
      console.log('  | ' + lines[i].trim().substring(0, 100));
    }
    
    // Wait more
    await new Promise(r => setTimeout(r, 5000));
    
    r = await Runtime.evaluate({ expression: 'document.body.innerText', returnByValue: true, timeout: 3000 }).catch(function() { return { result: { value: '' } }; });
    t = r && r.result ? r.result.value : '';
    lines = t.split('\n').filter(function(l) { return l.indexOf('CHIP') >= 0 || l.indexOf('Proposal') >= 0; });
    console.log('\n[T+13s] ' + lines.length + ' lines:');
    for (var i = 0; i < lines.length; i++) {
      console.log('  | ' + lines[i].trim().substring(0, 100));
    }
    
    // Screenshot
    try {
      var ss = await Page.captureScreenshot({ format: 'png' });
      if (ss && ss.data) fs.writeFileSync('/tmp/dao-v2.png', Buffer.from(ss.data, 'base64'));
      console.log('[Screenshot saved to /tmp/dao-v2.png]');
    } catch(e) { console.log('SS err:', e.message); }
    
    client.close();
  } catch(e) {
    console.error('ERR:', e.message);
    try { if(client) client.close(); } catch(x) {}
  }
})();
