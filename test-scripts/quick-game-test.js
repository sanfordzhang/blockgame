const CDP = require('chrome-remote-interface');
const axios = require('axios');

const API_BASE = 'http://127.0.0.1:7778';
const PLAYER1 = { address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv' };

async function main() {
    console.log('🎮 开始游戏流程测试\n');

    // 1. 连接 CDP
    const client = await CDP({ port: 9222 });
    const { Runtime, Page } = client;
    await Runtime.enable();
    await Page.enable();
    console.log('✅ CDP 连接成功\n');

    // 2. 等待页面加载
    await new Promise(r => setTimeout(r, 3000));
    console.log('✅ 页面已加载\n');

    // 3. 截图
    const screenshot1 = await Page.captureScreenshot({ format: 'png' });
    require('fs').writeFileSync('/tmp/game-1.png', screenshot1.data, 'base64');
    console.log('📸 截图保存: /tmp/game-1.png\n');

    // 4. 检查顺子牌型
    const checkRes = await axios.post(`${API_BASE}/api/nft/check-achievement`, {
        holeCards: ['Ah', 'Kh'],
        board: ['Qc', 'Jd', 'Ts', '2c', '3d']
    });
    if (checkRes.data.achievement) {
        console.log('🎯 顺子检测:', checkRes.data.achievement.name);
        console.log('   牌型:', checkRes.data.achievement.description, '\n');
    } else {
        console.log('⚠️  未检测到成就\n');
    }

    // 5. 准备铸造
    const prepareRes = await axios.post(`${API_BASE}/api/nft/prepare-mint`, {
        walletAddress: PLAYER1.address,
        achievementType: 'STRAIGHT',
        gameId: `test-${Date.now()}`,
        cards: ['Ah', 'Kh', 'Qc', 'Jd', 'Ts']
    });
    console.log('✅ 铸造准备完成\n');

    // 6. 获取 NFT 列表
    const nftsRes = await axios.get(`${API_BASE}/api/nft/list/${PLAYER1.address}`);
    console.log('📋 NFT 总数:', nftsRes.data.nfts.length);
    if (nftsRes.data.nfts.length > 0) {
        const latest = nftsRes.data.nfts[0];
        console.log('   最新 NFT #' + latest.tokenId + ':', latest.achievementType);
        console.log('   卡牌:', latest.cards?.map(c => c.rank + c.suit).join(' '));
    }
    console.log();

    // 7. 测试元数据
    if (nftsRes.data.nfts.length > 0) {
        const tokenId = nftsRes.data.nfts[0].tokenId;
        const metaRes = await axios.get(`${API_BASE}/api/nft/metadata/6/${tokenId}`);
        console.log('🎨 元数据测试:');
        console.log('   Name:', metaRes.data.name);
        console.log('   Description:', metaRes.data.description);
        console.log('   Image type:', metaRes.data.image.substring(0, 30) + '...');
    }

    await client.close();
    console.log('\n✅ 测试完成！');
}

main().catch(console.error);
