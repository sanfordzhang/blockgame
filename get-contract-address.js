const { TronWeb } = require('tronweb');
const tronWeb = new TronWeb({ fullHost: 'https://nile.trongrid.io' });

(async () => {
    const txid = '23b9ab56eef16e38e4aac3824b6e6ecc451a03ae52374f244f669ec3060367f3';
    
    console.log('查询交易:', txid);
    
    try {
        const txInfo = await tronWeb.trx.getTransactionInfo(txid);
        
        if (txInfo.contract_address) {
            const contractAddress = tronWeb.address.fromHex(txInfo.contract_address);
            console.log('\n✅ 合约地址:', contractAddress);
            
            // 验证
            const contract = await tronWeb.contract().at(contractAddress);
            const name = await contract.name().call();
            const symbol = await contract.symbol().call();
            
            console.log('名称:', name);
            console.log('符号:', symbol);
            
            // 保存
            const fs = require('fs');
            const deployments = JSON.parse(fs.readFileSync('deployments/nile.json', 'utf8'));
            deployments.chipTokenContract = contractAddress;
            deployments.chipTokenDeployedAt = new Date().toISOString();
            fs.writeFileSync('deployments/nile.json', JSON.stringify(deployments, null, 2));
            
            console.log('\n✅ 已更新到 deployments/nile.json');
        } else {
            console.log('\n交易可能还在确认中...');
            console.log('交易信息:', JSON.stringify(txInfo, null, 2));
        }
    } catch (e) {
        console.log('错误:', e.message);
    }
})();
