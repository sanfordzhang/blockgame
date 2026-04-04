const { TronWeb } = require('tronweb');
const tronWeb = new TronWeb({ 
    fullHost: 'https://nile.trongrid.io',
    privateKey: '0000000000000000000000000000000000000000000000000000000000000001'
});

(async () => {
    const txid = '2497581fa6b7e7ea89f1b451d9ae85ae9dc69f53e873cf248eafb66a53b8b9b7';
    const CHIP_CONTRACT = 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';
    
    console.log('\n========================================');
    console.log('验证提现交易');
    console.log('========================================\n');
    
    const tx = await tronWeb.trx.getTransaction(txid);
    const txInfo = await tronWeb.trx.getTransactionInfo(txid);
    
    console.log('交易ID:', txid);
    console.log('交易状态:', txInfo.receipt?.result || 'N/A');
    console.log('区块高度:', txInfo.blockNumber);
    
    // 获取合约调用信息
    const contractAddr = tronWeb.address.fromHex(tx.raw_data.contract[0].parameter.value.contract_address);
    const caller = tronWeb.address.fromHex(tx.raw_data.contract[0].parameter.value.owner_address);
    
    console.log('\n合约地址:', contractAddr);
    console.log('调用者:', caller);
    
    // 检查余额
    const functionSelector = 'balanceOf(address)';
    
    const yourWallet = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
    const yourBalance = await tronWeb.transactionBuilder.triggerSmartContract(
        CHIP_CONTRACT, 
        functionSelector, 
        {},
        [{ type: 'address', value: yourWallet }]
    );
    console.log('\n您的钱包CHIP余额:', parseInt(yourBalance.constant_result[0], 16) / 1e6, 'CHIP');
    
    const treasuryWallet = 'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA';
    const treasuryBalance = await tronWeb.transactionBuilder.triggerSmartContract(
        CHIP_CONTRACT, 
        functionSelector, 
        {},
        [{ type: 'address', value: treasuryWallet }]
    );
    console.log('Treasury CHIP余额:', parseInt(treasuryBalance.constant_result[0], 16) / 1e6, 'CHIP');
    
    console.log('\n查看交易: https://nile.tronscan.org/#/transaction/' + txid);
})();
