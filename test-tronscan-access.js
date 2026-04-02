const axios = require('axios');

async function testTronScanAccess() {
    console.log('🔍 测试TronScan访问NFT元数据\n');

    const tokenURI = 'https://dragon-beauty-cloth-tomatoes.trycloudflare.com/api/nft/metadata/6/10';

    console.log('URL:', tokenURI);

    try {
        const res = await axios.get(tokenURI, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; TronScan/1.0)',
                'Accept': 'application/json'
            },
            timeout: 10000
        });

        console.log('\n✅ 响应成功\n');
        console.log('Name:', res.data.name);
        console.log('Description:', res.data.description);
        console.log('\nAttributes:');
        res.data.attributes.forEach(attr => {
            console.log(`  ${attr.trait_type}: ${attr.value}`);
        });

        const hasCards = res.data.attributes.some(a => a.trait_type === 'Cards');
        console.log('\n' + (hasCards ? '✅ Cards信息存在' : '❌ 缺少Cards信息'));

    } catch (error) {
        console.log('❌ 访问失败:', error.message);
    }
}

testTronScanAccess();
