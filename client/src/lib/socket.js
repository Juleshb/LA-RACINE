import { io as createSocket } from 'socket.io-client';

let socket = null;

export function getSupportSocket() {
  if (socket) return socket;

  const url = import.meta.env.VITE_SOCKET_URL || undefined; // same origin via Vite proxy
  socket = createSocket(url || '/', {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  return socket;
}
