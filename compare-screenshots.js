// Compare screenshots to verify the fix
const fs = require('fs');

async function main() {
    console.log('=== Screenshot Comparison Analysis ===\n');
    
    const files = [
        { name: 'Old NFT Screenshot (with issue)', path: 'test-results/existing-nft-screenshot.png' },
        { name: 'New Fix Preview', path: 'test-results/screenshot-fix-preview.png' },
        { name: 'Browser Comparison', path: 'test-results/browser-comparison.png' }
    ];
    
    // Check if files exist and analyze
    for (const file of files) {
        try {
            const stats = fs.statSync(file.path);
            const buffer = fs.readFileSync(file.path);
            
            // Check PNG header
            const isPng = buffer.slice(0, 4).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47]));
            
            // Get dimensions from IHDR
            let width = 0, height = 0;
            if (isPng && buffer.length > 24) {
                width = buffer.readUInt32BE(16);
                height = buffer.readUInt32BE(20);
            }
            
            console.log(`${file.name}:`);
            console.log(`  Size: ${(stats.size / 1024).toFixed(1)} KB`);
            console.log(`  Dimensions: ${width} x ${height}`);
            console.log(`  Valid PNG: ${isPng}`);
            
            // Analyze color distribution
            // Sample pixels from different parts of the image
            const base64 = buffer.toString('base64');
            
            // Count dark pixel indicators in base64
            const darkCount = (base64.match(/AAAA/g) || []).length;
            const lightCount = (base64.match(/\/\/\/\/|w8PD|v7\//g) || []).length;
            
            console.log(`  Dark pixel indicators: ${darkCount}`);
            console.log(`  Light pixel indicators: ${lightCount}`);
            console.log(`  Dark/Light ratio: ${(darkCount / (lightCount + 1)).toFixed(2)}`);
            console.log('');
            
        } catch (err) {
            console.log(`${file.name}: File not found or error reading`);
            console.log('');
        }
    }
    
    console.log('=== Visual Comparison ===');
    console.log('Please open the following files in your image viewer:');
    console.log('1. test-results/existing-nft-screenshot.png - Old screenshot (check for black shadow)');
    console.log('2. test-results/screenshot-fix-preview.png - New fix preview');
    console.log('3. test-results/browser-comparison.png - Browser screenshot for reference');
    console.log('\nIf the new screenshot looks brighter without black shadows, the fix works!');
}

main().catch(console.error);
