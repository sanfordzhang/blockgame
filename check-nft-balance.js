require('dotenv').config({ path: '.env.testnet' });
const { TronWeb } = require('tronweb');

async function check() {
    const tronWeb = new TronWeb({ 
        fullHost: 'https://nile.trongrid.io',
        privateKey: process.env.NILE_PRIVATE_KEY 
    });
    const c = await tronWeb.contract().at('TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC');
    
    // 检查部署者地址的NFT
    const deployerBal = await c.balanceOf('TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA').call();
    console.log('部署者NFT:', deployerBal.toString());
    
    // 检查玩家地址的NFT
    const playerBal = await c.balanceOf('TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv').call();
    console.log('玩家TU8rNFT:', playerBal.toString());
    
    // 尝试检查token 1-10的owner
    console.log('\n检查Token Owners:');
    for (let i = 1; i <= 10; i++) {
        try {
            const owner = await c.ownerOf(i).call();
            console.log(`Token #${i} owner:`, tronWeb.address.fromHex(owner));
        } catch(e) {
            // Token doesn't exist
        }
    }
}

check().catch(console.error);
