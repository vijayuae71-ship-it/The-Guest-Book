import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  addComment,
  getCommentsForPhoto,
  getCommentById,
  deleteComment,
  getPhotoById,
  getEventById,
} from '../db.js';

/**
 * Factory function: accepts Socket.IO server so comment routes can broadcast events.
 * @param {import('socket.io').Server} io
 * @returns {Router}
 */
export default function createCommentsRouter(io) {
  const router = Router();

  // ─── POST /:photoId - Add comment ────────────────────────────────────────────

  router.post('/:photoId', (req, res) => {
    try {
      const { photoId } = req.params;
      const { userId, userName, eventId, text } = req.body;

      if (!userId || !eventId || !text) {
        return res.status(400).json({ error: 'userId, eventId, and text are required' });
      }

      const photo = getPhotoById(photoId);
      if (!photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      const id = uuidv4();
      const comment = addComment({
        id,
        photo_id: photoId,
        event_id: eventId,
        user_id: userId,
        user_name: userName || null,
        text,
      });

      // Broadcast new comment to the event room
      const event = getEventById(eventId);
      if (event) {
        io.to(event.code).emit('new-comment', {
          photoId,
          comment,
        });
      }

      return res.status(201).json({ comment });
    } catch (err) {
      console.error('Error adding comment:', err);
      return res.status(500).json({ error: 'Failed to add comment' });
    }
  });

  // ─── GET /:photoId - Get comments for photo ──────────────────────────────────

  router.get('/:photoId', (req, res) => {
    try {
      const { photoId } = req.params;
      const photo = getPhotoById(photoId);
      if (!photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      const comments = getCommentsForPhoto(photoId);
      return res.json({ comments });
    } catch (err) {
      console.error('Error fetching comments:', err);
      return res.status(500).json({ error: 'Failed to fetch comments' });
    }
  });

  // ─── DELETE /:commentId - Delete comment ─────────────────────────────────────

  router.delete('/:commentId', (req, res) => {
    try {
      const { commentId } = req.params;
      const hostId = req.headers['x-host-id'] || req.headers['hostid'];
      const userId = req.headers['x-user-id'] || req.headers['userid'];

      const comment = getCommentById(commentId);
      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      // Check if the requester is the comment creator or the event host
      const event = getEventById(comment.event_id);
      const isHost = event && event.host_id === hostId;
      const isCreator = comment.user_id === userId;

      if (!isHost && !isCreator) {
        return res.status(403).json({ error: 'Only the comment creator or event host can delete comments' });
      }

      deleteComment(commentId);

      // Broadcast comment deletion to the event room
      if (event) {
        io.to(event.code).emit('comment-deleted', {
          photoId: comment.photo_id,
          commentId,
        });
      }

      return res.json({ success: true, message: 'Comment deleted' });
    } catch (err) {
      console.error('Error deleting comment:', err);
      return res.status(500).json({ error: 'Failed to delete comment' });
    }
  });

  return router;
}
