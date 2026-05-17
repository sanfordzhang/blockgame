/**
 * CDP v17: Monitor for page navigation/reload events during 0G/EVM click
 * Also capture network activity to find the real error source
 */
const CDP = require('chrome-remote-interface');

(async function() {
    var client = await CDP({ port: 9222 });
    var Page = client.Page, Runtime = client.Runtime, Network = client.Network, Log = client.Log;
    await Page.enable();
    await Runtime.enable();
    await Network.enable();
    
    try { await Log.enable(); } catch(e) {}

    var events = [];
    
    client.on('Page.frameNavigated', function(params) {
        events.push({ t: Date.now(), type: 'frameNavigated', url: params.frame.url });
    });
    client.on('Page.navigatedWithinDocument', function(params) {
        events.push({ t: Date.now(), type: 'navigatedWithinDocument', url: params.url });
    });
    client.on('Page.loadEventFired', function(params) {
        events.push({ t: Date.now(), type: 'loadEventFired' });
    });
    client.on('Network.requestWillBeSent', function(params) {
        if (params.type === 'Script' || params.type === 'XHR' || params.type === 'Fetch') {
            events.push({ 
                t: Date.now(), 
                type: 'network:' + params.type, 
                url: (params.request||{}).url?.substring(0, 100) 
            });
        }
    });
    client.on('Runtime.consoleAPICalled', function(params) {
        if (params.type === 'error' || params.type === 'warning') {
            var msg = (params.args||[]).map(function(a){return (a.value||a.description||'').substring(0,200);}).join(' ');
            events.push({ t: Date.now(), type: 'console:'+params.type, msg: msg.substring(0,300) });
        }
    });

    console.log('[1] Navigate to mainnet...');
    var navT = Date.now();
    await Page.navigate({ url: 'http://127.0.0.1/?v=' + Date.now() });
    await new Promise(function(r) { setTimeout(r, 5000); });

    // Capture initial state - list all JS chunks loaded
    var scriptsBefore = await Runtime.evaluate({
        expression: 'Array.from(document.querySelectorAll("script[src]")).map(function(s){return s.src;}).join("\\n")',
        returnByValue: true
    });
    console.log('Scripts before click:');
    (scriptsBefore.result.value || '').split('\n').filter(Boolean).forEach(function(s) {
        console.log('   ', s.split('/').pop());
    });

    console.log('\n[2] Clicking 0G / EVM button at T+' + (Date.now()-navT) + 'ms');
    await Runtime.evaluate({
        expression: '(function(){var b=document.querySelectorAll("button");for(var i=0;i<b.length;i++){if(/0[Gg]/i.test(b[i].textContent){b[i].click();return true;}}return false;})()'
    });

    // Wait with event logging
    console.log('\n[3] Monitoring events for 15s...');
    var errorFoundAt = null;
    for (var w=0; w<8; w++) {
        await new Promise(function(r) { setTimeout(r, 2000); });
        
        var bodyCheck = await Runtime.evaluate({
            expression: '(document.body||{}).innerText.indexOf("Cannot read")>=0 ? "ERROR" : "ok"',
            returnByValue: true
        });
        
        if (!errorFoundAt && bodyCheck.result.value === 'ERROR') {
            errorFoundAt = (w+1)*2;
        }
        
        process.stdout.write('  +' + ((w+1)*2) + 's: body=' + bodyCheck.result.value + ' events=' + events.length + '\n');
    }

    // Print all captured events
    console.log('\n=== CAPTURED EVENTS (' + events.length + ') ===');
    var baseT = events[0] ? events[0].t : navT;
    events.forEach(function(ev, i) {
        var offset = ((ev.t - baseT) / 1000).toFixed(2);
        var detail = ev.url || ev.msg || '';
        console.log('  [' + i + '] T+' + offset + 's [' + ev.type + '] ' + detail);
    });

    // Check for new scripts loaded after click (dynamic imports)
    var scriptsAfter = await Runtime.evaluate({
        expression: 'Array.from(document.querySelectorAll("script[src]")).map(function(s){return s.src;}).join("\\n")',
        returnByValue: true
    });
    console.log('\nScripts after click:');
    (scriptsAfter.result.value || '').split('\n').filter(Boolean).forEach(function(s) {
        console.log('   ', s.split('/').pop());
    });

    // Try to get the actual JS error from browser
    var jsErrors = [];
    try {
        var logEntries = await Log.getAndClearLogEntries({});
        logEntries.forEach(function(entry) {
            if (entry.level === 'error' || entry.level === 'warning') {
                jsErrors.push(entry);
            }
        });
    } catch(e) {}
    
    if (jsErrors.length > 0) {
        console.log('\n=== BROWSER LOG ERRORS ===');
        jsErrors.forEach(function(e, i) {
            console.log('  [' + i + '] ' + e.level + ':', (e.text || '').substring(0, 500));
        });
    }

    // Final: try to get the exact error from React's internal state
    var reactError = await Runtime.evaluate({
        expression: '(function(){' +
            '// Walk DOM looking for the error text element' +
            'var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);' +
            'var node;' +
            'while(node = walker.nextNode()) {' +
                'if (node.textContent && node.textContent.indexOf("Cannot read properties of null") >= 0) {' +
                    'var parent = node.parentElement;' +
                    'return {' +
                        'tag: parent ? parent.tagName : "none",' +
                        'cls: parent ? parent.className : "",' +
                        'html: parent ? parent.outerHTML.substring(0,800) : ""' +
                    '};' +
                '}' +
            '}' +
            'return null;' +
        '})()',
        returnByValue: true
    });
    
    console.log('\n=== ERROR ELEMENT ===');
    console.log(JSON.stringify(reactError.result.value, null, 2));

    await client.close();
    console.log('\nDone. Error found at: +' + (errorFoundAt || 'N/A') + 's');
})();
