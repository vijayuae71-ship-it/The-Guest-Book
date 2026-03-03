import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import eventsRouter from './routes/events.js';
import createPhotosRouter from './routes/photos.js';
import facesRouter from './routes/faces.js';
import storiesRouter from './routes/stories.js';
import createReactionsRouter from './routes/reactions.js';
import createCommentsRouter from './routes/comments.js';
import albumsRouter from './routes/albums.js';
import votesRouter from './routes/votes.js';
import createChatRouter from './routes/chat.js';
import templatesRouter from './routes/templates.js';
import { registerSocketHandlers } from './socket/handlers.js';
import { isParticipant, getEventById } from './db.js';
import { resolveFilePath, decryptFile } from './utils/crypto.js';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// ─── Socket.IO ──────────────────────────────────────────────────────────────

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// ─── Middleware ──────────────────────────────────────────────────────────────

app.use(cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Static Files ───────────────────────────────────────────────────────────

// Serve uploaded files — only to event participants
const uploadsDir = path.join(__dirname, 'uploads');
app.get('/uploads/:eventId/:filename', (req, res) => {
  const { eventId, filename } = req.params;
  const uid = req.query.uid || req.headers['x-user-id'];

  // Verify the event exists
  const event = getEventById(eventId);
  if (!event) {
    return res.status(404).json({ error: 'Not found' });
  }

  // Verify the requester is a participant (or host)
  if (!uid || !isParticipant(eventId, uid)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Serve the file (handle encrypted or plain)
  const basePath = path.join(uploadsDir, eventId, filename);
  const resolved = resolveFilePath(basePath);

  if (!resolved.path) {
    return res.status(404).json({ error: 'File not found' });
  }

  if (resolved.encrypted) {
    // Decrypt and send
    try {
      const decrypted = decryptFile(resolved.path);
      // Determine content type from extension
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.png': 'image/png', '.gif': 'image/gif',
        '.webp': 'image/webp', '.heic': 'image/heic',
        '.heif': 'image/heif',
      };
      res.set('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.set('Cache-Control', 'private, max-age=3600');
      return res.send(decrypted);
    } catch (decErr) {
      console.error('Decryption failed:', decErr);
      return res.status(500).json({ error: 'Failed to read file' });
    }
  }

  // Plain file (legacy / unencrypted)
  return res.sendFile(resolved.path);
});

// ─── API Routes ─────────────────────────────────────────────────────────────

app.use('/api/events', eventsRouter);
app.use('/api/photos', createPhotosRouter(io));
app.use('/api/faces', facesRouter);
app.use('/api/stories', storiesRouter);
app.use('/api/reactions', createReactionsRouter(io));
app.use('/api/comments', createCommentsRouter(io));
app.use('/api/albums', albumsRouter);
app.use('/api/votes', votesRouter);
app.use('/api/chat', createChatRouter(io));
app.use('/api/templates', templatesRouter);

// ─── Health Check ───────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Production: serve client build ─────────────────────────────────────────

// Always serve client build (production mode)
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// SPA fallback: serve index.html for all non-API, non-static routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.sendFile(path.join(clientDist, 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// ─── Socket Handlers ────────────────────────────────────────────────────────

registerSocketHandlers(io);

// ─── Start Server ───────────────────────────────────────────────────────────

const PORT = process.env.PORT || 8080;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`  API:     http://localhost:${PORT}/api`);
  console.log(`  Uploads: http://localhost:${PORT}/uploads`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`  Client:  http://localhost:${PORT}`);
  }
});

export { app, httpServer, io };
