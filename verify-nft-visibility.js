/**
 * 验证NFT是否可以在TronLink钱包中显示
 * 
 * 问题诊断：
 * 1. NFT是否在链上？ ✓ (玩家TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv有1个NFT #1)
 * 2. 合约是否符合ERC721标准？ ✓ (实现了name, symbol, tokenURI, supportsInterface等)
 * 3. Metadata是否可访问？ ✗ (baseURI是本地地址127.0.0.1，TronLink无法访问)
 * 
 * 解决方案：
 * 方案A：手动在TronLink添加NFT合约
 *   1. 确保TronLink连接到Nile测试网
 *   2. 钱包 → 收藏品 → 添加/导入 → 输入合约地址
 *   3. 合约地址: TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC
 * 
 * 方案B：更新baseURI为公网地址
 *   1. 需要一个公网可访问的metadata服务
 *   2. 调用合约的setBaseURI方法更新
 */

require('dotenv').config({ path: '.env.testnet' });
const { TronWeb } = require('tronweb');

async function main() {
    const tronWeb = new TronWeb({ 
        fullHost: 'https://nile.trongrid.io',
        privateKey: process.env.NILE_PRIVATE_KEY 
    });
    
    const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';
    const PLAYER_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
    
    const c = await tronWeb.contract().at(NFT_CONTRACT);
    
    console.log('========================================');
    console.log('🔍 NFT可见性验证');
    console.log('========================================\n');
    
    // 合约信息
    const name = await c.name().call();
    const symbol = await c.symbol().call();
    const baseURI = await c.baseURI().call();
    
    console.log('📋 合约信息:');
    console.log('   名称:', name);
    console.log('   符号:', symbol);
    console.log('   合约地址:', NFT_CONTRACT);
    console.log('   baseURI:', baseURI);
    console.log('');
    
    // 玩家余额
    const balance = await c.balanceOf(PLAYER_ADDRESS).call();
    console.log('👤 玩家:', PLAYER_ADDRESS);
    console.log('   NFT数量:', balance.toString());
    
    // 列出玩家拥有的NFT
    if (parseInt(balance.toString()) > 0) {
        console.log('   NFT列表:');
        for (let i = 1; i <= 20; i++) {
            try {
                const owner = await c.ownerOf(i).call();
                if (tronWeb.address.fromHex(owner) === PLAYER_ADDRESS) {
                    const uri = await c.tokenURI(i).call();
                    console.log(`   - #${i}: ${uri}`);
                }
            } catch(e) {}
        }
    }
    
    console.log('\n========================================');
    console.log('⚠️  问题诊断:');
    console.log('========================================');
    console.log('baseURI是本地地址，TronLink无法访问。');
    console.log('这会导致NFT图片和属性无法显示，但NFT应该仍然可见。');
    console.log('\n如果TronLink完全不显示NFT，请检查:');
    console.log('1. 是否连接到Nile测试网');
    console.log('2. 尝试手动添加合约地址');
    console.log('');
    console.log('📌 TronLink添加NFT步骤:');
    console.log('   1. 打开TronLink钱包');
    console.log('   2. 切换到Nile测试网');
    console.log('   3. 进入"收藏品"标签页');
    console.log('   4. 点击"添加"或"+"按钮');
    console.log('   5. 输入合约地址: ' + NFT_CONTRACT);
    console.log('========================================');
}

main().catch(console.error);
