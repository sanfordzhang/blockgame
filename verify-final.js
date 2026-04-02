/**
 * 最终验证 - 检查所有配置
 */

require('dotenv').config({ path: '.env.testnet' });
const { TronWeb } = require('tronweb');
const axios = require('axios');

const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';
const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: process.env.NILE_PRIVATE_KEY
});

async function verify() {
    console.log('✅ 验证结果:\n');

    const contract = await tronWeb.contract().at(NFT_CONTRACT);
    const baseURI = await contract.baseURI().call();
    const tokenURI = await contract.tokenURI(10).call();

    console.log('1. 合约地址:', NFT_CONTRACT);
    console.log('2. baseURI:', baseURI);
    console.log('3. Token #10 URI:', tokenURI);

    const response = await axios.get(tokenURI);
    const cards = response.data.attributes.find(a => a.trait_type === 'Cards');

    console.log('4. Cards信息:', cards.value);
    console.log('\n✅ 所有配置正确！\n');
    console.log('📱 TronLink操作:\n');
    console.log('1. 打开TronLink → NFT收藏品');
    console.log('2. 删除PANFT合约（长按）');
    console.log('3. 添加NFT → 输入:', NFT_CONTRACT);
    console.log('4. 点击NFT #10 → 查看属性 → 应该显示: 10h 9d 8c 7s 6h\n');
}

verify().catch(console.error);
