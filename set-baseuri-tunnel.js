const TronWeb = require('tronweb');
require('dotenv').config({ path: '.env.testnet' });

const tronWeb = new TronWeb({
    fullHost: 'https://api.shasta.trongrid.io',
    privateKey: process.env.TESTNET_PRIVATE_KEY
});

async function setBaseURI() {
    const contractAddress = process.env.NFT_CONTRACT_ADDRESS;
    const newBaseURI = 'https://your-tunnel-url.trycloudflare.com/api/nft/metadata/';

    console.log('Setting baseURI to:', newBaseURI);

    const contract = await tronWeb.contract().at(contractAddress);
    const tx = await contract.setBaseURI(newBaseURI).send();

    console.log('✅ BaseURI updated, tx:', tx);
}

setBaseURI().catch(console.error);
