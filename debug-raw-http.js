// 调试 raw HTTP 合约调用
const https = require('https');
const { TronWeb } = require('tronweb');

require('dotenv').config({ path: '.env.testnet' });

const fullHost = 'https://nile.trongrid.io';
const apiKey = process.env.TRONGRID_API_KEY;
const contractAddr = 'TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c';
const playerAddr = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

async function test() {
    // Convert addresses
    const addrHex = TronWeb.address.toHex(playerAddr).slice(2);
    const contractHex = TronWeb.address.toHex(contractAddr).slice(2);
    console.log('Player hex:', addrHex);
    console.log('Contract hex:', contractHex);
    
    // getPlayerInfo(address) - need proper ABI encoding
    // Function selector: first 4 bytes of keccak256("getPlayerInfo(address)")
    // For tron, it's different from Ethereum
    const selector = 'getPlayerInfo(address)';
    
    // Parameter: address padded to 32 bytes (64 hex chars)
    const param = '00000000000000000000000000000000000000000000000000' + addrHex;
    
    // Use server wallet address as owner (not zero address)
    const serverPrivateKey = process.env.TESTNET_PRIVATE_KEY;
    const tw = new TronWeb({ fullHost, privateKey: serverPrivateKey });
    const serverAddr = tw.address.fromPrivateKey(serverPrivateKey);
    
    console.log('Server address:', typeof serverAddr === 'string' ? serverAddr : serverAddr.address);
    const serverHex = TronWeb.address.toHex(typeof serverAddr === 'string' ? serverAddr : serverAddr.address).slice(2);
    
    const postData = JSON.stringify({
        owner_address: typeof serverAddr === 'string' ? serverAddr : serverAddr.address,
        contract_address: contractAddr,
        function_selector: selector,
        parameter: [playerAddr], // visible mode - pass address as array
        visible: true
    });
    
    console.log('\nRequest body:', postData.substring(0,200));
    
    const result = await new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'nile.trongrid.io',
            port: 443,
            path: '/wallet/triggerconstantcontract',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'TRON-PRO-API-KEY': apiKey || ''
            },
            timeout: 15000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('Status:', res.statusCode);
                resolve(JSON.parse(data));
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.write(postData);
        req.end();
    });
    
    console.log('\nResponse:', JSON.stringify(result, null, 2)?.substring(0,500));
    
    if (result && result.result && result.result[0]) {
        const hexResult = result.result[0];
        console.log('\nRaw result hex:', hexResult);
        
        // Decode: (uint256 balance, uint256 lockedAmount, bool isRegistered)
        if (hexResult.length >= 130) {
            const bal = parseInt(hexResult.slice(0, 64), 16);
            const lock = parseInt(hexResult.slice(64, 128), 16);
            console.log(`\nDecoded:`);
            console.log(`  balance: ${bal/1e6} TRX`);
            console.log(`  locked: ${lock/1e6} TRX`);
        }
    }
}

test().catch(console.error);
