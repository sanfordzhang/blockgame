const { TronWeb } = require('tronweb');
const tronWeb = new TronWeb({ fullHost: 'https://api.shasta.trongrid.io' });

const txid = '77ef2959be0cb3bfd1769870066bf370c391855906b00c6660e275f979bcc245';

async function check() {
  for (let i = 0; i < 10; i++) {
    const info = await tronWeb.trx.getTransactionInfo(txid);
    if (info.contract_address) {
      const addr = tronWeb.address.fromHex(info.contract_address);
      console.log('\n✅ 合约已部署:', addr);
      console.log('\n添加到 .env.testnet:');
      console.log(`NFT_CONTRACT_ONCHAIN=${addr}`);
      return addr;
    }
    console.log(`⏳ 等待确认... (${i + 1}/10)`);
    await new Promise(r => setTimeout(r, 5000));
  }
  console.log('\n⚠️  超时，请手动查看: https://shasta.tronscan.org/#/transaction/' + txid);
}

check();
