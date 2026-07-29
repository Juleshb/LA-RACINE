import { io as createSocket } from 'socket.io-client';
import { getSocketUrl } from './config';

let socket = null;

export function getSupportSocket() {
  if (socket) return socket;

  // Same origin (Vite proxy) when unset; otherwise VITE_SOCKET_URL or VITE_API_URL
  const url = getSocketUrl();
  socket = createSocket(url || '/', {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  return socket;
}
