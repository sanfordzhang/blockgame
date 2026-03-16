const { TronWeb } = require('tronweb');

const tronWeb = new TronWeb({
  fullHost: 'https://nile.trongrid.io'
});

const contractAddress = 'TPrXy7qsoY3rEutSPmEF14sJjjijxpHGpv';

async function check() {
  try {
    console.log('Checking contract:', contractAddress);
    const contract = await tronWeb.contract().at(contractAddress);
    
    // Check server wallet
    const serverAddr = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
    const info = await contract.players(serverAddr).call();
    console.log('\nServer wallet:', serverAddr);
    console.log('  isRegistered:', info.isRegistered);
    console.log('  Balance:', Number(info.balance) / 1e6, 'TRX');
    
    // Check rake rate
    const rakeRate = await contract.rakeRate().call();
    console.log('\nRake rate:', Number(rakeRate) / 100, '%');
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

check();
