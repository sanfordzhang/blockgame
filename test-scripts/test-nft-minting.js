/**
 * 测试 NFT 铸造上链功能
 * 用法: ENV_FILE=.env.testnet node test-nft-minting.js
 */

const { TronWeb } = require('tronweb');
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config({ path: process.env.ENV_FILE || '.env.testnet' });

// 测试钱包地址 - 必须使用私钥对应的地址
const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;

async function testNFTMinting() {
    console.log('🧪 测试 NFT 铸造上链功能\n');
    console.log('=====================================\n');
    
    // 初始化 TronWeb
    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io',
        headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY }
    });
    
    tronWeb.setPrivateKey(PRIVATE_KEY);
    
    // 获取私钥对应的地址（这将是 msg.sender）
    const TEST_ADDRESS = tronWeb.address.fromPrivateKey(PRIVATE_KEY);
    
    const nftContractAddress = process.env.NFT_CONTRACT_ADDRESS;
    if (!nftContractAddress) {
        throw new Error('请在 .env 文件中配置 NFT_CONTRACT_ADDRESS');
    }
    
    console.log(`NFT 合约地址: ${nftContractAddress}`);
    console.log(`测试钱包地址: ${TEST_ADDRESS} (调用者/签名者)\n`);
    
    // 加载合约
    const contract = await tronWeb.contract().at(nftContractAddress);
    
    // 1. 检查合约基本信息
    console.log('📋 步骤 1: 检查合约基本信息');
    const name = await contract.name().call();
    const symbol = await contract.symbol().call();
    const signer = await contract.signer().call();
    console.log(`   名称: ${name}`);
    console.log(`   符号: ${symbol}`);
    console.log(`   签名者: ${tronWeb.address.fromHex(signer)}\n`);
    
    // 2. 检查测试地址余额
    console.log('💰 步骤 2: 检查余额');
    const balance = await tronWeb.trx.getBalance(TEST_ADDRESS);
    console.log(`   ${TEST_ADDRESS} 余额: ${tronWeb.fromSun(balance)} TRX\n`);
    
    if (balance < 10 * 1e6) {
        console.warn('⚠️  余额不足 10 TRX，无法支付铸造费用');
        console.log('💡 请从 Nile Testnet Faucet 获取测试 TRX:\n   https://nileex.io/join/getJoinPage\n');
        return;
    }
    
    // 3. 生成签名
    console.log('✍️  步骤 3: 生成铸造签名');
    const achievementTypeId = 6; // Straight (最常见)
    const timestamp = Math.floor(Date.now() / 1000);
    const gameId = `test-${Date.now()}`;
    
    // 创建消息哈希 (使用 ethers v5 API)
    const ethers = require('ethers');
    
    // TRON 地址格式：合约中使用的是 20 字节地址（去掉 41 前缀后）
    // msg.sender 将是调用者地址 (TEST_ADDRESS)
    const msgSenderHex = tronWeb.address.toHex(TEST_ADDRESS);
    const msgSenderEth = '0x' + msgSenderHex.slice(2); // 去掉 '41' 前缀，得到 20 字节地址
    
    console.log(`   TRON Address: ${TEST_ADDRESS}`);
    console.log(`   Eth Address: ${msgSenderEth}`);
    
    // 计算 hash（模拟合约中的逻辑）
    const hash = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ['address', 'uint256', 'uint256', 'string'],
            [msgSenderEth, achievementTypeId, timestamp, gameId]
        )
    );
    
    // ethSignedHash = keccak256("\x19Ethereum Signed Message:\n32" + hash)
    const messagePrefix = "\x19Ethereum Signed Message:\n32";
    const ethSignedHash = ethers.utils.keccak256(
        ethers.utils.concat([
            ethers.utils.toUtf8Bytes(messagePrefix),
            ethers.utils.arrayify(hash)
        ])
    );
    
    // 直接签名 ethSignedHash（不使用 signMessage，因为它会再次添加前缀）
    const signingKey = new ethers.utils.SigningKey('0x' + PRIVATE_KEY);
    const sig = signingKey.signDigest(ethers.utils.arrayify(ethSignedHash));
    
    const r = sig.r;
    const s = sig.s;
    const v = sig.recoveryParam + 27;
    
    console.log(`   Achievement Type: ${achievementTypeId} (Straight)`);
    console.log(`   Timestamp: ${timestamp}`);
    console.log(`   Game ID: ${gameId}`);
    console.log(`   v: ${v}`);
    console.log(`   r: ${r.slice(0, 20)}...`);
    console.log(`   s: ${s.slice(0, 20)}...\n`);
    
    // 4. 检查月度限制
    console.log('📊 步骤 4: 检查月度限制');
    const remaining = await contract.getMonthlyRemaining(achievementTypeId).call();
    const remainingNum = typeof remaining === 'object' ? remaining.toNumber() : Number(remaining);
    console.log(`   Type ${achievementTypeId} 剩余铸造额度: ${remainingNum}\n`);
    
    if (remainingNum === 0) {
        console.warn('⚠️  本月铸造额度已用完\n');
        return;
    }
    
    // 5. 铸造 NFT
    console.log('铸造 NFT...');
    console.log('   请在 TronLink 钱包中确认交易\n');
    
    try {
        const tx = await contract.claimNFT(
            achievementTypeId,
            timestamp,
            gameId,
            v,
            r,
            s
        ).send({
            callValue: 5 * 1e6, // 5 TRX
            feeLimit: 100 * 1e6 // 100 TRX
        });
        
        console.log('✅ NFT 铸造成功！\n');
        console.log('=====================================');
        console.log(`交易哈希: ${tx}`);
        console.log('=====================================\n');
        
        // 6. 验证 NFT
        console.log('🔍 步骤 6: 验证 NFT');
        const nftBalance = await contract.balanceOf(TEST_ADDRESS).call();
        const nftBalanceNum = typeof nftBalance === 'object' ? nftBalance.toNumber() : Number(nftBalance);
        console.log(`   ${TEST_ADDRESS} NFT 数量: ${nftBalanceNum}`);
        
        if (nftBalanceNum > 0) {
            console.log('\n🎉 测试成功！NFT 已铸造到区块链上！');
            console.log('\n💡 接下来：');
            console.log('1. 打开 TronLink 钱包');
            console.log('2. 切换到 Nile 测试网');
            console.log('3. 查看 "收藏品" 或 "NFT" 标签');
            console.log('4. 应该能看到你的 Poker Achievement NFT\n');
            
            // 打开浏览器查看
            console.log('🌐 查看交易:');
            console.log(`   https://nile.tronscan.org/#/transaction/${tx}\n`);
        }
        
    } catch (error) {
        console.error('❌ 铸造失败:', error.message);
        
        if (error.message.includes('Invalid signature')) {
            console.log('\n💡 签名验证失败，请检查:');
            console.log('   1. NFT_SIGNER_ADDRESS 是否正确');
            console.log('   2. SERVER_PRIVATE_KEY 是否正确');
        } else if (error.message.includes('insufficient balance')) {
            console.log('\n💡 余额不足，请获取测试 TRX:');
            console.log('   https://nileex.io/join/getJoinPage');
        }
    }
}

testNFTMinting().catch(console.error);
