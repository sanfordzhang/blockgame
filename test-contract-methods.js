const { TronWeb } = require('tronweb');
const tw = new TronWeb({ fullHost: 'https://api.shasta.trongrid.io' });

const defaultABI = [
  {"inputs":[],"name":"registerPlayer","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"name":"player","type":"address"}],"name":"getPlayerInfo","outputs":[{"name":"balance","type":"uint256"},{"name":"lockedAmount","type":"uint256"},{"name":"isRegistered","type":"bool"}],"stateMutability":"view","type":"function"}
];

async function test() {
  const contractAddr = 'TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c';
  const player1 = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
  
  // Method 1: contract(abi, addr) - like ContractService does
  console.log('=== Method 1: tw.contract(abi, addr) ===');
  try {
    const c1 = tw.contract(defaultABI, contractAddr);
    console.log('Contract instance created');
    const r1 = await c1.getPlayerInfo(player1).call();
    console.log('SUCCESS:', JSON.stringify(r1));
  } catch(e) {
    console.error('FAILED:', e.message?.substring(0,300) || JSON.stringify(e).substring(0,300));
  }

  // Method 2: .at() - like test script
  console.log('\n=== Method 2: tw.contract().at(addr) ===');
  try {
    const c2 = await tw.contract().at(contractAddr);
    const r2 = await c2.getPlayerInfo(player1).call();
    console.log('SUCCESS:', JSON.stringify(r2));
  } catch(e) {
    console.error('FAILED:', e.message?.substring(0,300) || JSON.stringify(e).substring(0,300));
  }
}
test().catch(console.error);
