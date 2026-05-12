/**
 * 触发TronScan刷新NFT metadata
 * TronScan会监听Transfer事件来更新NFT数据
 */
require('dotenv').config({ path: '.env.testnet' });
const { TronWeb } = require('tronweb');

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: process.env.NILE_PRIVATE_KEY
});

const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';
const TOKEN_ID = 10;

async function triggerRefresh() {
    console.log('🔄 触发TronScan刷新NFT #10的metadata\n');

    const contract = await tronWeb.contract().at(NFT_CONTRACT);
    const owner = tronWeb.address.fromHex(await contract.ownerOf(TOKEN_ID).call());

    console.log('当前owner:', owner);
    console.log('\n方法：将NFT转给自己（触发Transfer事件）');

    // 转给自己，触发Transfer事件，TronScan会重新爬取metadata
    const tx = await contract.transferFrom(owner, owner, TOKEN_ID).send({
        feeLimit: 50_000_000
    });

    console.log('✅ 交易:', tx);
    console.log('\n等待3-5分钟后，TronScan会更新metadata');
    console.log('访问: https://nile.tronscan.org/#/token721/' + NFT_CONTRACT + '/' + TOKEN_ID);
}

triggerRefresh().catch(console.error);
