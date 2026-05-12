const fs = require('fs');

console.log('=== Screenshot Comparison ===\n');

const files = [
    { name: 'Old Method', path: 'test-results/screenshot-old-method.png' },
    { name: 'New Fix', path: 'test-results/screenshot-new-fix.png' },
    { name: 'Browser View', path: 'test-results/browser-nft-page.png' },
    { name: 'Existing NFT', path: 'test-results/existing-nft-screenshot.png' }
];

files.forEach(file => {
    try {
        const stats = fs.statSync(file.path);
        const buffer = fs.readFileSync(file.path);
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        
        console.log(`${file.name}:`);
        console.log(`  Size: ${(stats.size / 1024).toFixed(1)} KB`);
        console.log(`  Dimensions: ${width} x ${height}`);
        console.log('');
    } catch (e) {
        console.log(`${file.name}: Not found\n`);
    }
});

console.log('=== Analysis ===');
console.log('1. Open test-results/screenshot-old-method.png and test-results/screenshot-new-fix.png');
console.log('2. Compare them to see if the black shadow issue is fixed');
console.log('3. The new fix should have a smooth gradient background');
