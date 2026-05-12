/**
 * 对比截图文件
 */
const fs = require('fs');

console.log('=== 截图对比分析 ===\n');

const files = [
    { name: '浏览器视图', path: 'test-results/game-browser-view.png' },
    { name: '方法1-整页', path: 'test-results/game-method1-fullpage.png' },
    { name: '方法2-playarea', path: 'test-results/game-method2-playarea.png' },
    { name: '方法3-修复', path: 'test-results/game-method3-fixed.png' },
    { name: '现有NFT截图', path: 'test-results/existing-nft-for-analysis.png' }
];

files.forEach(file => {
    try {
        const stats = fs.statSync(file.path);
        const buffer = fs.readFileSync(file.path);
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        
        // 计算平均亮度（采样分析）
        const base64 = buffer.toString('base64');
        const darkPatterns = (base64.match(/AAAA/g) || []).length;
        const midPatterns = (base64.match(/\/\/8|w8P|MDA/g) || []).length;
        
        console.log(`${file.name}:`);
        console.log(`  尺寸: ${width} x ${height}`);
        console.log(`  大小: ${(stats.size / 1024).toFixed(1)} KB`);
        console.log(`  暗色模式: ${darkPatterns}, 中间色模式: ${midPatterns}`);
        console.log('');
    } catch (e) {
        console.log(`${file.name}: 文件不存在\n`);
    }
});

console.log('=== 分析结论 ===');
console.log('\n请打开以下文件进行视觉对比:');
console.log('1. test-results/game-browser-view.png - 浏览器实际显示');
console.log('2. test-results/game-method2-playarea.png - 原始截图方法');
console.log('3. test-results/game-method3-fixed.png - 修复后截图方法');
console.log('4. test-results/existing-nft-for-analysis.png - 现有NFT截图');
console.log('\n对比要点:');
console.log('- 截图是否有黑色阴影覆盖游戏内容？');
console.log('- 截图背景是否与浏览器显示一致？');
console.log('- 游戏元素是否完整显示？');
