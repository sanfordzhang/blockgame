/**
 * AMM合约部署脚本
 * 部署AMMPool和AMMRouter合约
 */
const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');

// 配置
const FULL_NODE = 'https://nile.trongrid.io';
const SOLIDITY_NODE = 'https://nile.trongrid.io';
const EVENT_SERVER = 'https://nile.trongrid.io';

// CHIP代币地址（测试网）
const CHIP_TOKEN_ADDRESS = 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';

async function compileContract(contractPath) {
    // 使用solc编译合约
    const solc = require('solc');
    
    const source = fs.readFileSync(contractPath, 'utf8');
    
    const input = {
        language: 'Solidity',
        sources: {
            [path.basename(contractPath)]: { content: source }
        },
        settings: {
            outputSelection: {
                '*': {
                    '*': ['abi', 'evm.bytecode']
                }
            }
        }
    };
    
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    const contractName = path.basename(contractPath, '.sol');
    
    return {
        abi: output.contracts[contractName][contractName].abi,
        bytecode: output.contracts[contractName][contractName].evm.bytecode.object
    };
}

async function deployAMM() {
    // 从环境变量获取私钥
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!privateKey) {
        console.error('Please set DEPLOYER_PRIVATE_KEY environment variable');
        process.exit(1);
    }
    
    // 初始化TronWeb
    const tronWeb = new TronWeb({
        fullHost: FULL_NODE,
        privateKey: privateKey
    });
    
    const deployer = tronWeb.address.fromPrivateKey(privateKey);
    console.log(`Deployer address: ${deployer}`);
    
    try {
        // 1. 部署AMMPool合约
        console.log('\n=== Deploying AMMPool ===');
        
        const poolSource = fs.readFileSync(
            path.join(__dirname, '../contracts/AMMPool.sol'),
            'utf8'
        );
        
        // 简化：直接使用已编译的ABI（实际部署需要编译）
        // 这里使用模拟的方式
        
        const poolContract = await tronWeb.contract().new({
            abi: require('../artifacts/AMMPool.json').abi,
            bytecode: require('../artifacts/AMMPool.json').bytecode,
            feeLimit: 1000 * 1e6, // 1000 TRX
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10 * 1e6,
            parameters: [CHIP_TOKEN_ADDRESS]
        });
        
        const poolAddress = poolContract.address;
        console.log(`AMMPool deployed at: ${poolAddress}`);
        
        // 2. 部署AMMRouter合约
        console.log('\n=== Deploying AMMRouter ===');
        
        const routerContract = await tronWeb.contract().new({
            abi: require('../artifacts/AMMRouter.json').abi,
            bytecode: require('../artifacts/AMMRouter.json').bytecode,
            feeLimit: 1000 * 1e6,
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10 * 1e6,
            parameters: [poolAddress, CHIP_TOKEN_ADDRESS]
        });
        
        const routerAddress = routerContract.address;
        console.log(`AMMRouter deployed at: ${routerAddress}`);
        
        // 3. 保存部署信息
        const deploymentInfo = {
            network: 'nile',
            deployer: deployer,
            pool: poolAddress,
            router: routerAddress,
            token: CHIP_TOKEN_ADDRESS,
            deployedAt: new Date().toISOString()
        };
        
        const deploymentPath = path.join(__dirname, '../deployments/amm-nile.json');
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
    console.log('Starting AMM deployment...');
    await deployAMM();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

module.exports = { deployAMM };
