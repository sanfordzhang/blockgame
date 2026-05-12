/**
 * Mint NFT: "Hello world cards 10h 9d 8c 7s 6h"
 * Player 1: TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv
 * Hand: Straight (10h 9d 8c 7s 6h) → achievementTypeId = 6
 */

const { TronWeb } = require('tronweb');
const mongoose = require('mongoose');
const ethers = require('ethers');
require('dotenv').config({ path: '.env.testnet' });

const PLAYER1 = {
    address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
    privateKey: '[REMOVED PRIVATE KEY - SEE .env FOR CONFIG]'
};

const NFT_DESCRIPTION = 'Hello world cards 10h 9d 8c 7s 6h';
const CARDS = [
    { rank: '10', suit: 'h' },
    { rank: '9',  suit: 'd' },
    { rank: '8',  suit: 'c' },
    { rank: '7',  suit: 's' },
    { rank: '6',  suit: 'h' }
];
const ACHIEVEMENT_TYPE_ID = 6;   // STRAIGHT
const ACHIEVEMENT_TYPE     = 'STRAIGHT';
const GAME_ID = `hello-world-${Date.now()}`;
const TOKEN_ID = Date.now();

const NFTClaimSchema = new mongoose.Schema({
    playerAddress:    { type: String },
    achievementTypeId:{ type: Number },
    achievementType:  { type: String },
    rarity:           { type: String },
    tokenId:          { type: Number },
    txHash:           { type: String },
    handDescription:  { type: String },
    gameId:           { type: String },
    cards:            [{ rank: String, suit: String }],
    yearMonth:        { type: String }
}, { strict: false });

(async () => {
    let db;
    try {
        console.log('🃏  Minting NFT: Hello world cards 10h 9d 8c 7s 6h\n');

        // ── 1. Connect MongoDB ────────────────────────────────────────────────
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bridge-poker';
        db = await mongoose.connect(mongoUri);
        const NFTClaim = mongoose.models.NFTClaim || mongoose.model('NFTClaim', NFTClaimSchema);

        const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');

        // ── 2. Save pre-mint record to DB ─────────────────────────────────────
        const claim = new NFTClaim({
            playerAddress:    PLAYER1.address.toLowerCase(),
            achievementTypeId: ACHIEVEMENT_TYPE_ID,
            achievementType:   ACHIEVEMENT_TYPE,
            rarity:            'COMMON',
            tokenId:           TOKEN_ID,
            txHash:            null,
            handDescription:   NFT_DESCRIPTION,
            gameId:            GAME_ID,
            cards:             CARDS,
            yearMonth
        });
        await claim.save();
        console.log(`💾 DB record saved  tokenId=${TOKEN_ID}`);

        // ── 3. Init TronWeb with Player 1's key ───────────────────────────────
        const tronWeb = new TronWeb({
            fullHost: 'https://nile.trongrid.io',
            headers: process.env.TRONGRID_API_KEY
                ? { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY }
                : {},
            privateKey: PLAYER1.privateKey
        });
        console.log(`🔑 Using Player 1: ${tronWeb.defaultAddress.base58}`);

        // ── 4. Load NFT contract ──────────────────────────────────────────────
        const nftAddress = process.env.NFT_CONTRACT_ADDRESS;
        const abi = require('./build/contracts/AchievementNFTSimple.json').abi;
        const contract = await tronWeb.contract(abi, nftAddress);
        console.log(`📜 Contract: ${nftAddress}`);

        // ── 5. Build signature (signed by server key, same as in mint-nft-final-working.js) ──
        const timestamp = Math.floor(Date.now() / 1000);

        let callerHex = tronWeb.address.toHex(PLAYER1.address);
        // Ensure 0x prefix with 20-byte address (hex without leading 41)
        if (callerHex.startsWith('41')) {
            callerHex = '0x' + callerHex.slice(2);
        } else if (!callerHex.startsWith('0x')) {
            callerHex = '0x' + callerHex;
        }

        const hash = ethers.utils.solidityKeccak256(
            ['address', 'uint256', 'uint256', 'string'],
            [callerHex, ACHIEVEMENT_TYPE_ID, timestamp, GAME_ID]
        );

        const serverWallet = new ethers.Wallet(process.env.SERVER_PRIVATE_KEY);
        const signature = await serverWallet.signMessage(ethers.utils.arrayify(hash));
        const sig = ethers.utils.splitSignature(signature);
        console.log(`✍️  Signer: ${serverWallet.address}  v=${sig.v}`);

        // ── 6. Call claimNFT on chain ─────────────────────────────────────────
        console.log('⏳ Calling claimNFT (5 TRX)...\n');
        const tx = await contract.claimNFT(
            ACHIEVEMENT_TYPE_ID,
            timestamp,
            GAME_ID,
            sig.v,
            sig.r,
            sig.s
        ).send({
            feeLimit:          1000000000,
            callValue:         5000000,   // 5 TRX
            shouldPollResponse: true
        });

        console.log(`✅ Minted!  TX: ${tx}`);
        console.log(`   https://nile.tronscan.org/#/transaction/${tx}\n`);

        // ── 7. Update txHash in DB ────────────────────────────────────────────
        claim.txHash = tx;
        await claim.save();
        console.log('💾 DB record updated with txHash');

        console.log('\n🎉 Done! NFT "Hello world cards 10h 9d 8c 7s 6h" minted for Player 1');

    } catch (err) {
        console.error('❌ Error:', err.message || err);
        if (err.output) console.error('   output:', JSON.stringify(err.output));
    } finally {
        if (db) await mongoose.disconnect();
    }
})();
