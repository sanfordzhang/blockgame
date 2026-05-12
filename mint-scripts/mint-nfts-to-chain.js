/**
 * 将数据库中的NFT真正mint到区块链
 * 
 * 使用方法: node mint-nfts-to-chain.js
 */

require('dotenv').config({ path: '.env.testnet' });
const { TronWeb } = require('tronweb');
const { ethers } = require('ethers');
const mongoose = require('mongoose');
const NFTClaim = require('./server/models/NFTClaim');

const serverPrivateKey = process.env.SERVER_PRIVATE_KEY || process.env.NILE_PRIVATE_KEY;
const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: serverPrivateKey
});

const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';

function tronToEth(tronAddress) {
    const hex = tronWeb.address.toHex(tronAddress);
    return '0x' + hex.slice(2);
}

// 生成签名 (用signer地址)
async function generateSignature(signerEthAddr, achievementTypeId, timestamp, gameId) {
    const privateKey = serverPrivateKey.startsWith('0x') ? serverPrivateKey : '0x' + serverPrivateKey;
    
    // 使用solidityPack (abi.encodePacked的等价物)
    const solidityPacked = ethers.utils.solidityPack(
        ['address', 'uint256', 'uint256', 'string'],
        [signerEthAddr, achievementTypeId, timestamp, gameId]
    );
    const hash = ethers.utils.keccak256(solidityPacked);
    
    // 以太坊签名格式
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
    console.log('🔗 NFT链上Mint工具');
    console.log('========================================\n');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bridgepoker');
    console.log('✅ 数据库连接成功');
    
    const unclaimed = await NFTClaim.find({ txHash: null }).sort({ createdAt: 1 });
    console.log(`📋 找到 ${unclaimed.length} 个未mint的NFT\n`);
    
    if (unclaimed.length === 0) {
        console.log('没有需要mint的NFT');
        await mongoose.disconnect();
        return;
    }
    
    const contract = await tronWeb.contract().at(NFT_CONTRACT);
    const serverAddress = tronWeb.address.fromPrivateKey(serverPrivateKey);
    const signerEthAddr = tronToEth(serverAddress);
    
    console.log('Signer地址:', serverAddress);
    console.log('Signer以太坊地址:', signerEthAddr);
    
    let minted = 0;
    for (const nft of unclaimed) {
        console.log(`\n--- [${minted + 1}/${unclaimed.length}] NFT #${nft.tokenId} ---`);
        console.log(`类型: ${nft.achievementType}, 玩家: ${nft.playerAddress}`);
        
        try {
            const timestamp = Math.floor(Date.now() / 1000);
            const sig = await generateSignature(signerEthAddr, nft.achievementTypeId, timestamp, nft.gameId);
            
            // Step 1: Mint
            const mintTx = await contract.claimNFT(
                nft.achievementTypeId, timestamp, nft.gameId, sig.v, sig.r, sig.s
            ).send({ feeLimit: 100 * 1e6, callValue: 5 * 1e6 });
            
            console.log('✅ Mint:', mintTx.slice(0, 16) + '...');
            
            await new Promise(r => setTimeout(r, 3000));
            
            // 获取tokenId
            const balance = await contract.balanceOf(serverAddress).call();
            const tokenId = parseInt(balance.toString());
            
            if (tokenId > 0) {
                // Step 2: 转移给玩家 (使用正确的地址格式)
                const playerHexAddr = tronWeb.address.toHex(nft.playerAddress.toUpperCase());
                const transferTx = await contract.safeTransferFrom(
                    serverAddress, playerHexAddr, tokenId
                ).send({ feeLimit: 50 * 1e6 });
                
                console.log('✅ 转移:', transferTx.slice(0, 16) + '...');
                
                nft.txHash = mintTx;
                await nft.save();
                minted++;
            }
            
            await new Promise(r => setTimeout(r, 2000));
        } catch (error) {
            console.error('❌ 失败:', error.message);
        }
    }
    
    console.log(`\n========================================`);
    console.log(`📊 完成: ${minted}/${unclaimed.length} 个NFT已mint`);
    console.log('========================================\n');
    
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('错误:', err);
    process.exit(1);
});
