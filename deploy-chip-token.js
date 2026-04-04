/**
 * 部署CHIP Token合约
 */

const { TronWeb } = require('tronweb');
const fs = require('fs');
const path = require('path');

// 配置
const PRIVATE_KEY = 'b185b511ad8314b5cf787108676581223ce354321428f6efb46ef2370c882905';

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: PRIVATE_KEY
});

async function deployChipToken() {
    console.log('========================================');
    console.log('🚀 部署CHIP Token合约');
    console.log('========================================\n');
    
    try {
        // 读取编译后的合约
        const buildPath = path.join(__dirname, 'build/contracts/ChipToken.json');
        
        if (!fs.existsSync(buildPath)) {
            console.log('❌ 未找到编译文件，请先编译合约:');
            console.log('   npx tronbox compile\n');
            return;
        }
        
        const contractJson = JSON.parse(fs.readFileSync(buildPath, 'utf8'));
        const abi = contractJson.abi;
        const bytecode = contractJson.bytecode;
        
        console.log('合约已编译，准备部署...\n');
        
        // 部署参数
        const initialSupply = '100000000000000'; // 100,000,000 CHIP (6 decimals)
        
        console.log('部署参数:');
        console.log('  初始供应量: 100,000,000 CHIP');
        console.log('  网络: TRON Nile测试网\n');
        
        // 部署合约
        console.log('正在部署...');
        
        const transaction = await tronWeb.transactionBuilder.createSmartContract({
            abi: abi,
            bytecode: bytecode,
            feeLimit: 1000_000_000,
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10_000_000,
            parameters: [initialSupply]
        });
        
        const signedTransaction = await tronWeb.trx.sign(transaction);
        const result = await tronWeb.trx.sendRawTransaction(signedTransaction);
        
        console.log('\n交易ID:', result.txid);
        
        // 等待确认
        console.log('\n等待确认...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // 获取合约地址
        const contractAddress = tronWeb.address.fromHex(
            signedTransaction.raw_data.contract[0].parameter.value.new_contract.address
        );
        
        console.log('\n✅ 部署成功！');
        console.log('合约地址:', contractAddress);
        
        // 验证合约
        console.log('\n验证合约...');
        const contract = await tronWeb.contract().at(contractAddress);
        const name = await contract.name().call();
        const symbol = await contract.symbol().call();
        const decimals = await contract.decimals().call();
        const totalSupply = await contract.totalSupply().call();
        
        console.log('  名称:', name);
        console.log('  符号:', symbol);
        console.log('  精度:', decimals.toNumber());
        console.log('  总供应量:', tronWeb.utils.fromSun(totalSupply.toString()), symbol);
        
        // 保存部署信息
        const deployInfo = {
            contractAddress: contractAddress,
            txid: result.txid,
            deployedAt: new Date().toISOString(),
            name: name,
            symbol: symbol,
            decimals: decimals.toNumber(),
            totalSupply: totalSupply.toString()
        };
        
        fs.writeFileSync(
            path.join(__dirname, 'chip-token-deployment.json'),
            JSON.stringify(deployInfo, null, 2)
        );
        
        console.log('\n📄 部署信息已保存到: chip-token-deployment.json');
        
        // 更新deployments/nile.json
        const deploymentsPath = path.join(__dirname, 'deployments/nile.json');
        const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
        deployments.chipTokenContract = contractAddress;
        deployments.chipTokenDeployedAt = new Date().toISOString();
        fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
        
        console.log('deployments/nile.json 已更新');
        
        console.log('\n========================================');
        console.log('📱 如何在TronLink中查看');
        console.log('========================================');
        console.log('\n1. 打开TronLink钱包');
        console.log('2. 切换到 "TRON Nile测试网"');
        console.log('3. 点击 "资产" 标签');
        console.log('4. 点击 "+" 或 "添加代币"');
        console.log('5. 输入合约地址:', contractAddress);
        console.log('6. 点击确认\n');
        
    } catch (error) {
        console.error('\n❌ 部署失败:', error.message);
        console.error(error.stack);
    }
}

deployChipToken();
