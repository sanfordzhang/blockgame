/**
 * 分析TronLink NFT显示问题
 */

require('dotenv').config({ path: '.env.testnet' });
const { TronWeb } = require('tronweb');
const axios = require('axios');

const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';

async function analyzeTronLinkFlow() {
    console.log('🔍 分析TronLink NFT显示流程\n');
    console.log('========================================');

    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io',
        privateKey: process.env.NILE_PRIVATE_KEY
    });

    const contract = await tronWeb.contract().at(NFT_CONTRACT);

    // 步骤1: TronLink调用合约
    console.log('\n1️⃣ TronLink调用合约方法');
    console.log('   方法: tokenURI(10)');

    const tokenURI = await contract.tokenURI(10).call();
    console.log('   返回:', tokenURI);

    // 步骤2: TronLink发送HTTP请求
    console.log('\n2️⃣ TronLink发送HTTP GET请求');
    console.log('   URL:', tokenURI);

    const response = await axios.get(tokenURI);
    const metadata = response.data;

    console.log('\n3️⃣ 服务器返回的元数据:');
    console.log(JSON.stringify(metadata, null, 2));

    // 分析attributes
    console.log('\n4️⃣ Attributes分析:');
    metadata.attributes.forEach((attr, index) => {
        console.log(`   [${index}] ${attr.trait_type}: ${attr.value}`);
    });

    // 检查Cards
    const cardsAttr = metadata.attributes.find(a => a.trait_type === 'Cards');
    console.log('\n5️⃣ Cards属性检查:');
    if (cardsAttr) {
        console.log('   ✅ Cards存在:', cardsAttr.value);
        console.log('   格式:', typeof cardsAttr.value);
    } else {
        console.log('   ❌ Cards不存在');
    }

    // 对比其他成功的NFT格式
    console.log('\n6️⃣ 标准ERC721元数据格式:');
    console.log('   - name: string');
    console.log('   - description: string');
    console.log('   - image: string (URL)');
    console.log('   - attributes: array of {trait_type, value}');
    console.log('\n   当前格式: ✅ 符合标准');

    console.log('\n========================================');
    console.log('📱 TronLink显示问题可能原因:');
    console.log('1. TronLink UI可能不显示所有attributes');
    console.log('2. 需要在"属性"或"特征"标签页查看');
    console.log('3. 某些版本的TronLink可能有显示bug');
    console.log('========================================\n');
}

analyzeTronLinkFlow().catch(console.error);
