/**
 * 更新NFT合约的baseURI为公网可访问地址
 * 
 * 使用方法:
 * 1. 如果你有公网服务器，将baseURI改为你的服务器地址
 * 2. 或者使用IPFS托管metadata
 * 3. 或者使用ngrok/localtunnel创建临时公网隧道
 */

require('dotenv').config({ path: '.env.testnet' });
const { TronWeb } = require('tronweb');

const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';

// 新的baseURI - 请替换为你的公网地址
// 示例选项:
// - IPFS: ipfs://QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/
// - 公网服务器: https://your-domain.com/api/nft/metadata/
// - GitHub Pages: https://username.github.io/repo/nft/metadata/
const NEW_BASE_URI = process.argv[2] || 'https://bridgepoker.example.com/api/nft/metadata/';

async function main() {
    const tronWeb = new TronWeb({ 
        fullHost: 'https://nile.trongrid.io',
        privateKey: process.env.NILE_PRIVATE_KEY 
    });
    
    const c = await tronWeb.contract().at(NFT_CONTRACT);
    
    // 检查当前owner
    const owner = await c.owner().call();
    const myAddress = tronWeb.address.fromPrivateKey(process.env.NILE_PRIVATE_KEY);
    
    console.log('当前合约owner:', tronWeb.address.fromHex(owner));
    console.log('你的地址:', myAddress);
    
    if (tronWeb.address.fromHex(owner) !== myAddress) {
        console.log('\n❌ 你不是合约owner，无法更新baseURI');
        return;
    }
    
    console.log('\n正在更新baseURI...');
    console.log('新baseURI:', NEW_BASE_URI);
    
    try {
        const tx = await c.setBaseURI(NEW_BASE_URI).send({ feeLimit: 30 * 1e6 });
        console.log('✅ 交易已发送:', tx);
        
        // 等待确认
        await new Promise(r => setTimeout(r, 5000));
        
        const newURI = await c.baseURI().call();
        console.log('新的baseURI:', newURI);
        
    } catch (error) {
        console.error('❌ 更新失败:', error.message);
    }
}

main().catch(console.error);
