/**
 * AMM合约主网部署脚本
 * 部署AMMPool和AMMRouter合约到主网
 */
const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');

// 主网配置
const FULL_NODE = 'https://api.trongrid.io';
const SOLIDITY_NODE = 'https://api.trongrid.io';
const EVENT_SERVER = 'https://api.trongrid.io';

// CHIP代币地址（主网）- 需要确认
const CHIP_TOKEN_ADDRESS_MAINNET = process.env.CHIP_TOKEN_ADDRESS_MAINNET || 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';

async function deployAMMMainnet() {
    // 从环境变量获取私钥
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!privateKey) {
        console.error('Please set DEPLOYER_PRIVATE_KEY environment variable');
        process.exit(1);
    }
    
    // 警告
    console.log('\n⚠️  WARNING: Deploying to MAINNET ⚠️\n');
    console.log('This will spend real TRX for deployment fees.');
    console.log('Make sure you have tested thoroughly on testnet first.\n');
    
    // 确认
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    const confirm = await new Promise(resolve => {
        readline.question('Type "CONFIRM" to proceed: ', answer => {
            readline.close();
            resolve(answer === 'CONFIRM');
        });
    });
    
    if (!confirm) {
        console.log('Deployment cancelled.');
        process.exit(0);
    }
    
    // 初始化TronWeb
    const tronWeb = new TronWeb({
        fullHost: FULL_NODE,
        privateKey: privateKey
    });
    
    const deployer = tronWeb.address.fromPrivateKey(privateKey);
    console.log(`Deployer address: ${deployer}`);
    
    // 检查余额
    const balance = await tronWeb.trx.getBalance(deployer);
    console.log(`Deployer balance: ${tronWeb.fromSun(balance)} TRX`);
    
    if (balance < 1000 * 1e6) {
        console.error('Insufficient balance for deployment (need at least 1000 TRX)');
        process.exit(1);
    }
    
    try {
        // 1. 部署AMMPool合约
        console.log('\n=== Deploying AMMPool ===');
        
        const poolContract = await tronWeb.contract().new({
            abi: require('../artifacts/AMMPool.json').abi,
            bytecode: require('../artifacts/AMMRouter.json').bytecode,
            feeLimit: 2000 * 1e6, // 2000 TRX
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 20 * 1e6,
            parameters: [CHIP_TOKEN_ADDRESS_MAINNET]
        });
        
        const poolAddress = poolContract.address;
        console.log(`AMMPool deployed at: ${poolAddress}`);
        
        // 2. 部署AMMRouter合约
        console.log('\n=== Deploying AMMRouter ===');
        
        const routerContract = await tronWeb.contract().new({
            abi: require('../artifacts/AMMRouter.json').abi,
            bytecode: require('../artifacts/AMMRouter.json').bytecode,
            feeLimit: 2000 * 1e6,
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 20 * 1e6,
            parameters: [poolAddress, CHIP_TOKEN_ADDRESS_MAINNET]
        });
        
        const routerAddress = routerContract.address;
        console.log(`AMMRouter deployed at: ${routerAddress}`);
        
        // 3. 保存部署信息
        const deploymentInfo = {
            network: 'mainnet',
            deployer: deployer,
            pool: poolAddress,
            router: routerAddress,
            token: CHIP_TOKEN_ADDRESS_MAINNET,
            deployedAt: new Date().toISOString()
        };
        
        const deploymentPath = path.join(__dirname, '../deployments/amm-mainnet.json');
        fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
        fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
        
        console.log('\n=== Deployment Complete ===');
        console.log(JSON.stringify(deploymentInfo, null, 2));
        
        return deploymentInfo;
        
    } catch (error) {
        console.error('Deployment failed:', error);
        throw error;
    }
}

// 主函数
async function main() {
    console.log('Starting AMM deployment to MAINNET...');
    await deployAMMMainnet();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

module.exports = { deployAMMMainnet };
