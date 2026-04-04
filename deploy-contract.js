const { TronWeb } = require('tronweb');
const fs = require('fs');
require('dotenv').config({ path: '.env.testnet' });

const tronWeb = new TronWeb({
    fullHost: 'https://api.nileex.io',
    privateKey: process.env.TESTNET_PRIVATE_KEY
});

async function deploy() {
    console.log('🚀 部署 AchievementNFTOnChain 到 Shasta...\n');

    const compiled = JSON.parse(fs.readFileSync('build/AchievementNFTOnChain.json'));
    const signerAddress = process.env.NFT_SIGNER_ADDRESS;

    console.log('Deployer:', tronWeb.defaultAddress.base58);
    console.log('Signer:', signerAddress);
    console.log('Bytecode length:', compiled.bytecode.length, '\n');

    const tx = await tronWeb.transactionBuilder.createSmartContract({
        abi: compiled.abi,
        bytecode: compiled.bytecode,
        feeLimit: 2000000000,
        callValue: 0,
        parameters: [signerAddress]
    });

    const signedTx = await tronWeb.trx.sign(tx);
    const result = await tronWeb.trx.sendRawTransaction(signedTx);

    console.log('✅ 部署交易已发送:', result.txid);
    console.log('等待确认...\n');

    await new Promise(r => setTimeout(r, 5000));

    const receipt = await tronWeb.trx.getTransactionInfo(result.txid);
    const contractAddress = tronWeb.address.fromHex(receipt.contract_address);

    console.log('✅ 合约已部署:', contractAddress);
    console.log('\n请添加到 .env.testnet:');
    console.log(`NFT_CONTRACT_ONCHAIN=${contractAddress}`);

    return contractAddress;
}

deploy().catch(console.error);
