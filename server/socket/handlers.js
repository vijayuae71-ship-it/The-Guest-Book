/**
 * Register Socket.IO event handlers for real-time event room management.
 * @param {import('socket.io').Server} io
 */
export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // ─── join-event: join a room by event code ────────────────────────────
    socket.on('join-event', ({ eventCode, userId, userName }) => {
      if (!eventCode) return;

      const room = eventCode.toUpperCase();
      socket.join(room);

      // Store user info on the socket for cleanup on disconnect
      socket.data.eventCode = room;
      socket.data.userId = userId;
      socket.data.userName = userName;

      // Broadcast to other participants in the room
      socket.to(room).emit('participant-joined', {
        userId,
        userName,
        socketId: socket.id,
      });

      console.log(`User ${userName} (${userId}) joined room ${room}`);
    });

    // ─── leave-event: leave a room voluntarily ────────────────────────────
    socket.on('leave-event', () => {
      const { eventCode, userId, userName } = socket.data;

      if (eventCode) {
        socket.leave(eventCode);

        socket.to(eventCode).emit('participant-left', {
          userId,
          userName,
          socketId: socket.id,
        });

        console.log(`User ${userName} (${userId}) left room ${eventCode}`);

        // Clear stored data
        socket.data.eventCode = null;
        socket.data.userId = null;
        socket.data.userName = null;
      }
    });

    // ─── disconnect: cleanup on disconnect ────────────────────────────────
    socket.on('disconnect', () => {
      const { eventCode, userId, userName } = socket.data;

      if (eventCode) {
        socket.to(eventCode).emit('participant-left', {
          userId,
          userName,
          socketId: socket.id,
        });

        console.log(`User ${userName} (${userId}) disconnected from room ${eventCode}`);
      }

      console.log(`Socket disconnected: ${socket.id}`);
    });

    // ─── reaction: broadcast photo reaction to the room ─────────────────
    socket.on('reaction', ({ photoId, userId, reactionType, eventCode }) => {
      if (!eventCode) return;

      const room = eventCode.toUpperCase();
      socket.to(room).emit('photo-reaction', {
        photoId,
        userId,
        reactionType,
      });
    });

    // ─── comment: broadcast new comment to the room ─────────────────────
    socket.on('comment', ({ photoId, userId, userName, text, eventCode }) => {
      if (!eventCode) return;

      const room = eventCode.toUpperCase();
      socket.to(room).emit('new-comment', {
        photoId,
        userId,
        userName,
        text,
      });
    });

    // ─── typing: broadcast user activity to the room ────────────────────
    socket.on('typing', ({ userId, userName, eventCode, activity }) => {
      if (!eventCode) return;

      const room = eventCode.toUpperCase();
      socket.to(room).emit('user-activity', {
        userId,
        userName,
        activity,
      });
    });

    // ─── presence-ping: track who's currently viewing ───────────────────
    socket.on('presence-ping', ({ userId, userName, eventCode }) => {
      if (!eventCode) return;

      const room = eventCode.toUpperCase();
      socket.to(room).emit('presence-pong', {
        userId,
        userName,
        socketId: socket.id,
      });
    });

    // ─── chat-message: broadcast chat message to room ───────────────────
    socket.on('chat-message', ({ message, eventCode }) => {
      if (!eventCode) return;
      const room = eventCode.toUpperCase();
      socket.to(room).emit('chat-message', message);
    });

    // ─── vote: broadcast vote update to room ────────────────────────────
    socket.on('vote', ({ photoId, userId, voted, count, eventCode }) => {
      if (!eventCode) return;
      const room = eventCode.toUpperCase();
      socket.to(room).emit('vote-update', { photoId, userId, voted, count });
    });
  });
}
