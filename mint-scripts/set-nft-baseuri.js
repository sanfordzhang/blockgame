/**
 * 设置NFT合约的baseURI
 * 使TronLink等钱包能够读取NFT元数据
 */

require('dotenv').config({ path: '.env.testnet' });
const { TronWeb } = require('tronweb');

const serverPrivateKey = process.env.SERVER_PRIVATE_KEY || process.env.NILE_PRIVATE_KEY;
const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: serverPrivateKey
});

const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';

async function main() {
    console.log('========================================');
    console.log('🔗 设置NFT合约baseURI');
    console.log('========================================\n');
    
    const contract = await tronWeb.contract().at(NFT_CONTRACT);
    const serverAddress = tronWeb.address.fromPrivateKey(serverPrivateKey);
    
    console.log('服务器地址:', serverAddress);
    
    // 获取当前baseURI
    const currentBaseURI = await contract.baseURI().call();
    console.log('当前baseURI:', currentBaseURI);
    
    // 设置新的baseURI
    // 使用公网地址（TronLink需要公网访问）
    const newBaseURI = 'https://accompanied-kilometers-hospitality-dressed.trycloudflare.com/api/nft/metadata/';
    
    // 本地测试环境（仅在本地浏览器测试时使用）
    // const newBaseURI = 'http://127.0.0.1:7778/api/nft/metadata/';
    
    console.log('\n设置新baseURI:', newBaseURI);
    
    try {
        const tx = await contract.setBaseURI(newBaseURI).send({ feeLimit: 30 * 1e6 });
        console.log('✅ 交易已发送:', tx);
        
        // 等待确认
        await new Promise(r => setTimeout(r, 3000));
        
        // 验证
        const updatedBaseURI = await contract.baseURI().call();
        console.log('✅ 新baseURI已设置:', updatedBaseURI);
        
        // 测试tokenURI
        const tokenURI = await contract.tokenURI(1).call();
        console.log('✅ Token #1 URI:', tokenURI);
        
        console.log('\n========================================');
        console.log('✅ 设置完成！');
        console.log('TronLink现在可以读取NFT元数据了');
        console.log('========================================');
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
    }
}

main();
