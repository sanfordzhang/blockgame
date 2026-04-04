const { TronWeb } = require('tronweb');
const tronWeb = new TronWeb({ fullHost: 'https://nile.trongrid.io' });

(async () => {
    const txid = '102c59261492d09d2307fde4dded2b4ffd122752fc9a129fc220b5d46461436a';
    const CHIP_CONTRACT = 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';
    
    console.log('========================================');
    console.log('验证On-Chain Transfer交易');
    console.log('========================================\n');
    console.log('交易ID:', txid);
    
    try {
        const tx = await tronWeb.trx.getTransaction(txid);
        const txInfo = await tronWeb.trx.getTransactionInfo(txid);
        
        console.log('\n--- 交易详情 ---');
        console.log('交易类型:', tx.raw_data.contract[0].type);
        
        const contractAddr = tronWeb.address.fromHex(tx.raw_data.contract[0].parameter.value.contract_address);
        const caller = tronWeb.address.fromHex(tx.raw_data.contract[0].parameter.value.owner_address);
        
        console.log('合约地址:', contractAddr);
        console.log('调用者:', caller);
        console.log('交易结果:', txInfo.receipt?.result || 'N/A');
        
        // 检查是否是CHIP合约
        if (contractAddr !== CHIP_CONTRACT) {
            console.log('\n❌ 错误：调用的不是CHIP合约！');
            console.log('期望:', CHIP_CONTRACT);
            console.log('实际:', contractAddr);
        } else {
            console.log('\n✅ 正确调用了CHIP合约');
        }
        
        // 解析函数调用
        const data = tx.raw_data.contract[0].parameter.value.data;
        if (data) {
            const functionSelector = data.substring(0, 10);
            console.log('\n--- 函数调用 ---');
            console.log('函数选择器:', functionSelector);
            
            // transfer函数选择器是 0xa9059cbb
            if (functionSelector === '0xa9059cbb') {
                console.log('✅ 这是 transfer(address,uint256) 函数');
                
                // 解析参数
                const params = data.substring(10);
                const toAddress = tronWeb.address.fromHex('41' + params.substring(24, 64));
                const amount = parseInt(params.substring(64), 16) / 1e6;
                
                console.log('接收地址:', toAddress);
                console.log('金额:', amount, 'CHIP');
            } else {
                console.log('⚠️  不是transfer函数！');
            }
        }
        
        // 检查事件日志
        console.log('\n--- 事件日志 ---');
        if (txInfo.log && txInfo.log.length > 0) {
            console.log('✅ 找到', txInfo.log.length, '个事件');
            txInfo.log.forEach((log, i) => {
                console.log('Log', i+1, ':', JSON.stringify(log.topics).substring(0, 100) + '...');
            });
        } else {
            console.log('❌ 没有事件日志！交易可能失败了。');
            console.log('\n交易信息:', JSON.stringify(txInfo, null, 2).substring(0, 500));
        }
        
        // 检查当前余额
        console.log('\n--- 当前余额 ---');
        
        const contract = await tronWeb.contract().at(CHIP_CONTRACT);
        
        const senderBalance = await contract.balanceOf('TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv').call();
        console.log('发送者余额 (TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv):', 
                    parseInt(senderBalance.toString()) / 1e6, 'CHIP');
        
        const receiverBalance = await contract.balanceOf('TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA').call();
        console.log('接收者余额 (TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA):', 
                    parseInt(receiverBalance.toString()) / 1e6, 'CHIP');
        
    } catch (error) {
        console.error('错误:', error.message);
    }
})();
