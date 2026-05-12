/**
 * 一键设置NFT metadata公网访问
 * 1. 启动cloudflared隧道
 * 2. 获取公网URL
 * 3. 更新合约baseURI
 */

const { spawn } = require('child_process');
const http = require('http');
const https = require('https');

const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';
const LOCAL_PORT = 7778;

function waitForTunnel(url, maxAttempts = 30) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const check = () => {
            attempts++;
            https.get(url + '/api/nft/metadata/1', (res) => {
                if (res.statusCode === 200) {
                    resolve(true);
                } else {
                    if (attempts < maxAttempts) setTimeout(check, 1000);
                    else reject(new Error('Tunnel not ready'));
                }
            }).on('error', () => {
                if (attempts < maxAttempts) setTimeout(check, 1000);
                else reject(new Error('Tunnel not accessible'));
            });
        };
        setTimeout(check, 3000);
    });
}

async function main() {
    require('dotenv').config({ path: '.env.testnet' });
    const { TronWeb } = require('tronweb');
    
    console.log('========================================');
    console.log('🚀 NFT Metadata公网隧道设置');
    console.log('========================================\n');
    
    // Step 1: 启动cloudflared隧道
    console.log('📡 启动cloudflared隧道...');
    
    const tunnel = spawn('cloudflared', [
        'tunnel',
        '--url',
        `http://localhost:${LOCAL_PORT}`
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    
    let tunnelUrl = null;
    
    tunnel.stderr.on('data', (data) => {
        const output = data.toString();
        // 查找隧道URL
        const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (match) {
            tunnelUrl = match[0];
            console.log('✅ 隧道已创建:', tunnelUrl);
        }
    });
    
    // 等待隧道URL出现
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('获取隧道URL超时')), 30000);
        const check = setInterval(() => {
            if (tunnelUrl) {
                clearTimeout(timeout);
                clearInterval(check);
                resolve();
            }
        }, 500);
    });
    
    if (!tunnelUrl) {
        console.error('❌ 无法获取隧道URL');
        tunnel.kill();
        return;
    }
    
    // Step 2: 等待隧道可用
    console.log('\n⏳ 等待隧道就绪...');
    const metadataBase = `${tunnelUrl}/api/nft/metadata/`;
    
    try {
        await waitForTunnel(tunnelUrl);
        console.log('✅ 隧道已就绪');
    } catch (e) {
        console.log('⚠️ 隧道可能未完全就绪，继续尝试更新合约...');
    }
    
    // Step 3: 更新合约baseURI
    console.log('\n📝 更新NFT合约baseURI...');
    console.log('   新baseURI:', metadataBase);
    
    const tronWeb = new TronWeb({ 
        fullHost: 'https://nile.trongrid.io',
        privateKey: process.env.NILE_PRIVATE_KEY 
    });
    
    const c = await tronWeb.contract().at(NFT_CONTRACT);
    
    try {
        const tx = await c.setBaseURI(metadataBase).send({ feeLimit: 30 * 1e6 });
        console.log('✅ 交易已发送:', tx.slice(0, 20) + '...');
        
        await new Promise(r => setTimeout(r, 5000));
        
        const newURI = await c.baseURI().call();
        console.log('\n🎉 baseURI已更新:', newURI);
        
        console.log('\n========================================');
        console.log('✅ 完成！现在TronLink应该能显示NFT了');
        console.log('========================================');
        console.log('\n📌 下一步:');
        console.log('1. 在TronLink切换到Nile测试网');
        console.log('2. 进入收藏品页面');
        console.log('3. 添加合约地址:', NFT_CONTRACT);
        console.log('\n隧道将保持运行，按Ctrl+C停止');
        
    } catch (error) {
        console.error('❌ 更新失败:', error.message);
        tunnel.kill();
    }
    
    // 保持进程运行
    process.on('SIGINT', () => {
        console.log('\n停止隧道...');
        tunnel.kill();
        process.exit();
    });
}

main().catch(err => {
    console.error('错误:', err);
    process.exit(1);
});
