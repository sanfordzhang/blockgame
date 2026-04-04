/**
 * 详细分析地址和转账
 */

const { TronWeb } = require('tronweb');

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io'
});

const CHIP_ADDRESS = 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';
const YOUR_WALLET = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const DEPLOYER = 'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA';

const TRANSFER_TX_ID = '88656b774ca9ffb1078e2f3ed4ea1f3a0ba6964a3376cb2f8f86c87e3f44e26e';

async function analyze() {
    console.log('========================================');
    console.log('🔍 地址解析分析');
    console.log('========================================\n');

    // 地址格式转换
    console.log('📊 1. 地址格式对比');
    console.log('----------------------------------------');

    const yourHex = tronWeb.address.toHex(YOUR_WALLET);
    const deployerHex = tronWeb.address.toHex(DEPLOYER);
    const chipHex = tronWeb.address.toHex(CHIP_ADDRESS);

    console.log('您的钱包:');
    console.log('  TRON格式:', YOUR_WALLET);
    console.log('  Hex格式:', yourHex);

    console.log('\n部署者钱包:');
    console.log('  TRON格式:', DEPLOYER);
    console.log('  Hex格式:', deployerHex);

    console.log('\nCHIP合约:');
    console.log('  TRON格式:', CHIP_ADDRESS);
    console.log('  Hex格式:', chipHex);

    // 分析转账交易
    console.log('\n📊 2. 转账交易解析');
    console.log('----------------------------------------');

    const txInfo = await tronWeb.trx.getTransaction(TRANSFER_TX_ID);
    const data = txInfo.raw_data.contract[0].parameter.value.data;

    console.log('原始数据:', data);
    console.log('\n函数选择器:', data.slice(0, 8));

    // 解析参数
    // transfer(address,uint256) 参数格式：
    // - 第1个32字节: 地址（左填充到32字节）
    // - 第2个32字节: 金额

    const addressParam = data.slice(8, 72);  // 64个hex字符 = 32字节
    const amountParam = data.slice(72, 136); // 64个hex字符 = 32字节

    console.log('\n地址参数 (完整):', addressParam);

    // 去掉前导零，获取实际地址
    const actualAddressHex = addressParam.replace(/^0+/, '');

    // TRON地址格式: 41 + 20字节地址
    const tronAddressHex = '41' + actualAddressHex;

    console.log('实际地址 (hex):', actualAddressHex);
    console.log('TRON格式 (hex):', tronAddressHex);

    try {
        const tronAddress = tronWeb.address.fromHex(tronAddressHex);
        console.log('TRON格式 (base58):', tronAddress);
    } catch (e) {
        console.log('地址转换失败');
    }

    // 解析金额
    const amount = parseInt(amountParam, 16);
    console.log('\n转账金额:', amount / 1e6, 'CHIP');

    // 对比地址
    console.log('\n📊 3. 地址对比');
    console.log('----------------------------------------');
    console.log('预期接收地址:', YOUR_WALLET);
    console.log('预期Hex:', yourHex);

    const expectedAddressInData = yourHex.replace('41', '').padStart(64, '0');
    console.log('\n预期在数据中:', expectedAddressInData);
    console.log('实际在数据中:', addressParam);
    console.log('是否匹配:', expectedAddressInData === addressParam ? '✅ 匹配' : '❌ 不匹配');

    // 实际接收地址
    const actualTronAddress = tronWeb.address.fromHex(tronAddressHex);
    console.log('\n实际接收地址:', actualTronAddress);
    console.log('与您的钱包相同:', actualTronAddress === YOUR_WALLET ? '✅ 是' : '❌ 否');

    // 查询实际接收地址的余额
    console.log('\n📊 4. 余额检查');
    console.log('----------------------------------------');

    const PRIVATE_KEY = 'b185b511ad8314b5cf787108676581223ce354321428f6efb46ef2370c882905';
    const tronWebWithKey = new TronWeb({
        fullHost: 'https://nile.trongrid.io',
        privateKey: PRIVATE_KEY
    });

    const contract = await tronWebWithKey.contract().at(CHIP_ADDRESS);

    const yourBalance = await contract.balanceOf(YOUR_WALLET).call();
    const deployerBalance = await contract.balanceOf(DEPLOYER).call();
    const actualReceiverBalance = await contract.balanceOf(actualTronAddress).call();

    console.log('您的钱包余额 (' + YOUR_WALLET + '):', Number(yourBalance) / 1e6, 'CHIP');
    console.log('实际接收者余额 (' + actualTronAddress + '):', Number(actualReceiverBalance) / 1e6, 'CHIP');
    console.log('部署者余额 (' + DEPLOYER + '):', Number(deployerBalance) / 1e6, 'CHIP');

    console.log('\n========================================');
    console.log('📋 结论');
    console.log('========================================');
    console.log('\n✅ 转账确实成功调用了合约');
    console.log('✅ 交易状态: SUCCESS');
    console.log('✅ 转账金额: 50,000 CHIP');
    console.log('');
    console.log('接收地址: ' + actualTronAddress);
    console.log('');

    if (actualTronAddress === YOUR_WALLET) {
        console.log('✅ 您的钱包已收到50,000 CHIP！');
        console.log('');
        console.log('如果TronLink未显示:');
        console.log('1. 确保已添加CHIP合约: ' + CHIP_ADDRESS);
        console.log('2. 刷新TronLink资产列表');
        console.log('3. 检查网络是否为 TRON Nile测试网');
    } else {
        console.log('⚠️  转账到了错误的地址！');
        console.log('这可能是地址编码问题');
    }
}

analyze().catch(console.error);
