import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  addReaction,
  removeReaction,
  getReactionsForPhoto,
  getReactionsForEvent,
  getPhotoById,
  getEventById,
} from '../db.js';

/**
 * Transform raw DB reactions into client-friendly format.
 * Input:  [{ reaction_type, count, user_ids: "u1,u2" }, ...]
 * Output: { counts: { heart: 2, fire: 1 }, userReactions: ['heart'] }
 */
function formatReactions(rawReactions, userId) {
  const counts = {};
  const userReactions = [];
  for (const r of rawReactions) {
    counts[r.reaction_type] = r.count;
    if (userId && r.user_ids && r.user_ids.split(',').includes(userId)) {
      userReactions.push(r.reaction_type);
    }
  }
  return { counts, userReactions };
}

/**
 * Factory function: accepts Socket.IO server so reaction routes can broadcast events.
 * @param {import('socket.io').Server} io
 * @returns {Router}
 */
export default function createReactionsRouter(io) {
  const router = Router();

  // ─── POST /:photoId/react - Toggle reaction ──────────────────────────────────

  router.post('/:photoId/react', (req, res) => {
    try {
      const { photoId } = req.params;
      const { userId, eventId, reactionType } = req.body;

      if (!userId || !eventId || !reactionType) {
        return res.status(400).json({ error: 'userId, eventId, and reactionType are required' });
      }

      const photo = getPhotoById(photoId);
      if (!photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      const validTypes = ['heart', 'fire', 'laugh', 'wow', 'sad'];
      if (!validTypes.includes(reactionType)) {
        return res.status(400).json({ error: `Invalid reaction type. Must be one of: ${validTypes.join(', ')}` });
      }

      // Toggle: try to add, if already exists (INSERT OR IGNORE won't insert), remove it
      const id = uuidv4();
      const inserted = addReaction({ id, photo_id: photoId, event_id: eventId, user_id: userId, reaction_type: reactionType });

      let action;
      if (inserted === 0) {
        // Already existed, so remove it (toggle off)
        removeReaction(photoId, userId, reactionType);
        action = 'removed';
      } else {
        action = 'added';
      }

      const rawReactions = getReactionsForPhoto(photoId);
      const { counts, userReactions } = formatReactions(rawReactions, userId);

      // Broadcast reaction update to the event room
      const event = getEventById(eventId);
      if (event) {
        io.to(event.code).emit('photo-reaction', {
          photoId,
          counts,
          userReactions,
        });
      }

      return res.json({ action, counts, userReactions });
    } catch (err) {
      console.error('Error toggling reaction:', err);
      return res.status(500).json({ error: 'Failed to toggle reaction' });
    }
  });

  // ─── GET /:photoId - Get reactions for a photo ──────────────────────────────

  router.get('/:photoId', (req, res) => {
    try {
      const { photoId } = req.params;
      const userId = req.query.userId || null;
      const photo = getPhotoById(photoId);
      if (!photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      const rawReactions = getReactionsForPhoto(photoId);
      const { counts, userReactions } = formatReactions(rawReactions, userId);
      return res.json({ counts, userReactions });
    } catch (err) {
      console.error('Error fetching reactions:', err);
      return res.status(500).json({ error: 'Failed to fetch reactions' });
    }
  });

  // ─── GET /event/:eventId - Get all reactions for an event ────────────────────

  router.get('/event/:eventId', (req, res) => {
    try {
      const { eventId } = req.params;
      const userId = req.query.userId || null;
      const event = getEventById(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Get all reactions grouped by photo, then format per photo
      const rawReactions = getReactionsForEvent(eventId);

      // Group by photo_id
      const byPhoto = {};
      for (const r of rawReactions) {
        if (!byPhoto[r.photo_id]) byPhoto[r.photo_id] = [];
        byPhoto[r.photo_id].push(r);
      }

      // Format each photo's reactions
      const reactions = {};
      for (const [photoId, photoReactions] of Object.entries(byPhoto)) {
        reactions[photoId] = formatReactions(photoReactions, userId);
      }

      return res.json({ reactions });
    } catch (err) {
      console.error('Error fetching event reactions:', err);
      return res.status(500).json({ error: 'Failed to fetch event reactions' });
    }
  });

  return router;
}
