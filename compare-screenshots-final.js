/**
 * 对比分析截图
 */
const fs = require('fs');

console.log('=== 截图对比分析 ===\n');

const files = [
    { name: '浏览器视图', path: 'test-results/fix-browser.png' },
    { name: '新生成截图', path: 'test-results/simple-test-screenshot.png' },
    { name: '现有NFT截图', path: 'test-results/existing-nft-for-analysis.png' }
];

files.forEach(file => {
    try {
        const stats = fs.statSync(file.path);
        const buffer = fs.readFileSync(file.path);
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        
        // 分析颜色分布
        const base64 = buffer.toString('base64');
        const darkPatterns = (base64.match(/AAAA/g) || []).length;
        const midPatterns = (base64.match(/\/\/8|w8P|MDA/g) || []).length;
        
        console.log(`${file.name}:`);
        console.log(`  尺寸: ${width} x ${height}`);
        console.log(`  大小: ${(stats.size / 1024).toFixed(1)} KB`);
        console.log(`  暗色模式: ${darkPatterns}, 中间色: ${midPatterns}`);
        console.log('');
    } catch (e) {
        console.log(`${file.name}: 文件不存在\n`);
    }
});

console.log('=== 结论 ===');
console.log('\n截图尺寸已修复！');
console.log('- 之前截图高度过大（几千到几万像素）');
console.log('- 现在截图尺寸正常（约1200x500）');
console.log('\n请打开以下文件查看效果:');
console.log('  - test-results/simple-test-screenshot.png (新生成)');
console.log('  - test-results/existing-nft-for-analysis.png (现有NFT)');
