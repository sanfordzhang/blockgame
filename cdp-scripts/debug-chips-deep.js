const CDP = require('chrome-remote-interface');
(async () => {
  const client = await CDP({ port: 9222 });
  const { Runtime } = client;
  await Runtime.enable();

  // Navigate fresh
  await Runtime.evaluate({ expression: "window.location.href='/'", awaitPromise: false });
  await new Promise(r => setTimeout(r, 5000));

  // Override console.log to capture chipsAmount details
  await Runtime.evaluate({
    expression: `(function() {
      var origLog = console.log;
      window.__chipData = [];
      console.log = function() {
        var msg = Array.prototype.join.call(arguments, ' ');
        if (msg.indexOf('chipsAmount') >= 0) {
          // Capture the actual argument types
          var detail = Array.prototype.slice.call(arguments).map(function(a) {
            return { type: typeof a, val: String(a).substring(0, 200), isObj: typeof a === 'object' && a !== null };
          });
          window.__chipData.push({ msg: msg.substring(0,300), detail: detail });
        }
        origLog.apply(console, arguments);
      };
      return 'interceptor installed';
    })()`,
    returnByValue: true
  });

  // Wait for balance sync attempts
  await new Promise(r => setTimeout(r, 8000));

  // Get captured data
  const chipData = await Runtime.evaluate({
    expression: 'JSON.stringify(window.__chipData || [])',
    returnByValue: true
  });
  
  console.log('=== Captured chipsAmount logs ===');
  var data = JSON.parse(chipData.result.value);
  data.forEach(function(d) { 
    console.log(d.msg); 
    d.detail.forEach(function(a) { 
      console.log('   arg type=' + a.type + ' val=[' + a.val + '] isObj=' + a.isObj); 
    }); 
  });

  // Also check what SC_BALANCE_SYNCED actually sends
  const balanceCheck = await Runtime.evaluate({
    expression: `(function() {
      // Try to find the actual socket handler by checking fetch responses
      return {
        url: location.href,
        gameBalanceText: (document.body.innerText.match(/Game Balance[\\s\\S]*?([\\d.]+)\\s*TRX/) || [])[1]
      };
    })()`,
    returnByValue: true
  });
  console.log('\\n=== Current State ===');
  console.log(JSON.stringify(balanceCheck.result.value));

  // Check normalizeBalance behavior in production build bundle
  const normTest = await Runtime.evaluate({
    expression: `(function() {
      // Test what value 393500000 becomes after normalization
      // In production build, this function is minified - try to call it
      var testVal = 393500000;
      // TRON SUN to TRX should be /1e6
      return {
        raw: testVal,
        div1e6: testVal / 1e6,
        div1e18: testVal / 1e18
      };
    })()`,
    returnByValue: true
  });
  console.log('\\n=== Normalize Balance Reference ===');
  console.log(JSON.stringify(normTest.result.value));

  await client.close();
})();
