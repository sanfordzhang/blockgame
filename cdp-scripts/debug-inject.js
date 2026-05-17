const CDP = require('chrome-remote-interface');
(async () => {
  const client = await CDP({ port: 9222 });
  const { Runtime, Page } = client;
  await Runtime.enable(); await Page.enable();

  // Inject interceptor that persists across navigations
  await Page.addScriptToEvaluateOnNewDocument(`
    // Persistent interceptor
    (function() {
      if (window.__chipInterceptorInstalled) return;
      window.__chipInterceptorInstalled = true;
      window.__chipData = [];
      
      var origLog = console.log;
      var origError = console.error;
      var origWarn = console.warn;
      
      function capture(level, args) {
        var msg = Array.prototype.join.call(args, ' ');
        if (msg.indexOf('chipsAmount') >= 0 || msg.indexOf('contractBalance') >= 0 ||
            msg.indexOf('registration') >= 0 || msg.indexOf('Player data') >= 0 ||
            msg.indexOf('BALANCE') >= 0 || msg.indexOf('Syncing') >= 0) {
          var detail = Array.prototype.slice.call(args).map(function(a) {
            return { type: typeof a, str: String(a).substring(0, 300), 
                     keys: typeof a === 'object' && a !== null ? Object.keys(a).slice(0,10) : null };
          });
          window.__chipData.push({ ts: Date.now(), level: level, msg: msg.substring(0,500), detail: detail });
        }
      }
      
      console.log = function() { capture('LOG', arguments); origLog.apply(console, arguments); };
      console.error = function() { capture('ERROR', arguments); origError.apply(console, arguments); };
      console.warn = function() { capture('WARN', arguments); origWarn.apply(console, arguments); };
    })();
  `);

  // Hard reload - the injected script will run before page scripts
  await Page.reload({ ignoreCache: true });
  await new Promise(r => setTimeout(r, 8000));

  // Get results
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

  var data = result.result.value.chipData;
  console.log('\n=== Captured Logs (' + data.length + ') ===');
  data.forEach(function(d) { 
    console.log('[' + d.level + '][' + new Date(d.ts).toISOString().substr(11,12) + '] ' + d.msg); 
    (d.detail || []).forEach(function(a) { 
      console.log('   arg type=' + a.type + ' str=[' + (a.str || '').substring(0,150) + ']' + (a.keys ? ' keys=' + a.keys.join(',') : '')); 
    }); 
  });

  await client.close();
})();
