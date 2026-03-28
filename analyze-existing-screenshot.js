/**
 * 分析现有NFT截图 - 检查黑色阴影问题
 */
const fs = require('fs');

async function main() {
    console.log('=== 分析现有NFT截图 ===\n');
    
    // 获取最新的NFT截图
    const response = await fetch('http://127.0.0.1:7778/api/nft/collection/TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv');
    const data = await response.json();
    
    if (!data.success || !data.nfts || data.nfts.length === 0) {
        console.log('没有找到NFT');
        return;
    }
    
    // 找到有截图的NFT
    const nft = data.nfts.find(n => n.gameScreenshot && n.gameScreenshot.length > 100);
    if (!nft) {
        console.log('没有找到有截图的NFT');
        return;
    }
    
    console.log('NFT信息:');
    console.log('  ID:', nft.id);
    console.log('  类型:', nft.achievementType);
    console.log('  描述:', nft.handDescription);
    console.log('  截图大小:', nft.gameScreenshot.length, 'bytes');
    
    // 解码截图
    const buffer = Buffer.from(nft.gameScreenshot, 'base64');
    
    // 检查PNG信息
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    console.log('  PNG尺寸:', width, 'x', height);
    
    // 保存截图
    fs.writeFileSync('test-results/existing-nft-for-analysis.png', buffer);
    console.log('\n已保存到: test-results/existing-nft-for-analysis.png');
    
    // 分析像素颜色分布
    console.log('\n=== 像素分析 ===');
    
    // PNG数据从第8字节开始是IHDR
    // 跳过PNG签名和IHDR，找到IDAT块
    let offset = 8;
    let foundIDAT = false;
    let idatData = [];
    
    while (offset < buffer.length - 8) {
        const chunkLength = buffer.readUInt32BE(offset);
        const chunkType = buffer.slice(offset + 4, offset + 8).toString('ascii');
        
        if (chunkType === 'IDAT') {
            foundIDAT = true;
            idatData.push(buffer.slice(offset + 8, offset + 8 + chunkLength));
        }
        
        if (chunkType === 'IEND') break;
        
        offset += 12 + chunkLength; // length(4) + type(4) + data + crc(4)
    }
    
    console.log('  IDAT块数量:', idatData.length);
    
    // 分析base64数据中的颜色模式
    const base64Str = nft.gameScreenshot;
    
    // 统计不同颜色区域的base64模式
    const patterns = {
        black: (base64Str.match(/AAAA/g) || []).length,
        dark: (base64Str.match(/\/\/8|w8P|wMD/g) || []).length,
        light: (base64Str.match(/\/\/\/\/\/|8PDw|PDw8/g) || []).length,
        colored: (base64Str.match(/[a-zA-Z]{4}/g) || []).length
    };
    
    console.log('  颜色模式统计:');
    console.log('    黑色区域(AAAA):', patterns.black);
    console.log('    深色区域:', patterns.dark);
    console.log('    浅色区域:', patterns.light);
    console.log('    彩色区域:', patterns.colored);
    
    // 计算黑/彩比例
    const blackRatio = patterns.black / (patterns.colored + 1);
    console.log('  黑色/彩色比例:', blackRatio.toFixed(2));
    
    if (blackRatio > 0.5) {
        console.log('\n⚠️ 检测到大量黑色区域，可能存在黑色阴影问题');
    } else {
        console.log('\n✅ 黑色区域比例正常');
    }
    
    console.log('\n=== 分析完成 ===');
    console.log('\n请打开 test-results/existing-nft-for-analysis.png 查看截图');
    console.log('如果截图看起来有黑色阴影覆盖，需要检查:');
    console.log('1. html2canvas 是否正确处理了背景');
    console.log('2. CSS伪元素(:before/:after)是否被捕获');
    console.log('3. backdrop-filter 效果是否被正确渲染');
}

main().catch(err => {
    console.error('错误:', err);
    process.exit(1);
});
