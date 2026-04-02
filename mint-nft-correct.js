const { TronWeb } = require('tronweb');
const mongoose = require('mongoose');
const { keccak256 } = require('ethers');
require('dotenv').config({ path: '.env.testnet' });

const NFTClaimSchema = new mongoose.Schema({
    playerAddress: { type: String, required: true, lowercase: true, index: true },
    achievementTypeId: { type: Number, required: true, min: 1, max: 6 },
    achievementType: { type: String, required: true },
    tokenId: { type: Number, required: true },
    txHash: { type: String, default: null },
    gameId: { type: String, default: null },
    cards: [{ rank: String, suit: String }],
    yearMonth: { type: Number, required: true },
    claimedAt: { type: Date, default: Date.now }
});

async function mintNFT() {
    try {
        console.log('🚀 Minting NFT to blockchain\n');

        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bridge-poker');
        const NFTClaim = mongoose.models.NFTClaim || mongoose.model('NFTClaim', NFTClaimSchema);
        const nft = await NFTClaim.findOne({ txHash: null }).sort({ claimedAt: -1 });

        if (!nft) {
            console.log('❌ No unminted NFT found');
            await mongoose.disconnect();
            return;
        }

        console.log('📋 NFT Info:');
        console.log('   Token ID:', nft.tokenId);
        console.log('   Type:', nft.achievementType);
        console.log('   Player:', nft.playerAddress.toUpperCase());
        console.log('   Cards:', nft.cards.map(c => c.rank + c.suit).join(' '));
        console.log('');

        const tronWeb = new TronWeb({
            fullHost: 'https://nile.trongrid.io',
            privateKey: process.env.TESTNET_PRIVATE_KEY
        });

        const contract = await tronWeb.contract(
            require('./build/contracts/AchievementNFTSimple.json').abi,
            process.env.NFT_CONTRACT_ADDRESS
        );

        const timestamp = Math.floor(Date.now() / 1000);
        const achievementTypeId = nft.achievementTypeId;
        const gameId = nft.gameId;

        // Create hash matching contract's format: keccak256(abi.encodePacked(msg.sender, achievementTypeId, timestamp, gameId))
        const playerHex = tronWeb.address.toHex(nft.playerAddress).replace(/^0x/, '').replace(/^41/, '');
        const achievementTypeHex = achievementTypeId.toString(16).padStart(64, '0');
        const timestampHex = timestamp.toString(16).padStart(64, '0');
        const gameIdHex = Buffer.from(gameId).toString('hex');

        const packed = '0x' + playerHex + achievementTypeHex + timestampHex + gameIdHex;
        const hash = keccak256(packed);

        // Add Ethereum signed message prefix
        const ethSignedHash = keccak256(
            Buffer.concat([
                Buffer.from('\x19Ethereum Signed Message:\n32'),
                Buffer.from(hash.slice(2), 'hex')
            ])
        );

        console.log('⏳ Generating signature...');
        const signature = await tronWeb.trx.sign(ethSignedHash, process.env.SERVER_PRIVATE_KEY);
        const sig = signature.replace(/^0x/, '');

        console.log('✅ Signature generated\n');
        console.log('⏳ Calling claimNFT with 5 TRX...');

        const tx = await contract.claimNFT(
            achievementTypeId,
            timestamp,
            gameId,
            parseInt(sig.slice(128, 130), 16),
            '0x' + sig.slice(0, 64),
            '0x' + sig.slice(64, 128)
        ).send({
            feeLimit: 1000000000,
            callValue: 5000000,
            shouldPollResponse: true
        });

        console.log('\n✅ NFT minted successfully!');
        console.log('   TX:', tx);
        console.log('   View: https://nile.tronscan.org/#/transaction/' + tx);
        console.log('');

        nft.txHash = tx;
        await nft.save();

        console.log('✅ Database updated');
        console.log('\n💡 Open TronLink wallet to see your NFT with Cards info!');

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ Error:', error.message);
        await mongoose.disconnect();
        process.exit(1);
    }
}

mintNFT();
