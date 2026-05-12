/**
 * 模拟TronLink读取NFT metadata的完整流程
 */
require('dotenv').config({ path: '.env.testnet' });
const { TronWeb } = require('tronweb');
const https = require('https');

const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';
const TOKEN_ID = 10;

async function simulateTronLink() {
    console.log('🔍 模拟TronLink读取NFT #10的完整流程\n');

    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io'
    });

    // Step 1: 调用合约获取tokenURI
    console.log('1️⃣ 调用合约 tokenURI(10)...');
    const contract = await tronWeb.contract().at(NFT_CONTRACT);
    const tokenURI = await contract.tokenURI(TOKEN_ID).call();
    console.log('   返回:', tokenURI);

    // Step 2: 发起HTTP请求获取metadata
    console.log('\n2️⃣ 发起HTTP GET请求...');
    const url = new URL(tokenURI);

    return new Promise((resolve, reject) => {
        https.get(tokenURI, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const metadata = JSON.parse(data);
                console.log('\n3️⃣ 收到metadata:');
                console.log('   Name:', metadata.name);
                console.log('   Description:', metadata.description);
                console.log('\n   Attributes:');
                metadata.attributes.forEach(attr => {
                    console.log(`   - ${attr.trait_type}: ${attr.value}`);
                });

                const hasCards = metadata.attributes.some(a => a.trait_type === 'Cards');
                console.log('\n' + (hasCards ? '✅ Cards信息存在' : '❌ Cards信息缺失'));

                if (hasCards) {
                    const cards = metadata.attributes.find(a => a.trait_type === 'Cards');
                    console.log('   Cards值:', cards.value);
                }

                resolve(metadata);
            });
        }).on('error', reject);
    });
}

simulateTronLink().catch(console.error);
