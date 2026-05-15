const CDP = require('chrome-remote-interface');

(async () => {
  try {
    const client = await CDP({ port: 9222 });
    const { Runtime } = client;
    
    const result = await Runtime.evaluate({
      expression: `
        (function() {
          const buttons = Array.from(document.querySelectorAll('button'));
          const btnInfo = buttons.map(b => ({text: b.textContent.trim(), cls: b.className.substring(0,50)}));
          const ogBtn = buttons.find(b => b.textContent.includes('0G') || b.textContent.includes('EVM'));
          if (ogBtn) {
            ogBtn.click();
            return {clicked: true, text: ogBtn.textContent.trim(), all: btnInfo};
          }
          return {clicked: false, all: btnInfo};
        })()
      `,
      returnByValue: true
    });
    
    console.log(JSON.stringify(result.result.value, null, 2));
    await client.close();
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
