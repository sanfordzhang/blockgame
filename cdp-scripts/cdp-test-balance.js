const WebSocket = require('ws');
const http = require('http');
const socketIO = require('socket.io-client');

// Test: connect as player and check if balance syncs correctly
async function testBalance() {
  const TESTNET_URL = 'http://43.163.114.175:3001';
  const PLAYER1_ADDR = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

  console.log('=== Connecting to testnet as player 1 ===');
  const socket = socketIO(TESTNET_URL, {
    transports: ['polling'],
    reconnection: false,
    timeout: 15000,
  });

  return new Promise((resolve, reject) => {
    socket.on('connect', () => {
      console.log('Socket connected, id:', socket.id);

      // Listen for balance events
      socket.on('SC_BALANCE_SYNCED', (data) => {
        console.log('[SC_BALANCE_SYNCED]', JSON.stringify(data));
      });

      socket.on('SC_RECEIVE_LOBBY_INFO', (data) => {
        console.log('[SC_RECEIVE_LOBBY_INFO]');
        console.log('  amount (bankroll):', data.amount, 'SUN =', (data.amount / 1e6), 'TRX');
        console.log('  socketId:', data.socketId);
        
        if (data.amount > 0) {
          console.log('\n✅ Balance synced correctly! Player has', data.amount / 1e6, 'TRX');
        } else {
          console.log('\n❌ Balance is 0! API rate limiting may still be affecting sync');
        }
        
        socket.disconnect();
        resolve();
      });

      // Emit CS_FETCH_LOBBY_INFO to trigger balance sync
      console.log('Sending CS_FETCH_LOBBY_INFO for', PLAYER1_ADDR);
      socket.emit('CS_FETCH_LOBBY_INFO', {
        walletAddress: PLAYER1_ADDR,
        gameId: '1',
        username: PLAYER1_ADDR.slice(0, 8),
      });
    });

    socket.on('connect_error', (err) => {
      console.error('Connection error:', err.message);
      reject(err);
    });

    setTimeout(() => {
      console.log('Timeout waiting for lobby info');
      socket.disconnect();
      resolve();
    }, 20000);
  });
}

testBalance().catch(console.error);
