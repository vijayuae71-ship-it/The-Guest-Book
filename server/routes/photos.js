import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import upload from '../middleware/upload.js';
import { processImage } from '../utils/imageProcessor.js';
import { computeImageHash, hammingDistance } from '../utils/imageHash.js';
import { scorePhoto } from '../utils/photoScoring.js';
import { encryptFile, decryptFile, resolveFilePath } from '../utils/crypto.js';
import {
  addPhoto,
  getPhotosForEvent,
  getPhotoById,
  deletePhoto,
  getEventById,
  getPendingPhotos,
  approvePhoto,
  rejectPhoto,
  updatePhotoHash,
  markDuplicate,
  getPhotoHashesForEvent,
  updateHighlightScore,
  getTopPhotos,
  updatePhotoCaption,
  updatePhotoGPS,
} from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.join(__dirname, '..', 'uploads');

/**
 * Factory function: accepts Socket.IO server so photo routes can broadcast events.
 * @param {import('socket.io').Server} io
 * @returns {Router}
 */
export default function createPhotosRouter(io) {
  const router = Router();

  // ─── POST /:eventId - Upload photos ─────────────────────────────────────

  router.post('/:eventId', upload.array('photos', 20), async (req, res) => {
    try {
      const { eventId } = req.params;
      const { uploaderId, uploaderName } = req.body;

      const event = getEventById(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No photos uploaded' });
      }

      const outputDir = path.join(uploadsRoot, eventId);
      const photos = [];

      for (const file of req.files) {
        const id = uuidv4();

        let processed;
        try {
          processed = await processImage(file.path, outputDir);
        } catch (procErr) {
          console.error(`Failed to process image ${file.originalname}:`, procErr);
          // Still save the photo even if processing fails
          processed = { thumbnail: null, width: null, height: null, takenAt: null };
        }

        // Compute image hash and highlight score before encryption
        let imageHash = null;
        let highlightScore = null;
        const photoFilePath = path.join(outputDir, file.filename);
        try {
          imageHash = await computeImageHash(photoFilePath);
        } catch (hashErr) {
          console.error(`Failed to compute image hash for ${file.originalname}:`, hashErr);
        }
        try {
          highlightScore = await scorePhoto(photoFilePath);
        } catch (scoreErr) {
          console.error(`Failed to score photo ${file.originalname}:`, scoreErr);
        }

        // Encrypt the main photo file
        try {
          encryptFile(photoFilePath);
        } catch (encErr) {
          console.error(`Failed to encrypt photo ${file.filename}:`, encErr);
        }

        // Encrypt the thumbnail if it exists
        if (processed.thumbnail) {
          try {
            encryptFile(path.join(outputDir, processed.thumbnail));
          } catch (encErr) {
            console.error(`Failed to encrypt thumbnail ${processed.thumbnail}:`, encErr);
          }
        }

        const photo = addPhoto({
          id,
          event_id: eventId,
          filename: file.filename,
          thumbnail: processed.thumbnail,
          original_name: file.originalname,
          uploader_id: uploaderId || null,
          uploader_name: uploaderName || null,
          width: processed.width,
          height: processed.height,
          file_size: file.size,
          mime_type: file.mimetype,
          taken_at: processed.takenAt,
          status: event.moderation_enabled ? 'pending' : 'approved',
        });

        // Store GPS coordinates if available
        if (processed.latitude != null && processed.longitude != null) {
          try {
            updatePhotoGPS(id, processed.latitude, processed.longitude);
          } catch (gpsErr) {
            console.error(`Failed to store GPS data for ${file.originalname}:`, gpsErr);
          }
        }

        // Store image hash and check for duplicates
        if (imageHash) {
          try {
            updatePhotoHash(id, imageHash);
            const existingHashes = getPhotoHashesForEvent(eventId);
            for (const existing of existingHashes) {
              if (existing.id !== id && existing.image_hash) {
                const distance = hammingDistance(imageHash, existing.image_hash);
                if (distance < 5) {
                  markDuplicate(id);
                  break;
                }
              }
            }
          } catch (dupErr) {
            console.error(`Failed to check duplicates for ${file.originalname}:`, dupErr);
          }
        }

        // Store highlight score
        if (highlightScore !== null) {
          try {
            updateHighlightScore(id, highlightScore);
          } catch (scoreErr) {
            console.error(`Failed to store highlight score for ${file.originalname}:`, scoreErr);
          }
        }

        photos.push(photo);

        // Broadcast to all clients in the event room (only for approved photos)
        if (!event.moderation_enabled || photo.status === 'approved') {
          io.to(event.code).emit('new-photo', photo);
        }
      }

      return res.status(201).json({ photos });
    } catch (err) {
      console.error('Error uploading photos:', err);
      return res.status(500).json({ error: 'Failed to upload photos' });
    }
  });

  // ─── GET /:eventId - List all photos for an event ───────────────────────

  router.get('/:eventId', (req, res) => {
    try {
      const { eventId } = req.params;
      const event = getEventById(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const photos = getPhotosForEvent(eventId);
      return res.json({ photos });
    } catch (err) {
      console.error('Error fetching photos:', err);
      return res.status(500).json({ error: 'Failed to fetch photos' });
    }
  });

  // ─── GET /:eventId/download/:photoId - Download a single photo ──────────

  router.get('/:eventId/download/:photoId', (req, res) => {
    try {
      const { eventId, photoId } = req.params;
      const photo = getPhotoById(photoId);

      if (!photo || photo.event_id !== eventId) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      const basePath = path.join(uploadsRoot, eventId, photo.filename);
      const resolved = resolveFilePath(basePath);

      if (!resolved.path) {
        return res.status(404).json({ error: 'Photo file not found on disk' });
      }

      const downloadName = photo.original_name || photo.filename;
      res.set('Content-Disposition', `attachment; filename="${downloadName}"`);

      if (resolved.encrypted) {
        try {
          const decrypted = decryptFile(resolved.path);
          const ext = path.extname(photo.filename).toLowerCase();
          const mimeTypes = {
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
            '.png': 'image/png', '.gif': 'image/gif',
            '.webp': 'image/webp',
          };
          res.set('Content-Type', mimeTypes[ext] || 'application/octet-stream');
          return res.send(decrypted);
        } catch (decErr) {
          console.error('Decryption failed during download:', decErr);
          return res.status(500).json({ error: 'Failed to decrypt photo' });
        }
      }

      return res.sendFile(resolved.path);
    } catch (err) {
      console.error('Error downloading photo:', err);
      return res.status(500).json({ error: 'Failed to download photo' });
    }
  });

  // ─── GET /:eventId/download-all - Download all photos as zip ────────────

  router.get('/:eventId/download-all', (req, res) => {
    try {
      const { eventId } = req.params;
      const event = getEventById(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const photos = getPhotosForEvent(eventId);
      if (photos.length === 0) {
        return res.status(404).json({ error: 'No photos to download' });
      }

      const zipFilename = `${event.name.replace(/[^a-zA-Z0-9]/g, '_')}_photos.zip`;
      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', `attachment; filename="${zipFilename}"`);

      const archive = archiver('zip', { zlib: { level: 5 } });

      archive.on('error', (archiveErr) => {
        console.error('Archive error:', archiveErr);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to create zip archive' });
        }
      });

      archive.pipe(res);

      for (const photo of photos) {
        const basePath = path.join(uploadsRoot, eventId, photo.filename);
        const resolved = resolveFilePath(basePath);

        if (resolved.path) {
          const archiveName = photo.original_name || photo.filename;
          if (resolved.encrypted) {
            try {
              const decrypted = decryptFile(resolved.path);
              archive.append(decrypted, { name: archiveName });
            } catch {
              // Skip files that fail to decrypt
            }
          } else {
            archive.file(resolved.path, { name: archiveName });
          }
        }
      }

      archive.finalize();
    } catch (err) {
      console.error('Error downloading all photos:', err);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Failed to download photos' });
      }
    }
  });

  // ─── DELETE /:photoId - Delete a single photo ───────────────────────────

  router.delete('/:photoId', (req, res) => {
    try {
      const { photoId } = req.params;
      const hostId = req.headers['x-host-id'] || req.headers['hostid'];
      const photo = getPhotoById(photoId);

      if (!photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      // Only the event host can delete photos
      const event = getEventById(photo.event_id);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      if (event.host_id !== hostId) {
        return res.status(403).json({ error: 'Only the host can delete photos' });
      }

      // Delete the physical file (encrypted or plain)
      const filePath = path.join(uploadsRoot, photo.event_id, photo.filename);
      const resolved = resolveFilePath(filePath);
      if (resolved.path) {
        fs.unlinkSync(resolved.path);
      }

      // Delete the thumbnail (encrypted or plain)
      if (photo.thumbnail) {
        const thumbPath = path.join(uploadsRoot, photo.event_id, photo.thumbnail);
        const thumbResolved = resolveFilePath(thumbPath);
        if (thumbResolved.path) {
          fs.unlinkSync(thumbResolved.path);
        }
      }

      // Delete from database
      deletePhoto(photoId);

      // Broadcast deletion to event room
      io.to(event.code).emit('photo-deleted', { photoId });

      return res.json({ success: true, message: 'Photo deleted' });
    } catch (err) {
      console.error('Error deleting photo:', err);
      return res.status(500).json({ error: 'Failed to delete photo' });
    }
  });

  // ─── GET /:eventId/pending - Get pending photos (host only) ──────────────

  router.get('/:eventId/pending', (req, res) => {
    try {
      const { eventId } = req.params;
      const hostId = req.headers['x-host-id'] || req.headers['hostid'];

      const event = getEventById(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      if (event.host_id !== hostId) {
        return res.status(403).json({ error: 'Only the host can view pending photos' });
      }

      const photos = getPendingPhotos(eventId);
      return res.json({ photos });
    } catch (err) {
      console.error('Error fetching pending photos:', err);
      return res.status(500).json({ error: 'Failed to fetch pending photos' });
    }
  });

  // ─── PUT /:photoId/approve - Approve photo (host only) ─────────────────

  router.put('/:photoId/approve', (req, res) => {
    try {
      const { photoId } = req.params;
      const hostId = req.headers['x-host-id'] || req.headers['hostid'];

      const photo = getPhotoById(photoId);
      if (!photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      const event = getEventById(photo.event_id);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      if (event.host_id !== hostId) {
        return res.status(403).json({ error: 'Only the host can approve photos' });
      }

      const approved = approvePhoto(photoId);

      // Broadcast the newly approved photo to all clients
      io.to(event.code).emit('new-photo', approved);

      return res.json({ photo: approved });
    } catch (err) {
      console.error('Error approving photo:', err);
      return res.status(500).json({ error: 'Failed to approve photo' });
    }
  });

  // ─── PUT /:photoId/reject - Reject/delete photo (host only) ────────────

  router.put('/:photoId/reject', (req, res) => {
    try {
      const { photoId } = req.params;
      const hostId = req.headers['x-host-id'] || req.headers['hostid'];

      const photo = getPhotoById(photoId);
      if (!photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      const event = getEventById(photo.event_id);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      if (event.host_id !== hostId) {
        return res.status(403).json({ error: 'Only the host can reject photos' });
      }

      // Delete the physical file (encrypted or plain)
      const filePath = path.join(uploadsRoot, photo.event_id, photo.filename);
      const resolved = resolveFilePath(filePath);
      if (resolved.path) {
        fs.unlinkSync(resolved.path);
      }

      // Delete the thumbnail (encrypted or plain)
      if (photo.thumbnail) {
        const thumbPath = path.join(uploadsRoot, photo.event_id, photo.thumbnail);
        const thumbResolved = resolveFilePath(thumbPath);
        if (thumbResolved.path) {
          fs.unlinkSync(thumbResolved.path);
        }
      }

      rejectPhoto(photoId);

      return res.json({ success: true, message: 'Photo rejected and deleted' });
    } catch (err) {
      console.error('Error rejecting photo:', err);
      return res.status(500).json({ error: 'Failed to reject photo' });
    }
  });

  // ─── GET /:eventId/highlights - Get top-scored photos for reels ────────

  router.get('/:eventId/highlights', (req, res) => {
    try {
      const { eventId } = req.params;
      const limit = parseInt(req.query.limit, 10) || 20;

      const event = getEventById(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const photos = getTopPhotos(eventId, limit);
      return res.json({ photos });
    } catch (err) {
      console.error('Error fetching highlight photos:', err);
      return res.status(500).json({ error: 'Failed to fetch highlight photos' });
    }
  });

  // ─── PUT /:photoId/caption - Update photo caption ──────────────────────────
  router.put('/:photoId/caption', (req, res) => {
    try {
      const { photoId } = req.params;
      const { caption } = req.body;
      const photo = getPhotoById(photoId);
      if (!photo) return res.status(404).json({ error: 'Photo not found' });

      const updated = updatePhotoCaption(photoId, caption || null);
      return res.json({ photo: updated });
    } catch (err) {
      console.error('Error updating caption:', err);
      return res.status(500).json({ error: 'Failed to update caption' });
    }
  });

  return router;
}
