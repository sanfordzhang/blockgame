const CDP = require('chrome-remote-interface');
const fs = require('fs');

(async () => {
  let client;
  try {
    client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;

    await Page.enable();
    await Runtime.enable();

    console.log('[STEP] Navigate to /dao ...');
    await Page.navigate({ url: 'http://43.163.114.175:3001/dao' });
    
    console.log('[WAIT] 10s for data fetch...');
    await new Promise(r => setTimeout(r, 10000));

    // Screenshot first
    try { 
      const ss = await Page.captureScreenshot({ format: 'png' });
      if (ss && ss.data) {
        fs.writeFileSync('/tmp/dao-verify.png', Buffer.from(ss.data, 'base64'));
        console.log('[Screenshot saved]');
      }
    } catch(e) { console.log('SS error:', e.message); }

    // Use simpler evaluate
    const r1 = await Runtime.evaluate({ expression: 'document.body.innerText', returnByValue: true });
    const bodyText = (r1 && r1.result) ? r1.result.value : '';
    
    console.log('\n=== BODY TEXT (relevant parts) ===');
    // Find lines with CHIP
    const lines = bodyText.split('\n').filter(l => l.includes('CHIP') || l.includes('Balance'));
    lines.forEach(l => console.log(l.trim().substring(0, 120)));
    
    const chipMatch = bodyText.match(/Your CHIP Balance[\s\S]{0,50}([\d,.]+)\s*CHIP/);
    if (chipMatch) {
      console.log('\n✅ Found:', chipMatch[0].trim());
      console.log('   Value:', chipMatch[1]);
      if (chipMatch[1].replace(/,/g,'') === '2501' || chipMatch[1] === '2,501') {
        console.log('   ✅ CORRECT - Shows 2,501 CHIP!');
      }
    } else {
      console.log('\n❌ CHIP balance pattern not found in page');
    }

  } catch(e) {
    console.error('Error:', e.message);
  } finally { 
    if(client) await client.close(); 
  }
})();
