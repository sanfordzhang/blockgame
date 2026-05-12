const { TronWeb } = require('tronweb');
const mongoose = require('mongoose');
const ethers = require('ethers');
require('dotenv').config({ path: '.env.testnet' });

const NFTClaimSchema = new mongoose.Schema({
    playerAddress: { type: String },
    achievementTypeId: { type: Number },
    achievementType: { type: String },
    tokenId: { type: Number },
    txHash: { type: String },
    gameId: { type: String },
    cards: [{ rank: String, suit: String }]
}, { strict: false });

(async () => {
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

        console.log('📋 NFT:', nft.tokenId);
        console.log('   Cards:', nft.cards.map(c => c.rank + c.suit).join(' '));

        const tronWeb = new TronWeb({
            fullHost: 'https://nile.trongrid.io',
            headers: process.env.TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY } : {},
            privateKey: process.env.TESTNET_PRIVATE_KEY
        });

        const contract = await tronWeb.contract(
            require('./build/contracts/AchievementNFTSimple.json').abi,
            process.env.NFT_CONTRACT_ADDRESS
        );

        const timestamp = Math.floor(Date.now() / 1000);
        const callerAddress = tronWeb.defaultAddress.base58;
        let callerHex = tronWeb.address.toHex(callerAddress);
        if (!callerHex.startsWith('0x')) {
            callerHex = '0x' + callerHex.slice(2);
        }

        // Create hash
        const hash = ethers.utils.solidityKeccak256(
            ['address', 'uint256', 'uint256', 'string'],
            [callerHex, nft.achievementTypeId, timestamp, nft.gameId]
        );

        // Add Ethereum signed message prefix
        const messagePrefix = Buffer.from('\x19Ethereum Signed Message:\n32', 'utf8');
        const hashBuffer = Buffer.from(hash.slice(2), 'hex');
        const prefixedHash = ethers.utils.keccak256(Buffer.concat([messagePrefix, hashBuffer]));

        // Sign with ethers (Ethereum-compatible)
        const wallet = new ethers.Wallet(process.env.SERVER_PRIVATE_KEY);
        const signature = await wallet.signMessage(ethers.utils.arrayify(hash));
        const sig = ethers.utils.splitSignature(signature);

        console.log('⏳ Minting with 5 TRX...\n');

        const tx = await contract.claimNFT(
            nft.achievementTypeId,
            timestamp,
            nft.gameId,
            sig.v,
            sig.r,
            sig.s
        ).send({
            feeLimit: 1000000000,
            callValue: 5000000,
            shouldPollResponse: true
        });

        console.log('✅ Minted! TX:', tx);
        console.log('   https://nile.tronscan.org/#/transaction/' + tx);

        nft.txHash = tx;
        await nft.save();

        console.log('\n💡 Open TronLink wallet to see your NFT with Cards info!');
        await mongoose.disconnect();
    } catch (error) {
        console.error('❌', error.message);
        await mongoose.disconnect();
        process.exit(1);
    }
})();
