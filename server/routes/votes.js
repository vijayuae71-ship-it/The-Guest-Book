import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  addVote,
  removeVote,
  getVotesForPhoto,
  hasUserVoted,
  getLeaderboard,
  getVoteCountsForEvent,
  getPhotoById,
  getEventById,
} from '../db.js';

const router = Router();

// POST /:photoId/vote - Toggle vote
router.post('/:photoId/vote', (req, res) => {
  try {
    const { photoId } = req.params;
    const { userId, eventId } = req.body;
    if (!userId || !eventId) return res.status(400).json({ error: 'userId and eventId required' });

    const photo = getPhotoById(photoId);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    const alreadyVoted = hasUserVoted(photoId, userId);
    if (alreadyVoted) {
      removeVote(photoId, userId);
    } else {
      addVote({ id: uuidv4(), photo_id: photoId, event_id: eventId, user_id: userId });
    }

    const count = getVotesForPhoto(photoId);
    return res.json({ voted: !alreadyVoted, count });
  } catch (err) {
    console.error('Error toggling vote:', err);
    return res.status(500).json({ error: 'Failed to toggle vote' });
  }
});

// GET /:photoId/votes - Get vote count
router.get('/:photoId/votes', (req, res) => {
  try {
    const { photoId } = req.params;
    const userId = req.query.userId;
    const count = getVotesForPhoto(photoId);
    const voted = userId ? hasUserVoted(photoId, userId) : false;
    return res.json({ count, voted });
  } catch (err) {
    console.error('Error fetching votes:', err);
    return res.status(500).json({ error: 'Failed to fetch votes' });
  }
});

// GET /event/:eventId/leaderboard - Get photo leaderboard
router.get('/event/:eventId/leaderboard', (req, res) => {
  try {
    const { eventId } = req.params;
    const limit = parseInt(req.query.limit, 10) || 10;
    const event = getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const leaderboard = getLeaderboard(eventId, limit);
    return res.json({ leaderboard });
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// GET /event/:eventId/counts - Get all vote counts for event
router.get('/event/:eventId/counts', (req, res) => {
  try {
    const { eventId } = req.params;
    const counts = getVoteCountsForEvent(eventId);
    return res.json({ counts });
  } catch (err) {
    console.error('Error fetching vote counts:', err);
    return res.status(500).json({ error: 'Failed to fetch vote counts' });
  }
});

export default router;
