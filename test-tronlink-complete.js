/**
 * 完整测试TronLink NFT显示
 * 模拟TronLink钱包读取NFT元数据的过程
 */

require('dotenv').config({ path: '.env.testnet' });
const { TronWeb } = require('tronweb');
const axios = require('axios');

const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';
const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: process.env.NILE_PRIVATE_KEY
});

async function testTronLinkFlow() {
    console.log('========================================');
    console.log('🧪 模拟TronLink读取NFT #10');
    console.log('========================================\n');

    try {
        const contract = await tronWeb.contract().at(NFT_CONTRACT);

        // 步骤1: 获取baseURI
        console.log('📍 步骤1: 读取合约baseURI...');
        const baseURI = await contract.baseURI().call();
        console.log(`   baseURI: ${baseURI}\n`);

        if (!baseURI || baseURI === '') {
            console.log('❌ baseURI未设置！');
            console.log('\n需要设置baseURI:');
            console.log('1. 启动cloudflared tunnel');
            console.log('2. 获取公网URL');
            console.log('3. 运行: node set-nft-baseuri-public.js <URL>/api/nft/metadata/\n');
            return;
        }

        // 步骤2: 获取tokenURI
        console.log('📍 步骤2: 读取Token #10的URI...');
        const tokenURI = await contract.tokenURI(10).call();
        console.log(`   tokenURI: ${tokenURI}\n`);

        // 步骤3: 模拟TronLink请求元数据
        console.log('📍 步骤3: 请求元数据（模拟TronLink）...');
        try {
            const response = await axios.get(tokenURI, { timeout: 10000 });
            const metadata = response.data;

            console.log(`✅ 元数据获取成功`);
            console.log(`   name: ${metadata.name}`);
            console.log(`   description: ${metadata.description}\n`);

            // 检查Cards属性
            const cardsAttr = metadata.attributes?.find(a => a.trait_type === 'Cards');
            if (cardsAttr) {
                console.log(`✅ Cards信息: ${cardsAttr.value}`);
                console.log('\n========================================');
                console.log('✅ 测试通过！TronLink应该能显示牌型');
                console.log('========================================\n');
            } else {
                console.log(`❌ 缺少Cards属性`);
            }

        } catch (error) {
            console.log(`❌ 无法访问元数据URL`);
            console.log(`   错误: ${error.message}\n`);

            if (tokenURI.includes('localhost') || tokenURI.includes('127.0.0.1')) {
                console.log('⚠️  问题: baseURI指向localhost，TronLink无法访问');
                console.log('\n解决方案:');
                console.log('1. 确保cloudflared tunnel正在运行');
                console.log('2. 获取公网URL（如: https://xxx.trycloudflare.com）');
                console.log('3. 运行: node set-nft-baseuri-public.js <公网URL>/api/nft/metadata/\n');
            }
        }

    } catch (error) {
        console.error('❌ 错误:', error.message);
    }
}

testTronLinkFlow();
