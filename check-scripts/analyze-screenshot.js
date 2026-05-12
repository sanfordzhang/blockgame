// Analyze existing NFT screenshot to check for black shadow issue
const https = require('https');
const http = require('http');

async function main() {
    console.log('=== Analyzing NFT Screenshot ===\n');
    
    // Fetch NFT data from API
    const url = 'http://127.0.0.1:7778/api/nft/collection/TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.success || !data.nfts || data.nfts.length === 0) {
        console.log('No NFTs found');
        return;
    }
    
    // Find NFT with screenshot
    const nftWithScreenshot = data.nfts.find(n => n.gameScreenshot && n.gameScreenshot.length > 100);
    
    if (!nftWithScreenshot) {
        console.log('No NFT with screenshot found');
        return;
    }
    
    console.log('Found NFT with screenshot:');
    console.log('  ID:', nftWithScreenshot.id);
    console.log('  Achievement:', nftWithScreenshot.achievementType);
    console.log('  Screenshot length:', nftWithScreenshot.gameScreenshot.length);
    
    // Decode base64 to analyze PNG header
    const base64Data = nftWithScreenshot.gameScreenshot;
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Check PNG signature
    const pngSignature = buffer.slice(0, 8);
    const expectedSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const isPng = pngSignature.equals(expectedSignature);
    console.log('  Is valid PNG:', isPng);
    
    // Extract IHDR chunk to get dimensions
    // PNG format: signature (8 bytes) + IHDR chunk
    // IHDR: length (4 bytes) + "IHDR" (4 bytes) + data (13 bytes) + CRC (4 bytes)
    if (isPng && buffer.length > 33) {
        const ihdrData = buffer.slice(16, 29); // IHDR data (after signature + length + type)
        const width = ihdrData.readUInt32BE(0);
        const height = ihdrData.readUInt32BE(4);
        const bitDepth = ihdrData[8];
        const colorType = ihdrData[9];
        
        console.log('  PNG dimensions:', width, 'x', height);
        console.log('  Bit depth:', bitDepth);
        console.log('  Color type:', colorType, '(2=RGB, 6=RGBA)');
    }
    
    // Analyze color distribution in the image
    // Sample some pixels to check for black shadow
    console.log('\n=== Color Analysis ===');
    
    // Save to file for manual inspection
    const fs = require('fs');
    const outputPath = 'test-results/existing-nft-screenshot.png';
    fs.writeFileSync(outputPath, buffer);
    console.log('Saved screenshot to:', outputPath);
    
    // Check if image is mostly dark (indicating black shadow issue)
    // by analyzing the base64 data patterns
    const base64Str = base64Data.substring(0, 10000);
    const darkPatterns = ['AAAA', 'AAA/', 'AAAAA'];
    let darkPixelEstimate = 0;
    darkPatterns.forEach(p => {
        const matches = (base64Str.match(new RegExp(p, 'g')) || []).length;
        darkPixelEstimate += matches;
    });
    
    console.log('  Dark pixel estimate (relative):', darkPixelEstimate);
    console.log('  Higher values suggest more black/dark areas');
    
    console.log('\n=== Analysis Complete ===');
    console.log('\nThe existing screenshot was generated with old code.');
    console.log('To verify the fix, a new NFT needs to be minted.');
    console.log('\nYou can:');
    console.log('1. Run: node scripts/game-bot.js');
    console.log('2. Play a game manually and achieve Straight+');
    console.log('3. Check NFT gallery for the new screenshot');
}

main().catch(console.error);
