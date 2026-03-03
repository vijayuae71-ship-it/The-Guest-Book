import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  addMessage,
  getMessagesForEvent,
  getRecentMessages,
  deleteMessage as dbDeleteMessage,
  getMessageById,
  getEventById,
} from '../db.js';

/**
 * Factory function: accepts Socket.IO server for real-time chat.
 * @param {import('socket.io').Server} io
 * @returns {Router}
 */
export default function createChatRouter(io) {
  const router = Router();

  // POST /:eventId - Send a message
  router.post('/:eventId', (req, res) => {
    try {
      const { eventId } = req.params;
      const { userId, userName, text, replyTo } = req.body;
      if (!userId || !text) return res.status(400).json({ error: 'userId and text required' });

      const event = getEventById(eventId);
      if (!event) return res.status(404).json({ error: 'Event not found' });

      const message = addMessage({
        id: uuidv4(),
        event_id: eventId,
        user_id: userId,
        user_name: userName || 'Anonymous',
        text,
        reply_to: replyTo || null,
      });

      // Broadcast to event room
      io.to(event.code).emit('chat-message', message);

      return res.status(201).json({ message });
    } catch (err) {
      console.error('Error sending message:', err);
      return res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // GET /:eventId - Get messages for event
  router.get('/:eventId', (req, res) => {
    try {
      const { eventId } = req.params;
      const event = getEventById(eventId);
      if (!event) return res.status(404).json({ error: 'Event not found' });

      const messages = getMessagesForEvent(eventId);
      return res.json({ messages });
    } catch (err) {
      console.error('Error fetching messages:', err);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // GET /:eventId/recent - Get recent messages
  router.get('/:eventId/recent', (req, res) => {
    try {
      const { eventId } = req.params;
      const limit = parseInt(req.query.limit, 10) || 50;
      const messages = getRecentMessages(eventId, limit).reverse();
      return res.json({ messages });
    } catch (err) {
      console.error('Error fetching recent messages:', err);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // DELETE /:messageId - Delete a message
  router.delete('/:messageId', (req, res) => {
    try {
      const { messageId } = req.params;
      const hostId = req.headers['x-host-id'];
      const userId = req.headers['x-user-id'];

      const msg = getMessageById(messageId);
      if (!msg) return res.status(404).json({ error: 'Message not found' });

      const event = getEventById(msg.event_id);
      if (event && event.host_id !== hostId && msg.user_id !== userId) {
        return res.status(403).json({ error: 'Cannot delete this message' });
      }

      dbDeleteMessage(messageId);

      // Broadcast deletion
      if (event) {
        io.to(event.code).emit('chat-message-deleted', { messageId });
      }

      return res.json({ success: true });
    } catch (err) {
      console.error('Error deleting message:', err);
      return res.status(500).json({ error: 'Failed to delete message' });
    }
  });

  return router;
}
