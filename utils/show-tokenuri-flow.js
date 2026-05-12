require('dotenv').config({ path: '.env.testnet' });
const { TronWeb } = require('tronweb');

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: process.env.NILE_PRIVATE_KEY
});

const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';

async function showTokenURIFlow() {
    console.log('📍 tokenURI(10) 请求流程\n');

    const contract = await tronWeb.contract().at(NFT_CONTRACT);

    // 1. 获取baseURI
    const baseURI = await contract.baseURI().call();
    console.log('1️⃣ 合约baseURI:');
    console.log('   ', baseURI);

    // 2. 调用tokenURI(10)
    const tokenURI = await contract.tokenURI(10).call();
    console.log('\n2️⃣ tokenURI(10) 返回:');
    console.log('   ', tokenURI);

    // 3. 解析URL构成
    console.log('\n3️⃣ URL构成:');
    console.log('   baseURI + achievementType + "/" + tokenId');
    console.log('   = baseURI + "6/10"');

    console.log('\n4️⃣ TronLink/TronScan会请求这个URL获取元数据');
}

showTokenURIFlow().catch(console.error);
