/**
 * 批量铸造未上链的NFT
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
    console.log('');
    
    let minted = 0;
    for (const nft of unclaimed) {
        console.log(`\n--- [${minted + 1}/${unclaimed.length}] ---`);
        console.log(`数据库TokenID: ${nft.tokenId}`);
        console.log(`类型: ${nft.achievementType} (${nft.achievementTypeId})`);
        console.log(`玩家: ${nft.playerAddress}`);
        
        try {
            const timestamp = Math.floor(Date.now() / 1000);
            const gameId = nft.gameId || `db-${nft.tokenId}`;
            const achievementTypeId = nft.achievementTypeId || 6; // 默认STRAIGHT
            
            const sig = await generateSignature(signerEthAddr, achievementTypeId, timestamp, gameId);
            
            // Step 1: Mint (部署者作为msg.sender，NFT会铸造给部署者)
            console.log('正在铸造...');
            const mintTx = await contract.claimNFT(
                achievementTypeId, timestamp, gameId, sig.v, sig.r, sig.s
            ).send({ feeLimit: 100 * 1e6, callValue: 5 * 1e6 });
            
            console.log('✅ 铸造成功:', mintTx.slice(0, 20) + '...');
            
            await new Promise(r => setTimeout(r, 3000));
            
            // Step 2: 获取新铸造的tokenId
            const totalSupply = await contract.balanceOf(serverAddress).call();
            const newTokenId = 0; // 需要通过事件获取
            
            // 查询最新的tokenId
            let latestTokenId = 0;
            for (let i = 20; i >= 1; i--) {
                try {
                    const owner = await contract.ownerOf(i).call();
                    if (tronWeb.address.fromHex(owner) === serverAddress) {
                        latestTokenId = Math.max(latestTokenId, i);
                    }
                } catch(e) {}
            }
            
            // 检查所有token找到最新的
            for (let i = 50; i >= 1; i--) {
                try {
                    const owner = await contract.ownerOf(i).call();
                    if (tronWeb.address.fromHex(owner) === serverAddress) {
                        latestTokenId = Math.max(latestTokenId, i);
                        break;
                    }
                } catch(e) {}
            }
            
            console.log('最新TokenID:', latestTokenId);
            
            // Step 3: 转移给玩家
            if (latestTokenId > 0) {
                const playerHexAddr = tronWeb.address.toHex(nft.playerAddress.toUpperCase());
                console.log('正在转移给玩家...');
                
                const transferTx = await contract.safeTransferFrom(
                    serverAddress, playerHexAddr, latestTokenId
                ).send({ feeLimit: 50 * 1e6 });
                
                console.log('✅ 转移成功:', transferTx.slice(0, 20) + '...');
                
                // 更新数据库
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
    console.log(`📊 完成: ${minted}/${unclaimed.length} 个NFT已铸造并转移`);
    console.log('========================================\n');
    
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('错误:', err);
    process.exit(1);
});
