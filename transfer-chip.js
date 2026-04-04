/**
 * 给用户钱包充值CHIP代币
 */

const { TronWeb } = require('tronweb');

const PRIVATE_KEY = 'b185b511ad8314b5cf787108676581223ce354321428f6efb46ef2370c882905';
const CHIP_ADDRESS = 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';
const RECIPIENT = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';  // 您的钱包地址

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: PRIVATE_KEY
});

async function transferChip() {
    console.log('========================================');
    console.log('💰 转账CHIP代币');
    console.log('========================================\n');
    
    const contract = await tronWeb.contract().at(CHIP_ADDRESS);
    
    // 转账数量: 50,000 CHIP
    const amount = 50000 * 1e6;  // 6 decimals
    
    console.log('转账信息:');
    console.log('  接收地址:', RECIPIENT);
    console.log('  转账数量: 50,000 CHIP\n');
    
    // 检查余额
    const balanceBefore = await contract.balanceOf(RECIPIENT).call();
    console.log('当前余额:', Number(balanceBefore) / 1e6, 'CHIP');
    
    // 转账
    console.log('\n正在转账...');
    
    const tx = await contract.transfer(
        RECIPIENT,
        amount.toString()
    ).send({
        feeLimit: 100_000_000
    });
    
    console.log('交易ID:', tx);
    
    // 等待确认
    await new Promise(r => setTimeout(r, 5000));
    
    // 检查新余额
    const balanceAfter = await contract.balanceOf(RECIPIENT).call();
    console.log('\n转账后余额:', Number(balanceAfter) / 1e6, 'CHIP');
    
    console.log('\n✅ 转账成功！');
    console.log('\n请在TronLink钱包中:');
    console.log('1. 添加代币合约: ' + CHIP_ADDRESS);
    console.log('2. 刷新查看余额');
}

transferChip().catch(console.error);
