/**
 * 给指定地址铸造CHIP代币
 */

const { TronWeb } = require('tronweb');
const fs = require('fs');

// 配置
const CHIP_ADDRESS = 'TXD7DT9uY5gg4LpdMcatzKGa7GFfSD64uK';
const PRIVATE_KEY = 'b185b511ad8314b5cf787108676581223ce354321428f6efb46ef2370c882905';
const RECIPIENT_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: PRIVATE_KEY
});

async function mintChip() {
    console.log('========================================');
    console.log('💰 铸造CHIP代币');
    console.log('========================================\n');
    
    try {
        // CHIP Token ABI (简化版)
        const chipAbi = [
            {
                "inputs": [{"name": "to", "type": "address"}, {"name": "amount", "type": "uint256"}],
                "name": "mint",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [{"name": "account", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "decimals",
                "outputs": [{"name": "", "type": "uint8"}],
                "stateMutability": "view",
                "type": "function"
            }
        ];
        
        const contract = await tronWeb.contract(chipAbi, CHIP_ADDRESS);
        
        // 获取精度
        const decimals = await contract.decimals().call();
        console.log('代币精度:', decimals.toNumber());
        
        // 铸造数量: 10,000 CHIP
        const mintAmount = 10000 * Math.pow(10, decimals.toNumber());
        console.log('铸造数量: 10,000 CHIP');
        console.log('接收地址:', RECIPIENT_ADDRESS);
        
        // 查询当前余额
        const balanceBefore = await contract.balanceOf(RECIPIENT_ADDRESS).call();
        console.log('\n当前余额:', tronWeb.utils.fromSun(balanceBefore.toString()), 'CHIP');
        
        // 铸造
        console.log('\n正在铸造...');
        const tx = await contract.mint(
            RECIPIENT_ADDRESS,
            mintAmount.toString()
        ).send();
        
        console.log('交易ID:', tx);
        
        // 等待确认
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 查询新余额
        const balanceAfter = await contract.balanceOf(RECIPIENT_ADDRESS).call();
        console.log('\n铸造后余额:', tronWeb.utils.fromSun(balanceAfter.toString()), 'CHIP');
        
        console.log('\n✅ 铸造成功！');
        console.log('请在TronLink钱包中刷新查看');
        
    } catch (error) {
        console.error('\n❌ 错误:', error.message);
        console.log('\n可能的原因:');
        console.log('1. 合约地址不正确');
        console.log('2. 没有mint权限');
        console.log('3. 网络连接问题');
    }
}

mintChip();
