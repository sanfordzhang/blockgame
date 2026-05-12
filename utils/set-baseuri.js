const { TronWeb } = require('tronweb');
require('dotenv').config({ path: '.env.testnet' });

const newBaseURI = process.argv[2];
if (!newBaseURI) { console.error('用法: node set-baseuri.js <隧道URL>'); process.exit(1); }

const tronWeb = new TronWeb({ fullHost: 'https://nile.trongrid.io', privateKey: process.env.SERVER_PRIVATE_KEY });
const ABI = [{ inputs: [{name:'_baseURI',type:'string'}], name: 'setBaseURI', outputs: [], stateMutability: 'nonpayable', type: 'function' }];

(async () => {
    const baseURI = newBaseURI.replace(/\/$/, '') + '/api/nft/metadata/';
    const contract = await tronWeb.contract(ABI, process.env.NFT_CONTRACT_ONCHAIN);
    const tx = await contract.setBaseURI(baseURI).send({ feeLimit: 100000000 });
    console.log('✅ baseURI 已更新:', baseURI);
    console.log('TX:', tx);
})().catch(e => { console.error(e.message); process.exit(1); });
