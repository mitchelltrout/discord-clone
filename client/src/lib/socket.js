'use client';
import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  return socket;
}

export function connectSocket(accessToken) {
  if (socket?.connected) return socket;

  const wsUrl = typeof window !== 'undefined'
    ? (window.location.hostname === 'localhost'
        ? `${window.location.protocol}//${window.location.hostname}:4000`
        : window.location.origin)
    : 'http://localhost:4000';

  socket = io(wsUrl, {
    auth: { token: accessToken },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  });

  async function getStores() {
    const [{ useAuthStore }, { useConnectionStore }] = await Promise.all([
      import('./stores/authStore'),
      import('./stores/connectionStore'),
    ]);
    return { useAuthStore, useConnectionStore };
  }

  socket.on('connect', async () => {
    console.log('Socket connected');
    const { useConnectionStore } = await getStores();
    useConnectionStore.getState().setStatus('connected');
  });

  socket.on('disconnect', async (reason) => {
    console.log('Socket disconnected:', reason);
    if (reason === 'io server disconnect' || reason === 'io client disconnect') return;
    const { useConnectionStore } = await getStores();
    useConnectionStore.getState().setStatus('reconnecting');
  });

  socket.on('connect_error', async (err) => {
    console.error('Socket error:', err.message);
    // Auth rejection from server — force logout
    if (err.message === 'Authentication error' || err.data?.type === 'UnauthorizedError') {
      const { useAuthStore, useConnectionStore } = await getStores();
      useConnectionStore.getState().setStatus('failed');
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
  });

  socket.on('reconnect_failed', async () => {
    console.error('Socket reconnect failed');
    const { useAuthStore, useConnectionStore } = await getStores();
    useConnectionStore.getState().setStatus('failed');
    useAuthStore.getState().logout();
    window.location.href = '/login';
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
