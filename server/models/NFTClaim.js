/**
 * NFT Claim Model
 * Tracks NFT achievements claimed by players
 */

const mongoose = require('mongoose');

const nftClaimSchema = new mongoose.Schema({
    // Player wallet address
    playerAddress: {
        type: String,
        required: true,
        lowercase: true,
        index: true
    },
    
    // Achievement type (1-6)
    achievementTypeId: {
        type: Number,
        required: true,
        min: 1,
        max: 6
    },
    
    // Achievement name
    achievementType: {
        type: String,
        enum: ['ROYAL_FLUSH', 'STRAIGHT_FLUSH', 'FOUR_OF_A_KIND', 'FULL_HOUSE', 'FLUSH', 'STRAIGHT'],
        required: true
    },
    
    // Rarity
    rarity: {
        type: String,
        enum: ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'],
        required: true
    },
    
    // NFT Token ID from contract
    tokenId: {
        type: Number,
        required: true
    },
    
    // Transaction hash
    txHash: {
        type: String,
        default: null
    },

    // Blockchain where this achievement NFT belongs.
    chain: {
        type: String,
        enum: ['TRON', '0G'],
        default: null,
        index: true
    },

    // Token standard shown by the gallery/import flows.
    tokenStandard: {
        type: String,
        default: null
    },

    // NFT contract address used for the on-chain mint.
    contractAddress: {
        type: String,
        default: null
    },

    // On-chain token ID (from contract)
    onchainTokenId: {
        type: Number,
        default: null,
        index: true
    },

    // When the NFT was minted on-chain
    mintedAt: {
        type: Date,
        default: null
    },
    
    // Hand description (e.g., "Royal Flush - A-K-Q-J-10 of Hearts")
    handDescription: {
        type: String,
        default: null
    },
    
    // Game session ID where achievement was earned
    gameId: {
        type: String,
        default: null
    },
    
    // Cards involved in the hand
    cards: [{
        rank: String,
        suit: String
    }],
    
    // Game screenshot (base64 encoded image)
    gameScreenshot: {
        type: String,
        default: null
    },
    
    // Screenshot format (e.g., 'png', 'jpeg')
    screenshotFormat: {
        type: String,
        default: 'png'
    },

    // Display name (custom name for NFT, overrides default)
    displayName: {
        type: String,
        default: null
    },

    // Year-month for monthly tracking
    yearMonth: {
        type: Number,
        required: true,
        index: true
    },
    
    // Timestamps
    claimedAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Compound indexes
nftClaimSchema.index({ playerAddress: 1, claimedAt: -1 });
nftClaimSchema.index({ achievementTypeId: 1, yearMonth: 1 });
nftClaimSchema.index({ yearMonth: 1, achievementTypeId: 1, claimedAt: 1 });

// Static methods
nftClaimSchema.statics.findByPlayer = function(address) {
    return this.find({ playerAddress: address.toLowerCase() })
        .sort({ claimedAt: -1 });
};

nftClaimSchema.statics.findByPlayerAndChain = function(address, chain) {
    const normalizedAddress = address.toLowerCase();
    const normalizedChain = String(chain || '').toLowerCase();

    if (normalizedChain === '0g' || normalizedChain === 'zerog' || normalizedChain === 'inft') {
        return this.find({
            playerAddress: normalizedAddress,
            $or: [
                { chain: '0G' },
                { tokenStandard: 'ERC-7857' },
                { playerAddress: /^0x/i }
            ]
        }).sort({ claimedAt: -1 });
    }

    if (normalizedChain === 'tron') {
        return this.find({
            playerAddress: normalizedAddress,
            $and: [
                { $or: [{ chain: 'TRON' }, { chain: null }, { chain: { $exists: false } }] },
                { playerAddress: { $not: /^0x/i } }
            ]
        }).sort({ claimedAt: -1 });
    }

    return this.findByPlayer(address);
};

nftClaimSchema.statics.getMonthlyMinted = function(yearMonth, achievementTypeId) {
    return this.countDocuments({ yearMonth, achievementTypeId });
};

nftClaimSchema.statics.getMonthlyMintedByPlayer = function(yearMonth, playerAddress) {
    return this.countDocuments({ 
        yearMonth, 
        playerAddress: playerAddress.toLowerCase() 
    });
};

// Method to get year-month from date
nftClaimSchema.statics.getYearMonth = function(date = new Date()) {
    return date.getFullYear() * 100 + (date.getMonth() + 1);
};

// Pre-save hook to set yearMonth
nftClaimSchema.pre('save', function(next) {
    if (!this.yearMonth) {
        this.yearMonth = this.constructor.getYearMonth(this.claimedAt || new Date());
    }
    next();
});

// Set rarity based on achievement type
nftClaimSchema.pre('save', function(next) {
    const rarityMap = {
        'ROYAL_FLUSH': 'LEGENDARY',
        'STRAIGHT_FLUSH': 'EPIC',
        'FOUR_OF_A_KIND': 'RARE',
        'FULL_HOUSE': 'RARE',
        'FLUSH': 'COMMON',
        'STRAIGHT': 'COMMON'
    };
    
    if (!this.rarity && this.achievementType) {
        this.rarity = rarityMap[this.achievementType] || 'COMMON';
    }
    next();
});

// Ensure virtuals are included
nftClaimSchema.set('toJSON', { virtuals: true });
nftClaimSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('NFTClaim', nftClaimSchema);
