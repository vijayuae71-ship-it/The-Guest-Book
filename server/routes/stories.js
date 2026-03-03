import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  createStory,
  getStoriesForEvent,
  getStory,
  deleteStory,
  getEventById,
} from '../db.js';

const router = Router();

// ─── POST /:eventId - Create a story ────────────────────────────────────────

router.post('/:eventId', (req, res) => {
  try {
    const { eventId } = req.params;
    const { creatorId, creatorName, title, slides } = req.body;

    const event = getEventById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const id = uuidv4();
    const story = createStory({
      id,
      event_id: eventId,
      creator_id: creatorId || null,
      creator_name: creatorName || null,
      title,
      slides: slides || [],
    });

    return res.status(201).json({ story });
  } catch (err) {
    console.error('Error creating story:', err);
    return res.status(500).json({ error: 'Failed to create story' });
  }
});

// ─── GET /event/:eventId - List stories for an event ────────────────────────

router.get('/event/:eventId', (req, res) => {
  try {
    const { eventId } = req.params;
    const stories = getStoriesForEvent(eventId);
    return res.json({ stories });
  } catch (err) {
    console.error('Error fetching stories:', err);
    return res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// ─── GET /:storyId - Get a single story ─────────────────────────────────────

router.get('/:storyId', (req, res) => {
  try {
    const { storyId } = req.params;
    const story = getStory(storyId);

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    return res.json({ story });
  } catch (err) {
    console.error('Error fetching story:', err);
    return res.status(500).json({ error: 'Failed to fetch story' });
  }
});

// ─── DELETE /:storyId - Delete a story ──────────────────────────────────────

router.delete('/:storyId', (req, res) => {
  try {
    const { storyId } = req.params;
    const story = getStory(storyId);

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    deleteStory(storyId);
    return res.json({ success: true, message: 'Story deleted' });
  } catch (err) {
    console.error('Error deleting story:', err);
    return res.status(500).json({ error: 'Failed to delete story' });
  }
});

export default router;
