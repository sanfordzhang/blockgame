/**
 * Socket.io client connection singleton
 * Used by pages that need direct socket access
 */
import { io } from 'socket.io-client';
import { getSocketBaseUrl } from './utils/serverConfig';

const socketUrl = getSocketBaseUrl();

console.log('[Socket] Connecting to:', socketUrl);

let socket = null;

function getSocket() {
  if (!socket) {
    socket = io(socketUrl, {
      transports: ['polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      upgrade: false,
      autoConnect: true
    });
  }
  return socket;
}

// Export singleton instance
export default getSocket();

// Also export the function for testing
export { getSocket };
