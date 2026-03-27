#!/usr/bin/env node
/**
 * 连接到已存在的Chrome浏览器实例
 * 用于E2E测试
 * 
 * 使用方法:
 * 1. 先启动Chrome并开启远程调试:
 *    macOS: /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
 *    Windows: chrome.exe --remote-debugging-port=9222
 *    Linux: google-chrome --remote-debugging-port=9222
 * 
 * 2. 运行此脚本获取WebSocket endpoint:
 *    node scripts/connect-chrome.js
 * 
 * 3. 运行测试并连接:
 *    CDP_ENDPOINT=ws://localhost:9222/... npx playwright test
 */

const http = require('http');

const CDP_PORT = process.env.CDP_PORT || 9222;

async function getWebSocketEndpoint() {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:${CDP_PORT}/json/version`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.webSocketDebuggerUrl);
                } catch (e) {
                    reject(new Error('Failed to parse CDP response: ' + e.message));
                }
            });
        }).on('error', (e) => {
            reject(new Error(`Cannot connect to Chrome at port ${CDP_PORT}. Make sure Chrome is running with --remote-debugging-port=${CDP_PORT}`));
        });
    });
}

async function main() {
    console.log('='.repeat(60));
    console.log('Chrome DevTools Protocol (CDP) Connection Helper');
    console.log('='.repeat(60));
    console.log();
    
    try {
        const wsEndpoint = await getWebSocketEndpoint();
        
        console.log('✅ Successfully connected to Chrome!');
        console.log();
        console.log('WebSocket Endpoint:');
        console.log(wsEndpoint);
        console.log();
        console.log('-'.repeat(60));
        console.log('Run tests with:');
        console.log();
        console.log(`  CDP_ENDPOINT="${wsEndpoint}" npx playwright test tests/e2e/tournament.spec.js`);
        console.log();
        console.log('Or add to your shell:');
        console.log();
        console.log(`  export CDP_ENDPOINT="${wsEndpoint}"`);
        console.log('  npx playwright test');
        console.log('-'.repeat(60));
        
        // 输出环境变量格式
        console.log();
        console.log('Environment variable for CI/CD:');
        console.log(`CDP_ENDPOINT=${wsEndpoint}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log();
        console.log('To start Chrome with remote debugging:');
        console.log();
        console.log('macOS:');
        console.log('  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222');
        console.log();
        console.log('Windows:');
        console.log('  chrome.exe --remote-debugging-port=9222');
        console.log();
        console.log('Linux:');
        console.log('  google-chrome --remote-debugging-port=9222');
        console.log();
        console.log('With user data (keeps wallet logged in):');
        console.log('  chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug');
        process.exit(1);
    }
}

main();
