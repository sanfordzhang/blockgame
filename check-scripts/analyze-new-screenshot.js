// 分析新生成的NFT截图
const mongoose = require('mongoose');
const fs = require('fs');

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
    console.log('Token ID:', latestNFT.tokenId);
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
        const buffer = Buffer.from(screenshot, 'base64');
        const path = 'test-results/new-nft-straight-screenshot.png';
        fs.writeFileSync(path, buffer);
        
        // 使用pngjs分析图片
        const { PNG } = require('pngjs');
        try {
            const png = PNG.sync.read(buffer);
            console.log('图片尺寸:', png.width, 'x', png.height);
            console.log('文件大小:', (buffer.length / 1024).toFixed(1), 'KB');
            console.log('保存路径:', path);
            
            // 分析图片颜色分布
            let darkPixels = 0;
            let totalPixels = png.width * png.height;
            for (let i = 0; i < png.data.length; i += 4) {
                const r = png.data[i];
                const g = png.data[i + 1];
                const b = png.data[i + 2];
                // 检查是否是暗色像素 (R+G+B < 100)
                if (r + g + b < 100) {
                    darkPixels++;
                }
            }
            const darkRatio = (darkPixels / totalPixels * 100).toFixed(1);
            console.log('暗色像素占比:', darkRatio + '%');
            
            if (darkRatio > 50) {
                console.log('⚠️ 警告: 暗色像素占比过高，可能仍有黑色阴影问题');
            } else {
                console.log('✅ 截图颜色正常，暗色像素占比合理');
            }
            
            // 检查图片尺寸是否合理
            if (png.height > 2000) {
                console.log('⚠️ 警告: 图片高度过大 (' + png.height + 'px)，可能截取了整个页面');
            } else {
                console.log('✅ 图片尺寸正常');
            }
        } catch (e) {
            console.log('PNG解析错误:', e.message);
        }
    }
    
    // 对比之前的NFT截图
    const oldNFT = await NFTClaim.findOne({ 
        _id: { $ne: latestNFT._id } 
    }).sort({ createdAt: -1 });
    
    if (oldNFT && oldNFT.gameScreenshot) {
        console.log('\n=== 与之前NFT对比 ===');
        const oldBuffer = Buffer.from(oldNFT.gameScreenshot, 'base64');
        const oldPath = 'test-results/old-nft-screenshot-for-compare.png';
        fs.writeFileSync(oldPath, oldBuffer);
        
        const { PNG } = require('pngjs');
        try {
            const oldPng = PNG.sync.read(oldBuffer);
            console.log('之前NFT尺寸:', oldPng.width, 'x', oldPng.height);
            console.log('之前NFT大小:', (oldBuffer.length / 1024).toFixed(1), 'KB');
        } catch (e) {
            console.log('之前NFT解析错误:', e.message);
        }
    }
    
    await mongoose.disconnect();
}

main().catch(console.error);
