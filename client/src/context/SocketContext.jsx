import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(window.location.origin, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    return () => {
      if (socket.connected) {
        socket.disconnect();
      }
    };
  }, []);

  const getSocket = useCallback(() => {
    const socket = socketRef.current;
    if (socket && !socket.connected) {
      socket.connect();
    }
    return socket;
  }, []);

  const joinRoom = useCallback((code, userName) => {
    const socket = getSocket();
    if (socket) {
      socket.emit('join-room', { code, userName });
    }
  }, [getSocket]);

  const leaveRoom = useCallback((code) => {
    const socket = getSocket();
    if (socket) {
      socket.emit('leave-room', { code });
    }
  }, [getSocket]);

  const value = {
    socket: socketRef.current,
    getSocket,
    joinRoom,
    leaveRoom,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

export default SocketContext;
