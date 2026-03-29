require('dotenv').config({ path: '.env.testnet' });
const { TronWeb } = require('tronweb');
const { ethers } = require('ethers');

async function check() {
    const tronWeb = new TronWeb({ 
        fullHost: 'https://nile.trongrid.io',
        privateKey: process.env.NILE_PRIVATE_KEY 
    });
    
    const c = await tronWeb.contract().at('TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC');
    const serverHex = '0x' + tronWeb.address.toHex('TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA').slice(2);
    
    const gameIds = [
        'tournament-1774708298665',
        'tournament-1774710301341',
        'db-1774708327209',
        'db-1774710318187'
    ];
    
    console.log('检查claimRecord:');
    for (const gameId of gameIds) {
        const hash = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ['address', 'string', 'uint256'],
                [serverHex, gameId, 6]
            )
        );
        const claimed = await c.claimRecord(hash).call();
        console.log(gameId + ': ' + (claimed ? '已claim' : '未claim'));
    }
}

check().catch(console.error);
