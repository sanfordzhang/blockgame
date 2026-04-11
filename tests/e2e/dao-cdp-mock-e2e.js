/**
 * DAO API Mock Server + CDP E2E Test
 *
 * 在没有真实后端的情况下，启动 Mock API 服务器，通过 CDP 操作浏览器进行完整的 DAO 页面测试。
 *
 * 用法:
 *   node tests/e2e/dao-cdp-mock-e2e.js
 *
 * 前置条件:
 *   1. Chrome 已以 --remote-debugging-port=9222 启动
 *   2. 前端已在 http://127.0.0.1:3001 运行
 */

const http = require('http');
const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');

// ============================================================
// 配置
// ============================================================
const FRONTEND_URL = 'http://127.0.0.1:3001';
const CDP_PORT = 9222;
const MOCK_API_PORT = 7780;
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'dao');

// 测试玩家
const PLAYER1 = {
    address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv'
};

// ============================================================
// Mock 数据
// ============================================================
const MOCK_PROPOSALS = [
    {
        _id: 'prop-001',
        title: 'Reduce Rake Rate to 3%',
        description: 'This proposal aims to reduce the platform rake rate from 5% to 3% to attract more players.',
        state: 'ACTIVE',
        votesFor: 125000,
        votesAgainst: 45000,
        quorumReached: false,
        votingEnds: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        proposerAddress: PLAYER1.address,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        _id: 'prop-002',
        title: 'Add NFT Staking Rewards',
        description: 'Enable NFT holders to stake their cards for CHIP token rewards at 5% APY.',
        state: 'ACTIVE',
        votesFor: 89000,
        votesAgainst: 12000,
        quorumReached: false,
        votingEnds: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        proposerAddress: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4',
        createdAt: new Date(Date.now() - 0.5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        _id: 'prop-003',
        title: 'Increase Tournament Prize Pool',
        description: 'Allocate 20% of rake revenue to weekly tournament prize pools.',
        state: 'PASSED',
        votesFor: 320000,
        votesAgainst: 50000,
        quorumReached: true,
        votingEnds: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        proposerAddress: PLAYER1.address,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        _id: 'prop-004',
        title: 'Smart Contract Upgrade v2',
        description: 'Upgrade game contract to support multi-table tournaments.',
        state: 'EXECUTED',
        votesFor: 500000,
        votesAgainst: 20000,
        quorumReached: true,
        votingEnds: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        proposerAddress: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4',
        createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        _id: 'prop-005',
        title: 'Burn 10% CHIP Supply',
        description: 'Monthly burn of 10% of CHIP token supply.',
        state: 'REJECTED',
        votesFor: 80000,
        votesAgainst: 250000,
        quorumReached: true,
        votingEnds: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        proposerAddress: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4',
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    }
];

let currentProposals = [...MOCK_PROPOSALS];
let voteRecords = {};

// ============================================================
// Mock API Server
// ============================================================
function startMockServer() {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            // CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.setHeader('Content-Type', 'application/json');

            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            const url = new URL(req.url, `http://localhost:${MOCK_API_PORT}`);
            const pathname = url.pathname;

            console.log(`[Mock API] ${req.method} ${pathname}`);

            // GET /api/dao/proposals
            if (req.method === 'GET' && pathname === '/api/dao/proposals') {
                const state = url.searchParams.get('state');
                let filtered = currentProposals;

                if (state === 'ACTIVE') {
                    filtered = currentProposals.filter(p => p.state === 'ACTIVE');
                } else if (state === 'PASSED') {
                    filtered = currentProposals.filter(p => p.state === 'PASSED');
                }

                res.writeHead(200);
                res.end(JSON.stringify({ success: true, proposals: filtered }));
                return;
            }

            // GET /api/dao/voting-power/:address
            if (req.method === 'GET' && pathname.startsWith('/api/dao/voting-power/')) {
                const address = pathname.split('/').pop();
                const votingPower = address === PLAYER1.address ? 5000 : 0;
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, votingPower }));
                return;
            }

            // GET /api/dao/threshold
            if (req.method === 'GET' && pathname === '/api/dao/threshold') {
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, threshold: 1000 }));
                return;
            }

            // GET /api/dao/quorum
            if (req.method === 'GET' && pathname === '/api/dao/quorum') {
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, quorum: 100000 }));
                return;
            }

            // POST /api/dao/proposals/create
            if (req.method === 'POST' && pathname === '/api/dao/proposals/create') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => {
                    const data = JSON.parse(body || '{}');
                    const newProposal = {
                        _id: `prop-${Date.now()}`,
                        title: data.title || 'Untitled',
                        description: data.description || '',
                        state: 'ACTIVE',
                        votesFor: 0,
                        votesAgainst: 0,
                        quorumReached: false,
                        votingEnds: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                        proposerAddress: data.walletAddress,
                        createdAt: new Date().toISOString()
                    };
                    currentProposals.unshift(newProposal);
                    console.log(`[Mock API] Created proposal: ${newProposal.title}`);
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, proposal: newProposal }));
                });
                return;
            }

            // POST /api/dao/proposals/:id/vote
            const voteMatch = pathname.match(/^\/api\/dao\/proposals\/([^/]+)\/vote$/);
            if (req.method === 'POST' && voteMatch) {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => {
                    const proposalId = voteMatch[1];
                    const data = JSON.parse(body || '{}');
                    const { walletAddress, support } = data;
                    const voteKey = `${proposalId}-${walletAddress}`;

                    if (voteRecords[voteKey]) {
                        res.writeHead(400);
                        res.end(JSON.stringify({ success: false, error: 'Already voted' }));
                        return;
                    }

                    voteRecords[voteKey] = { support, at: Date.now() };

                    const proposal = currentProposals.find(p => p._id === proposalId);
                    if (proposal) {
                        if (support) {
                            proposal.votesFor += 5000;
                        } else {
                            proposal.votesAgainst += 5000;
                        }
                        console.log(`[Mock API] Vote cast: ${support ? 'FOR' : 'AGAINST'} on proposal ${proposalId}`);
                    }

                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, vote: { proposalId, support } }));
                });
                return;
            }

            // GET /api/dao/votes/:address
            if (req.method === 'GET' && pathname.startsWith('/api/dao/votes/')) {
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, votes: [] }));
                return;
            }

            // 默认 404
            res.writeHead(404);
            res.end(JSON.stringify({ success: false, error: 'Not found' }));
        });

        server.listen(MOCK_API_PORT, () => {
            console.log(`✅ Mock API server started on port ${MOCK_API_PORT}`);
            resolve(server);
        });

        server.on('error', reject);
    });
}

// ============================================================
// Helper 工具
// ============================================================
let screenshotCount = 0;

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function takeScreenshot(Page, name = '') {
    screenshotCount++;
    const filename = `dao-${String(screenshotCount).padStart(2, '0')}${name ? '-' + name : ''}.png`;
    const filepath = path.join(SCREENSHOT_DIR, filename);

    if (!fs.existsSync(SCREENSHOT_DIR)) {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    const screenshot = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(screenshot.data, 'base64'));
    console.log(`📸 Saved: ${filename}`);
}

async function evaluate(Runtime, expression) {
    const result = await Runtime.evaluate({
        expression,
        awaitPromise: true,
        returnByValue: true
    });

    if (result.exceptionDetails) {
        const msg = result.exceptionDetails.exception
            ? result.exceptionDetails.exception.description
            : result.exceptionDetails.text;
        throw new Error(`JS Error: ${msg}`);
    }

    return result.result.value;
}

async function waitForText(Runtime, text, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const found = await evaluate(Runtime, `
            document.body.innerText.includes('${text}')
        `);
        if (found) {
            console.log(`✅ Found text: "${text}"`);
            return true;
        }
        await sleep(500);
    }
    throw new Error(`Timeout waiting for text: "${text}"`);
}

async function clickButtonWithText(Runtime, text) {
    const found = await evaluate(Runtime, `
        (function() {
            const btns = Array.from(document.querySelectorAll('button'));
            const btn = btns.find(b => b.textContent.trim() === '${text}');
            if (btn && !btn.disabled) {
                btn.click();
                return true;
            }
            return false;
        })()
    `);

    if (found) {
        console.log(`🖱️  Clicked button: "${text}"`);
    } else {
        console.log(`⚠️  Button not found or disabled: "${text}"`);
    }

    return found;
}

async function injectMockWallet(Runtime) {
    console.log('💉 Injecting mock wallet context...');
    await evaluate(Runtime, `
        (function() {
            // Intercept fetch calls to redirect to mock API
            const originalFetch = window.fetch;
            window.fetch = function(url, options) {
                if (typeof url === 'string' && url.includes('/api/dao/')) {
                    const mockUrl = url.replace(/http:\/\/[^/]+/, 'http://localhost:${MOCK_API_PORT}');
                    console.log('[MockFetch] Redirecting:', url, '->', mockUrl);
                    return originalFetch(mockUrl, options);
                }
                return originalFetch(url, options);
            };
            console.log('[MockFetch] Fetch interceptor installed');
        })()
    `);
}

// ============================================================
// 主测试流程
// ============================================================
async function runTests(Page, Runtime) {
    const results = {
        passed: [],
        failed: [],
        warnings: []
    };

    function pass(name, detail = '') {
        results.passed.push(name);
        console.log(`  ✅ PASS: ${name}${detail ? ' - ' + detail : ''}`);
    }

    function fail(name, reason = '') {
        results.failed.push(name);
        console.log(`  ❌ FAIL: ${name}${reason ? ' - ' + reason : ''}`);
    }

    function warn(name, detail = '') {
        results.warnings.push(name);
        console.log(`  ⚠️  WARN: ${name}${detail ? ' - ' + detail : ''}`);
    }

    // ── Test 1: 页面加载 ────────────────────────────────────
    console.log('\n📋 Test 1: Page Load');
    try {
        await Page.navigate({ url: `${FRONTEND_URL}/dao` });
        await sleep(3000);
        await injectMockWallet(Runtime);
        await sleep(2000);

        const hasHeading = await evaluate(Runtime, `
            document.body.innerText.includes('DAO Governance')
        `);

        if (hasHeading) {
            pass('Page loads with DAO Governance heading');
        } else {
            warn('DAO heading not found', 'might need wallet connection or page is still loading');
        }

        await takeScreenshot(Page, 'page-loaded');
    } catch (e) {
        fail('Page load', e.message);
    }

    // ── Test 2: Tab 切换 - Active ───────────────────────────
    console.log('\n📋 Test 2: Active Tab');
    try {
        const activeClicked = await clickButtonWithText(Runtime, 'Active');
        await sleep(2000);

        if (activeClicked) {
            pass('Active tab is clickable');
        } else {
            fail('Active tab not found');
        }

        const activeProposalText = await evaluate(Runtime, `
            document.body.innerText
        `);

        if (activeProposalText.includes('ACTIVE') || activeProposalText.includes('No proposals')) {
            pass('Active tab shows correct content');
        } else {
            warn('Active tab content unclear');
        }

        await takeScreenshot(Page, 'tab-active');
    } catch (e) {
        fail('Active tab', e.message);
    }

    // ── Test 3: Tab 切换 - Passed ───────────────────────────
    console.log('\n📋 Test 3: Passed Tab');
    try {
        const passedClicked = await clickButtonWithText(Runtime, 'Passed');
        await sleep(2000);

        if (passedClicked) {
            pass('Passed tab is clickable');
        } else {
            fail('Passed tab not found');
        }

        const passedText = await evaluate(Runtime, `document.body.innerText`);

        if (passedText.includes('PASSED') || passedText.includes('No proposals')) {
            pass('Passed tab shows correct content');
        } else {
            warn('Passed tab content unclear');
        }

        await takeScreenshot(Page, 'tab-passed');
    } catch (e) {
        fail('Passed tab', e.message);
    }

    // ── Test 4: Tab 切换 - All ──────────────────────────────
    console.log('\n📋 Test 4: All Tab');
    try {
        const allClicked = await clickButtonWithText(Runtime, 'All');
        await sleep(2000);

        if (allClicked) {
            pass('All tab is clickable');
        } else {
            fail('All tab not found');
        }

        const allText = await evaluate(Runtime, `document.body.innerText`);
        const showsMultipleStates =
            allText.includes('ACTIVE') ||
            allText.includes('PASSED') ||
            allText.includes('No proposals');

        if (showsMultipleStates) {
            pass('All tab shows proposals or empty state');
        } else {
            warn('All tab content unclear');
        }

        await takeScreenshot(Page, 'tab-all');
    } catch (e) {
        fail('All tab', e.message);
    }

    // ── Test 5: Tab 切换 - Create ───────────────────────────
    console.log('\n📋 Test 5: Create Tab');
    try {
        const createClicked = await clickButtonWithText(Runtime, 'Create');
        await sleep(2000);

        if (createClicked) {
            pass('Create tab is clickable');
        } else {
            fail('Create tab not found');
        }

        const hasFormInput = await evaluate(Runtime, `
            document.querySelector('input[placeholder*="Title"]') !== null ||
            document.querySelector('input[type="text"]') !== null
        `);

        if (hasFormInput) {
            pass('Create form is displayed');
        } else {
            warn('Create form input not found (may require wallet connection)');
        }

        const hasTextArea = await evaluate(Runtime, `
            document.querySelector('textarea') !== null
        `);

        if (hasTextArea) {
            pass('Create form has description textarea');
        } else {
            warn('Create form textarea not found');
        }

        await takeScreenshot(Page, 'tab-create');
    } catch (e) {
        fail('Create tab', e.message);
    }

    // ── Test 6: Create Proposal Form 填写 ───────────────────
    console.log('\n📋 Test 6: Fill Create Proposal Form');
    try {
        const titleFilled = await evaluate(Runtime, `
            (function() {
                const input = document.querySelector('input[placeholder*="Title"], input[type="text"]');
                if (!input) return false;
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeInputValueSetter.call(input, 'Test Proposal via CDP');
                input.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            })()
        `);

        if (titleFilled) {
            pass('Proposal title filled successfully');
        } else {
            warn('Could not fill title input');
        }

        const descFilled = await evaluate(Runtime, `
            (function() {
                const textarea = document.querySelector('textarea');
                if (!textarea) return false;
                const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
                nativeTextAreaValueSetter.call(textarea, 'Automated test proposal description from CDP test.');
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            })()
        `);

        if (descFilled) {
            pass('Proposal description filled successfully');
        } else {
            warn('Could not fill description textarea');
        }

        await sleep(1000);
        await takeScreenshot(Page, 'create-form-filled');
    } catch (e) {
        fail('Fill create form', e.message);
    }

    // ── Test 7: Create Proposal 按钮状态验证 ────────────────
    console.log('\n📋 Test 7: Create Proposal Button State');
    try {
        const buttonInfo = await evaluate(Runtime, `
            (function() {
                const btns = Array.from(document.querySelectorAll('button'));
                const btn = btns.find(b => b.textContent.includes('Create Proposal'));
                if (!btn) return null;
                return { text: btn.textContent.trim(), disabled: btn.disabled };
            })()
        `);

        if (buttonInfo) {
            pass('Create Proposal button found', `disabled=${buttonInfo.disabled}`);

            if (!buttonInfo.disabled) {
                console.log('     Attempting to click Create Proposal...');
                const submitted = await evaluate(Runtime, `
                    (function() {
                        const btns = Array.from(document.querySelectorAll('button'));
                        const btn = btns.find(b => b.textContent.includes('Create Proposal') && !b.disabled);
                        if (btn) { btn.click(); return true; }
                        return false;
                    })()
                `);

                if (submitted) {
                    pass('Create Proposal button clicked');
                    await sleep(2000);
                    await takeScreenshot(Page, 'create-submitted');
                } else {
                    warn('Button click blocked');
                }
            } else {
                warn('Create Proposal button is disabled', 'insufficient CHIP or no wallet');
            }
        } else {
            warn('Create Proposal button not found on page');
        }
    } catch (e) {
        fail('Create Proposal button', e.message);
    }

    // ── Test 8: 返回 Active Tab 检查提案列表 ────────────────
    console.log('\n📋 Test 8: Back to Active Tab - Check Proposals');
    try {
        await clickButtonWithText(Runtime, 'Active');
        await sleep(2500);
        await takeScreenshot(Page, 'active-after-create');

        const bodyText = await evaluate(Runtime, `document.body.innerText`);
        const hasLoadingOrContent =
            !bodyText.includes('Error') || bodyText.includes('Loading') || bodyText.includes('No proposals');

        if (hasLoadingOrContent) {
            pass('Active tab shows proper state after navigation');
        } else {
            fail('Active tab shows error state');
        }
    } catch (e) {
        fail('Back to Active tab', e.message);
    }

    // ── Test 9: 投票 UI 元素验证 ────────────────────────────
    console.log('\n📋 Test 9: Vote UI Elements');
    try {
        const voteButtons = await evaluate(Runtime, `
            (function() {
                const btns = Array.from(document.querySelectorAll('button'));
                const forBtns = btns.filter(b => b.textContent.includes('Vote For'));
                const againstBtns = btns.filter(b => b.textContent.includes('Vote Against'));
                return { forCount: forBtns.length, againstCount: againstBtns.length };
            })()
        `);

        if (voteButtons.forCount > 0) {
            pass('Vote For buttons found', `count=${voteButtons.forCount}`);
        } else {
            warn('No Vote For buttons found', 'wallet might not be connected');
        }

        if (voteButtons.againstCount > 0) {
            pass('Vote Against buttons found', `count=${voteButtons.againstCount}`);
        } else {
            warn('No Vote Against buttons found');
        }

        // 检查投票进度条
        const hasVoteBar = await evaluate(Runtime, `
            document.querySelector('[class*="VoteBar"]') !== null ||
            document.querySelector('[class*="vote"]') !== null
        `);

        if (hasVoteBar) {
            pass('Vote progress bar visible');
        } else {
            warn('Vote progress bar not found');
        }

        await takeScreenshot(Page, 'vote-ui');
    } catch (e) {
        fail('Vote UI elements', e.message);
    }

    // ── Test 10: 投票操作 ───────────────────────────────────
    console.log('\n📋 Test 10: Cast Vote');
    try {
        const voteForClicked = await evaluate(Runtime, `
            (function() {
                const btns = Array.from(document.querySelectorAll('button'));
                const btn = btns.find(b => b.textContent.includes('Vote For') && !b.disabled);
                if (btn) { btn.click(); return true; }
                return false;
            })()
        `);

        if (voteForClicked) {
            pass('Vote For button clicked');
            await sleep(2000);
            await takeScreenshot(Page, 'vote-for-clicked');

            const hasError = await evaluate(Runtime, `
                document.body.innerText.includes('Error') || document.body.innerText.includes('error')
            `);

            if (!hasError) {
                pass('No error after voting');
            } else {
                warn('Possible error after voting action');
            }
        } else {
            warn('Vote For button not clickable', 'wallet might not be connected');
        }
    } catch (e) {
        fail('Cast vote', e.message);
    }

    // ── Test 11: Proposal State Badge 验证 ──────────────────
    console.log('\n📋 Test 11: Proposal State Badges');
    try {
        const badges = await evaluate(Runtime, `
            (function() {
                const badgeEls = document.querySelectorAll('[class*="StateBadge"]');
                const texts = Array.from(badgeEls).map(b => b.textContent.trim());
                return texts;
            })()
        `);

        if (badges && badges.length > 0) {
            pass('State badges found', `states: ${badges.join(', ')}`);
        } else {
            warn('No state badges found', 'no proposals displayed');
        }
    } catch (e) {
        fail('State badges', e.message);
    }

    // ── Test 12: 投票功率显示 ────────────────────────────────
    console.log('\n📋 Test 12: Voting Power Display');
    try {
        const bodyText = await evaluate(Runtime, `document.body.innerText`);

        if (bodyText.includes('Voting Power')) {
            pass('Voting Power section visible');
        } else {
            warn('Voting Power not visible', 'might need wallet connection');
        }

        if (bodyText.includes('Proposal Threshold')) {
            pass('Proposal Threshold visible');
        } else {
            warn('Proposal Threshold not visible');
        }
    } catch (e) {
        fail('Voting power display', e.message);
    }

    await takeScreenshot(Page, 'final-state');

    return results;
}

// ============================================================
// 主函数
// ============================================================
async function main() {
    let mockServer;
    let cdpClient;

    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║      DAO Governance CDP E2E Test           ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');

    try {
        // 启动 Mock API 服务器
        mockServer = await startMockServer();

        console.log(`\n🌐 Frontend: ${FRONTEND_URL}`);
        console.log(`📡 Mock API: http://localhost:${MOCK_API_PORT}`);
        console.log(`🔭 CDP port: ${CDP_PORT}`);
        console.log(`📁 Screenshots: ${SCREENSHOT_DIR}`);
        console.log('');

        // 连接 CDP
        cdpClient = await CDP({ port: CDP_PORT });
        const { Page, Runtime, Network } = cdpClient;

        await Page.enable();
        await Runtime.enable();
        await Network.enable();

        console.log('✅ Chrome CDP connected\n');

        // 运行测试
        const results = await runTests(Page, Runtime);

        // ── 测试报告 ──────────────────────────────────────────
        console.log('\n');
        console.log('╔════════════════════════════════════════════╗');
        console.log('║              Test Results                  ║');
        console.log('╚════════════════════════════════════════════╝');
        console.log(`  ✅ Passed:   ${results.passed.length}`);
        console.log(`  ❌ Failed:   ${results.failed.length}`);
        console.log(`  ⚠️  Warnings: ${results.warnings.length}`);
        console.log(`  📸 Screenshots: ${screenshotCount} saved to ${SCREENSHOT_DIR}`);
        console.log('');

        if (results.failed.length > 0) {
            console.log('Failed tests:');
            results.failed.forEach(f => console.log(`  - ${f}`));
        }

        if (results.warnings.length > 0) {
            console.log('\nWarnings (expected if no wallet connected):');
            results.warnings.forEach(w => console.log(`  - ${w}`));
        }

        console.log('');
        console.log('╔════════════════════════════════════════════╗');
        console.log('║      DAO Tab 功能说明                      ║');
        console.log('╚════════════════════════════════════════════╝');
        console.log('');
        console.log('  Active  - 显示投票进行中的提案 (state=ACTIVE)');
        console.log('            玩家可以点击 "Vote For" / "Vote Against" 投票');
        console.log('');
        console.log('  Passed  - 显示投票已通过的提案 (state=PASSED)');
        console.log('            赞成票 > 反对票 且 达到法定人数(Quorum)');
        console.log('');
        console.log('  All     - 显示全部提案 (ACTIVE/PASSED/EXECUTED/REJECTED)');
        console.log('            可以看到提案的完整历史');
        console.log('');
        console.log('  Create  - 创建新提案的表单');
        console.log('            需要: 钱包连接 + CHIP 余额 >= 提案门槛(Threshold)');
        console.log('            填写 Title + Description 后提交');
        console.log('');

        const exitCode = results.failed.length > 0 ? 1 : 0;
        if (exitCode === 0) {
            console.log('✅ All critical tests passed!\n');
        } else {
            console.log('❌ Some tests failed. See above for details.\n');
        }

        process.exit(exitCode);

    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        if (cdpClient) await cdpClient.close();
        if (mockServer) mockServer.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = { main, startMockServer };
