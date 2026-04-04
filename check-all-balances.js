const { TronWeb } = require('tronweb');
const tronWeb = new TronWeb({ 
    fullHost: 'https://nile.trongrid.io',
    privateKey: '0000000000000000000000000000000000000000000000000000000000000001'  // dummy key for read-only
});

(async () => {
    const CHIP_CONTRACT = 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';
    
    console.log('\n========================================');
    console.log('当前各账户CHIP余额');
    console.log('========================================\n');
    
    // 使用直接的合约调用而不是包装的contract()
    const functionSelector = 'balanceOf(address)';
    
    // 您的钱包
    const yourWallet = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
    const yourBalance = await tronWeb.transactionBuilder.triggerSmartContract(
        CHIP_CONTRACT, 
        functionSelector, 
        {},
        [{ type: 'address', value: yourWallet }]
    );
    console.log('您的钱包:', yourWallet);
    console.log('余额:', parseInt(yourBalance.constant_result[0], 16) / 1e6, 'CHIP\n');
    
    // 部署者钱包
    const deployerWallet = 'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA';
    const deployerBalance = await tronWeb.transactionBuilder.triggerSmartContract(
        CHIP_CONTRACT, 
        functionSelector, 
        {},
        [{ type: 'address', value: deployerWallet }]
    );
    console.log('部署者钱包:', deployerWallet);
    console.log('余额:', parseInt(deployerBalance.constant_result[0], 16) / 1e6, 'CHIP\n');
    
    console.log('========================================');
    console.log('问题分析：');
    console.log('========================================');
    console.log('交易 TXID: 102c59261492d09d2307fde4dded2b4ffd122752fc9a129fc220b5d46461436a');
    console.log('\n实际发送者: TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA');
    console.log('您输入的接收者: TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA');
    console.log('\n❌ 这是自转！发送者和接收者是同一个地址！');
    console.log('所以余额没有变化。');
    console.log('\n原因：TronLink当前连接的是部署者账户，不是您的游戏账户。');
})();
