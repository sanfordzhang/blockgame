/**
 * 独立部署 AchievementNFTSimple 合约
 * 用法: ENV_FILE=.env.testnet node deploy-nft-simple.js
 */

const { TronWeb } = require('tronweb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: process.env.ENV_FILE || '.env.testnet' });

async function deployNFTContract() {
    console.log('🚀 开始部署 AchievementNFTSimple 合约...\n');
    
    // 初始化 TronWeb
    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io',
        headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY }
    });
    
    // 加载私钥
    const privateKey = process.env.TESTNET_PRIVATE_KEY || process.env.NILE_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('请在 .env 文件中配置 TESTNET_PRIVATE_KEY');
    }
    
    tronWeb.setPrivateKey(privateKey);
    const deployerAddress = tronWeb.address.fromPrivateKey(privateKey);
    console.log(`部署者地址: ${deployerAddress}\n`);
    
    // 读取编译好的合约 ABI 和 Bytecode
    const contractJson = JSON.parse(fs.readFileSync('./build/contracts/AchievementNFTSimple.json', 'utf8'));
    const abi = contractJson.abi;
    const bytecode = contractJson.bytecode;
    
    // 准备构造函数参数
    const signerAddress = deployerAddress; // 使用部署者作为签名者
    const baseURI = process.env.NFT_BASE_URI || 'http://127.0.0.1:7778/api/nft/metadata/';
    
    console.log(`签名者地址: ${signerAddress}`);
    console.log(`Base URI: ${baseURI}\n`);
    
    try {
        // 检查余额
        const balance = await tronWeb.trx.getBalance(deployerAddress);
        console.log(`💰 部署者余额: ${tronWeb.fromSun(balance)} TRX\n`);
        
        if (balance < 50 * 1e6) {
            console.warn('⚠️  余额不足 50 TRX，可能无法完成部署');
            console.log('💡 请从 Nile Testnet Faucet 获取测试 TRX:');
            console.log('   https://nileex.io/join/getJoinPage\n');
        }
        
        // 部署合约
        console.log('📦 正在部署合约...');
        const contract = await tronWeb.contract().new({
            abi,
            bytecode,
            parameters: [signerAddress, baseURI],
            feeLimit: 1000 * 1e6, // 1000 TRX
            callValue: 0
        });
        
        console.log('\n✅ 合约部署成功！\n');
        console.log('==============================================');
        console.log(`合约地址: ${contract.address}`);
        console.log('==============================================\n');
        
        // 保存部署信息
        const deploymentsDir = './deployments';
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }
        
        const deploymentFile = `${deploymentsDir}/nile.json`;
        let deploymentInfo = {};
        if (fs.existsSync(deploymentFile)) {
            deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
        }
        
        deploymentInfo.nftContract = contract.address;
        deploymentInfo.nftContractType = 'AchievementNFTSimple';
        deploymentInfo.nftDeployedAt = new Date().toISOString();
        deploymentInfo.nftSigner = signerAddress;
        deploymentInfo.deployer = deployerAddress;
        
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
        console.log(`📄 部署信息已保存到 ${deploymentFile}\n`);
        
        // 打印环境变量配置
        console.log('==============================================');
        console.log('添加到 .env.testnet:');
        console.log(`NFT_CONTRACT_ADDRESS=${contract.address}`);
        console.log(`NFT_SIGNER_ADDRESS=${signerAddress}`);
        console.log('==============================================\n');
        
        // 验证合约
        console.log('🔍 验证合约...');
        const name = await contract.name().call();
        const symbol = await contract.symbol().call();
        console.log(`   名称: ${name}`);
        console.log(`   符号: ${symbol}`);
        console.log(`   签名者: ${await contract.signer().call()}\n`);
        
        console.log('🎉 部署完成！接下来请：');
        console.log('1. 将上面的环境变量添加到 .env.testnet');
        console.log('2. 重启后端服务');
        console.log('3. 测试 NFT 铸造功能\n');
        
    } catch (error) {
        console.error('❌ 部署失败:', error.message);
        if (error.message.includes('insufficient balance')) {
            console.log('\n💡 解决方法：从 Nile Testnet Faucet 获取测试 TRX');
            console.log('   https://nileex.io/join/getJoinPage');
        }
        throw error;
    }
}

deployNFTContract().catch(console.error);
