const { TronWeb } = require('tronweb');
const mongoose = require('mongoose');
const ethers = require('ethers');
require('dotenv').config({ path: '.env.testnet' });

const NFTClaimSchema = new mongoose.Schema({
    playerAddress: { type: String },
    achievementTypeId: { type: Number },
    tokenId: { type: Number },
    txHash: { type: String },
    gameId: { type: String },
    cards: [{ rank: String, suit: String }]
}, { strict: false });

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bridge-poker');
        const NFTClaim = mongoose.models.NFTClaim || mongoose.model('NFTClaim', NFTClaimSchema);
        const nft = await NFTClaim.findOne({ txHash: null }).sort({ claimedAt: -1 });

        console.log('NFT:', nft.tokenId);
        console.log('GameId:', nft.gameId);

        const tronWeb = new TronWeb({
            fullHost: 'https://nile.trongrid.io',
            privateKey: process.env.TESTNET_PRIVATE_KEY
        });

        const timestamp = Math.floor(Date.now() / 1000);
        const callerAddress = tronWeb.defaultAddress.base58;

        console.log('\nCaller:', callerAddress);
        console.log('Timestamp:', timestamp);
        console.log('AchievementTypeId:', nft.achievementTypeId);

        let callerHex = tronWeb.address.toHex(callerAddress);
        if (!callerHex.startsWith('0x')) {
            callerHex = '0x' + callerHex.slice(2);
        }

        console.log('Caller hex:', callerHex);

        // Create hash
        const hash = ethers.utils.solidityKeccak256(
            ['address', 'uint256', 'uint256', 'string'],
            [callerHex, nft.achievementTypeId, timestamp, nft.gameId]
        );

        console.log('\nHash:', hash);

        // Add prefix
        const messagePrefix = Buffer.from('\x19Ethereum Signed Message:\n32', 'utf8');
        const hashBuffer = Buffer.from(hash.slice(2), 'hex');
        const prefixedHash = ethers.utils.keccak256(Buffer.concat([messagePrefix, hashBuffer]));

        console.log('Prefixed hash:', prefixedHash);

        // Sign
        const signature = await tronWeb.trx.sign(prefixedHash, process.env.SERVER_PRIVATE_KEY);
        const sig = signature.replace(/^0x/, '');
        const v = parseInt(sig.slice(128, 130), 16);
        const r = '0x' + sig.slice(0, 64);
        const s = '0x' + sig.slice(64, 128);

        console.log('\nSignature components:');
        console.log('v:', v);
        console.log('r:', r);
        console.log('s:', s);

        // Verify signature locally
        const recovered = ethers.utils.recoverAddress(prefixedHash, { v, r, s });
        console.log('\nRecovered address:', recovered);

        const serverHex = tronWeb.address.toHex(tronWeb.address.fromPrivateKey(process.env.SERVER_PRIVATE_KEY));
        console.log('Server hex:', serverHex);
        console.log('Match:', recovered.toLowerCase() === ('0x' + serverHex.slice(2)).toLowerCase());

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error.message);
        await mongoose.disconnect();
        process.exit(1);
    }
})();
