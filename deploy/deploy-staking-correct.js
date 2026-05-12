/**
 * 重新部署质押合约（使用正确的 CHIP Token 地址）
 * 
 * 问题：当前质押合约 TBrmQ4pGBYYKrRv8SYaLACkBodwA7f1RGW 指向错误的 CHIP Token 地址
 * 解决：重新部署一个新的质押合约，指向正确的 CHIP Token 地址
 */

const { TronWeb } = require('tronweb');
const fs = require('fs');
const path = require('path');

// 正确的 CHIP Token 地址
const CHIP_TOKEN_ADDRESS = 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';

// 旧的质押合约（错误）
const OLD_STAKING = 'TBrmQ4pGBYYKrRv8SYaLACkBodwA7f1RGW';

// 部署者私钥
const PRIVATE_KEY = process.env.PRIVATE_KEY || 'b185b511ad8314b5cf787108676581223ce354321428f6efb46ef2370c882905';

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: PRIVATE_KEY
});

async function main() {
    console.log('========================================');
    console.log('重新部署质押合约');
    console.log('========================================\n');
    
    // 获取部署者地址
    const deployer = tronWeb.address.fromPrivateKey(PRIVATE_KEY);
    console.log('部署者地址:', typeof deployer === 'object' ? deployer.address : deployer);
    const deployerAddr = typeof deployer === 'object' ? deployer.address : deployer;
    
    // 验证 CHIP Token 地址
    console.log('\n正确的 CHIP Token 地址:', CHIP_TOKEN_ADDRESS);
    console.log('旧的质押合约地址:', OLD_STAKING);
    
    // 检查旧质押合约的问题
    try {
        const oldStaking = await tronWeb.contract().at(OLD_STAKING);
        const storedChipToken = await oldStaking.chipToken().call();
        const storedAddr = tronWeb.address.fromHex(storedChipToken);
        console.log('\n旧质押合约中存储的 chipToken:', storedAddr);
        console.log('地址匹配:', storedAddr === CHIP_TOKEN_ADDRESS ? '✅' : '❌ 不匹配！');
    } catch (e) {
        console.log('无法读取旧质押合约:', e.message);
    }
    
    // 读取编译后的合约
    let contractJson;
    try {
        contractJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'build/contracts/Staking.json'), 'utf8'));
    } catch (e) {
        console.log('\n❌ 错误：找不到编译后的合约文件');
        console.log('请先运行: npx tronbox compile');
        return;
    }
    
    const bytecode = contractJson.bytecode;
    const abi = contractJson.abi;
    
    console.log('\n开始部署新的质押合约...');
    console.log('构造函数参数:', CHIP_TOKEN_ADDRESS);
    
    try {
        // 使用 tronWeb.contract.new 方法部署
        const contractInstance = await tronWeb.contract().new({
            bytecode: bytecode,
            abi: abi,
            parameters: [CHIP_TOKEN_ADDRESS],
            feeLimit: 1000_000_000, // 1000 TRX
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10_000_000
        });
        
        console.log('\n✅ 新的质押合约部署成功！');
        console.log('合约地址:', contractInstance.address);
        
        // 验证新合约
        try {
            const newStoredChip = await contractInstance.chipToken().call();
            const newStoredAddr = tronWeb.address.fromHex(newStoredChip);
            console.log('\n验证新合约:');
            console.log('存储的 chipToken 地址:', newStoredAddr);
            console.log('地址匹配:', newStoredAddr === CHIP_TOKEN_ADDRESS ? '✅' : '❌');
        } catch (e) {
            console.log('验证失败:', e.message);
        }
        
        console.log('\n========================================');
        console.log('请更新以下配置:');
        console.log('========================================');
        console.log('1. .env.testnet 添加:');
        console.log(`   STAKING_CONTRACT_ADDRESS=${contractInstance.address}`);
        console.log('2. 重启后端服务');
        
        // 自动更新 .env.testnet
        const envPath = path.join(__dirname, '.env.testnet');
        let envContent = fs.readFileSync(envPath, 'utf8');
        
        if (envContent.includes('STAKING_CONTRACT_ADDRESS=')) {
            envContent = envContent.replace(
                /STAKING_CONTRACT_ADDRESS=.*/,
                `STAKING_CONTRACT_ADDRESS=${contractInstance.address}`
            );
        } else {
            envContent += `\n# Staking Contract Address (deployed ${new Date().toISOString().split('T')[0]})\n`;
            envContent += `STAKING_CONTRACT_ADDRESS=${contractInstance.address}\n`;
        }
        
        fs.writeFileSync(envPath, envContent);
        console.log('\n✅ 已自动更新 .env.testnet');
        
    } catch (error) {
        console.log('\n❌ 部署失败:', error.message);
        console.log('\n请手动部署:');
        console.log('1. 在 TronIDE 中部署 contracts/Staking.sol');
        console.log(`2. 构造函数参数: ${CHIP_TOKEN_ADDRESS}`);
    }
}

main().catch(console.error);
