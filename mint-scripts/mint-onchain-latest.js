/**
 * Mint the latest unminted NFT on-chain using AchievementNFTOnChain contract
 */
const { TronWeb } = require('tronweb');
const mongoose = require('mongoose');
const ethers = require('ethers');
const { generateMetadata } = require('./utils/metadata-generator');
require('dotenv').config({ path: '.env.testnet' });

const PLAYER1 = {
    address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
    privateKey: PLAYER1_PRIVATE_KEY
};

const CONTRACT = process.env.NFT_CONTRACT_ONCHAIN; // TZ44KG9TPtWzFWKHy4SJxHFmzwbgTZU9fc

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

    // Get latest unminted NFT for PLAYER1
    const claim = await col.findOne({
        playerAddress: { $regex: new RegExp(PLAYER1.address, 'i') },
        achievementTypeId: { $exists: true, $ne: null },
        gameId: { $exists: true, $ne: null },
        $or: [{ txHash: null }, { txHash: { $exists: false } }]
    }, { sort: { claimedAt: -1 } });

    if (!claim) { console.log('No unminted NFT found'); process.exit(0); }
    console.log(`Found NFT: ${claim._id} gameId=${claim.gameId} type=${claim.achievementTypeId}`);

    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io',
        privateKey: PLAYER1.privateKey
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const gameId = claim.gameId || `game-${Date.now()}`;

    // Build signature
    let callerHex = tronWeb.address.toHex(PLAYER1.address);
    if (callerHex.startsWith('41')) callerHex = '0x' + callerHex.slice(2);

    const hash = ethers.utils.solidityKeccak256(
        ['address', 'uint256', 'uint256', 'string'],
        [callerHex, claim.achievementTypeId, timestamp, gameId]
    );
    const serverWallet = new ethers.Wallet(process.env.SERVER_PRIVATE_KEY);
    const sig = ethers.utils.splitSignature(await serverWallet.signMessage(ethers.utils.arrayify(hash)));
    console.log(`Signer: ${serverWallet.address} v=${sig.v}`);

    // Get next on-chain token ID by probing ownerOf
    const ownerAbi = [{ inputs: [{name:'tokenId',type:'uint256'}], name: 'ownerOf', outputs: [{type:'address'}], stateMutability: 'view', type: 'function' }];
    const ownerContract = await tronWeb.contract(ownerAbi, CONTRACT);
    let nextTokenId = 1;
    while (true) {
        try { await ownerContract.ownerOf(nextTokenId).call(); nextTokenId++; }
        catch (_) { break; }
    }
    console.log(`Next on-chain tokenId: ${nextTokenId}`);

    // Metadata URL pointing to local server (no tunnel dependency)
    const baseUri = process.env.NFT_BASE_URI || 'http://192.168.10.39:7778/api/nft/metadata/';
    const metadata = `${baseUri}${claim.achievementTypeId}/${nextTokenId}`;
    console.log(`Metadata URL: ${metadata}`);

    const contract = await tronWeb.contract(ABI, CONTRACT);
    console.log(`Calling claimNFT on ${CONTRACT}...`);

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
    console.log(`DB updated: txHash=${String(tx)} onchainTokenId=${nextTokenId}`);
    await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
