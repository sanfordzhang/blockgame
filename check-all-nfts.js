require('dotenv').config({ path: '.env.testnet' });
const { TronWeb } = require('tronweb');

async function check() {
    const tronWeb = new TronWeb({ 
        fullHost: 'https://nile.trongrid.io',
        privateKey: process.env.NILE_PRIVATE_KEY 
    });
    const c = await tronWeb.contract().at('TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC');
    
    const addresses = [
        'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA',
        'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
        'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4',
    ];
    
    for (const addr of addresses) {
        const bal = await c.balanceOf(addr).call();
        console.log(addr, ':', bal.toString());
    }
    
    console.log('\nTokens:');
    for (let i = 1; i <= 15; i++) {
        try {
            const owner = await c.ownerOf(i).call();
            console.log('#' + i + ':', tronWeb.address.fromHex(owner));
        } catch(e) {}
    }
}

check().catch(console.error);
