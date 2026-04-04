/**
 * 生成 on-chain metadata (data URI)
 */

function generateMetadata(achievementType, tokenId, cards) {
    const metadata = {
        name: `${achievementType} #${tokenId}`,
        description: `Poker achievement: ${achievementType} | Cards: ${cards}`,
        image: generateCardImage(cards),
        attributes: [
            { trait_type: "Achievement", value: achievementType },
            { trait_type: "Cards", value: cards }
        ]
    };

    const json = JSON.stringify(metadata);
    const base64 = Buffer.from(json).toString('base64');
    return `data:application/json;base64,${base64}`;
}

function generateCardImage(cards) {
    // 简单的 SVG 卡片图像
    const cardArray = cards.split(' ');
    const svg = `<svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="100" fill="#1a472a"/>
        <text x="200" y="50" font-size="24" fill="white" text-anchor="middle">${cards}</text>
    </svg>`;

    const base64 = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
}

module.exports = { generateMetadata };

// 测试
if (require.main === module) {
    const metadata = generateMetadata('Straight', 20, '5h 6h 7h 8h 9d');
    console.log('Metadata URI length:', metadata.length);
    console.log('First 200 chars:', metadata.substring(0, 200));

    // 解码验证
    const base64Data = metadata.split(',')[1];
    const decoded = Buffer.from(base64Data, 'base64').toString();
    console.log('\nDecoded:', JSON.parse(decoded));
}
