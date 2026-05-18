const express = require('express');
const router = express.Router();
const NFTService = require('../../services/NFTService');
const NFTClaim = require('../../models/NFTClaim');
const { authMiddleware } = require('../../middleware/auth');
const sharp = require('sharp');

function getPublicBaseUrl(req) {
    if (process.env.NFT_PUBLIC_BASE_URL) {
        return process.env.NFT_PUBLIC_BASE_URL.replace(/\/$/, '');
    }

    const forwardedProto = (req.get('x-forwarded-proto') || '').split(',')[0].trim();
    const forwardedHost = (req.get('x-forwarded-host') || '').split(',')[0].trim();
    const proto = forwardedProto || req.protocol || 'http';
    return `${proto}://${forwardedHost || req.get('host')}`;
}

function setPublicNFTHeaders(res) {
    res.removeHeader('Access-Control-Allow-Credentials');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
}

function escapeXml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatCards(cards = []) {
    return cards.map(c => `${c.rank || ''}${c.suit || ''}`).join(' ').trim();
}

function buildFallbackSvg(nft, displayId) {
    const title = escapeXml(nft?.achievementType || 'Poker Hand');
    const rarity = escapeXml(nft?.rarity || 'COMMON');
    const cards = escapeXml(formatCards(nft?.cards) || 'Recorded in game');
    const tokenLabel = escapeXml(displayId || '-');
    return `<svg width="800" height="450" xmlns="http://www.w3.org/2000/svg">` +
        `<rect width="800" height="450" fill="#101827"/>` +
        `<rect x="28" y="28" width="744" height="394" rx="18" fill="#0d5c2e" stroke="#fbbf24" stroke-width="3"/>` +
        `<text x="400" y="92" font-size="22" fill="#fbbf24" text-anchor="middle" font-family="Arial" font-weight="700">0G POKER INFT</text>` +
        `<text x="400" y="190" font-size="46" fill="#ffffff" text-anchor="middle" font-family="Arial" font-weight="700">${title}</text>` +
        `<text x="400" y="245" font-size="24" fill="#d1d5db" text-anchor="middle" font-family="Arial">${cards}</text>` +
        `<text x="400" y="315" font-size="20" fill="#9ca3af" text-anchor="middle" font-family="Arial">${rarity} • ERC-7857</text>` +
        `<text x="400" y="370" font-size="18" fill="#fbbf24" text-anchor="middle" font-family="Arial">#${tokenLabel}</text>` +
        `</svg>`;
}

function buildPreviewSvg(nft, displayId) {
    const title = escapeXml(nft?.displayName || nft?.achievementType || 'Poker Hand');
    const rarity = escapeXml(nft?.rarity || 'COMMON');
    const cards = escapeXml(formatCards(nft?.cards) || 'Recorded in game');
    const tokenLabel = escapeXml(displayId || '-');
    return `<svg width="640" height="360" viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg">` +
        `<defs><linearGradient id="felt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#116b38"/><stop offset="1" stop-color="#08251b"/></linearGradient></defs>` +
        `<rect width="640" height="360" fill="#101827"/>` +
        `<rect x="26" y="24" width="588" height="312" rx="22" fill="url(#felt)" stroke="#f3c969" stroke-width="4"/>` +
        `<rect x="58" y="62" width="524" height="72" rx="12" fill="#0b1220" opacity="0.58"/>` +
        `<text x="320" y="104" font-size="32" fill="#ffffff" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700">${title}</text>` +
        `<text x="320" y="158" font-size="18" fill="#f3c969" text-anchor="middle" font-family="Arial, sans-serif">${rarity} INFT</text>` +
        `<text x="320" y="220" font-size="30" fill="#ffffff" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700">${cards}</text>` +
        `<text x="320" y="288" font-size="18" fill="#d1d5db" text-anchor="middle" font-family="Arial, sans-serif">Token #${tokenLabel}</text>` +
        `</svg>`;
}

async function makeNftJpeg(buffer, { width, height, quality }) {
    return sharp(buffer, { failOn: 'none' })
        .resize({
            width,
            height,
            fit: 'inside',
            withoutEnlargement: true
        })
        .jpeg({ quality, progressive: true, mozjpeg: true })
        .toBuffer();
}

// NFTService实例（用于牌型检测）
const nftServiceInstance = new (require('../../services/NFTService').NFTService)({
    tronWeb: null,
    contractAddress: null,
    signerPrivateKey: null,
    signerAddress: null
});

/**
 * @route GET /api/nft/types
 * @desc Get all achievement types
 */
router.get('/types', (req, res) => {
    const types = NFTService.getAchievementTypes();
    res.json({ success: true, types });
});

/**
 * @route GET /api/nft/monthly-limit/:typeId
 * @desc Get monthly limit for achievement type
 */
router.get('/monthly-limit/:typeId', async (req, res) => {
    try {
        const { typeId } = req.params;
        const typeIdNum = parseInt(typeId);
        
        // 获取成就类型信息
        const types = NFTService.getAchievementTypes();
        const typeInfo = types.find(t => t.id === typeIdNum);
        
        if (!typeInfo) {
            return res.status(404).json({ success: false, error: 'Invalid achievement type' });
        }
        
        // 尝试从合约获取剩余数量
        let remaining = typeInfo.monthlyLimit;
        try {
            remaining = await NFTService.getMonthlyRemaining(typeIdNum);
        } catch (e) {
            // 使用默认值
        }
        
        res.json({ 
            success: true, 
            typeId: typeIdNum,
            typeName: typeInfo.name,
            monthlyLimit: typeInfo.monthlyLimit,
            remaining: remaining
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/nft/detect
 * @desc Detect achievement from poker hand
 */
router.post('/detect', async (req, res) => {
    try {
        const { holeCards, board, walletAddress } = req.body;
        
        if (!holeCards || !Array.isArray(holeCards)) {
            return res.status(400).json({ success: false, error: 'holeCards required' });
        }
        
        if (!board || !Array.isArray(board)) {
            return res.status(400).json({ success: false, error: 'board required' });
        }
        
        // 检测牌型
        const achievement = nftServiceInstance.checkAchievement(holeCards, board);
        
        res.json({ 
            success: true, 
            holeCards,
            board,
            achievement: achievement,
            hasAchievement: achievement !== null
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/nft/collection/:walletAddress
 * @desc Get user's NFT collection
 */
router.get('/collection/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const { chain } = req.query;
        const nfts = chain
            ? await NFTClaim.findByPlayerAndChain(walletAddress, chain)
            : await NFTClaim.findByPlayer(walletAddress);

        console.log('[NFT API] Collection query for', walletAddress, chain ? `chain=${chain}` : 'all', 'found', nfts.length, 'NFTs');
        res.json({ success: true, nfts, chain: chain || 'all' });
    } catch (error) {
        console.error('[NFT API] Collection error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/nft/image/:claimId
 * @desc Return the real game screenshot for an NFT claim.
 */
router.get('/image/:claimId', async (req, res) => {
    try {
        const { claimId } = req.params;
        const nft = await NFTClaim.findById(claimId);

        if (!nft) {
            return res.status(404).send('NFT image not found');
        }

        if (nft.gameScreenshot && nft.gameScreenshot.length > 100) {
            const imageBuffer = Buffer.from(nft.gameScreenshot, 'base64');
            try {
                const outputBuffer = await makeNftJpeg(imageBuffer, {
                    width: 1280,
                    height: 720,
                    quality: 78
                });
                setPublicNFTHeaders(res);
                res.set('Content-Type', 'image/jpeg');
                res.set('Cache-Control', 'public, max-age=31536000, immutable');
                return res.send(outputBuffer);
            } catch (sharpErr) {
                const format = nft.screenshotFormat || 'jpeg';
                console.warn('[NFT API] Image resize failed, sending stored screenshot:', sharpErr.message);
                setPublicNFTHeaders(res);
                res.set('Content-Type', `image/${format}`);
                res.set('Cache-Control', 'public, max-age=31536000, immutable');
                return res.send(imageBuffer);
            }
        }

        const displayId = nft.onchainTokenId || nft.tokenId;
        setPublicNFTHeaders(res);
        res.set('Content-Type', 'image/svg+xml; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=3600');
        res.send(buildFallbackSvg(nft, displayId));
    } catch (error) {
        console.error('[NFT API] Image error:', error);
        res.status(500).send(error.message);
    }
});

/**
 * @route GET /api/nft/preview/:claimId
 * @desc Small deterministic preview for wallet import popups.
 */
router.get('/preview/:claimId', async (req, res) => {
    try {
        const { claimId } = req.params;
        const nft = await NFTClaim.findById(claimId);

        if (!nft) {
            return res.status(404).send('NFT preview not found');
        }

        const displayId = nft.onchainTokenId || nft.tokenId;
        setPublicNFTHeaders(res);
        res.set('Cache-Control', 'public, max-age=31536000, immutable');

        if (nft.gameScreenshot && nft.gameScreenshot.length > 100) {
            const imageBuffer = Buffer.from(nft.gameScreenshot, 'base64');
            try {
                const previewBuffer = await makeNftJpeg(imageBuffer, {
                    width: 640,
                    height: 360,
                    quality: 72
                });
                res.set('Content-Type', 'image/jpeg');
                return res.send(previewBuffer);
            } catch (sharpErr) {
                console.warn('[NFT API] Preview resize failed, using SVG fallback:', sharpErr.message);
            }
        }

        res.set('Content-Type', 'image/svg+xml; charset=utf-8');
        res.send(buildPreviewSvg(nft, displayId));
    } catch (error) {
        console.error('[NFT API] Preview error:', error);
        res.status(500).send(error.message);
    }
});

/**
 * @route GET /api/nft/metadata/inft/:claimId
 * @desc Metadata used by 0G INFT tokenURI. Uses the stored real game screenshot.
 */
router.get('/metadata/inft/:claimId', async (req, res) => {
    try {
        const { claimId } = req.params;
        const nft = await NFTClaim.findById(claimId);

        if (!nft) {
            return res.status(404).json({ success: false, error: 'NFT metadata not found' });
        }

        const baseUrl = getPublicBaseUrl(req);
        const displayId = nft.onchainTokenId || nft.tokenId;
        const cards = formatCards(nft.cards);
        const imageUrl = `${baseUrl}/api/nft/image/${claimId}`;

        setPublicNFTHeaders(res);
        res.set('Cache-Control', 'public, max-age=300');
        res.json({
            name: `${nft.displayName || nft.achievementType} INFT #${displayId}`,
            description: nft.handDescription || `Real ${nft.achievementType} achievement from 0G Poker`,
            image: imageUrl,
            external_url: `${baseUrl}/nft?address=${encodeURIComponent(nft.playerAddress)}`,
            attributes: [
                { trait_type: 'Hand Type', value: nft.achievementType },
                { trait_type: 'Rarity', value: nft.rarity },
                { trait_type: 'Cards', value: cards || 'Recorded in game' },
                { trait_type: 'Standard', value: 'ERC-7857' },
                { trait_type: 'Game ID', value: nft.gameId || 'Unknown' },
                { trait_type: 'Token ID', value: displayId, display_type: 'number' },
                { trait_type: 'Real Game Screenshot', value: nft.gameScreenshot ? 'Yes' : 'No' }
            ]
        });
    } catch (error) {
        console.error('[NFT API] INFT metadata error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/nft/:tokenId
 * @desc Get NFT details by token ID
 */
router.get('/:tokenId', async (req, res) => {
    try {
        const { tokenId } = req.params;
        const nft = await NFTService.getNFTById(tokenId);
        if (!nft) {
            return res.status(404).json({ success: false, error: 'NFT not found' });
        }
        res.json({ success: true, nft });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/nft/limit/:walletAddress/:achievementType
 * @desc Check monthly limit for achievement type
 */
router.get('/limit/:walletAddress/:achievementType', async (req, res) => {
    try {
        const { walletAddress, achievementType } = req.params;
        const limitInfo = await NFTService.checkMonthlyLimit(walletAddress, parseInt(achievementType));
        res.json({ success: true, ...limitInfo });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/nft/prepare-mint
 * @desc Prepare NFT mint with signature (requires achievement)
 */
router.post('/prepare-mint', async (req, res) => {
    try {
        const { walletAddress, achievementType, gameSessionId, handData } = req.body;

        if (!walletAddress) {
            return res.status(400).json({ success: false, error: 'walletAddress required' });
        }

        if (!achievementType) {
            return res.status(400).json({ success: false, error: 'achievementType required' });
        }

        const result = await NFTService.prepareMint(walletAddress, {
            achievementType,
            gameSessionId,
            handData
        });

        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/nft/stats/:walletAddress
 * @desc Get user's NFT statistics
 */
router.get('/stats/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const stats = await NFTService.getNFTStats(walletAddress);
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/nft/metadata/:achievementType/:tokenId
 * @desc Get NFT metadata with achievementType (for contract tokenURI format)
 * Contract returns: baseURI + achievementType + "/" + tokenId
 */
router.get('/metadata/:achievementType/:tokenId', async (req, res) => {
    try {
        const { achievementType, tokenId } = req.params;
        console.log('[NFT API] ========== METADATA REQUEST ==========');
        console.log('[NFT API] Type:', achievementType, 'Token:', tokenId);
        console.log('[NFT API] Headers:', JSON.stringify(req.headers));

        const metadata = await NFTService.getNFTMetadata(tokenId);
        console.log('[NFT API] Metadata attributes:', JSON.stringify(metadata.attributes));
        res.json(metadata);
    } catch (error) {
        console.error('[NFT API] Metadata error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/nft/metadata/:tokenId
 * @desc Get NFT metadata (for external platforms and direct access)
 */
router.get('/metadata/:tokenId', async (req, res) => {
    try {
        const { tokenId } = req.params;
        console.log('[NFT API] Metadata request for tokenId:', tokenId);
        const metadata = await NFTService.getNFTMetadata(tokenId);
        console.log('[NFT API] Metadata generated:', JSON.stringify(metadata).substring(0, 100));
        res.json(metadata);
    } catch (error) {
        console.error('[NFT API] Metadata error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/nft/confirm-mint
 * @desc Update NFT record with on-chain txHash after successful mint
 */
router.post('/confirm-mint', async (req, res) => {
    try {
        const { walletAddress, gameId, txHash, tokenId } = req.body;
        
        if (!walletAddress || !gameId || !txHash) {
            return res.status(400).json({ success: false, error: 'walletAddress, gameId, txHash required' });
        }
        
        console.log(`[NFT API] Confirming mint: ${walletAddress?.substring(0, 10)}... gameId=${gameId} tx=${txHash?.substring(0, 16)}...`);
        
        let resolvedTokenId = tokenId;
        if (walletAddress?.startsWith('0x') && txHash) {
            try {
                const { getZeroGService } = require('../../blockchain/blockchainFactory');
                const ethers6 = require('ethers6');
                const fs = require('fs');
                const path = require('path');
                const zgService = getZeroGService();
                const abiPath = path.resolve(__dirname, '../../../artifacts/contracts/0g/PokerHandINFT.sol/PokerHandINFT.json');
                if (zgService?.provider && fs.existsSync(abiPath)) {
                    const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8')).abi;
                    const inftAddr = process.env.ZEROG_INFT_ADDRESS || '0x5d36eE3Bd3D9D42B552C873EEd1Eef23535443a5';
                    const inft = new ethers6.Contract(inftAddr, abi, zgService.provider);
                    let receipt = await zgService.provider.getTransactionReceipt(txHash);
                    for (let attempt = 0; !receipt && attempt < 20; attempt++) {
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        receipt = await zgService.provider.getTransactionReceipt(txHash);
                    }
                    const mintEvent = receipt?.logs
                        ?.map((log) => {
                            try { return inft.interface.parseLog(log); } catch (_) { return null; }
                        })
                        .find((event) => event && event.name === 'PokerHandMinted');
                    if (mintEvent?.args?.tokenId !== undefined) {
                        resolvedTokenId = mintEvent.args.tokenId.toString();
                    }
                }
            } catch (resolveErr) {
                console.warn('[NFT API] Could not resolve 0G tokenId from receipt:', resolveErr.message);
            }
        }

        // Find the NFT record and update
        const result = await NFTClaim.updateOne(
            { 
                playerAddress: { $regex: new RegExp(walletAddress, 'i') },
                gameId: gameId
            },
            { 
                $set: { 
                    txHash: txHash,
                    onchainTokenId: resolvedTokenId ? parseInt(resolvedTokenId, 10) : tokenId,
                    mintedAt: new Date(),
                    ...(walletAddress?.startsWith('0x') ? {
                        chain: '0G',
                        tokenStandard: 'ERC-7857',
                        contractAddress: process.env.ZEROG_INFT_ADDRESS || null
                    } : {
                        chain: 'TRON'
                    })
                } 
            }
        );
        
        if (result.modifiedCount === 0) {
            console.log('[NFT API] No NFT record found to update');
            return res.status(404).json({ success: false, error: 'NFT record not found' });
        }
        
        console.log(`[NFT API] ✅ NFT record updated: ${result.modifiedCount} document(s)`);
        res.json({
            success: true,
            modifiedCount: result.modifiedCount,
            tokenId: resolvedTokenId,
            onchainTokenId: resolvedTokenId
        });
    } catch (error) {
        console.error('[NFT API] Confirm mint error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
