const { TronWeb } = require('tronweb');

const PRIVATE_KEY = 'b185b511ad8314b5cf787108676581223ce354321428f6efb46ef2370c882905';

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: PRIVATE_KEY
});

const CHIP_ADDRESS = 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';
const DEPLOYER = 'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA';

(async () => {
    console.log('========================================');
    console.log('✅ CHIP Token 部署验证');
    console.log('========================================\n');
    
    console.log('合约地址:', CHIP_ADDRESS);
    
    const contract = await tronWeb.contract().at(CHIP_ADDRESS);
    
    const name = await contract.name().call();
    const symbol = await contract.symbol().call();
    const decimals = await contract.decimals().call();
    const totalSupply = await contract.totalSupply().call();
    const balance = await contract.balanceOf(DEPLOYER).call();
    
    console.log('\n合约信息:');
    console.log('  名称:', name);
    console.log('  符号:', symbol);
    console.log('  精度:', decimals.toNumber ? decimals.toNumber() : decimals);
    console.log('  总供应量:', Number(totalSupply) / 1e6, symbol);
    console.log('  部署者余额:', Number(balance) / 1e6, symbol);
    
    // 保存
    const fs = require('fs');
    const deployments = JSON.parse(fs.readFileSync('deployments/nile.json', 'utf8'));
    deployments.chipTokenContract = CHIP_ADDRESS;
    deployments.chipTokenDeployedAt = new Date().toISOString();
    fs.writeFileSync('deployments/nile.json', JSON.stringify(deployments, null, 2));
    
    console.log('\n✅ 已更新到 deployments/nile.json');
    
    console.log('\n========================================');
    console.log('📱 如何在TronLink中查看');
    console.log('========================================');
    console.log('\n1. 打开TronLink钱包');
    console.log('2. 切换到 TRON Nile测试网');
    console.log('3. 点击 "资产" 标签');
    console.log('4. 点击 "+" 或 "添加代币"');
    console.log('5. 输入合约地址:', CHIP_ADDRESS);
    console.log('6. 点击确认\n');
})();
