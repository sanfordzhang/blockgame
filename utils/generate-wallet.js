const { TronWeb } = require('tronweb');
const crypto = require('crypto');

console.log('🔐 生成 TRON 主网钱包...\n');

// 生成随机私钥
const privateKey = crypto.randomBytes(32).toString('hex');

const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    privateKey: privateKey
});

const address = tronWeb.defaultAddress.base58;

console.log('✅ 钱包生成成功！\n');
console.log('📍 地址（Address）:');
console.log('   ', address);
console.log('');
console.log('🔑 私钥（Private Key）:');
console.log('   ', privateKey);
console.log('');
console.log('⚠️  重要提示：');
console.log('   1. 请妥善保管私钥，不要泄露给任何人');
console.log('   2. 建议将私钥保存到密码管理器');
console.log('   3. 私钥丢失将无法找回资金');
console.log('');
console.log('📝 下一步：');
console.log('   1. 将地址复制到币安提现页面');
console.log('   2. 将私钥添加到 .env 文件');
console.log('');
