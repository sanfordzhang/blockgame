/**
 * Mint一个新的NFT来测试TronLink和TronScan显示
 */
require('dotenv').config({ path: '.env.testnet' });
const { TronWeb } = require('tronweb');

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: process.env.NILE_PRIVATE_KEY
});

const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';

async function mintTestNFT() {
    console.log('🎨 Mint新NFT测试Cards显示\n');

    const myAddress = tronWeb.defaultAddress.base58;
    console.log('接收地址:', myAddress);

    const contract = await tronWeb.contract().at(NFT_CONTRACT);

    // Mint一个STRAIGHT类型的NFT (achievementType = 6)
    console.log('\n正在mint...');
    const tx = await contract.mintAchievement(myAddress, 6).send({
        feeLimit: 100_000_000
    });

    console.log('✅ 交易:', tx);

    await new Promise(r => setTimeout(r, 3000));

    // 获取新的tokenId
    const balance = await contract.balanceOf(myAddress).call();
    console.log('\n你现在拥有', balance.toString(), '个NFT');

    // 获取最后一个token
    const lastIndex = parseInt(balance.toString()) - 1;
    const tokenId = await contract.tokenOfOwnerByIndex(myAddress, lastIndex).call();
    console.log('新NFT tokenId:', tokenId.toString());

    const tokenURI = await contract.tokenURI(tokenId).call();
    console.log('tokenURI:', tokenURI);

    console.log('\n等待3-5分钟后访问:');
    console.log('TronScan:', `https://nile.tronscan.org/#/token721/${NFT_CONTRACT}/${tokenId}`);
}

mintTestNFT().catch(console.error);
