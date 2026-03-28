/**
 * NFTService
 * Manages NFT achievement detection, signature generation, and minting
 */

const crypto = require('crypto');
const NFTClaim = require('../models/NFTClaim');

class NFTService {
    constructor(config) {
        this.tronWeb = config.tronWeb;
        this.contractAddress = config.nftContractAddress;
        this.signerPrivateKey = config.signerPrivateKey;
        this.signerAddress = config.signerAddress;
        this.signatureValidity = config.signatureValidity || 7 * 24 * 60 * 60; // 7 days
        this.contract = null;
    }
    
    /**
     * Initialize the service
     */
    async init() {
        if (this.contractAddress) {
            this.contract = await this.tronWeb.contract().at(this.contractAddress);
            console.log('[NFTService] Contract loaded:', this.contractAddress);
        }
    }
    
    // ============ Achievement Detection ============
    
    /**
     * Check if a hand qualifies for an NFT achievement
     * @param {Array} holeCards - Player's hole cards ['Ah', 'Kh']
     * @param {Array} board - Community cards ['Qh', 'Jh', 'Th', '2c', '3d']
     * @returns {Object|null} Achievement info or null
     */
    checkAchievement(holeCards, board) {
        const allCards = [...holeCards, ...board];
        const hand = this._evaluateHand(allCards);
        
        // Achievement types that qualify for NFT
        const achievementTypes = {
            'Royal Flush': 'ROYAL_FLUSH',
            'Straight Flush': 'STRAIGHT_FLUSH',
            'Four of a Kind': 'FOUR_OF_A_KIND',
            'Full House': 'FULL_HOUSE',
            'Flush': 'FLUSH',
            'Straight': 'STRAIGHT'
        };
        
        if (achievementTypes[hand.name]) {
            return {
                type: achievementTypes[hand.name],
                name: hand.name,
                description: hand.description,
                cards: allCards,
                typeId: this._getTypeId(achievementTypes[hand.name])
            };
        }
        
        return null;
    }
    
    /**
     * Evaluate poker hand
     */
    _evaluateHand(cards) {
        const parsed = cards.map(c => this._parseCard(c));
        
        // Sort by rank
        parsed.sort((a, b) => b.rankValue - a.rankValue);
        
        // Check for flush
        const bySuit = {};
        parsed.forEach(c => {
            if (!bySuit[c.suit]) bySuit[c.suit] = [];
            bySuit[c.suit].push(c);
        });
        
        let flushSuit = null;
        for (const suit of Object.keys(bySuit)) {
            if (bySuit[suit].length >= 5) {
                flushSuit = suit;
                break;
            }
        }
        
        // Check for straight
        const findStraight = (cardList) => {
            const unique = [...new Map(cardList.map(c => [c.rankValue, c])).values()];
            unique.sort((a, b) => b.rankValue - a.rankValue);
            
            // Check for wheel (A-2-3-4-5)
            const hasWheel = unique.some(c => c.rankValue === 14) &&
                unique.some(c => c.rankValue === 2) &&
                unique.some(c => c.rankValue === 3) &&
                unique.some(c => c.rankValue === 4) &&
                unique.some(c => c.rankValue === 5);
            
            if (hasWheel) {
                return { isStraight: true, highCard: 5 };
            }
            
            for (let i = 0; i <= unique.length - 5; i++) {
                let isSequence = true;
                for (let j = 0; j < 4; j++) {
                    if (unique[i + j].rankValue - unique[i + j + 1].rankValue !== 1) {
                        isSequence = false;
                        break;
                    }
                }
                if (isSequence) {
                    return { isStraight: true, highCard: unique[i].rankValue };
                }
            }
            
            return { isStraight: false };
        };
        
        // Check for straight flush and royal flush
        if (flushSuit) {
            const flushCards = bySuit[flushSuit];
            const straightResult = findStraight(flushCards);
            
            if (straightResult.isStraight) {
                if (straightResult.highCard === 14) {
                    return { name: 'Royal Flush', description: 'A-K-Q-J-10 同花顺', rank: 10 };
                }
                return { name: 'Straight Flush', description: `${straightResult.highCard}高同花顺`, rank: 9 };
            }
            
            return { name: 'Flush', description: `${this._rankName(flushCards[0].rankValue)}高同花`, rank: 6 };
        }
        
        // Count ranks
        const rankCount = {};
        parsed.forEach(c => {
            rankCount[c.rankValue] = (rankCount[c.rankValue] || 0) + 1;
        });
        
        const counts = Object.entries(rankCount)
            .map(([rank, count]) => ({ rank: parseInt(rank), count }))
            .sort((a, b) => b.count - a.count || b.rank - a.rank);
        
        // Four of a kind
        if (counts[0].count === 4) {
            return { name: 'Four of a Kind', description: `四条${this._rankName(counts[0].rank)}`, rank: 8 };
        }
        
        // Full house
        if (counts[0].count === 3 && counts[1]?.count >= 2) {
            return { name: 'Full House', description: `葫芦${this._rankName(counts[0].rank)}-${this._rankName(counts[1].rank)}`, rank: 7 };
        }
        
        // Straight
        const straightResult = findStraight(parsed);
        if (straightResult.isStraight) {
            return { name: 'Straight', description: `${this._rankName(straightResult.highCard)}高顺子`, rank: 5 };
        }
        
        // Other hands (not achievements)
        if (counts[0].count === 3) {
            return { name: 'Three of a Kind', rank: 4 };
        }
        if (counts[0].count === 2 && counts[1]?.count === 2) {
            return { name: 'Two Pair', rank: 3 };
        }
        if (counts[0].count === 2) {
            return { name: 'One Pair', rank: 2 };
        }
        
        return { name: 'High Card', rank: 1 };
    }
    
    /**
     * Parse a card string
     */
    _parseCard(cardStr) {
        // 支持对象格式 {rank: 'A', suit: 'h'} 或字符串格式 'Ah'
        let rank, suit;
        
        if (typeof cardStr === 'object' && cardStr !== null) {
            rank = cardStr.rank;
            suit = (cardStr.suit || '').toLowerCase();
        } else {
            rank = cardStr.slice(0, -1);
            suit = cardStr.slice(-1).toLowerCase();
        }
        
        const rankMap = {
            'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10, '10': 10,
            '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
        };
        
        return {
            rank,
            rankValue: rankMap[rank] || parseInt(rank),
            suit
        };
    }
    
    _rankName(rankValue) {
        const names = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: '10' };
        return names[rankValue] || rankValue.toString();
    }
    
    _getTypeId(type) {
        const typeIds = {
            'ROYAL_FLUSH': 1,
            'STRAIGHT_FLUSH': 2,
            'FOUR_OF_A_KIND': 3,
            'FULL_HOUSE': 4,
            'FLUSH': 5,
            'STRAIGHT': 6
        };
        return typeIds[type];
    }
    
    // ============ Signature Generation ============
    
    /**
     * Generate a mint signature for an NFT claim
     * @param {string} playerAddress - Player's wallet address
     * @param {number} achievementTypeId - Achievement type ID (1-6)
     * @param {string} gameId - Unique game session ID
     * @returns {Object} Signature data
     */
    async generateMintSignature(playerAddress, achievementTypeId, gameId) {
        const timestamp = Math.floor(Date.now() / 1000);
        
        // Create message hash
        const message = this.tronWeb.utils.crypto.bytesToString(
            this.tronWeb.utils.crypto.keccak256(
                JSON.stringify({
                    player: playerAddress,
                    achievementTypeId,
                    timestamp,
                    gameId
                })
            )
        );
        
        // Sign with server private key
        const signature = await this.tronWeb.trx.sign(
            message,
            this.signerPrivateKey
        );
        
        return {
            player: playerAddress,
            achievementTypeId,
            timestamp,
            gameId,
            signature,
            deadline: timestamp + this.signatureValidity
        };
    }
    
    /**
     * Generate compact signature for contract
     */
    async generateCompactSignature(playerAddress, achievementTypeId, gameId) {
        const sig = await this.generateMintSignature(playerAddress, achievementTypeId, gameId);
        
        // Convert to v, r, s format
        const sigObj = this._parseSignature(sig.signature);
        
        return {
            ...sig,
            v: sigObj.v,
            r: sigObj.r,
            s: sigObj.s
        };
    }
    
    _parseSignature(signature) {
        // Parse TRON signature into v, r, s components
        const sig = signature.replace(/^0x/, '');
        return {
            r: '0x' + sig.slice(0, 64),
            s: '0x' + sig.slice(64, 128),
            v: parseInt(sig.slice(128, 130), 16)
        };
    }
    
    // ============ Monthly Limit ============
    
    /**
     * Check if player can mint NFT
     */
    async canMintNFT(achievementTypeId) {
        if (!this.contract) return true;
        
        const remaining = await this.contract.getMonthlyRemaining(achievementTypeId).call();
        return remaining.toNumber() > 0;
    }
    
    /**
     * Get monthly remaining count
     */
    async getMonthlyRemaining(achievementTypeId) {
        if (!this.contract) return 0;
        
        const remaining = await this.contract.getMonthlyRemaining(achievementTypeId).call();
        return remaining.toNumber();
    }
    
    // ============ Database Operations ============
    
    /**
     * Record NFT claim
     */
    async recordClaim(playerAddress, achievementTypeId, tokenId, txHash, handDescription, gameId) {
        const claim = new NFTClaim({
            playerAddress,
            achievementTypeId,
            achievementType: this._getAchievementTypeName(achievementTypeId),
            tokenId,
            txHash,
            handDescription,
            gameId,
            yearMonth: NFTClaim.getYearMonth()
        });
        
        await claim.save();
        return claim;
    }
    
    /**
     * Get player's NFTs
     */
    async getPlayerNFTs(playerAddress) {
        return NFTClaim.findByPlayer(playerAddress);
    }
    
    /**
     * Get monthly minted count
     */
    async getMonthlyMinted(achievementTypeId) {
        const yearMonth = NFTClaim.getYearMonth();
        return NFTClaim.getMonthlyMinted(yearMonth, achievementTypeId);
    }
    
    // ============ Process Game End ============
    
    /**
     * Process game end and detect achievements
     * @param {Object} gameResult - Game result data
     */
    async processGameEnd(gameResult) {
        const { winners, players, board, gameId } = gameResult;
        const achievements = [];
        
        for (const player of players) {
            const achievement = this.checkAchievement(player.holeCards, board);
            
            if (achievement) {
                // Check monthly limit
                const canMint = await this.canMintNFT(achievement.typeId);
                
                if (canMint) {
                    // Generate signature
                    const signature = await this.generateCompactSignature(
                        player.address,
                        achievement.typeId,
                        gameId
                    );
                    
                    achievements.push({
                        player: player.address,
                        achievement,
                        signature
                    });
                }
            }
        }
        
        return achievements;
    }
    
    _getAchievementTypeName(typeId) {
        const types = {
            1: 'ROYAL_FLUSH',
            2: 'STRAIGHT_FLUSH',
            3: 'FOUR_OF_A_KIND',
            4: 'FULL_HOUSE',
            5: 'FLUSH',
            6: 'STRAIGHT'
        };
        return types[typeId];
    }
}

// Singleton instance
let nftServiceInstance = null;

function initNFTService(config) {
    if (!nftServiceInstance) {
        nftServiceInstance = new NFTService(config);
    }
    return nftServiceInstance;
}

// Export with proxy methods
module.exports = {
    NFTService,
    initNFTService,
    getNFTService: () => nftServiceInstance,
    
    // Proxy methods - 直接使用数据库模型，不依赖实例初始化
    list: async (playerAddress) => {
        return NFTClaim.findByPlayer(playerAddress);
    },
    getPlayerNFTs: async (playerAddress) => {
        return NFTClaim.findByPlayer(playerAddress);
    },
    canMintNFT: async (achievementTypeId) => {
        if (!nftServiceInstance) return true;
        return nftServiceInstance.canMintNFT(achievementTypeId);
    },
    getMonthlyRemaining: async (achievementTypeId) => {
        if (!nftServiceInstance) {
            // 从数据库计算
            const yearMonth = NFTClaim.getYearMonth();
            const minted = await NFTClaim.getMonthlyMinted(yearMonth, achievementTypeId);
            const limits = { 1: 10, 2: 20, 3: 30, 4: 50, 5: 100, 6: 200 };
            return (limits[achievementTypeId] || 200) - minted;
        }
        return nftServiceInstance.getMonthlyRemaining(achievementTypeId);
    },
    getAchievementTypes: () => {
        return [
            { id: 1, name: 'ROYAL_FLUSH', description: '皇家同花顺', monthlyLimit: 10 },
            { id: 2, name: 'STRAIGHT_FLUSH', description: '同花顺', monthlyLimit: 20 },
            { id: 3, name: 'FOUR_OF_A_KIND', description: '四条', monthlyLimit: 30 },
            { id: 4, name: 'FULL_HOUSE', description: '葫芦', monthlyLimit: 50 },
            { id: 5, name: 'FLUSH', description: '同花', monthlyLimit: 100 },
            { id: 6, name: 'STRAIGHT', description: '顺子', monthlyLimit: 200 }
        ];
    },
    generateMintSignature: async (playerAddress, achievementTypeId, gameId) => {
        if (!nftServiceInstance) throw new Error('Service not initialized');
        return nftServiceInstance.generateMintSignature(playerAddress, achievementTypeId, gameId);
    },
    recordClaim: async (playerAddress, achievementTypeId, tokenId, txHash, handDescription, gameId, cards) => {
        const claim = new NFTClaim({
            playerAddress,
            achievementTypeId,
            achievementType: ['ROYAL_FLUSH', 'STRAIGHT_FLUSH', 'FOUR_OF_A_KIND', 'FULL_HOUSE', 'FLUSH', 'STRAIGHT'][achievementTypeId - 1],
            tokenId,
            txHash,
            handDescription,
            gameId,
            cards: cards || [],
            yearMonth: NFTClaim.getYearMonth()
        });
        await claim.save();
        return claim;
    },
    // Additional methods for routes
    getNFTById: async (tokenId) => {
        return NFTClaim.findOne({ tokenId: parseInt(tokenId) });
    },
    checkMonthlyLimit: async (walletAddress, achievementType) => {
        const yearMonth = NFTClaim.getYearMonth();
        const minted = await NFTClaim.getMonthlyMinted(yearMonth, achievementType);
        const limits = { 1: 10, 2: 20, 3: 30, 4: 50, 5: 100, 6: 200 };
        return { 
            canMint: minted < (limits[achievementType] || 200), 
            remaining: (limits[achievementType] || 200) - minted 
        };
    },
    prepareMint: async (walletAddress, data) => {
        if (!nftServiceInstance) {
            // 返回模拟签名用于测试
            const timestamp = Math.floor(Date.now() / 1000);
            return {
                signature: {
                    player: walletAddress,
                    achievementTypeId: data.achievementType,
                    timestamp,
                    gameId: data.gameSessionId || `game-${Date.now()}`,
                    mockMode: true
                }
            };
        }
        return nftServiceInstance.prepareMint?.(walletAddress, data) || { signature: 'mock' };
    },
    getNFTStats: async (walletAddress) => {
        const nfts = await NFTClaim.findByPlayer(walletAddress);
        const byType = {};
        nfts.forEach(nft => {
            byType[nft.achievementType] = (byType[nft.achievementType] || 0) + 1;
        });
        return { total: nfts.length, byType };
    },
    getNFTMetadata: async (tokenId) => {
        const nft = await NFTClaim.findOne({ tokenId: parseInt(tokenId) });
        if (!nft) return { name: 'NFT', description: 'Poker Achievement NFT' };
        return {
            name: `${nft.achievementType} #${nft.tokenId}`,
            description: nft.handDescription,
            attributes: [
                { trait_type: 'Achievement', value: nft.achievementType },
                { trait_type: 'Rarity', value: nft.rarity },
                { trait_type: 'Game ID', value: nft.gameId }
            ]
        };
    },
    // Check achievement from hand cards - static method for game flow
    checkAchievement: (holeCards, board) => {
        // Create a temporary instance to use the method
        const tempInstance = new NFTService({
            tronWeb: null,
            contractAddress: null,
            signerPrivateKey: null,
            signerAddress: null
        });
        return tempInstance.checkAchievement(holeCards, board);
    }
};
