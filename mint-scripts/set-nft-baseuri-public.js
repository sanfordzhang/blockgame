/**
 * 设置NFT合约的baseURI为公网地址
 * 用法: node set-nft-baseuri-public.js https://your-domain.com/api/nft/metadata/
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
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log('用法: node set-nft-baseuri-public.js <公网URL>');
        console.log('例如: node set-nft-baseuri-public.js https://abc123.trycloudflare.com/api/nft/metadata/');
        console.log('\n启动cloudflare tunnel:');
        console.log('  cloudflared tunnel --url http://localhost:7778');
        process.exit(1);
    }
    
    const newBaseURI = args[0];
    if (!newBaseURI.startsWith('https://') && !newBaseURI.startsWith('http://')) {
        console.error('❌ URL必须以https://或http://开头');
        process.exit(1);
    }
    
    console.log('========================================');
    console.log('🔗 设置NFT合约baseURI');
    console.log('========================================\n');
    
    const contract = await tronWeb.contract().at(NFT_CONTRACT);
    
    console.log('新baseURI:', newBaseURI);
    
    try {
        const tx = await contract.setBaseURI(newBaseURI).send({ feeLimit: 30 * 1e6 });
        console.log('✅ 交易已发送:', tx);
        
        await new Promise(r => setTimeout(r, 3000));
        
        const updatedBaseURI = await contract.baseURI().call();
        console.log('✅ 新baseURI已设置:', updatedBaseURI);
        
        const tokenURI = await contract.tokenURI(1).call();
        console.log('✅ Token #1 URI:', tokenURI);
        
        console.log('\n========================================');
        console.log('✅ 设置完成！');
        console.log('TronLink现在可以读取NFT元数据了');
        console.log('请在TronLink中刷新NFT收藏品');
        console.log('========================================');
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
    }
}

main();
