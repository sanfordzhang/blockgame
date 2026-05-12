/**
 * 使用能量租赁部署CHIP Token
 */

const { TronWeb } = require('tronweb');

const PRIVATE_KEY = 'b185b511ad8314b5cf787108676581223ce354321428f6efb46ef2370c882905';
const DEPLOYER_ADDRESS = 'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA';

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: PRIVATE_KEY
});

async function deploy() {
    console.log('========================================');
    console.log('🚀 部署CHIP Token (使用TRX支付)');
    console.log('========================================\n');
    
    try {
        // 读取合约
        const fs = require('fs');
        const path = require('path');
        const contractJson = JSON.parse(fs.readFileSync('build/contracts/ChipToken.json', 'utf8'));
        
        const abi = contractJson.abi;
        const bytecode = contractJson.bytecode;
        
        // 初始供应量: 100,000,000 CHIP (6 decimals = 100000000000000)
        const initialSupply = '100000000000000';
        
        console.log('合约准备完成');
        console.log('初始供应量: 100,000,000 CHIP\n');
        
        // 方式1: 使用tronWeb的deploy方法
        console.log('开始部署...\n');
        
        const contractInstance = await tronWeb.contract().new({
            abi: abi,
            bytecode: bytecode,
            feeLimit: 1000_000_000,  // 最大费用 1000 TRX
            callValue: 0,
            userFeePercentage: 100,   // 用户支付100%费用
            originEnergyLimit: 10_000_000,
            parameters: [initialSupply]
        });
        
        console.log('\n✅ 部署成功！');
        console.log('合约地址:', contractInstance.address);
        
        // 验证
        const name = await contractInstance.name().call();
        const symbol = await contractInstance.symbol().call();
        const decimals = await contractInstance.decimals().call();
        const totalSupply = await contractInstance.totalSupply().call();
        
        console.log('\n合约信息:');
        console.log('  名称:', name);
        console.log('  符号:', symbol);
        console.log('  精度:', decimals.toNumber());
        console.log('  总供应量:', (totalSupply.toNumber() / 1e6).toLocaleString(), symbol);
        
        // 检查部署者余额
        const balance = await contractInstance.balanceOf(DEPLOYER_ADDRESS).call();
        console.log('  部署者余额:', (balance.toNumber() / 1e6).toLocaleString(), symbol);
        
        // 保存部署信息
        const deploymentInfo = {
            contractAddress: contractInstance.address,
            deployedAt: new Date().toISOString(),
            name: name,
            symbol: symbol,
            decimals: decimals.toNumber(),
            totalSupply: totalSupply.toString()
        };
        
        fs.writeFileSync('chip-token-deployment.json', JSON.stringify(deploymentInfo, null, 2));
        
        // 更新deployments
        const deployments = JSON.parse(fs.readFileSync('deployments/nile.json', 'utf8'));
        deployments.chipTokenContract = contractInstance.address;
        deployments.chipTokenDeployedAt = new Date().toISOString();
        fs.writeFileSync('deployments/nile.json', JSON.stringify(deployments, null, 2));
        
        console.log('\n✅ 部署信息已保存');
        
        return contractInstance.address;
        
    } catch (error) {
        console.error('\n❌ 部署失败:', error.message);
        
        if (error.message.includes('energy')) {
            console.log('\n💡 解决方案:');
            console.log('1. 从水龙头获取测试TRX: https://nileex.io/join/getJoinPage');
            console.log('2. 等待几分钟后重试');
        }
        
        throw error;
    }
}

deploy().then(address => {
    if (address) {
        console.log('\n========================================');
        console.log('📱 在TronLink中查看');
        console.log('========================================');
        console.log('\n1. 打开TronLink → 资产');
        console.log('2. 点击 "+" 添加代币');
        console.log('3. 输入合约地址:', address);
        console.log('4. 确认添加\n');
    }
}).catch(() => process.exit(1));
