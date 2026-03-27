/**
 * 简化的锦标赛第二手测试
 * 使用 Playwright 来测试
 */

const { chromium } = require('playwright');
const axios = require('axios');

const API_BASE = 'http://127.0.0.1:7778';
const FRONTEND_URL = 'http://127.0.0.1:3001';

// 测试用的私钥
const PLAYER1_PRIVATE_KEY = 'a1a2a3a4a5a6a7a8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2';
const PLAYER2_PRIVATE_KEY = 'b1b2b3b4b5b6b7b8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2';

const { TronWeb } = require('tronweb');
const tronWeb = new TronWeb({ fullHost: 'https://api.shasta.trongrid.io' });

async function getAddressFromPrivateKey(privateKey) {
    return tronWeb.address.fromPrivateKey(privateKey);
}

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function runTest() {
    console.log('=== Simplified Tournament Test ===\n');
    
    let browser;
    let context;
    let page1, page2;
    
    try {
        // 派生地址
        const player1Address = await getAddressFromPrivateKey(PLAYER1_PRIVATE_KEY);
        const player2Address = await getAddressFromPrivateKey(PLAYER2_PRIVATE_KEY);
        console.log(`Player 1: ${player1Address}`);
        console.log(`Player 2: ${player2Address}\n`);
        
        // 1. 创建锦标赛
        console.log('Step 1: Creating tournament...');
        const createRes = await axios.post(`${API_BASE}/api/tournament/create`, {
            configId: 3
        }, {
            headers: { 'x-wallet-address': player1Address }
        });
        const tournamentId = createRes.data.tournamentId || createRes.data.tournament?.tournamentId;
        console.log(`Tournament created: ${tournamentId}\n`);
        
        // 2. 连接浏览器
        console.log('Step 2: Connecting to Chrome (CDP port 9222)...');
        browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
        context = browser.contexts()[0];
        
        // 获取现有页面或创建新页面
        const existingPages = context.pages();
        console.log(`Found ${existingPages.length} existing pages`);
        
        // 使用第一个页面作为 player1
        page1 = existingPages[0] || await context.newPage();
        
        // 创建新页面作为 player2
        page2 = await context.newPage();
        
        // 3. 设置控制台日志监听
        page1.on('console', msg => {
            if (msg.text().includes('Tournament') || msg.text().includes('game') || msg.text().includes('Socket')) {
                console.log(`[P1 Console] ${msg.text()}`);
            }
        });
        page2.on('console', msg => {
            if (msg.text().includes('Tournament') || msg.text().includes('game') || msg.text().includes('Socket')) {
                console.log(`[P2 Console] ${msg.text()}`);
            }
        });
        
        // 4. Player 1 加入
        console.log('\nStep 3: Player 1 joining tournament...');
        await page1.goto(`${FRONTEND_URL}/tournament/${tournamentId}?address=${player1Address}`);
        await sleep(3000);
        
        // 检查页面状态
        const p1Content = await page1.content();
        console.log(`Player 1 page loaded, content length: ${p1Content.length}`);
        
        // 5. Player 2 加入 - 锦标赛应该开始
        console.log('\nStep 4: Player 2 joining tournament...');
        await page2.goto(`${FRONTEND_URL}/tournament/${tournamentId}?address=${player2Address}`);
        await sleep(5000);
        
        // 6. 检查游戏是否开始
        console.log('\nStep 5: Checking if game started...');
        
        const p1Buttons = await page1.locator('button').allTextContents();
        const p2Buttons = await page2.locator('button').allTextContents();
        
        console.log('Player 1 buttons:', p1Buttons.filter(b => b.trim()).slice(0, 5));
        console.log('Player 2 buttons:', p2Buttons.filter(b => b.trim()).slice(0, 5));
        
        const gameStarted = p1Buttons.some(b => b.toLowerCase().includes('fold') || b.toLowerCase().includes('check') || b.toLowerCase().includes('call'));
        console.log(`Game started: ${gameStarted ? 'YES' : 'NO'}`);
        
        if (!gameStarted) {
            console.log('\nGame did not start. Checking page content...');
            const p1Text = await page1.locator('body').innerText();
            console.log('Player 1 page text (first 500 chars):', p1Text.substring(0, 500));
            return;
        }
        
        // 7. 玩第一局 - Fold
        console.log('\nStep 6: Playing first hand - looking for fold button...');
        
        // 检查谁轮到
        const p1Turn = await page1.locator('button:has-text("Fold")').count() > 0;
        const p2Turn = await page2.locator('button:has-text("Fold")').count() > 0;
        
        console.log(`Player 1 turn: ${p1Turn}, Player 2 turn: ${p2Turn}`);
        
        if (p1Turn) {
            console.log('Player 1 folding...');
            await page1.locator('button:has-text("Fold")').click();
            await sleep(3000);
        } else if (p2Turn) {
            console.log('Player 2 folding...');
            await page2.locator('button:has-text("Fold")').click();
            await sleep(3000);
        }
        
        // 8. 检查第一局是否结束
        console.log('\nStep 7: Checking if first hand ended...');
        const p1WinMessage = await page1.locator('text=/wins|Winner/i').count();
        console.log(`Win message found: ${p1WinMessage > 0}`);
        
        // 9. 等待第二局开始
        console.log('\nStep 8: Waiting for second hand to start (5 seconds)...');
        await sleep(5000);
        
        // 10. 检查第二局是否开始
        console.log('\nStep 9: Checking if second hand started...');
        
        const p1ButtonsAfter = await page1.locator('button').allTextContents();
        const gameButtons = p1ButtonsAfter.filter(b => 
            b.toLowerCase().includes('fold') || 
            b.toLowerCase().includes('check') || 
            b.toLowerCase().includes('call') ||
            b.toLowerCase().includes('raise')
        );
        
        console.log('Action buttons found:', gameButtons);
        
        if (gameButtons.length > 0) {
            console.log('\n✅ SUCCESS: Second hand started!');
            
            // 玩第二局
            const foldBtn1 = await page1.locator('button:has-text("Fold")').count();
            const foldBtn2 = await page2.locator('button:has-text("Fold")').count();
            
            if (foldBtn1 > 0) {
                console.log('Player 1 folding in second hand...');
                await page1.locator('button:has-text("Fold")').click();
                await sleep(2000);
            } else if (foldBtn2 > 0) {
                console.log('Player 2 folding in second hand...');
                await page2.locator('button:has-text("Fold")').click();
                await sleep(2000);
            }
            
            // 等待第三局
            console.log('\nWaiting for third hand...');
            await sleep(5000);
            
            const p1ButtonsThird = await page1.locator('button').allTextContents();
            const thirdHandButtons = p1ButtonsThird.filter(b => 
                b.toLowerCase().includes('fold') || 
                b.toLowerCase().includes('check')
            );
            
            if (thirdHandButtons.length > 0) {
                console.log('✅ Third hand also started successfully!');
            } else {
                console.log('⚠️ Third hand did not start (tournament may have ended)');
            }
        } else {
            console.log('\n❌ FAILURE: Second hand did NOT start');
            
            // 检查是否锦标赛结束了
            const endMessage = await page1.locator('text=/ended|finished|winner|Tournament/i').count();
            console.log(`End message found: ${endMessage > 0}`);
            
            const pageText = await page1.locator('body').innerText();
            console.log('Page text (last 300 chars):', pageText.slice(-300));
        }
        
    } catch (error) {
        console.error('Test error:', error.message);
        console.error(error.stack);
    } finally {
        if (browser) {
            // 不要关闭浏览器，只是断开连接
            await browser.close();
        }
        console.log('\nTest completed');
    }
}

runTest().catch(console.error);
