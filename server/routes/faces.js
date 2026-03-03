import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import {
  saveFace,
  getFacesForEvent,
  updateFaceCluster,
  saveFaceCluster,
  getFaceClusters,
  updateFaceLabel,
  deleteFacesForEvent,
} from '../db.js';

const router = Router();

// ─── POST /:photoId - Save face descriptors for a photo ─────────────────────

router.post('/:photoId', (req, res) => {
  try {
    const { photoId } = req.params;
    const { eventId, faces } = req.body;

    if (!eventId || !Array.isArray(faces)) {
      return res.status(400).json({ error: 'eventId and faces array are required' });
    }

    const savedFaces = [];

    for (const face of faces) {
      const id = uuidv4();
      const box = face.box || {};

      const saved = saveFace({
        id,
        photo_id: photoId,
        event_id: eventId,
        descriptor: face.descriptor || null,
        cluster_id: null,
        label: null,
        thumbnail: face.thumbnail || null,
        box_x: box.x ?? null,
        box_y: box.y ?? null,
        box_width: box.width ?? null,
        box_height: box.height ?? null,
        detection_score: face.score ?? null,
      });

      savedFaces.push(saved);
    }

    return res.status(201).json({ faces: savedFaces });
  } catch (err) {
    console.error('Error saving faces:', err);
    return res.status(500).json({ error: 'Failed to save faces' });
  }
});

// ─── GET /event/:eventId - Get all faces for an event with photo info ───────

router.get('/event/:eventId', (req, res) => {
  try {
    const { eventId } = req.params;
    const faces = getFacesForEvent(eventId);
    return res.json({ faces });
  } catch (err) {
    console.error('Error fetching faces:', err);
    return res.status(500).json({ error: 'Failed to fetch faces' });
  }
});

// ─── PUT /cluster - Save cluster assignments ────────────────────────────────

router.put('/cluster', (req, res) => {
  try {
    const { clusters } = req.body;

    if (!Array.isArray(clusters)) {
      return res.status(400).json({ error: 'clusters array is required' });
    }

    for (const cluster of clusters) {
      const { id, eventId, faceIds, label } = cluster;

      if (!id || !eventId || !Array.isArray(faceIds)) {
        continue;
      }

      // Update each face's cluster_id
      for (const faceId of faceIds) {
        updateFaceCluster(faceId, id);
      }

      // Create or update the face_cluster record
      saveFaceCluster({
        id,
        event_id: eventId,
        label: label || null,
        representative_face_id: faceIds.length > 0 ? faceIds[0] : null,
        face_count: faceIds.length,
      });
    }

    return res.json({ success: true, message: 'Clusters saved' });
  } catch (err) {
    console.error('Error saving clusters:', err);
    return res.status(500).json({ error: 'Failed to save clusters' });
  }
});

// ─── PUT /:clusterId/label - Update cluster label ───────────────────────────

router.put('/:clusterId/label', (req, res) => {
  try {
    const { clusterId } = req.params;
    const { label } = req.body;

    if (label === undefined) {
      return res.status(400).json({ error: 'label is required' });
    }

    updateFaceLabel(clusterId, label);
    return res.json({ success: true, message: 'Label updated' });
  } catch (err) {
    console.error('Error updating face label:', err);
    return res.status(500).json({ error: 'Failed to update label' });
  }
});

// ─── DELETE /event/:eventId - Clear all face data for an event (for rescan) ──

router.delete('/event/:eventId', (req, res) => {
  try {
    const { eventId } = req.params;
    deleteFacesForEvent(eventId);
    return res.json({ success: true, message: 'Face data cleared' });
  } catch (err) {
    console.error('Error deleting face data:', err);
    return res.status(500).json({ error: 'Failed to clear face data' });
  }
});

// ─── GET /event/:eventId/clusters - Get clusters with counts ────────────────

router.get('/event/:eventId/clusters', (req, res) => {
  try {
    const { eventId } = req.params;
    const clusters = getFaceClusters(eventId);
    return res.json({ clusters });
  } catch (err) {
    console.error('Error fetching clusters:', err);
    return res.status(500).json({ error: 'Failed to fetch clusters' });
  }
});

// ─── GET /event/:eventId/collage - Generate face collage image ──────────────

router.get('/event/:eventId/collage', async (req, res) => {
  try {
    const { eventId } = req.params;
    const clusters = getFaceClusters(eventId);
    const faces = getFacesForEvent(eventId);

    if (clusters.length === 0) {
      return res.status(404).json({ error: 'No faces found' });
    }

    // Get one representative face per cluster (with thumbnail)
    const representativeFaces = [];
    for (const cluster of clusters) {
      const clusterFaces = faces.filter(f => f.cluster_id === (cluster._id || cluster.id));
      const withThumb = clusterFaces.find(f => f.thumbnail);
      if (withThumb) {
        representativeFaces.push({
          thumbnail: withThumb.thumbnail,
          label: cluster.label || 'Unknown',
        });
      }
    }

    if (representativeFaces.length === 0) {
      return res.status(404).json({ error: 'No face thumbnails available' });
    }

    // Create collage using sharp
    const cellSize = 128;
    const padding = 8;
    const cols = Math.min(representativeFaces.length, 4);
    const rows = Math.ceil(representativeFaces.length / cols);
    const width = cols * (cellSize + padding) + padding;
    const height = rows * (cellSize + padding) + padding;

    // Create base image with dark background
    const composites = [];
    for (let i = 0; i < representativeFaces.length; i++) {
      const face = representativeFaces[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = padding + col * (cellSize + padding);
      const y = padding + row * (cellSize + padding);

      try {
        // Convert data URL to buffer
        const base64Data = face.thumbnail.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const resized = await sharp(buffer)
          .resize(cellSize, cellSize, { fit: 'cover' })
          .png()
          .toBuffer();

        composites.push({
          input: resized,
          left: x,
          top: y,
        });
      } catch (e) {
        console.warn('Failed to process face thumbnail:', e.message);
      }
    }

    if (composites.length === 0) {
      return res.status(500).json({ error: 'Failed to create collage' });
    }

    const collage = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 15, g: 23, b: 42, alpha: 1 }, // slate-900
      },
    })
      .composite(composites)
      .png()
      .toBuffer();

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=60');
    res.send(collage);
  } catch (err) {
    console.error('Error generating face collage:', err);
    res.status(500).json({ error: 'Failed to generate collage' });
  }
});

export default router;
