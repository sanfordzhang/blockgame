require('dotenv').config({ path: '.env.testnet' });
const { TronWeb } = require('tronweb');

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    headers: { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY },
    privateKey: process.env.NILE_PRIVATE_KEY
});

const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';

async function setBaseURI() {
    const newURI = process.argv[2];
    if (!newURI) {
        console.log('用法: node set-baseuri-simple.js <URL>');
        return;
    }

    console.log('设置baseURI:', newURI);

    const contract = await tronWeb.contract().at(NFT_CONTRACT);
    const tx = await contract.setBaseURI(newURI).send({ feeLimit: 50_000_000 });

    console.log('✅ 交易:', tx);
    await new Promise(r => setTimeout(r, 3000));

    const updated = await contract.baseURI().call();
    console.log('✅ 新baseURI:', updated);
}

setBaseURI().catch(console.error);
