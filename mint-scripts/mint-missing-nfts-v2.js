/**
 * 批量铸造未上链的NFT - 修复版
 */

require('dotenv').config({ path: '.env.testnet' });
const { TronWeb } = require('tronweb');
const { ethers } = require('ethers');
const mongoose = require('mongoose');
const NFTClaim = require('./server/models/NFTClaim');

const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';
const serverPrivateKey = process.env.SERVER_PRIVATE_KEY || process.env.NILE_PRIVATE_KEY;

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: serverPrivateKey
});

function tronToEth(tronAddress) {
    const hex = tronWeb.address.toHex(tronAddress);
    return '0x' + hex.slice(2);
}

// 规范化TRON地址 - 返回hex格式用于合约调用
function normalizeTronAddress(addr) {
    if (!addr) return null;
    try {
        const clean = addr.trim();
        // 验证地址并转为hex
        const hex = tronWeb.address.toHex(clean);
        return hex; // 返回hex格式用于合约
    } catch(e) {
        console.error('地址格式错误:', addr, e.message);
        return null;
    }
}

async function generateSignature(signerEthAddr, achievementTypeId, timestamp, gameId) {
    const privateKey = serverPrivateKey.startsWith('0x') ? serverPrivateKey : '0x' + serverPrivateKey;
    
    const solidityPacked = ethers.utils.solidityPack(
        ['address', 'uint256', 'uint256', 'string'],
        [signerEthAddr, achievementTypeId, timestamp, gameId]
    );
    const hash = ethers.utils.keccak256(solidityPacked);
    
    const prefix = ethers.utils.toUtf8Bytes('\x19Ethereum Signed Message:\n32');
    const ethSignedHash = ethers.utils.keccak256(
        ethers.utils.concat([prefix, ethers.utils.arrayify(hash)])
    );
    
    const signingKey = new ethers.utils.SigningKey(privateKey);
    const sig = signingKey.signDigest(ethers.utils.arrayify(ethSignedHash));
    
    return { hash, v: sig.v, r: sig.r, s: sig.s };
}

async function main() {
    console.log('========================================');
    console.log('🚀 批量铸造未上链NFT');
    console.log('========================================\n');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bridgepoker');
    console.log('✅ 数据库已连接');
    
    // 查找所有未铸造的NFT
    const unclaimed = await NFTClaim.find({ txHash: null }).sort({ createdAt: 1 });
    console.log(`📋 找到 ${unclaimed.length} 个未铸造的NFT\n`);
    
    if (unclaimed.length === 0) {
        console.log('没有需要铸造的NFT');
        await mongoose.disconnect();
        return;
    }
    
    const contract = await tronWeb.contract().at(NFT_CONTRACT);
    const serverAddress = tronWeb.address.fromPrivateKey(serverPrivateKey);
    const signerEthAddr = tronToEth(serverAddress);
    
    console.log('Server地址:', serverAddress);
    console.log('合约地址:', NFT_CONTRACT);
    
    // 获取当前最大tokenId
    let maxTokenId = 0;
    for (let i = 1; i <= 100; i++) {
        try {
            await contract.ownerOf(i).call();
            maxTokenId = i;
        } catch(e) {}
    }
    console.log('当前最大TokenID:', maxTokenId);
    console.log('');
    
    let minted = 0;
    for (const nft of unclaimed) {
        console.log(`\n--- [${minted + 1}/${unclaimed.length}] ---`);
        console.log(`数据库TokenID: ${nft.tokenId}`);
        console.log(`类型: ${nft.achievementType} (${nft.achievementTypeId})`);
        console.log(`玩家原始地址: ${nft.playerAddress}`);
        
        // 规范化玩家地址
        const playerHex = normalizeTronAddress(nft.playerAddress);
        if (!playerHex) {
            console.log('❌ 地址格式无效，跳过');
            continue;
        }
        console.log(`玩家规范地址: ${playerHex}`);
        
        try {
            const timestamp = Math.floor(Date.now() / 1000);
            const gameId = nft.gameId || `db-${nft.tokenId}`;
            const achievementTypeId = nft.achievementTypeId || 6;
            
            const sig = await generateSignature(signerEthAddr, achievementTypeId, timestamp, gameId);
            
            // Step 1: Mint
            console.log('正在铸造...');
            const mintTx = await contract.claimNFT(
                achievementTypeId, timestamp, gameId, sig.v, sig.r, sig.s
            ).send({ feeLimit: 100 * 1e6, callValue: 5 * 1e6 });
            
            console.log('✅ 铸造成功:', mintTx.slice(0, 20) + '...');
            
            await new Promise(r => setTimeout(r, 4000));
            
            // Step 2: 查找新的tokenId
            let newTokenId = null;
            for (let i = maxTokenId + 1; i <= maxTokenId + 10; i++) {
                try {
                    const owner = await contract.ownerOf(i).call();
                    if (tronWeb.address.fromHex(owner) === serverAddress) {
                        newTokenId = i;
                        maxTokenId = i;
                        break;
                    }
                } catch(e) {}
            }
            
            if (!newTokenId) {
                console.log('❌ 无法找到新铸造的TokenID');
                continue;
            }
            
            console.log('新TokenID:', newTokenId);
            
            // Step 3: 转移给玩家
            console.log('正在转移给玩家...');
            const transferTx = await contract.safeTransferFrom(
                serverAddress, playerHex, newTokenId
            ).send({ feeLimit: 50 * 1e6 });
            
            console.log('✅ 转移成功:', transferTx.slice(0, 20) + '...');
            
            // 更新数据库
            nft.txHash = mintTx;
            await nft.save();
            
            minted++;
            
            // 等待一下避免频繁请求
            await new Promise(r => setTimeout(r, 3000));
            
        } catch (error) {
            console.error('❌ 失败:', error.message);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    
    console.log(`\n========================================`);
    console.log(`📊 完成: ${minted}/${unclaimed.length} 个NFT已铸造并转移`);
    console.log('========================================\n');
    
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('错误:', err);
    process.exit(1);
});
