const CDP = require('chrome-remote-interface');
(async () => {
  const client = await CDP({ port: 9222 });
  const { Runtime, Page } = client;
  await Runtime.enable(); await Page.enable();

  // FIRST: Install interceptor BEFORE navigation
  await Runtime.evaluate({
    expression: `(function() {
      var origLog = console.log;
      window.__chipData = [];
      console.log = function() {
        var msg = Array.prototype.join.call(arguments, ' ');
        // Capture all Landing/tronInteract related logs
        if (msg.indexOf('chipsAmount') >= 0 || msg.indexOf('contractBalance') >= 0 || 
            msg.indexOf('registration') >= 0 || msg.indexOf('Player data') >= 0 ||
            msg.indexOf('BALANCE') >= 0) {
          var detail = Array.prototype.slice.call(arguments).map(function(a) {
            return { type: typeof a, str: String(a).substring(0, 300), keys: typeof a === 'object' && a !== null ? Object.keys(a).slice(0,10) : null };
          });
          window.__chipData.push({ ts: Date.now(), msg: msg.substring(0,400), detail: detail });
        }
        origLog.apply(console, arguments);
      };
      
      // Also capture errors
      var origError = console.error;
      console.error = function() {
        var msg = Array.prototype.join.call(arguments, ' ');
        if (msg.indexOf('tron') >= 0 || msg.indexOf('contract') >= 0 || msg.indexOf('balance') >= 0) {
          window.__chipData.push({ ts: Date.now(), level: 'ERROR', msg: msg.substring(0,400) });
        }
        origError.apply(console, arguments);
      };
      
      return 'interceptor installed BEFORE nav';
    })()`,
    returnByValue: true
  });

  // Hard reload to ensure fresh start with interceptor active
  await Page.reload({ ignoreCache: true });
  await new Promise(r => setTimeout(r, 8000));

  // Get all captured data
  const result = await Runtime.evaluate({
    expression: `(function() {
      var text = document.body.innerText;
      return {
        chipData: window.__chipData || [],
        url: location.href,
        gameBalance: (text.match(/Game Balance[\\s\\S]*?([\\d.]+)\\s*TRX/) || [])[1],
        bankroll: (text.match(/Bankroll[\\s\\S]*?([\\d.]+)\\s*TRX/) || [])[1],
        walletTrx: (text.match(/Wallet TRX:[\\s\\S]*?([\\d.]+)\\s*TRX/) || [])[1]
      };
    })()`,
    returnByValue: true
  });

  console.log('=== Current State ===');
  console.log('URL:', result.result.value.url);
  console.log('Wallet TRX:', result.result.value.walletTrx);
  console.log('Game Balance:', result.result.value.gameBalance);
  console.log('Bankroll:', result.result.value.bankroll);

  console.log('\n=== All Captured Logs (' + result.result.value.chipData.length + ') ===');
  result.result.value.chipData.forEach(function(d) { 
    console.log('[' + new Date(d.ts).toISOString().substring(11,19) + '] ' + d.msg); 
    if (d.detail) d.detail.forEach(function(a) { 
      console.log('   arg: type=' + a.type + ' str=[' + (a.str||'').substring(0,150) + ']' + (a.keys ? ' keys=' + a.keys.join(',') : '')); 
    }); 
  });

  await client.close();
})();
