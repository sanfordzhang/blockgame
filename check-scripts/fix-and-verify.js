/**
 * 完整修复和验证TronLink显示
 */
require('dotenv').config({ path: '.env.testnet' });
const { TronWeb } = require('tronweb');
const axios = require('axios');
const { exec } = require('child_process');

const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';

async function main() {
    console.log('🔧 TronLink NFT显示修复\n');

    // 1. 检查本地API
    console.log('1️⃣ 测试本地API...');
    try {
        const res = await axios.get('http://localhost:7778/api/nft/metadata/6/10');
        const cards = res.data.attributes.find(a => a.trait_type === 'Cards');
        console.log(`   ✅ 本地API正常: ${cards.value}\n`);
    } catch (e) {
        console.log(`   ❌ 本地API失败: ${e.message}\n`);
        return;
    }

    // 2. 检查合约baseURI
    console.log('2️⃣ 检查合约baseURI...');
    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io',
        privateKey: process.env.NILE_PRIVATE_KEY
    });

    const contract = await tronWeb.contract().at(NFT_CONTRACT);
    const baseURI = await contract.baseURI().call();
    console.log(`   当前baseURI: ${baseURI}\n`);

    // 3. 测试公网访问
    console.log('3️⃣ 测试公网访问...');
    const tokenURI = await contract.tokenURI(10).call();
    console.log(`   Token #10 URI: ${tokenURI}`);

    try {
        const res = await axios.get(tokenURI, { timeout: 10000 });
        const cards = res.data.attributes.find(a => a.trait_type === 'Cards');
        console.log(`   ✅ 公网可访问: ${cards.value}\n`);

        console.log('========================================');
        console.log('✅ 所有测试通过！');
        console.log('========================================\n');
        console.log('📱 TronLink操作:');
        console.log('1. 删除PANFT合约（长按）');
        console.log('2. 重新添加: TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC');
        console.log('3. 查看NFT #10属性\n');

    } catch (e) {
        console.log(`   ❌ 公网访问失败: ${e.message}\n`);
        console.log('⚠️  需要修复:');
        console.log('1. 停止旧的cloudflared: pkill cloudflared');
        console.log('2. 启动新隧道: cloudflared tunnel --url http://localhost:7777');
        console.log('3. 复制新URL并运行: node set-nft-baseuri-public.js <新URL>/api/nft/metadata/\n');
    }
}

main().catch(console.error);
