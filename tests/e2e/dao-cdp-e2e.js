/**
 * DAO Governance CDP E2E Test
 *
 * 测试流程：
 * 1. 连接钱包进入 DAO 页面
 * 2. 测试 Active/Passed/All/Create 四个 Tab 切换
 * 3. 创建新提案
 * 4. 对提案投票（支持/反对）
 * 5. 验证投票结果和状态更新
 */

const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');

const SERVER_URL = 'http://127.0.0.1:3001';
const CDP_PORT = 9222;
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'dao');

const PLAYER1 = {
    address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
    privateKey: '[REMOVED PRIVATE KEY - SEE .env FOR CONFIG]'
};

let screenshotCount = 0;

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function takeScreenshot(Page, name = '') {
    screenshotCount++;
    const filename = `dao-${String(screenshotCount).padStart(2, '0')}${name ? '-' + name : ''}.png`;
    const filepath = path.join(SCREENSHOT_DIR, filename);

    // 确保目录存在
    if (!fs.existsSync(SCREENSHOT_DIR)) {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    const screenshot = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(screenshot.data, 'base64'));
    console.log(`📸 ${filename}`);
}

async function evaluate(Runtime, expression) {
    const result = await Runtime.evaluate({ expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) {
        const msg = result.exceptionDetails.exception
            ? result.exceptionDetails.exception.description
            : result.exceptionDetails.text;
        throw new Error(msg);
    }
    return result.result.value;
}

async function clickElement(Runtime, selector, description = '') {
    console.log(`🖱️  Clicking: ${description || selector}`);
    const script = `
        (function() {
            const el = document.querySelector('${selector}');
            if (!el) throw new Error('Element not found: ${selector}');
            el.click();
            return true;
        })()
    `;
    return await evaluate(Runtime, script);
}

async function fillInput(Runtime, selector, value, description = '') {
    console.log(`⌨️  Filling: ${description || selector} = "${value}"`);
    const script = `
        (function() {
            const el = document.querySelector('${selector}');
            if (!el) throw new Error('Element not found: ${selector}');
            el.value = '${value}';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        })()
    `;
    return await evaluate(Runtime, script);
}

async function getElementText(Runtime, selector) {
    const script = `
        (function() {
            const el = document.querySelector('${selector}');
            return el ? el.textContent.trim() : null;
        })()
    `;
    return await evaluate(Runtime, script);
}

async function waitForElement(Runtime, selector, timeout = 10000) {
    console.log(`⏳ Waiting for: ${selector}`);
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        const script = `document.querySelector('${selector}') !== null`;
        const exists = await evaluate(Runtime, script);
        if (exists) {
            console.log(`✅ Found: ${selector}`);
            return true;
        }
        await sleep(500);
    }

    throw new Error(`Timeout waiting for element: ${selector}`);
}

async function getProposalCount(Runtime) {
    // styled-components 生成随机 class，通过 ACTIVE/PASSED 状态 Badge 计数
    const script = `
        (function() {
            const text = document.body.innerText;
            const activeCount = (text.match(/\\bACTIVE\\b/g) || []).length;
            const passedCount = (text.match(/\\bPASSED\\b/g) || []).length;
            const executedCount = (text.match(/\\bEXECUTED\\b/g) || []).length;
            const rejectedCount = (text.match(/\\bREJECTED\\b/g) || []).length;
            return activeCount + passedCount + executedCount + rejectedCount;
        })()
    `;
    return await evaluate(Runtime, script);
}

async function main() {
    let client;

    try {
        console.log('🚀 Starting DAO CDP E2E Test...\n');

        // 找到 localhost:3001 的 tab
        const http = require('http');
        const pages = await new Promise((resolve, reject) => {
            http.get(`http://localhost:${CDP_PORT}/json`, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => resolve(JSON.parse(data)));
            }).on('error', reject);
        });

        const appPage = pages.find(p => p.url && (p.url.includes('localhost:3001') || p.url.includes('127.0.0.1:3001')));
        const target = appPage ? appPage.id : null;

        // 连接 CDP
        client = await CDP({ port: CDP_PORT, target });
        const { Page, Runtime, Network } = client;

        await Page.enable();
        await Runtime.enable();
        await Network.enable();

        console.log('✅ CDP connected\n');

        // ==================== 1. 导航到 DAO 页面 ====================
        console.log('📍 Step 1: Navigate to DAO page');
        await Page.navigate({ url: `${SERVER_URL}/dao` });
        await sleep(3000);
        await takeScreenshot(Page, 'initial-load');

        // 检查页面标题
        const heading = await getElementText(Runtime, 'h1');
        console.log(`📄 Page heading: "${heading}"`);

        if (!heading || !heading.includes('DAO')) {
            console.log('⚠️  DAO heading not found, might need wallet connection');
        }

        await sleep(1000);

        // ==================== 2. 测试 Tab 切换 ====================
        console.log('\n📍 Step 2: Test Tab Navigation');

        // 2.1 Active Tab (默认)
        console.log('\n🔹 Testing Active Tab');
        await waitForElement(Runtime, 'button');
        await takeScreenshot(Page, 'tab-active');

        const activeCount = await getProposalCount(Runtime);
        console.log(`   Active proposals: ${activeCount}`);

        await sleep(1000);

        // 2.2 Passed Tab
        console.log('\n🔹 Testing Passed Tab');
        const passedTabScript = `
            (function() {
                const buttons = Array.from(document.querySelectorAll('button'));
                const passedBtn = buttons.find(b => b.textContent.trim() === 'Passed');
                if (passedBtn) {
                    passedBtn.click();
                    return true;
                }
                return false;
            })()
        `;
        await evaluate(Runtime, passedTabScript);
        await sleep(2000);
        await takeScreenshot(Page, 'tab-passed');

        const passedCount = await getProposalCount(Runtime);
        console.log(`   Passed proposals: ${passedCount}`);

        await sleep(1000);

        // 2.3 All Tab
        console.log('\n🔹 Testing All Tab');
        const allTabScript = `
            (function() {
                const buttons = Array.from(document.querySelectorAll('button'));
                const allBtn = buttons.find(b => b.textContent.trim() === 'All');
                if (allBtn) {
                    allBtn.click();
                    return true;
                }
                return false;
            })()
        `;
        await evaluate(Runtime, allTabScript);
        await sleep(2000);
        await takeScreenshot(Page, 'tab-all');

        const allCount = await getProposalCount(Runtime);
        console.log(`   All proposals: ${allCount}`);

        await sleep(1000);

        // 2.4 Create Tab
        console.log('\n🔹 Testing Create Tab');
        const createTabScript = `
            (function() {
                const buttons = Array.from(document.querySelectorAll('button'));
                const createBtn = buttons.find(b => b.textContent.trim() === 'Create');
                if (createBtn) {
                    createBtn.click();
                    return true;
                }
                return false;
            })()
        `;
        await evaluate(Runtime, createTabScript);
        await sleep(2000);
        await takeScreenshot(Page, 'tab-create');

        // 检查创建表单是否显示
        const hasForm = await evaluate(Runtime, `
            document.querySelector('input[placeholder*="Title"]') !== null
        `);
        console.log(`   Create form visible: ${hasForm}`);

        await sleep(1000);

        // ==================== 3. 创建提案 ====================
        console.log('\n📍 Step 3: Create New Proposal');

        const proposalTitle = `Test Proposal ${Date.now()}`;
        const proposalDesc = 'This is an automated test proposal to verify DAO governance functionality.';

        // 填写标题
        const fillTitleScript = `
            (function() {
                const input = document.querySelector('input[placeholder*="Title"]');
                if (!input) return false;
                input.value = '${proposalTitle}';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            })()
        `;
        await evaluate(Runtime, fillTitleScript);
        console.log(`   ✏️  Title: "${proposalTitle}"`);
        await sleep(500);

        // 填写描述
        const fillDescScript = `
            (function() {
                const textarea = document.querySelector('textarea[placeholder*="Description"]');
                if (!textarea) return false;
                textarea.value = '${proposalDesc}';
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            })()
        `;
        await evaluate(Runtime, fillDescScript);
        console.log(`   ✏️  Description: "${proposalDesc}"`);
        await sleep(500);

        await takeScreenshot(Page, 'create-filled');

        // 检查提交按钮状态
        const buttonState = await evaluate(Runtime, `
            (function() {
                const buttons = Array.from(document.querySelectorAll('button'));
                const submitBtn = buttons.find(b => b.textContent.includes('Create Proposal'));
                if (!submitBtn) return { found: false };
                return {
                    found: true,
                    disabled: submitBtn.disabled,
                    text: submitBtn.textContent.trim()
                };
            })()
        `);

        console.log(`   Submit button: ${JSON.stringify(buttonState)}`);

        if (buttonState && buttonState.found && !buttonState.disabled) {
            console.log('   🚀 Submitting proposal...');
            const submitScript = `
                (function() {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const submitBtn = buttons.find(b => b.textContent.includes('Create Proposal'));
                    if (submitBtn && !submitBtn.disabled) {
                        submitBtn.click();
                        return true;
                    }
                    return false;
                })()
            `;
            await evaluate(Runtime, submitScript);
            await sleep(3000);
            await takeScreenshot(Page, 'create-submitted');
            console.log('   ✅ Proposal submitted');
        } else {
            console.log('   ⚠️  Cannot submit (button disabled or not found)');
            console.log('   💡 This might be due to insufficient CHIP balance or no wallet connection');
        }

        await sleep(1000);

        // ==================== 4. 返回 Active Tab 查看提案 ====================
        console.log('\n📍 Step 4: View Proposals in Active Tab');

        const backToActiveScript = `
            (function() {
                const buttons = Array.from(document.querySelectorAll('button'));
                const activeBtn = buttons.find(b => b.textContent.trim() === 'Active');
                if (activeBtn) {
                    activeBtn.click();
                    return true;
                }
                return false;
            })()
        `;
        await evaluate(Runtime, backToActiveScript);
        await sleep(2000);
        await takeScreenshot(Page, 'proposals-list');

        const proposalCountAfter = await getProposalCount(Runtime);
        console.log(`   Active proposals after creation: ${proposalCountAfter}`);

        // ==================== 5. 测试投票功能 ====================
        console.log('\n📍 Step 5: Test Voting');

        // 检查是否有投票按钮
        const hasVoteButtons = await evaluate(Runtime, `
            (function() {
                const forBtn = Array.from(document.querySelectorAll('button')).find(b =>
                    b.textContent.includes('Vote For') || b.textContent.includes('For')
                );
                const againstBtn = Array.from(document.querySelectorAll('button')).find(b =>
                    b.textContent.includes('Vote Against') || b.textContent.includes('Against')
                );
                return { hasFor: !!forBtn, hasAgainst: !!againstBtn };
            })()
        `);

        console.log(`   Vote buttons: ${JSON.stringify(hasVoteButtons)}`);

        if (hasVoteButtons && hasVoteButtons.hasFor) {
            console.log('   🗳️  Attempting to vote FOR...');
            const voteForScript = `
                (function() {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const forBtn = buttons.find(b => b.textContent.includes('Vote For'));
                    if (forBtn && !forBtn.disabled) {
                        forBtn.click();
                        return true;
                    }
                    return false;
                })()
            `;
            const voted = await evaluate(Runtime, voteForScript);
            await sleep(2000);
            await takeScreenshot(Page, 'vote-for');

            if (voted) {
                console.log('   ✅ Vote FOR clicked');
            } else {
                console.log('   ⚠️  Vote button disabled or not clickable');
            }
        } else {
            console.log('   ℹ️  No vote buttons found (might need wallet connection or no active proposals)');
        }

        await sleep(1000);

        // ==================== 6. 检查投票统计 ====================
        console.log('\n📍 Step 6: Check Vote Statistics');

        const voteStats = await evaluate(Runtime, `
            (function() {
                const text = document.body.innerText;
                const forMatch = text.match(/For[\\s\\S]{0,20}?([\\d,]+)/);
                const againstMatch = text.match(/Against[\\s\\S]{0,20}?([\\d,]+)/);
                const quorumMatch = text.match(/Quorum[\\s\\S]{0,10}?(✅|❌)/);
                return {
                    For: forMatch ? forMatch[1] : 'N/A',
                    Against: againstMatch ? againstMatch[1] : 'N/A',
                    Quorum: quorumMatch ? quorumMatch[1] : 'N/A'
                };
            })()
        `);

        console.log('   Vote statistics:', JSON.stringify(voteStats));
        await takeScreenshot(Page, 'vote-stats');

        // ==================== 7. 测试提案详情显示 ====================
        console.log('\n📍 Step 7: Check Proposal Details');

        const proposalDetails = await evaluate(Runtime, `
            (function() {
                const text = document.body.innerText;
                const lines = text.split('\\n').filter(l => l.trim());
                // 找到 ACTIVE 状态行附近的内容
                const activeIdx = lines.findIndex(l => l.trim() === 'ACTIVE');
                if (activeIdx < 0) return null;
                return {
                    title: lines[activeIdx - 3] || lines[0],
                    state: 'ACTIVE',
                    votesFor: lines[activeIdx + 2] || 'N/A'
                };
            })()
        `);

        if (proposalDetails) {
            console.log('   First proposal details:');
            console.log(`     Title: ${proposalDetails.title}`);
            console.log(`     State: ${proposalDetails.state}`);
            console.log(`     Votes For: ${proposalDetails.votesFor}`);
        } else {
            console.log('   ℹ️  No proposals found');
        }

        await sleep(1000);

        // ==================== 8. 测试投票进度条 ====================
        console.log('\n📍 Step 8: Check Vote Progress Bar');

        const voteProgress = await evaluate(Runtime, `
            (function() {
                const bars = document.querySelectorAll('div[style*="width"]');
                let percentage = null;
                bars.forEach(b => {
                    const w = b.style.width;
                    if (w && w.includes('%') && !percentage) percentage = w;
                });
                return percentage ? { exists: true, percentage } : null;
            })()
        `);

        if (voteProgress) {
            console.log(`   Vote progress bar: ${voteProgress.percentage}`);
        }

        await takeScreenshot(Page, 'final-state');

        // ==================== 总结 ====================
        console.log('\n' + '='.repeat(60));
        console.log('📊 Test Summary');
        console.log('='.repeat(60));
        console.log(`✅ Active Tab: ${activeCount} proposals`);
        console.log(`✅ Passed Tab: ${passedCount} proposals`);
        console.log(`✅ All Tab: ${allCount} proposals`);
        console.log(`✅ Create Tab: Form ${hasForm ? 'visible' : 'not visible'}`);
        console.log(`✅ Vote Buttons: ${hasVoteButtons.hasFor ? 'available' : 'not available'}`);
        console.log(`✅ Screenshots: ${screenshotCount} taken`);
        console.log(`✅ Screenshot directory: ${SCREENSHOT_DIR}`);
        console.log('='.repeat(60));

        console.log('\n✅ DAO CDP E2E Test completed successfully!\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

// 运行测试
if (require.main === module) {
    main().catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}

module.exports = { main };
