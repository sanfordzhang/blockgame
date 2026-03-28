// 分析最新NFT截图
const mongoose = require('mongoose');

async function main() {
    await mongoose.connect('mongodb://localhost:27017/poker_game');
    
    const NFTClaim = mongoose.model('NFTClaim', new mongoose.Schema({}, { strict: false }), 'nftclaims');
    
    // 获取最新的NFT记录
    const latestNFT = await NFTClaim.findOne().sort({ createdAt: -1 });
    
    if (!latestNFT) {
        console.log('没有找到NFT记录');
        return;
    }
    
    console.log('=== 最新NFT记录 ===');
    console.log('ID:', latestNFT._id);
    console.log('成就类型:', latestNFT.achievementType);
    console.log('牌型描述:', latestNFT.handDescription);
    console.log('游戏ID:', latestNFT.gameId);
    console.log('创建时间:', latestNFT.createdAt);
    
    // 分析截图
    if (latestNFT.gameScreenshot) {
        const screenshot = latestNFT.gameScreenshot;
        console.log('\n=== 截图分析 ===');
        console.log('截图Base64长度:', screenshot.length);
        
        // 解码并保存
        const fs = require('fs');
        const buffer = Buffer.from(screenshot, 'base64');
        const path = 'test-results/new-nft-screenshot.png';
        fs.writeFileSync(path, buffer);
        
        // 分析图片尺寸
        const { PNG } = require('pngjs');
        try {
            const png = PNG.sync.read(buffer);
            console.log('图片尺寸:', png.width, 'x', png.height);
            console.log('文件大小:', buffer.length, 'bytes');
            console.log('保存路径:', path);
        } catch (e) {
            console.log('PNG解析错误:', e.message);
            console.log('保存原始数据用于分析');
        }
    }
    
    // 列出所有NFT记录
    const allNFTs = await NFTClaim.find().sort({ createdAt: -1 }).limit(5);
    console.log('\n=== 最近5条NFT记录 ===');
    allNFTs.forEach((nft, i) => {
        console.log(`${i+1}. ${nft.achievementType} - ${nft.handDescription?.substring(0, 30)}... (${nft.createdAt})`);
    });
    
    await mongoose.disconnect();
}

main().catch(console.error);
