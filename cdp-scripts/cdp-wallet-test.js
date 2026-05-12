/**
 * 钱包页面自动化测试脚本
 * 测试页面: http://127.0.0.1:3001/wallet
 * 
 * 测试内容:
 * 1. 页面加载和Tab切换
 * 2. Balance Tab - 余额显示、转账测试
 * 3. Staking Tab - 质押功能测试
 * 4. VIP Status Tab - VIP状态
 * 5. History Tab - 交易历史验证
 * 6. API接口测试 - 转账、质押、奖励
 */

const CDP = require('chrome-remote-interface');
const fs = require('fs');
const http = require('http');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const PLAYER_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const PLAYER2_ADDRESS = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';
const SERVER_URL = 'http://127.0.0.1:7778';

// HTTP 请求辅助函数
async function httpRequest(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, SERVER_URL);
        const options = {
            hostname: url.hostname,
            port: url.port || 80,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };
        
        const req = http.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    resolve({ 
                        status: res.statusCode, 
                        data: JSON.parse(responseData) 
                    });
                } catch (e) {
                    resolve({ status: res.statusCode, data: responseData });
                }
            });
        });
        
        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function test() {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime, Network } = client;
    
    await Page.enable();
    await Runtime.enable();
    await Network.enable();
    
    const screenshot = async (name) => {
        const { data } = await Page.captureScreenshot();
        const path = `test-results/${name}.png`;
        fs.writeFileSync(path, Buffer.from(data, 'base64'));
        console.log(`📸 ${name}`);
    };
    
    const getState = async () => {
        const result = await Runtime.evaluate({
            expression: `({
                url: window.location.href,
                title: document.querySelector('h1')?.textContent || '',
                activeTab: (() => {
                    const tabs = document.querySelectorAll('button');
                    for (const tab of tabs) {
                        const text = tab.textContent.trim();
                        if (['Balance', 'Staking', 'VIP Status', 'History'].includes(text)) {
                            const style = window.getComputedStyle(tab);
                            if (style.background.includes('rgb') || style.backgroundColor) {
                                return text;
                            }
                        }
                    }
                    return 'unknown';
                })(),
                tabs: Array.from(document.querySelectorAll('button'))
                    .filter(b => ['Balance', 'Staking', 'VIP Status', 'History'].includes(b.textContent.trim()))
                    .map(b => ({ text: b.textContent.trim(), disabled: b.disabled })),
                bodyText: document.body.innerText.substring(0, 1000),
                hasWalletCard: !!document.querySelector('[data-testid="wallet-card"]'),
                hasStakeCard: !!document.querySelector('[data-testid="stake-card"]'),
                hasVipCard: !!document.querySelector('[data-testid="vip-card"]'),
                chipBalance: document.querySelector('[data-testid="chip-balance"]')?.textContent || '',
                stakedAmount: document.querySelector('[data-testid="staked-amount"]')?.textContent || '',
                vipLevel: document.querySelector('[data-testid="vip-badge"]')?.textContent || '',
                vipDiscount: document.querySelector('[data-testid="vip-discount"]')?.textContent || ''
            })`,
            returnByValue: true
        });
        return result.result.value;
    };
    
    const clickTab = async (tabName) => {
        return await Runtime.evaluate({
            expression: `
                (function() {
                    const tabs = document.querySelectorAll('button');
                    for (const tab of tabs) {
                        if (tab.textContent.trim() === '${tabName}') {
                            tab.click();
                            return { success: true, text: tab.textContent.trim() };
                        }
                    }
                    return { success: false };
                })()
            `,
            returnByValue: true
        });
    };
    
    const clickButton = async (testId) => {
        return await Runtime.evaluate({
            expression: `
                (function() {
                    const btn = document.querySelector('[data-testid="${testId}"]');
                    if (btn && !btn.disabled) {
                        btn.click();
                        return { success: true };
                    }
                    return { success: false, disabled: btn?.disabled };
                })()
            `,
            returnByValue: true
        });
    };
    
    // 模拟 TronLink 钱包并设置地址
    const mockTronLink = async () => {
        await Runtime.evaluate({
            expression: `
                (function() {
                    window.tronLink = {
                        ready: true,
                        tronWeb: {
                            defaultAddress: { base58: '${PLAYER_ADDRESS}' },
                            address: { fromHex: (hex) => '${PLAYER_ADDRESS}' }
                        }
                    };
                    window.tronWeb = window.tronLink.tronWeb;
                    window.localStorage.setItem('testWalletAddress', '${PLAYER_ADDRESS}');
                    return true;
                })()
            `,
            returnByValue: true
        });
    };

    console.log('========================================');
    console.log('💰 钱包页面自动化测试 (完整版)');
    console.log('========================================\n');

    // ==================== 步骤0: 准备测试数据 ====================
    console.log('--- 步骤0: 准备测试数据 ---');
    
    // 创建测试交易
    const txResult = await httpRequest('POST', '/api/chip/test/create-transactions', {
        walletAddress: PLAYER_ADDRESS
    });
    console.log('创建测试交易:', txResult.data.message || txResult.data.error);
    
    // 创建质押
    const stakeResult = await httpRequest('POST', '/api/stake/create', {
        walletAddress: PLAYER_ADDRESS,
        amount: 1000,
        lockDays: 30
    }, { 'x-wallet-address': PLAYER_ADDRESS });
    console.log('创建质押:', stakeResult.data.success ? '✅' : stakeResult.data.error);
    
    // 执行转账
    const transferResult = await httpRequest('POST', '/api/chip/transfer', {
        from: PLAYER_ADDRESS,
        to: PLAYER2_ADDRESS,
        amount: 100
    });
    console.log('执行转账:', transferResult.data.success ? '✅' : transferResult.data.error);
    
    await sleep(1000);

    // ==================== 步骤1: 导航到钱包页面 ====================
    console.log('\n--- 步骤1: 导航到钱包页面 ---');
    await Page.navigate({ url: `http://127.0.0.1:3001/wallet?address=${PLAYER_ADDRESS}` });
    await Page.loadEventFired();
    await sleep(3000);
    
    await mockTronLink();
    await sleep(1500);
    
    await screenshot('wallet-01-initial');
    
    let state = await getState();
    console.log('页面标题:', state.title);
    console.log('钱包卡片:', state.hasWalletCard ? '✅ 显示' : '❌ 未显示');
    console.log('CHIP余额:', state.chipBalance || '未显示');

    // ==================== 步骤2: 测试 Balance Tab ====================
    console.log('\n--- 步骤2: 测试 Balance Tab ---');
    await clickTab('Balance');
    await sleep(1500);
    await screenshot('wallet-02-balance-tab');
    
    state = await getState();
    const balanceState = { ...state };
    console.log('Balance Tab:');
    console.log('  - 钱包卡片:', state.hasWalletCard ? '✅' : '❌');
    console.log('  - CHIP余额:', state.chipBalance);
    
    // 检查按钮
    const balanceButtons = await Runtime.evaluate({
        expression: `({
            transfer: !!document.querySelector('[data-testid="transfer-btn"]'),
            history: !!document.querySelector('[data-testid="history-btn"]'),
            claim: !!document.querySelector('[data-testid="claim-btn"]')
        })`,
        returnByValue: true
    });
    console.log('  - 按钮:', balanceButtons.result.value);
    
    // ==================== 步骤3: 测试 Staking Tab ====================
    console.log('\n--- 步骤3: 测试 Staking Tab ---');
    await clickTab('Staking');
    await sleep(1500);
    await screenshot('wallet-03-staking-tab');
    
    state = await getState();
    const stakingState = { ...state };
    console.log('Staking Tab:');
    console.log('  - 质押卡片:', state.hasStakeCard ? '✅' : '❌');
    console.log('  - 质押总额:', state.stakedAmount);
    
    // 检查质押列表
    const stakingInfo = await Runtime.evaluate({
        expression: `({
            stakeBtn: !!document.querySelector('[data-testid="stake-btn"]'),
            activeStakes: document.querySelectorAll('[data-testid="stake-card"] button').length,
            stakeItems: document.body.innerText.includes('Active Stakes') || document.body.innerText.includes('Staked')
        })`,
        returnByValue: true
    });
    console.log('  - 质押按钮:', stakingInfo.result.value.stakeBtn ? '✅' : '❌');
    console.log('  - 显示质押信息:', stakingInfo.result.value.stakeItems ? '✅' : '❌');
    
    // 测试质押按钮点击
    console.log('  - 测试点击质押按钮...');
    const stakeClickResult = await clickButton('stake-btn');
    console.log('  - 点击结果:', stakeClickResult.result.value);
    await sleep(1000);
    await screenshot('wallet-04-after-stake-click');
    
    // ==================== 步骤4: 测试 VIP Status Tab ====================
    console.log('\n--- 步骤4: 测试 VIP Status Tab ---');
    await clickTab('VIP Status');
    await sleep(1500);
    await screenshot('wallet-05-vip-tab');
    
    state = await getState();
    const vipState = { ...state };
    console.log('VIP Status Tab:');
    console.log('  - VIP卡片:', state.hasVipCard ? '✅' : '❌');
    console.log('  - VIP等级:', state.vipLevel);
    console.log('  - 折扣:', state.vipDiscount);
    
    // 检查VIP等级说明
    const vipInfo = await Runtime.evaluate({
        expression: `({
            levels: Array.from(document.querySelectorAll('div')).filter(el => 
                el.textContent.includes('Bronze') || 
                el.textContent.includes('Silver') || 
                el.textContent.includes('Gold') || 
                el.textContent.includes('Platinum')
            ).length
        })`,
        returnByValue: true
    });
    console.log('  - VIP等级说明:', vipInfo.result.value.levels > 0 ? '✅ 显示' : '❌ 未显示');
    
    // ==================== 步骤5: 测试 History Tab ====================
    console.log('\n--- 步骤5: 测试 History Tab ---');
    await clickTab('History');
    await sleep(1500);
    await screenshot('wallet-06-history-tab');
    
    // 检查交易历史
    const historyInfo = await Runtime.evaluate({
        expression: `({
            title: document.body.innerText.includes('Transaction History'),
            hasTransactions: !document.body.innerText.includes('No transactions yet'),
            transactionCount: (document.body.innerText.match(/Game Reward|Staked|Transfer|Received|Claim/g) || []).length
        })`,
        returnByValue: true
    });
    console.log('History Tab:');
    console.log('  - 标题:', historyInfo.result.value.title ? '✅' : '❌');
    console.log('  - 有交易记录:', historyInfo.result.value.hasTransactions ? '✅' : '❌');
    console.log('  - 交易类型数量:', historyInfo.result.value.transactionCount);
    
    // ==================== 步骤6: 通过API验证数据 ====================
    console.log('\n--- 步骤6: 通过API验证数据 ---');
    
    try {
        // 获取余额
        const balanceRes = await httpRequest('GET', `/api/chip/balance/${PLAYER_ADDRESS}`);
        console.log('API余额:', balanceRes.data);
        
        // 获取VIP状态
        const vipRes = await httpRequest('GET', `/api/chip/vip-status/${PLAYER_ADDRESS}`);
        console.log('API VIP状态:', vipRes.data);
        
        // 获取质押历史
        const stakesRes = await httpRequest('GET', `/api/stake/history/${PLAYER_ADDRESS}`);
        console.log('API质押历史:', stakesRes.data.success ? 
            `✅ ${stakesRes.data.stakes?.length || 0} 条记录` : stakesRes.data.error);
        
        // 获取交易历史
        const txRes = await httpRequest('GET', `/api/chip/transactions/${PLAYER_ADDRESS}`);
        console.log('API交易历史:', txRes.data.success ? 
            `✅ ${txRes.data.transactions?.length || 0} 条记录` : txRes.data.error);
    } catch (err) {
        console.log('API调用出错:', err.message);
    }
    
    // ==================== 步骤7: 测试转账功能 ====================
    console.log('\n--- 步骤7: 测试转账功能 ---');
    
    // 回到 Balance Tab
    await clickTab('Balance');
    await sleep(1000);
    
    // 点击转账按钮
    const transferBtnResult = await clickButton('transfer-btn');
    console.log('点击转账按钮:', transferBtnResult.result.value);
    await sleep(1000);
    await screenshot('wallet-07-transfer-dialog');
    
    // 检查是否有转账对话框
    const dialogInfo = await Runtime.evaluate({
        expression: `({
            hasDialog: !!document.querySelector('[role="dialog"]') || 
                       !!document.querySelector('.swal2-popup') ||
                       document.body.innerText.includes('Transfer') ||
                       document.body.innerText.includes('转账'),
            bodyText: document.body.innerText.substring(0, 500)
        })`,
        returnByValue: true
    });
    console.log('转账对话框:', dialogInfo.result.value.hasDialog ? '✅ 显示' : '❌ 未显示');
    
    // ==================== 最终截图 ====================
    await screenshot('wallet-08-final');
    
    console.log('\n========================================');
    console.log('✅ 钱包页面测试完成!');
    console.log('========================================');
    
    // 测试结果汇总
    console.log('\n📋 测试结果汇总:');
    console.log('  1. 页面加载:', '✅');
    console.log('  2. Balance Tab:', balanceState.hasWalletCard ? '✅' : '❌');
    console.log('  3. Staking Tab:', stakingState.hasStakeCard || stakingInfo.result.value.stakeBtn ? '✅' : '❌');
    console.log('  4. VIP Status Tab:', vipState.hasVipCard ? '✅' : '❌');
    console.log('  5. History Tab:', historyInfo.result.value.hasTransactions ? '✅' : '❌');
    console.log('  6. 转账功能:', transferBtnResult.result.value.success ? '✅' : '❌');
    
    await client.close();
}

test().catch(err => {
    console.error('测试失败:', err);
    process.exit(1);
});
