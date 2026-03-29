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

async function main() {
    const contract = await tronWeb.contract().at(NFT_CONTRACT);
    const serverAddress = tronWeb.address.fromPrivateKey(serverPrivateKey);
    console.log('服务器地址:', serverAddress);
    
    // 检查当前NFT数量
    const beforeBal = await contract.balanceOf(serverAddress).call();
    console.log('mint前部署者NFT:', beforeBal.toString());
    
    // 生成签名
    const achievementTypeId = 6;  // STRAIGHT
    const timestamp = Math.floor(Date.now() / 1000);
    const gameId = 'test-' + Date.now();
    
    const ethAddr = tronToEth(serverAddress);
    const privateKey = serverPrivateKey.startsWith('0x') ? serverPrivateKey : '0x' + serverPrivateKey;
    
    // Step 1: 计算hash (与合约一致)
    // keccak256(abi.encodePacked(msg.sender, achievementTypeId, timestamp, gameId))
    // abi.encodePacked是紧凑编码，不包含长度前缀
    const solidityPacked = ethers.utils.solidityPack(
        ['address', 'uint256', 'uint256', 'string'],
        [ethAddr, achievementTypeId, timestamp, gameId]
    );
    const hash = ethers.utils.keccak256(solidityPacked);
    console.log('原始hash:', hash);
    
    // Step 2: 计算ethSignedHash (与合约一致)
    // keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash))
    const prefix = ethers.utils.toUtf8Bytes('\x19Ethereum Signed Message:\n32');
    const ethSignedHash = ethers.utils.keccak256(
        ethers.utils.concat([prefix, ethers.utils.arrayify(hash)])
    );
    console.log('ethSignedHash:', ethSignedHash);
    
    // Step 3: 签名ethSignedHash
    const signingKey = new ethers.utils.SigningKey(privateKey);
    const sig = signingKey.signDigest(ethers.utils.arrayify(ethSignedHash));
    
    // 验证签名恢复的地址是否正确
    const recovered = ethers.utils.recoverAddress(ethSignedHash, sig);
    console.log('签名恢复地址:', recovered);
    console.log('期望地址:', ethAddr);
    
    console.log('签名参数:');
    console.log('  ethAddr:', ethAddr);
    console.log('  timestamp:', timestamp);
    console.log('  gameId:', gameId);
    console.log('  v:', sig.v);
    console.log('  r:', sig.r.slice(0, 20) + '...');
    console.log('  s:', sig.s.slice(0, 20) + '...');
    
    // 调用合约
    console.log('\n调用合约...');
    const tx = await contract.claimNFT(
        achievementTypeId, timestamp, gameId, sig.v, sig.r, sig.s
    ).send({ feeLimit: 100 * 1e6, callValue: 5 * 1e6 });
    
    console.log('交易hash:', tx);
    
    // 等待确认
    console.log('等待确认...');
    await new Promise(r => setTimeout(r, 5000));
    
    // 检查结果
    const afterBal = await contract.balanceOf(serverAddress).call();
    console.log('mint后部署者NFT:', afterBal.toString());
    
    if (afterBal.toString() !== '0') {
        // 转移给玩家
        const playerAddr = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
        const tokenId = parseInt(afterBal.toString());
        
        console.log('\n转移NFT #' + tokenId + ' 给玩家...');
        const transferTx = await contract.safeTransferFrom(
            serverAddress, playerAddr, tokenId
        ).send({ feeLimit: 50 * 1e6 });
        
        console.log('转移hash:', transferTx);
        
        await new Promise(r => setTimeout(r, 3000));
        const playerBal = await contract.balanceOf(playerAddr).call();
        console.log('玩家NFT数量:', playerBal.toString());
    }
}

main().catch(e => {
    console.error('错误:', e.message);
    if (e.response) console.error('响应:', e.response);
    process.exit(1);
});
