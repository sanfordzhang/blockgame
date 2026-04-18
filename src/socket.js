/**
 * Socket.io client connection singleton
 * Used by pages that need direct socket access
 */
import { io } from 'socket.io-client';
import config from './clientConfig';

// Get server URL from config or environment
// Note: clientConfig exports socketURI, not serverUrl
const SERVER_URL = config?.socketURI || config?.serverUrl || process.env.REACT_APP_SERVER_URL || 'http://localhost:7778';
const SERVER_PORT = process.env.REACT_APP_SERVER_PORT || 7778;

// Create socket instance
// If SERVER_URL already includes port (from socketURI), use it directly
const socketUrl = SERVER_URL.includes(':') ? SERVER_URL : `${SERVER_URL}:${SERVER_PORT}`;

console.log('[Socket] Connecting to:', socketUrl);

let socket = null;

function getSocket() {
  if (!socket) {
    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: false
    });
  }
  return socket;
}

// Export singleton instance
export default getSocket();

// Also export the function for testing
export { getSocket };
