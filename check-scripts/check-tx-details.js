const { TronWeb } = require('tronweb');
require('dotenv').config({ path: '.env.testnet' });

const JOIN_TX = 'a1faea8ac60f48b58c4f1474734e3f9e88236a3742d2656a2612c0fc564adb45';
const LEAVE_TX = 'f74ac431b8d7b8140fb6a75287104720af3d731146c75ad44652b8bee586e2ef';

async function main() {
    const tronWeb = new TronWeb({
        fullHost: 'https://api.nile.trongrid.io',
        privateKey: process.env.SERVER_PRIVATE_KEY
    });
    
    console.log('=== Transaction Analysis ===\n');
    
    // Check joinTableFor transaction
    console.log('JoinTableFor Transaction:', JOIN_TX);
    try {
        const joinInfo = await tronWeb.trx.getTransactionInfo(JOIN_TX);
        console.log('  Block:', joinInfo.blockNumber);
        console.log('  Result:', joinInfo.result ? 'SUCCESS' : 'FAILED');
        
        // Check for events
        if (joinInfo.log) {
            console.log('  Events:', joinInfo.log.length);
            for (const log of joinInfo.log) {
                console.log('    - Topics:', log.topics?.map(t => t.substring(0, 20) + '...'));
            }
        }
        
        // Check internal transactions
        if (joinInfo.internal_transactions) {
            console.log('  Internal TXs:', joinInfo.internal_transactions.length);
        }
    } catch (e) {
        console.log('  Error:', e.message);
    }
    
    console.log('\nLeaveTableFor Transaction:', LEAVE_TX);
    try {
        const leaveInfo = await tronWeb.trx.getTransactionInfo(LEAVE_TX);
        console.log('  Block:', leaveInfo.blockNumber);
        console.log('  Result:', leaveInfo.result ? 'SUCCESS' : 'FAILED');
        
        // Check for events
        if (leaveInfo.log) {
            console.log('  Events:', leaveInfo.log.length);
            for (const log of leaveInfo.log) {
                console.log('    - Topics:', log.topics?.map(t => t.substring(0, 20) + '...'));
            }
        }
        
        // Check internal transactions (rake transfer)
        if (leaveInfo.internal_transactions) {
            console.log('  Internal TXs:', leaveInfo.internal_transactions.length);
            for (const itx of leaveInfo.internal_transactions) {
                console.log('    - Value:', Number(itx.value || itx.callValue || 0) / 1e6, 'TRX');
            }
        }
        
        // Check contract result
        const txDetail = await tronWeb.trx.getTransaction(LEAVE_TX);
        console.log('  Contract Result:', txDetail.ret?.[0]?.contractRet);
    } catch (e) {
        console.log('  Error:', e.message);
    }
    
    // Check current player state
    console.log('\n=== Current Player State ===');
    const abi = [{'inputs':[{'name':'','type':'address'}],'name':'players','outputs':[{'name':'balance','type':'uint256'},{'name':'lockedAmount','type':'uint256'},{'name':'isRegistered','type':'bool'}],'stateMutability':'view','type':'function'}];
    const contract = await tronWeb.contract(abi, 'TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c');
    
    const p1 = await contract.players('TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv').call();
    console.log('Player 1:');
    console.log('  Balance:', Number(p1.balance) / 1e6, 'TRX');
    console.log('  Locked:', Number(p1.lockedAmount) / 1e6, 'TRX');
    
    const p2 = await contract.players('TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4').call();
    console.log('Player 2:');
    console.log('  Balance:', Number(p2.balance) / 1e6, 'TRX');
    console.log('  Locked:', Number(p2.lockedAmount) / 1e6, 'TRX');
}

main().catch(console.error);
