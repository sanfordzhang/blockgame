const { TronWeb } = require('tronweb');
const mongoose = require('mongoose');
const ethers = require('ethers');
require('dotenv').config({ path: '.env.testnet' });

const NFTClaimSchema = new mongoose.Schema({
    playerAddress: { type: String, required: true, lowercase: true },
    achievementTypeId: { type: Number, required: true },
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
        console.log('🚀 Minting NFT\n');

        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bridge-poker');
        const NFTClaim = mongoose.models.NFTClaim || mongoose.model('NFTClaim', NFTClaimSchema);
        const nft = await NFTClaim.findOne({ txHash: null }).sort({ claimedAt: -1 });

        if (!nft) {
            console.log('❌ No unminted NFT');
            await mongoose.disconnect();
            return;
        }

        console.log('📋 NFT:', nft.tokenId, nft.achievementType);
        console.log('   Player:', nft.playerAddress);
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

        // msg.sender will be the address calling the contract (TESTNET_PRIVATE_KEY)
        const callerAddress = tronWeb.defaultAddress.base58;
        let callerHex = tronWeb.address.toHex(callerAddress);
        if (!callerHex.startsWith('0x')) {
            callerHex = '0x' + callerHex.slice(2);
        }

        // Create hash: keccak256(abi.encodePacked(msg.sender, achievementTypeId, timestamp, gameId))
        const hash = ethers.utils.solidityKeccak256(
            ['address', 'uint256', 'uint256', 'string'],
            [callerHex, nft.achievementTypeId, timestamp, nft.gameId]
        );

        // Add Ethereum signed message prefix: keccak256("\x19Ethereum Signed Message:\n32" + hash)
        const messagePrefix = Buffer.from('\x19Ethereum Signed Message:\n32', 'utf8');
        const hashBuffer = Buffer.from(hash.slice(2), 'hex');
        const prefixedHash = ethers.utils.keccak256(Buffer.concat([messagePrefix, hashBuffer]));

        console.log('⏳ Signing...');
        const signature = await tronWeb.trx.sign(prefixedHash, process.env.SERVER_PRIVATE_KEY);
        const sig = signature.replace(/^0x/, '');

        console.log('✅ Signed\n');
        console.log('⏳ Minting with 5 TRX...');

        const tx = await contract.claimNFT(
            nft.achievementTypeId,
            timestamp,
            nft.gameId,
            parseInt(sig.slice(128, 130), 16),
            '0x' + sig.slice(0, 64),
            '0x' + sig.slice(64, 128)
        ).send({
            feeLimit: 1000000000,
            callValue: 5000000,
            shouldPollResponse: true
        });

        console.log('\n✅ Minted! TX:', tx);
        console.log('   https://nile.tronscan.org/#/transaction/' + tx);

        nft.txHash = tx;
        await nft.save();

        console.log('\n💡 Open TronLink to see NFT with Cards!');
        await mongoose.disconnect();
    } catch (error) {
        console.error('❌', error.message);
        await mongoose.disconnect();
        process.exit(1);
    }
}

mintNFT();
