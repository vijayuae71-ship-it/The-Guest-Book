import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  createAlbum,
  getAlbumsForEvent,
  getAlbumById,
  deleteAlbum,
  updateAlbum,
  addPhotoToAlbum,
  removePhotoFromAlbum,
  getPhotosForAlbum,
  getEventById,
} from '../db.js';

const router = Router();

// POST /:eventId - Create album
router.post('/:eventId', (req, res) => {
  try {
    const { eventId } = req.params;
    const { name, description, creatorId } = req.body;
    const event = getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (!name) return res.status(400).json({ error: 'Album name is required' });

    const album = createAlbum({
      id: uuidv4(),
      event_id: eventId,
      name,
      description: description || null,
      cover_photo: null,
      creator_id: creatorId || null,
    });
    return res.status(201).json({ album });
  } catch (err) {
    console.error('Error creating album:', err);
    return res.status(500).json({ error: 'Failed to create album' });
  }
});

// GET /:eventId - List albums for event
router.get('/:eventId', (req, res) => {
  try {
    const { eventId } = req.params;
    const albums = getAlbumsForEvent(eventId);
    return res.json({ albums });
  } catch (err) {
    console.error('Error fetching albums:', err);
    return res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

// PUT /:albumId - Update album
router.put('/:albumId', (req, res) => {
  try {
    const { albumId } = req.params;
    const { name, description } = req.body;
    const album = getAlbumById(albumId);
    if (!album) return res.status(404).json({ error: 'Album not found' });
    const updated = updateAlbum(albumId, name || album.name, description !== undefined ? description : album.description);
    return res.json({ album: updated });
  } catch (err) {
    console.error('Error updating album:', err);
    return res.status(500).json({ error: 'Failed to update album' });
  }
});

// DELETE /:albumId - Delete album
router.delete('/:albumId', (req, res) => {
  try {
    const { albumId } = req.params;
    const album = getAlbumById(albumId);
    if (!album) return res.status(404).json({ error: 'Album not found' });
    deleteAlbum(albumId);
    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting album:', err);
    return res.status(500).json({ error: 'Failed to delete album' });
  }
});

// POST /:albumId/photos - Add photos to album
router.post('/:albumId/photos', (req, res) => {
  try {
    const { albumId } = req.params;
    const { photoIds } = req.body;
    const album = getAlbumById(albumId);
    if (!album) return res.status(404).json({ error: 'Album not found' });
    if (!photoIds || !Array.isArray(photoIds)) return res.status(400).json({ error: 'photoIds array required' });

    for (const photoId of photoIds) {
      addPhotoToAlbum(albumId, photoId);
    }
    return res.json({ success: true, added: photoIds.length });
  } catch (err) {
    console.error('Error adding photos to album:', err);
    return res.status(500).json({ error: 'Failed to add photos' });
  }
});

// DELETE /:albumId/photos/:photoId - Remove photo from album
router.delete('/:albumId/photos/:photoId', (req, res) => {
  try {
    const { albumId, photoId } = req.params;
    removePhotoFromAlbum(albumId, photoId);
    return res.json({ success: true });
  } catch (err) {
    console.error('Error removing photo from album:', err);
    return res.status(500).json({ error: 'Failed to remove photo' });
  }
});

// GET /:albumId/photos - Get photos in album
router.get('/:albumId/photos', (req, res) => {
  try {
    const { albumId } = req.params;
    const photos = getPhotosForAlbum(albumId);
    return res.json({ photos });
  } catch (err) {
    console.error('Error fetching album photos:', err);
    return res.status(500).json({ error: 'Failed to fetch album photos' });
  }
});

export default router;
