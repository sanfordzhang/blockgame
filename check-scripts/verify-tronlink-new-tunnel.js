require('dotenv').config({ path: '.env.testnet' });
const { TronWeb } = require('tronweb');

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    headers: { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY }
});

const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';
const TOKEN_ID = 10;

async function verify() {
    console.log('🔍 模拟TronLink获取NFT #10的metadata流程\n');

    // Step 1: 读取合约baseURI
    const contract = await tronWeb.contract().at(NFT_CONTRACT);
    const baseURI = await contract.baseURI().call();
    console.log('1️⃣ 合约baseURI:', baseURI);

    // Step 2: 调用tokenURI(10)
    const tokenURI = await contract.tokenURI(TOKEN_ID).call();
    console.log('2️⃣ tokenURI(10):', tokenURI);

    // Step 3: 获取metadata
    console.log('\n3️⃣ 获取metadata...');
    const response = await fetch(tokenURI);
    const metadata = await response.json();

    console.log('\n✅ Metadata:');
    console.log('   Name:', metadata.name);
    console.log('   Description:', metadata.description);
    console.log('\n   Attributes:');
    metadata.attributes.forEach(attr => {
        console.log(`   - ${attr.trait_type}: ${attr.value}`);
    });

    // Step 4: 检查Cards属性
    const cardsAttr = metadata.attributes.find(a => a.trait_type === 'Cards');
    if (cardsAttr) {
        console.log('\n🎉 成功！TronLink应该能看到Cards:', cardsAttr.value);
    } else {
        console.log('\n❌ 失败：没有找到Cards属性');
    }
}

verify().catch(console.error);
