/**
 * 调试 NFT 签名验证
 */

const { TronWeb } = require('tronweb');
const ethers = require('ethers');
require('dotenv').config({ path: '.env.testnet' });

async function debugSignature() {
    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io',
        headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY }
    });
    
    tronWeb.setAddress('TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv');
    
    const TEST_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
    const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;
    const achievementTypeId = 6;
    const timestamp = Math.floor(Date.now() / 1000);
    const gameId = `test-${Date.now()}`;
    
    console.log('=== 调试签名验证 ===\n');
    
    // 1. 检查合约中的 signer
    const contract = await tronWeb.contract().at(process.env.NFT_CONTRACT_ADDRESS);
    const signerHex = await contract.signer().call();
    console.log('1. 合约中的 signer:');
    console.log(`   Hex: ${signerHex}`);
    console.log(`   Base58: ${tronWeb.address.fromHex(signerHex)}`);
    
    // 2. 从私钥推导签名者地址
    const expectedSigner = tronWeb.address.fromPrivateKey(PRIVATE_KEY);
    console.log('\n2. 私钥对应的地址:');
    console.log(`   Base58: ${expectedSigner}`);
    const expectedSignerHex = tronWeb.address.toHex(expectedSigner);
    console.log(`   Hex: ${expectedSignerHex}`);
    
    // 3. 模拟合约中的 hash 计算
    // TRON 的 msg.sender 在 solidity 中是 20 字节地址（去掉 41 前缀）
    const msgSenderHex = tronWeb.address.toHex(TEST_ADDRESS);
    const msgSenderEth = '0x' + msgSenderHex.slice(4); // 去掉 41 前缀
    
    console.log('\n3. 合约中的地址处理:');
    console.log(`   msg.sender (TRON hex): ${msgSenderHex}`);
    console.log(`   msg.sender (Eth format): ${msgSenderEth}`);
    
    // 计算 hash（模拟合约中的逻辑）
    const hash = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ['address', 'uint256', 'uint256', 'string'],
            [msgSenderEth, achievementTypeId, timestamp, gameId]
        )
    );
    console.log(`\n4. 计算的 hash: ${hash}`);
    
    // 4. 签名
    const messagePrefix = "\x19Ethereum Signed Message:\n32";
    const ethSignedHash = ethers.utils.keccak256(
        ethers.utils.concat([
            ethers.utils.toUtf8Bytes(messagePrefix),
            ethers.utils.arrayify(hash)
        ])
    );
    console.log(`5. ethSignedHash: ${ethSignedHash}`);
    
    // 使用 ethers 签名
    // 注意：signMessage 会自动添加 "\x19Ethereum Signed Message:\n32" 前缀
    // 但合约中已经手动添加了这个前缀，所以我们需要直接签名 hash
    
    // 方法1：直接使用私钥签名（不添加额外前缀）
    const signingKey = new ethers.utils.SigningKey('0x' + PRIVATE_KEY);
    
    // 我们需要签名的是 ethSignedHash，不是 hash
    // 但 ethers 的 signMessage 会再次添加前缀
    // 所以我们需要使用底层方法直接签名
    const sigObj = signingKey.signDigest(ethers.utils.arrayify(ethSignedHash));
    
    const signature2 = ethers.utils.joinSignature(sigObj);
    
    console.log(`\n6. 签名结果 (直接签名 ethSignedHash):`);
    console.log(`   v: ${sigObj.recoveryParam + 27}`);
    console.log(`   r: ${sigObj.r}`);
    console.log(`   s: ${sigObj.s}`);
    console.log(`   full signature: ${signature2}`);
    
    // 7. 恢复签名者地址
    const recoveredAddress = ethers.utils.recoverAddress(ethSignedHash, signature2);
    console.log(`\n7. 恢复的地址: ${recoveredAddress}`);
    
    // 8. 比较地址
    // signerHex 格式: 41dbf2e4b885e6de39190e15723abcfaa1d91b93b3
    // 需要去掉前 2 个字符 '41'，得到 20 字节地址
    const signerEth = '0x' + signerHex.slice(2); // 去掉 '41' 前缀
    console.log(`\n8. 地址比较:`);
    console.log(`   合约 signer (hex raw): ${signerHex}`);
    console.log(`   合约 signer (Eth): ${signerEth}`);
    console.log(`   恢复的地址: ${recoveredAddress}`);
    console.log(`   匹配: ${signerEth.toLowerCase() === recoveredAddress.toLowerCase()}`);
    
    if (signerEth.toLowerCase() !== recoveredAddress.toLowerCase()) {
        console.log('\n❌ 签名验证会失败！');
        console.log('原因：恢复的地址与合约中的 signer 不匹配');
    } else {
        console.log('\n✅ 签名验证应该通过');
    }
}

debugSignature().catch(console.error);
