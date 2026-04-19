/**
 * Access Log E2E Test — SPA-friendly version
 * 
 * Strategy:
 * 1. Navigate ONCE to base URL via CDP
 * 2. Use JS (React Router) for internal navigation — no full page reload
 * 3. Wait for flush interval
 * 4. Query MongoDB directly
 *
 * Usage: node tests/e2e/cdp-access-log-e2e.js
 */

const CDP = require('chrome-remote-interface');
const http = require('http');
const mongoose = require('mongoose');

const API_URL = 'http://127.0.0.1:7778';
const BASE_URL = 'http://127.0.0.1:3001';
const MONGO_URI = 'mongodb://localhost:27017/bridge-poker';

// Pages to visit in order
const PAGES_TO_VISIT = [
    '/',           // Landing (already here)
    '/play',       // Game main page
    '/tournament', // Tournament list
    '/wallet',     // Wallet page
    '/dao',        // DAO governance
    '/nft',        // NFT gallery
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

function httpGet(url) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        http.get({ hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
        }).on('error', reject);
    });
}

async function clearAccessLogs() {
    await mongoose.connect(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000
    });
    const result = await mongoose.connection.db.collection('accesslogs').deleteMany({});
    log(`Cleared ${result.deletedCount} existing access logs`);
}

async function queryAccessLogs() {
    return mongoose.connection.db.collection('accesslogs')
        .find({})
        .sort({ entryTime: 1 })
        .toArray();
}

/** Execute JS in browser and return result */
async function evalJS(Runtime, expression, timeoutMs = 10000) {
    try {
        const result = await Runtime.evaluate({
            expression,
            returnByValue: true,
            awaitPromise: true,
        }, { timeout: timeoutMs });
        return result?.result?.value;
    } catch (e) {
        log(`evalJS error: ${e.message}`);
        return null;
    }
}

async function runTest() {
    let client;

    try {
        // Step 0: Clear old data
        log('=== Step 0: Clear old logs ===');
        await clearAccessLogs();

        // Step 1: Connect CDP & navigate to home
        log('=== Step 1: Connect Chrome ===');
        client = await CDP({ port: 9222 });
        const { Page, Runtime } = client;
        
        await Page.enable();
        await Runtime.enable();

        log('Navigating to home page...');
        await Page.navigate({ url: BASE_URL });
        await sleep(5000); // Wait for full React app mount

        // Verify page loaded
        const currentUrl = await evalJS(Runtime, 'window.location.href');
        log(`Current URL: ${currentUrl}`);

        // Check if accessLogger is available
        const hasReact = await evalJS(Runtime, '!!document.getElementById("root") && document.getElementById("root").children.length > 0');
        log(`React root mounted: ${hasReact}`);

        // Step 2: Navigate using React Router (SPA — no full reload)
        log('\n=== Step 2: SPA Navigation through pages ===');

        for (let i = 1; i < PAGES_TO_VISIT.length; i++) { // Skip index 0 (already at /)
            const targetPath = PAGES_TO_VISIT[i];
            
            log(`  [${i + 1}/${PAGES_TO_VISIT.length}] Navigating → ${targetPath}`);
            
            // Use pushState to simulate React Router navigation
            await evalJS(Runtime, `
                window.history.pushState({}, '', '${targetPath}');
                window.dispatchEvent(new PopStateEvent('popstate'));
            `);
            
            // Wait for route change detection by useAccessLog hook
            await sleep(3500);
        }

        // Step 3: Wait for automatic flush cycle (10s)
        log('\n=== Step 3: Waiting for flush cycle ===');
        log('Waiting 12 seconds...');
        await sleep(12000);

        // Try manual flush
        log('Attempting manual flush...');
        try {
            // Access the module-level accessLogger singleton indirectly
            const flushInfo = await evalJS(Runtime, `
                (async () => {
                    try {
                        // Find fetch calls to /api/analytics/log or trigger visibilitychange
                        document.dispatchEvent(new Event('visibilitychange'));
                        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
                        document.dispatchEvent(new Event('visibilitychange'));
                        return 'visibilitychange dispatched';
                    } catch(e) {
                        return e.message;
                    }
                })()
            `, 5000);
            log(`Manual flush attempt: ${flushInfo}`);
        } catch (_) {}

        // Additional wait for network requests
        await sleep(4000);

        // Step 4: Query results
        log('\n=== Step 4: Querying MongoDB ===\n');

        // Also check API stats endpoint
        let apiStats = null;
        try {
            apiStats = await httpGet(`${API_URL}/api/analytics/stats?from=2026-01-01&to=2030-12-31`);
            log(`API /stats response keys: ${typeof apiStats === 'object' ? JSON.stringify(Object.keys(apiStats)) : String(apiStats).slice(0,200)}`);
        } catch (e) {
            log(`API /stats error: ${e.message}`);
        }

        const logs = await queryAccessLogs();

        // Display results
        console.log('╔══════════════════════════════════════════════════╗');
        console.log('║       ACCESS LOG E2E TEST RESULTS               ║');
        console.log('╠══════════════════════════════════════════════════╣');
        console.log(`║ Total records in DB: ${String(logs.length).padEnd(29)} ║`);

        if (logs.length === 0) {
            console.log('╚══════════════════════════════════════════════════╝\n');

            // Debug: Try sending a test log manually via POST
            log('No logs found! Trying direct API POST...');
            const testLogResult = await new Promise((resolve) => {
                const body = JSON.stringify({
                    logs: [{
                        sessionId: 'e2e-manual-test',
                        walletAddress: null,
                        path: '/test-direct',
                        entryTime: new Date().toISOString(),
                        exitTime: new Date(Date.now() + 3000).toISOString(),
                        duration: 3,
                        referrer: '/',
                        userAgent: 'E2E Test Script',
                        screenWidth: 1280,
                        screenHeight: 800,
                    }]
                });
                const req = http.request(
                    `${API_URL}/api/analytics/log`,
                    { method: 'POST', headers: { 'Content-Type': 'application/json' } },
                    (res) => {
                        let d = '';
                        res.on('data', c => d += c);
                        res.on('end', () => resolve({ status: res.statusCode, body: d }));
                    }
                );
                req.on('error', e => resolve({ error: e.message }));
                req.write(body);
                req.end();
            });

            log(`Direct POST result: ${JSON.stringify(testLogResult)}`);

            // Re-query
            const requery = await queryAccessLogs();
            log(`After direct POST, DB count: ${requery.length}`);

            if (requery.length > 0) {
                console.log('\n✅ Backend API works correctly!');
                console.log('⚠️  Frontend logger not flushing automatically.');
                console.log('   Possible causes:');
                console.log('   - Frontend dev server not running (need npm run start:client)');
                console.log('   - Build cache stale (need rebuild)');
                console.log('   - Flush timer hasn\'t fired yet (<10s)');
                console.log('   - sessionStorage blocked');
            } else {
                console.log('\n❌ Backend /api/analytics/log endpoint may not be registered!');
                console.log('   Check: server/routes/index.js should have analytics routes');
            }

        } else {
            console.log('╠──────────────────────────────────────────────╣');
            console.log('║ Individual Records:');
            console.log('╠──────────────────────────────────────────────╣');

            let validCount = 0;
            let issuesFound = [];

            for (let i = 0; i < logs.length; i++) {
                const l = logs[i];
                const issues = [];
                if (!l.sessionId) issues.push('sessionId');
                if (!l.path) issues.push('path');
                if (!l.entryTime) issues.push('entryTime');

                if (issues.length > 0) {
                    issuesFound.push(...issues.map(s => `#${i+1}:${s}`));
                } else {
                    validCount++;
                }

                console.log(`║ #${String(i+1).padStart(2)} | path=${(l.path||'-').padEnd(15)} | wallet=${(l.walletAddress||'-').padEnd(42)} | dur=${l.duration!=null?l.duration+'s':'-'} ║`);
            }

            console.log('╠══════════════════════════════════════════════════╣');
            
            const uniquePaths = [...new Set(logs.map(l => l.path))];
            const uniqueSessions = [...new Set(logs.map(l => l.sessionId))];
            const withWallet = logs.filter(l => l.walletAddress).length;
            const withDuration = logs.filter(l => l.duration != null).length;

            console.log(`║ Unique paths:     ${uniquePaths.join(', ').padEnd(36)} ║`);
            console.log(`║ Sessions:         ${String(uniqueSessions.length).padEnd(37)} ║`);
            console.log(`║ With wallet:      ${withWallet}/${logs.length}                              ║`);
            console.log(`║ With duration:    ${withDuration}/${logs.length}                              ║`);
            console.log('╚══════════════════════════════════════════════════╝\n');

            // Coverage analysis
            const missingPages = PAGES_TO_VISIT.filter(p => !new Set(logs.map(l => l.path)).has(p));
            if (missingPages.length > 0) {
                console.log(`⚠️  Pages not recorded: ${missingPages.join(', ')}`);
            } else {
                console.log('✅ All expected pages recorded!');
            }

            if (issuesFound.length > 0) {
                console.log(`⚠️  Validation issues: ${issuesFound.join(', ')}`);
            }

            // Final verdict
            console.log('\n═══ VERDICT ═══');
            if (validCount >= Math.ceil(PAGES_TO_VISIT.length * 0.6) && uniquePaths.size >= 3) {
                console.log('✅ ✅ ✅  PASSED — Access logging system working!');
                process.exitCode = 0;
            } else if (logs.length > 0) {
                console.log('⚠️  PARTIAL — Some data collected, coverage incomplete');
                process.exitCode = 1;
            } else {
                console.log('❌ ❌ ❌  FAILED — No meaningful data collected');
                process.exitCode = 2;
            }
        }

    } catch (err) {
        console.error('\n❌ CRASH:', err.message);
        console.error(err.stack);
        process.exitCode = 3;
    } finally {
        if (client) {
            try { await client.close(); } catch(_) {}
            log('CDP closed');
        }
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
        }
    }
}

runTest();
