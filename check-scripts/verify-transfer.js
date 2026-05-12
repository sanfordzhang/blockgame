/**
 * 验证CHIP转账和合约调用
 */

const { TronWeb } = require('tronweb');

const PRIVATE_KEY = 'b185b511ad8314b5cf787108676581223ce354321428f6efb46ef2370c882905';

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: PRIVATE_KEY
});

const CHIP_ADDRESS = 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';
const YOUR_WALLET = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const DEPLOYER = 'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA';

// 之前的转账交易ID
const TRANSFER_TX_ID = '88656b774ca9ffb1078e2f3ed4ea1f3a0ba6964a3376cb2f8f86c87e3f44e26e';

async function verify() {
    console.log('========================================');
    console.log('🔍 CHIP转账验证');
    console.log('========================================\n');

    const contract = await tronWeb.contract().at(CHIP_ADDRESS);

    // 1. 检查您的钱包余额
    console.log('📊 1. 钱包余额检查');
    console.log('----------------------------------------');
    const yourBalance = await contract.balanceOf(YOUR_WALLET).call();
    console.log('您的地址:', YOUR_WALLET);
    console.log('您的余额:', Number(yourBalance) / 1e6, 'CHIP');

    // 2. 检查部署者余额
    console.log('\n📊 2. 部署者余额检查');
    console.log('----------------------------------------');
    const deployerBalance = await contract.balanceOf(DEPLOYER).call();
    console.log('部署者地址:', DEPLOYER);
    console.log('部署者余额:', Number(deployerBalance) / 1e6, 'CHIP');

    // 3. 验证之前的转账交易
    console.log('\n📊 3. 转账交易验证');
    console.log('----------------------------------------');
    console.log('交易ID:', TRANSFER_TX_ID);

    try {
        const txInfo = await tronWeb.trx.getTransaction(TRANSFER_TX_ID);

        if (txInfo && txInfo.raw_data) {
            console.log('\n✅ 交易存在！');
            console.log('交易类型:', txInfo.raw_data.contract[0].type);

            const contractData = txInfo.raw_data.contract[0].parameter.value;
            console.log('合约地址 (hex):', contractData.contract_address);
            console.log('合约地址 (TRON):', tronWeb.address.fromHex(contractData.contract_address));
            console.log('调用者地址 (TRON):', tronWeb.address.fromHex(contractData.owner_address));

            // 解码数据
            if (contractData.data) {
                console.log('调用数据:', contractData.data);

                // 解析transfer函数
                const functionSelector = contractData.data.slice(0, 8);
                console.log('函数选择器:', functionSelector);

                // transfer(address,uint256) 的签名是 0xa9059cbb
                if (functionSelector === 'a9059cbb') {
                    console.log('✅ 这是 transfer(address,uint256) 调用');

                    // 解析参数
                    const toAddress = '0x' + contractData.data.slice(34, 74);
                    const amount = parseInt(contractData.data.slice(74), 16);
                    console.log('接收地址 (hex):', toAddress);
                    console.log('接收地址 (TRON):', tronWeb.address.fromHex(toAddress));
                    console.log('转账金额:', amount / 1e6, 'CHIP');
                }
            }
        }

        // 获取交易信息
        const txInfo2 = await tronWeb.trx.getTransactionInfo(TRANSFER_TX_ID);
        console.log('\n交易结果:');
        console.log('  状态:', txInfo2.receipt ? txInfo2.receipt.result : 'unknown');
        console.log('  区块高度:', txInfo2.blockNumber);
        console.log('  能量消耗:', txInfo2.energy_used);
        console.log('  费用 (sun):', txInfo2.fee);

    } catch (e) {
        console.log('❌ 无法获取交易信息:', e.message);
    }

    // 4. 检查游戏内余额 (API)
    console.log('\n📊 4. 游戏内余额 (数据库)');
    console.log('----------------------------------------');

    try {
        const response = await fetch(`http://127.0.0.1:7778/api/chip/balance/${YOUR_WALLET}`);
        const data = await response.json();
        console.log('游戏内CHIP:', data.chip);
        console.log('已质押:', data.staked);
        console.log('总额:', data.totalValue);
    } catch (e) {
        console.log('无法获取游戏内余额');
    }

    console.log('\n========================================');
    console.log('📋 总结');
    console.log('========================================');
    console.log('\n✅ 区块链上的CHIP余额:', Number(yourBalance) / 1e6);
    console.log('');
    console.log('💡 如果TronLink显示不同:');
    console.log('   1. 在TronLink中添加代币合约:', CHIP_ADDRESS);
    console.log('   2. 下拉刷新资产列表');
    console.log('   3. 或重启TronLink');
}

verify().catch(console.error);
