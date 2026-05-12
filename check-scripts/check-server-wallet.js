/**
 * 查询服务器钱包地址的交易历史
 */
const { TronWeb } = require('tronweb');

const tronWeb = new TronWeb({
  fullHost: 'https://nile.trongrid.io',
});

const SERVER_WALLET = 'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA';

async function checkServerWallet() {
  console.log('='.repeat(60));
  console.log('服务器钱包查询');
  console.log('地址:', SERVER_WALLET);
  console.log('='.repeat(60));

  try {
    // 查询余额
    const balance = await tronWeb.trx.getBalance(SERVER_WALLET);
    console.log('\n当前余额:', balance / 1e6, 'TRX');
    console.log('余额 (sun):', balance);

    // 查询入账交易
    console.log('\n' + '='.repeat(60));
    console.log('入账交易 (转入)');
    console.log('='.repeat(60));
    
    const txIn = await tronWeb.trx.getTransactionsRelated(SERVER_WALLET, 'to', 50);
    console.log('入账交易数量:', txIn.length || 0);
    
    if (txIn && txIn.length > 0) {
      let totalIn = 0;
      txIn.forEach((tx, i) => {
        const contract = tx.raw_data.contract[0];
        const param = contract.parameter.value;
        const fromHex = param.owner_address;
        const from = tronWeb.address.fromHex(fromHex);
        const amount = param.amount || 0;
        totalIn += amount;
        
        console.log(`\n${i + 1}. 交易ID: ${tx.txID}`);
        console.log(`   发送方: ${from}`);
        console.log(`   金额: ${amount / 1e6} TRX`);
        console.log(`   时间: ${new Date(tx.raw_data.timestamp).toLocaleString()}`);
      });
      console.log('\n入账总计:', totalIn / 1e6, 'TRX');
    }

    // 查询出账交易
    console.log('\n' + '='.repeat(60));
    console.log('出账交易 (转出)');
    console.log('='.repeat(60));
    
    const txOut = await tronWeb.trx.getTransactionsRelated(SERVER_WALLET, 'from', 50);
    console.log('出账交易数量:', txOut.length || 0);
    
    if (txOut && txOut.length > 0) {
      let totalOut = 0;
      txOut.forEach((tx, i) => {
        const contract = tx.raw_data.contract[0];
        const param = contract.parameter.value;
        const toHex = param.to_address;
        const to = toHex ? tronWeb.address.fromHex(toHex) : 'N/A';
        const amount = param.amount || 0;
        totalOut += amount;
        
        console.log(`\n${i + 1}. 交易ID: ${tx.txID}`);
        console.log(`   接收方: ${to}`);
        console.log(`   金额: ${amount / 1e6} TRX`);
        console.log(`   时间: ${new Date(tx.raw_data.timestamp).toLocaleString()}`);
      });
      console.log('\n出账总计:', totalOut / 1e6, 'TRX');
    }

    // 查询智能合约触发记录
    console.log('\n' + '='.repeat(60));
    console.log('智能合约触发记录');
    console.log('='.repeat(60));
    
    const triggerList = await tronWeb.trx.getTransactionsRelated(SERVER_WALLET, 'all', 50);
    const triggers = (triggerList || []).filter(tx => 
      tx.raw_data.contract[0].type === 'TriggerSmartContract'
    );
    
    console.log('合约触发次数:', triggers.length);
    if (triggers.length > 0) {
      triggers.slice(0, 10).forEach((tx, i) => {
        const contract = tx.raw_data.contract[0];
        const param = contract.parameter.value;
        const contractAddr = param.contract_address;
        console.log(`\n${i + 1}. 交易ID: ${tx.txID}`);
        console.log(`   合约地址: ${tronWeb.address.fromHex(contractAddr)}`);
        console.log(`   调用者: ${tronWeb.address.fromHex(param.owner_address)}`);
        console.log(`   时间: ${new Date(tx.raw_data.timestamp).toLocaleString()}`);
      });
    }

  } catch (error) {
    console.error('查询失败:', error.message);
  }
}

checkServerWallet();
