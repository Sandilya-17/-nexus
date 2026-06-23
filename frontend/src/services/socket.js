import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_SOCKET_URL || 'https://nexus-production-42ab.up.railway.app';

let socket = null;
const readyListeners = new Set();

// Subscribe to socket lifecycle — fires immediately with current socket (may be null),
// and again whenever a new socket is created or destroyed.
export const onSocketReady = (cb) => {
  readyListeners.add(cb);
  cb(socket);
  return () => readyListeners.delete(cb);
};

const notifyReady = () => readyListeners.forEach(cb => cb(socket));

export const initSocket = (token) => {
  if (socket?.connected) return socket;
  if (socket) { socket.disconnect(); socket = null; }

  socket = io(BACKEND_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  socket.on('connect', () => { console.log('Socket connected:', socket.id); notifyReady(); });
  socket.on('disconnect', reason => console.log('Socket disconnected:', reason));
  socket.on('connect_error', err => console.error('Socket error:', err.message));

  notifyReady();
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null; notifyReady(); }
};

export const emitTyping = (chatId, isTyping) =>
  socket?.emit(isTyping ? 'typing:start' : 'typing:stop', { chatId });

export const joinChat = (chatId) => socket?.emit('chat:join', chatId);
export const leaveChat = (chatId) => socket?.emit('chat:leave', chatId);

export default { initSocket, getSocket, disconnectSocket, emitTyping, joinChat, leaveChat, onSocketReady };
