/**
 * Batch mint all unminted NFTs for PLAYER1
 * 
 * 使用方法: node mint-all-unminted.js
 */
const { TronWeb } = require('tronweb');
const mongoose = require('mongoose');
const ethers = require('ethers');
require('dotenv').config({ path: '.env.testnet' });

const PLAYER1 = {
    address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
    privateKey: '[REMOVED PRIVATE KEY - SEE .env FOR CONFIG]'
};

const CONTRACT = process.env.NFT_CONTRACT_ONCHAIN;

const ABI = [{
    "inputs": [
        { "name": "achievementTypeId", "type": "uint256" },
        { "name": "timestamp", "type": "uint256" },
        { "name": "gameId", "type": "string" },
        { "name": "v", "type": "uint8" },
        { "name": "r", "type": "bytes32" },
        { "name": "s", "type": "bytes32" }
    ],
    "name": "claimNFT",
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "payable",
    "type": "function"
}];

async function main() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/poker_game');
    const col = mongoose.connection.collection('nftclaims');

    const unminted = await col.find({
        playerAddress: { $regex: new RegExp(PLAYER1.address, 'i') },
        $or: [{ txHash: null }, { txHash: { $exists: false } }]
    }).sort({ claimedAt: 1 }).toArray();

    console.log(`Found ${unminted.length} unminted NFTs`);
    
    if (unminted.length === 0) {
        console.log('No unminted NFTs found');
        process.exit(0);
    }

    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io',
        privateKey: PLAYER1.privateKey
    });

    const ownerAbi = [{ inputs: [{name:'tokenId',type:'uint256'}], name: 'ownerOf', outputs: [{type:'address'}], stateMutability: 'view', type: 'function' }];
    const ownerContract = await tronWeb.contract(ownerAbi, CONTRACT);
    let nextTokenId = 1;
    while (true) {
        try { await ownerContract.ownerOf(nextTokenId).call(); nextTokenId++; } catch (_) { break; }
    }
    console.log(`Starting from on-chain tokenId: ${nextTokenId}`);

    const serverWallet = new ethers.Wallet(process.env.SERVER_PRIVATE_KEY);

    for (let i = 0; i < unminted.length; i++) {
        const claim = unminted[i];
        console.log(`\n[${i + 1}/${unminted.length}] Minting ${claim.achievementType} (${claim.gameId})`);

        const timestamp = Math.floor(Date.now() / 1000);
        const gameId = claim.gameId || `game-${Date.now()}`;

        let callerHex = tronWeb.address.toHex(PLAYER1.address);
        if (callerHex.startsWith('41')) callerHex = '0x' + callerHex.slice(2);

        const hash = ethers.utils.solidityKeccak256(
            ['address', 'uint256', 'uint256', 'string'],
            [callerHex, claim.achievementTypeId, timestamp, gameId]
        );
        const sig = ethers.utils.splitSignature(await serverWallet.signMessage(ethers.utils.arrayify(hash)));

        try {
            const contract = await tronWeb.contract(ABI, CONTRACT);
            const tx = await contract.claimNFT(
                claim.achievementTypeId,
                timestamp,
                gameId,
                sig.v,
                sig.r,
                sig.s
            ).send({ feeLimit: 1000000000, callValue: 5000000 });

            console.log(`✅ Minted! TX: ${tx}`);
            console.log(`   https://nile.tronscan.org/#/transaction/${tx}`);

            await col.updateOne({ _id: claim._id }, { $set: { txHash: String(tx), onchainTokenId: nextTokenId } });
            nextTokenId++;

            await new Promise(r => setTimeout(r, 3000));
        } catch (error) {
            console.error(`❌ Failed: ${error.message}`);
        }
    }

    console.log(`\n✅ Batch mint complete! Minted ${unminted.length} NFTs`);
    await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
