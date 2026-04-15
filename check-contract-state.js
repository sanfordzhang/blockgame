const { TronWeb } = require('tronweb');
const tw = new TronWeb({
  fullHost: 'https://nile.trongrid.io',
  privateKey: 'b185b511ad8314b5cf787108676581223ce354321428f6efb46ef2370c882905'
});
async function check() {
    const contract = await tw.contract().at('TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c');
    const p1 = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
    const p2 = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';
    console.log('Contract: TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c (Nile testnet)');
    try {
        const info1 = await contract.players(p1).call();
        console.log('P1 (TU8r):', JSON.stringify({balance: info1.balance?.toString(), locked: info1.lockedAmount?.toString(), reg: info1.isRegistered}));
    } catch(e) { console.log('P1 error:', e.message?.slice(0,100) || e); }
    try {
        const info2 = await contract.players(p2).call();
        console.log('P2 (TX27l):', JSON.stringify({balance: info2.balance?.toString(), locked: info2.lockedAmount?.toString(), reg: info2.isRegistered}));
    } catch(e) { console.log('P2 error:', e.message?.slice(0,100) || e); }
}
check().catch(e => console.error('Fatal:', e.message));
