const CDP = require('chrome-remote-interface');

(async function() {
  const client = await CDP({ port: 9222 });
  const { Page, Runtime } = client;

  await Page.enable();
  await Runtime.enable();

  // Navigate to NFT gallery
  console.log('Navigating to /nft ...');
  await Page.navigate({ url: 'http://127.0.0.1:3001/nft' });
  await new Promise(resolve => setTimeout(resolve, 4000));

  // More precise click on ONLY the 0G/INFT tab
  console.log('Clicking specifically the 0G / INFT tab...');
  
  const clickResult = await Runtime.evaluate({
    expression: `
      (function() {
        // Find ALL elements that contain exactly or primarily '0G / INFT' text
        var allElements = document.querySelectorAll('*');
        var target = null;
        
        for (var j = 0; j < allElements.length; j++) {
          var el = allElements[j];
          var txt = (el.textContent || '').trim();
          // Look for small elements whose text starts with or is "0G"
          if ((txt.indexOf('0G') === 0 || txt.indexOf('0G / INFT') >= 0) && 
              el.offsetWidth > 0 && el.offsetHeight > 0 &&
              txt.length < 30) {
            // Prefer the most specific (smallest) element
            if (!target || el.children.length < target.children.length) {
              target = el;
            }
          }
        }
        
        if (target) {
          var rect = target.getBoundingClientRect();
          target.click();
          return JSON.stringify({
            clicked: true,
            tag: target.tagName,
            text: (target.textContent || '').trim(),
            class: (target.className || '').substring(0, 100),
            rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
          });
        }
        
        // Fallback: find by coordinates - look for the middle tab area
        var tabs = document.querySelectorAll('li, [role="tab"], button');
        var tabInfos = [];
        for (var k = 0; k < tabs.length; k++) {
          var t = tabs[k];
          if (t.offsetWidth > 0 && t.offsetHeight > 0) {
            var r = t.getBoundingClientRect();
            tabInfos.push({
              text: (t.textContent || '').trim().substring(0, 50),
              x: r.x + r.width/2,
              y: r.y + r.height/2
            });
          }
        }
        return JSON.stringify({ clicked: false, tabsFound: tabInfos });
      })()
    `,
    returnByValue: true
  });

  console.log('Click result:', clickResult.result.value);

  // Wait longer for data to load
  console.log('Waiting 10 seconds for data to load...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Take screenshot after waiting
  const screenshotPath = '/tmp/nft-gallery-inft-screenshot-2.png';
  const screenshotResult = await Page.captureScreenshot({ format: 'png', captureBeyondViewport: true });
  require('fs').writeFileSync(screenshotPath, Buffer.from(screenshotResult.data, 'base64'));
  console.log('\nScreenshot saved to: ' + screenshotPath);

  // Get full page info
  const pageInfo = await Runtime.evaluate({
    expression: `
      (function() {
        var bodyText = document.body.innerText;
        var cards = document.querySelectorAll('[class*="card"], [class*="NFT"], [class*="nft"], [class*="inft"], [class*="item"], [class*="gallery"], [class*="achievement"]');
        var visibleCards = [];
        for (var i = 0; i < cards.length; i++) {
          var c = cards[i];
          if (c.offsetWidth > 50 && c.offsetHeight > 50) {
            visibleCards.push({
              tag: c.tagName,
              text: (c.textContent || '').trim().substring(0, 150),
              classes: (c.className || '').substring(0, 100)
            });
          }
        }

        // Also check React fiber state for INFT data
        var inftData = [];
        try {
          var rootEl = document.getElementById('root');
          if (rootEl && rootEl._reactRootContainer) {
            var fiberKey = Object.keys(rootEl).find(k => k.startsWith('__reactFiber'));
            if (fiberKey) {
              // Try to extract state
            }
          }
        } catch(e) {}

        // Check network requests for INFT API calls
        return JSON.stringify({
          url: window.location.href,
          title: document.title,
          bodyText: bodyText.substring(0, 4000),
          visibleCardCount: visibleCards.length,
          cards: visibleCards.slice(0, 25),
          allVisibleElements: Array.from(document.body.querySelectorAll('*'))
            .filter(function(el) { return el.offsetWidth > 100 && el.offsetHeight > 40 && el.children.length === 0; })
            .map(function(el) { return (el.textContent || '').trim().substring(0, 80); })
            .filter(function(t) { return t.length > 3 && t.length < 200; })
            .slice(0, 30)
        }, null, 2);
      })()
    `,
    returnByValue: true
  });

  const info = JSON.parse(pageInfo.result.value);

  console.log('\n=== PAGE INFO ===');
  console.log('URL:', info.url);
  console.log('Title:', info.title);
  console.log('Visible card-like elements:', info.visibleCardCount);
  console.log('\n=== BODY TEXT ===');
  console.log(info.bodyText);

  if (info.cards.length > 0) {
    console.log('\n=== CARD DETAILS ===');
    info.cards.forEach(function(c, i) {
      console.log('[' + i + '] <' + c.tag + '> "' + c.text.substring(0, 100) + '" [' + c.classes + ']');
    });
  }

  console.log('\n=== LEAF ELEMENTS (potential content) ===');
  info.allVisibleElements.forEach(function(t, i) {
    console.log('[' + i + '] ' + t);
  });

  await client.close();
  console.log('\nDone!');
})().catch(function(err) {
  console.error('Error:', err.message);
  process.exit(1);
});
