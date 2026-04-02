/**
 * 端到端测试 - 验证TronLink钱包能够通过云隧道读取Cards信息
 */

const axios = require('axios');

// 配置
const TUNNEL_URL = 'https://absolute-lightweight-miscellaneous-linda.trycloudflare.com';
const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';
const TEST_TOKEN_ID = 1774788248313;

async function testEndToEnd() {
    console.log('========================================');
    console.log('🧪 端到端测试 - TronLink读取Cards信息');
    console.log('========================================\n');

    // 测试1: 本地API访问
    console.log('📝 测试1: 本地API访问');
    try {
        const localResponse = await axios.get(`http://localhost:7778/api/nft/metadata/${TEST_TOKEN_ID}`);
        const cardsAttr = localResponse.data.attributes.find(a => a.trait_type === 'Cards');
        
        if (cardsAttr && cardsAttr.value === 'Ah Kh Qh Jh 10h') {
            console.log('✅ 本地API正确返回Cards信息:', cardsAttr.value);
        } else {
            console.log('❌ 本地API未返回Cards信息');
            return false;
        }
    } catch (error) {
        console.log('❌ 本地API访问失败:', error.message);
        return false;
    }
    console.log('');

    // 测试2: 云隧道访问
    console.log('📝 测试2: 云隧道访问');
    try {
        const tunnelResponse = await axios.get(`${TUNNEL_URL}/api/nft/metadata/${TEST_TOKEN_ID}`);
        const cardsAttr = tunnelResponse.data.attributes.find(a => a.trait_type === 'Cards');
        
        if (cardsAttr && cardsAttr.value === 'Ah Kh Qh Jh 10h') {
            console.log('✅ 云隧道正确返回Cards信息:', cardsAttr.value);
        } else {
            console.log('❌ 云隧道未返回Cards信息');
            return false;
        }
    } catch (error) {
        console.log('❌ 云隧道访问失败:', error.message);
        return false;
    }
    console.log('');

    // 测试3: 验证完整数据结构
    console.log('📝 测试3: 验证NFT元数据完整性');
    try {
        const response = await axios.get(`${TUNNEL_URL}/api/nft/metadata/${TEST_TOKEN_ID}`);
        const metadata = response.data;
        
        const requiredFields = ['name', 'description', 'image', 'attributes'];
        const missingFields = requiredFields.filter(field => !metadata[field]);
        
        if (missingFields.length > 0) {
            console.log('❌ 缺少必需字段:', missingFields.join(', '));
            return false;
        }
        
        console.log('✅ 元数据结构完整:');
        console.log('   Name:', metadata.name);
        console.log('   Description:', metadata.description);
        console.log('   Image:', metadata.image.substring(0, 50) + '...');
        console.log('   Attributes数量:', metadata.attributes.length);
        
        // 检查必需属性
        const requiredAttrs = ['Achievement', 'Rarity', 'Cards'];
        for (const attr of requiredAttrs) {
            const found = metadata.attributes.find(a => a.trait_type === attr);
            if (found) {
                console.log(`   ✓ ${attr}: ${found.value}`);
            } else {
                console.log(`   ✗ 缺少属性: ${attr}`);
                return false;
            }
        }
    } catch (error) {
        console.log('❌ 元数据验证失败:', error.message);
        return false;
    }
    console.log('');

    // 测试4: 验证HTTP头和CORS
    console.log('📝 测试4: 验证HTTP头');
    try {
        const response = await axios.head(`${TUNNEL_URL}/api/nft/metadata/${TEST_TOKEN_ID}`);
        console.log('✅ HTTP状态码:', response.status);
        console.log('   Content-Type:', response.headers['content-type']);
    } catch (error) {
        if (error.response) {
            console.log('✅ HTTP状态码:', error.response.status);
        } else {
            console.log('⚠️  无法验证HTTP头');
        }
    }
    console.log('');

    // 测试5: 测试不同的tokenId
    console.log('📝 测试5: 测试多个NFT数据');
    try {
        // 查询Token ID 1（如果存在）
        const response1 = await axios.get(`${TUNNEL_URL}/api/nft/metadata/1`, { timeout: 3000 });
        if (response1.data.attributes) {
            const cards1 = response1.data.attributes.find(a => a.trait_type === 'Cards');
            console.log('✅ Token #1 可访问:', cards1 ? cards1.value : '无Cards信息');
        }
    } catch (error) {
        console.log('⚠️  Token #1 不可访问或不存在（预期行为）');
    }
    console.log('');

    return true;
}

// 运行测试
testEndToEnd().then(success => {
    console.log('========================================');
    if (success) {
        console.log('✅ 所有核心测试通过！');
        console.log('');
        console.log('📱 TronLink钱包访问指南:');
        console.log('1. 打开TronLink钱包');
        console.log('2. 切换到TRON Nile测试网');
        console.log('3. 进入NFT收藏品页面');
        console.log('4. 添加NFT合约: ' + NFT_CONTRACT);
        console.log('5. 查看NFT详情');
        console.log('6. 在"属性"中应该能看到:');
        console.log('   - Achievement: ROYAL_FLUSH');
        console.log('   - Rarity: LEGENDARY');
        console.log('   - Cards: Ah Kh Qh Jh 10h');
        console.log('');
        console.log('🌐 云隧道URL:');
        console.log(TUNNEL_URL);
        console.log('');
        console.log('✅ 数据访问流程:');
        console.log('TronLink → 合约tokenURI() → 云隧道URL → 本地服务器 → MongoDB → 返回Cards信息');
    } else {
        console.log('❌ 部分测试失败');
    }
    console.log('========================================');
    
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('❌ 测试执行错误:', error);
    process.exit(1);
});
