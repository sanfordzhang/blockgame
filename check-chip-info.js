/**
 * CHIP Token 信息查询
 */

const { TronWeb } = require('tronweb');
const tronWeb = new TronWeb({ fullHost: 'https://nile.trongrid.io' });

const CHIP_ADDRESS = 'TXD7DT9uY5gg4LpdMcatzKGa7GFfSD64uK';
const YOUR_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

async function main() {
    console.log('========================================');
    console.log('🪙 CHIP Token 信息查询');
    console.log('========================================\n');
    
    const contract = await tronWeb.contract().at(CHIP_ADDRESS);
    
    // 合约信息
    const name = await contract.name().call();
    const symbol = await contract.symbol().call();
    const decimals = await contract.decimals().call();
    const totalSupply = await contract.totalSupply().call();
    
    console.log('📋 合约信息:');
    console.log('  合约地址:', CHIP_ADDRESS);
    console.log('  名称:', name);
    console.log('  符号:', symbol);
    console.log('  精度:', decimals.toNumber());
    console.log('  总供应量:', tronWeb.utils.fromSun(totalSupply.toString()), symbol);
    
    // 您的余额
    const balance = await contract.balanceOf(YOUR_ADDRESS).call();
    const balanceNum = tronWeb.utils.fromSun(balance.toString());
    
    console.log('\n💰 您的余额:');
    console.log('  地址:', YOUR_ADDRESS);
    console.log('  余额:', balanceNum, symbol);
    
    console.log('\n========================================');
    console.log('📱 如何在TronLink中查看');
    console.log('========================================\n');
    
    console.log('方法1: 手动添加代币');
    console.log('  1. 打开TronLink钱包');
    console.log('  2. 切换到 "TRON Nile测试网"');
    console.log('  3. 点击 "资产" 标签');
    console.log('  4. 点击右上角 "+" 或 "添加代币"');
    console.log('  5. 输入合约地址:', CHIP_ADDRESS);
    console.log('  6. 点击确认，等待加载');
    console.log('  7. CHIP代币将显示在资产列表中\n');
    
    console.log('方法2: 通过区块链浏览器查看');
    console.log('  访问: https://nile.tronscan.org/#/token20/' + CHIP_ADDRESS);
    console.log('  可以查看合约详情、转账记录等\n');
    
    console.log('========================================');
    console.log('💱 TRX与CHIP兑换方案');
    console.log('========================================\n');
    
    console.log('方案1: 通过游戏系统兑换（推荐）');
    console.log('  1. 访问 http://127.0.0.1:3001/wallet');
    console.log('  2. 点击 "存款" 按钮');
    console.log('  3. 输入TRX数量');
    console.log('  4. 确认交易');
    console.log('  5. 系统自动发放对应数量的CHIP\n');
    
    console.log('方案2: 部署DEX交易所');
    console.log('  - 创建流动性池合约');
    console.log('  - 设置TRX/CHIP交易对');
    console.log('  - 用户可自由兑换\n');
    
    console.log('方案3: 直接转账');
    console.log('  - 管理员可直接mint CHIP给用户');
    console.log('  - 或通过合约的transfer函数\n');
    
    console.log('========================================');
    console.log('🏦 如何给钱包充值CHIP');
    console.log('========================================\n');
    
    console.log('方法1: 管理员铸造（测试环境）');
    console.log('  - 管理员可调用mint函数');
    console.log('  - 需要有minter权限\n');
    
    console.log('方法2: 游戏获得');
    console.log('  - 参与游戏赢得筹码');
    console.log('  - 提现到钱包\n');
    
    console.log('方法3: 其他用户转账');
    console.log('  - 拥有CHIP的用户可转账给你\n');
    
    console.log('\n✅ 查询完成！');
}

main().catch(console.error);
