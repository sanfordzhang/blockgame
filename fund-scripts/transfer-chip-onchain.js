/**
 * 在区块链上真正转账CHIP
 */

const { TronWeb } = require('tronweb');

const PRIVATE_KEY = 'b185b511ad8314b5cf787108676581223ce354321428f6efb46ef2370c882905';
const CHIP_ADDRESS = 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';
const FROM_ADDRESS = 'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA'; // 部署者
const TO_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';   // 您的钱包

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: PRIVATE_KEY
});

async function transferOnChain() {
    console.log('========================================');
    console.log('💰 区块链上转账CHIP');
    console.log('========================================\n');

    const contract = await tronWeb.contract().at(CHIP_ADDRESS);

    // 查询转账前余额
    console.log('📊 转账前余额:');
    const beforeFrom = await contract.balanceOf(FROM_ADDRESS).call();
    const beforeTo = await contract.balanceOf(TO_ADDRESS).call();
    console.log('  发送方:', Number(beforeFrom) / 1e6, 'CHIP');
    console.log('  接收方:', Number(beforeTo) / 1e6, 'CHIP');

    // 转账数量
    const amount = 5000 * 1e6; // 5,000 CHIP

    console.log('\n📤 转账信息:');
    console.log('  发送方:', FROM_ADDRESS);
    console.log('  接收方:', TO_ADDRESS);
    console.log('  数量:', 5000, 'CHIP');

    // 调用合约的transfer函数
    console.log('\n⏳ 正在调用合约...');
    const tx = await contract.transfer(
        TO_ADDRESS,
        amount.toString()
    ).send({
        feeLimit: 100_000_000
    });

    console.log('✅ 交易已发送:', tx);

    // 等待确认
    console.log('\n⏳ 等待区块确认...');
    await new Promise(r => setTimeout(r, 5000));

    // 查询转账后余额
    console.log('\n📊 转账后余额:');
    const afterFrom = await contract.balanceOf(FROM_ADDRESS).call();
    const afterTo = await contract.balanceOf(TO_ADDRESS).call();
    console.log('  发送方:', Number(afterFrom) / 1e6, 'CHIP');
    console.log('  接收方:', Number(afterTo) / 1e6, 'CHIP');

    console.log('\n✅ 转账成功！');
    console.log('\n查看交易:');
    console.log('  https://nile.tronscan.org/#/transaction/' + tx);
}

transferOnChain().catch(console.error);
