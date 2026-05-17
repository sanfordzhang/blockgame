const CDP = require('chrome-remote-interface');
(async () => {
  const client = await CDP({ port: 9222 });
  const { Runtime } = client;
  await Runtime.enable();
  
  await Runtime.evaluate({ expression: "window.location.href = '/'", awaitPromise: false });
  await new Promise(r => setTimeout(r, 6000));
  
  const result = await Runtime.evaluate({
    expression: `(function() {
      var roots = document.getElementById('root');
      var fiberKey = Object.keys(roots).find(function(k) { return k.startsWith('__reactFiber'); });
      if (!fiberKey) return { error: 'no react fiber' };
      var fiber = roots[fiberKey];
      var depth = 0;
      while (fiber && depth < 50) {
        // Check memoizedState chain
        var state = fiber.memoizedState;
        while (state) {
          var s = state.memoizedState;
          if (s && typeof s === 'object' && s.chipsAmount !== undefined) {
            return {
              found: true,
              chipsAmount: s.chipsAmount,
              chipsType: typeof s.chipsAmount,
              chipStr: String(s.chipsAmount).substring(0,300),
              keys: s.chipsAmount && typeof s.chipsAmount === 'object' ? Object.keys(s.chipsAmount).slice(0,10) : null
            };
          }
          state = state.next;
        }
        fiber = fiber.child || (depth > 10 ? null : fiber.return);
        depth++;
      }
      return { error: 'not found', depth: depth };
    })()`,
    returnByValue: true
  });
  console.log(JSON.stringify(result.result.value, null, 2));
  await client.close();
})();
