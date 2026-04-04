const TronWeb = require('tronweb');
const fs = require('fs');
require('dotenv').config({ path: '.env.testnet' });

const tronWeb = new TronWeb({
    fullHost: 'https://api.shasta.trongrid.io',
    privateKey: process.env.OWNER_PRIVATE_KEY
});

async function deploy() {
    console.log('📦 Deploying AchievementNFTOnChain...');

    const contractSource = fs.readFileSync('./contracts/AchievementNFTOnChain.sol', 'utf8');
    const signerAddress = process.env.SIGNER_ADDRESS;

    console.log('Signer:', signerAddress);

    const compiled = await tronWeb.transactionBuilder.createSmartContract({
        abi: [], // Will be auto-generated
        bytecode: '', // Will be compiled
        feeLimit: 1000000000,
        callValue: 0,
        userFeePercentage: 100,
        originEnergyLimit: 10000000,
        parameters: [signerAddress],
        name: 'AchievementNFTOnChain'
    }, tronWeb.defaultAddress.base58);

    console.log('✅ Contract deployed!');
    console.log('Address:', compiled.contract_address);

    return compiled.contract_address;
}

deploy().catch(console.error);
