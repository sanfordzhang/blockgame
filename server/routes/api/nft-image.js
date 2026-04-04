const express = require('express');
const sharp = require('sharp');
const router = express.Router();

router.get('/:tokenId', async (req, res) => {
    const { tokenId } = req.params;
    const { type = 'STRAIGHT', cards = '' } = req.query;

    const svg = Buffer.from(`<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="400" fill="#1a1a2e"/>
        <rect x="20" y="20" width="360" height="360" rx="16" fill="#16213e" stroke="#4ecca3" stroke-width="2"/>
        <text x="200" y="100" font-size="22" fill="#4ecca3" text-anchor="middle" font-weight="bold" font-family="Arial">${type}</text>
        <text x="200" y="210" font-size="28" fill="#ffffff" text-anchor="middle" font-family="monospace">${cards}</text>
        <text x="200" y="330" font-size="16" fill="#888888" text-anchor="middle" font-family="Arial">#${tokenId}</text>
    </svg>`);

    try {
        const png = await sharp(svg).png().toBuffer();
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(png);
    } catch (e) {
        // fallback to SVG
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(svg);
    }
});

module.exports = router;
