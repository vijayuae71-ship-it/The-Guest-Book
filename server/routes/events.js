import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import sharp from 'sharp';
import {
  createEvent,
  getEventByCode,
  getEventById,
  addParticipant,
  getParticipants,
  deleteEvent,
  getPhotosForEvent,
  updateEventModeration,
  updateEventExpiry,
  getEventStats,
  updateEventTheme,
  setParticipantVip,
  getVipParticipants,
} from '../db.js';
import { generateRoomCode } from '../utils/codeGenerator.js';

const router = Router();

/**
 * Strip password_hash from event before sending to clients.
 */
function sanitizeEvent(event) {
  if (!event) return null;
  const { password_hash, ...safe } = event;
  return { ...safe, hasPassword: !!password_hash };
}

/**
 * Escape special XML characters for safe SVG embedding.
 */
function escapeXml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ─── POST / - Create a new event ────────────────────────────────────────────

router.post('/', async (req, res) => {
  try {
    const { name, hostName, hostId, eventDate, password } = req.body;

    if (!name || !hostName || !hostId) {
      return res.status(400).json({ error: 'name, hostName, and hostId are required' });
    }

    const id = uuidv4();

    // Generate a unique room code (retry if collision)
    let code;
    let attempts = 0;
    do {
      code = generateRoomCode();
      attempts++;
      if (attempts > 100) {
        return res.status(500).json({ error: 'Failed to generate unique room code' });
      }
    } while (getEventByCode(code));

    let password_hash = null;
    if (password) {
      password_hash = await bcrypt.hash(password, 10);
    }

    const event = createEvent({
      id,
      name,
      code,
      password_hash,
      host_name: hostName,
      host_id: hostId,
      cover_photo: null,
      event_date: eventDate || null,
    });

    // Also add the host as a participant
    addParticipant({
      id: uuidv4(),
      event_id: id,
      user_id: hostId,
      display_name: hostName,
    });

    // Generate QR code data URL
    const qrDataUrl = await QRCode.toDataURL(code, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    return res.status(201).json({
      event: sanitizeEvent(event),
      qrCode: qrDataUrl,
    });
  } catch (err) {
    console.error('Error creating event:', err);
    return res.status(500).json({ error: 'Failed to create event' });
  }
});

// ─── GET /:code - Get event by code ─────────────────────────────────────────

router.get('/:code', (req, res) => {
  try {
    const { code } = req.params;
    const event = getEventByCode(code.toUpperCase());

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    return res.json({ event: sanitizeEvent(event) });
  } catch (err) {
    console.error('Error fetching event:', err);
    return res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// ─── POST /:code/join - Join an event ───────────────────────────────────────

router.post('/:code/join', async (req, res) => {
  try {
    const { code } = req.params;
    const { userName, userId, password } = req.body;

    if (!userName || !userId) {
      return res.status(400).json({ error: 'userName and userId are required' });
    }

    const event = getEventByCode(code.toUpperCase());
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Validate password if the event has one
    if (event.password_hash) {
      if (!password) {
        return res.status(401).json({ error: 'Password required', requiresPassword: true });
      }
      const valid = await bcrypt.compare(password, event.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid password' });
      }
    }

    // Add participant (INSERT OR IGNORE handles duplicates)
    addParticipant({
      id: uuidv4(),
      event_id: event.id,
      user_id: userId,
      display_name: userName,
    });

    return res.json({ event: sanitizeEvent(event) });
  } catch (err) {
    console.error('Error joining event:', err);
    return res.status(500).json({ error: 'Failed to join event' });
  }
});

// ─── GET /:id/participants - List participants for an event ─────────────────

router.get('/:id/participants', (req, res) => {
  try {
    const { id } = req.params;
    const event = getEventById(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const participants = getParticipants(id);
    return res.json({ participants });
  } catch (err) {
    console.error('Error fetching participants:', err);
    return res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

// ─── GET /:code/qr - Get QR code as PNG image ──────────────────────────────

router.get('/:code/qr', async (req, res) => {
  try {
    const { code } = req.params;
    const event = getEventByCode(code.toUpperCase());
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const buffer = await QRCode.toBuffer(code.toUpperCase(), {
      type: 'png',
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="event-${code}-qr.png"`);
    return res.send(buffer);
  } catch (err) {
    console.error('Error generating QR code:', err);
    return res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// ─── DELETE /:id - Delete an event (host only) ─────────────────────────────

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const hostId = req.headers['x-host-id'] || req.headers['hostid'];
    const event = getEventById(id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.host_id !== hostId) {
      return res.status(403).json({ error: 'Only the host can delete this event' });
    }

    deleteEvent(id);
    return res.json({ success: true, message: 'Event deleted' });
  } catch (err) {
    console.error('Error deleting event:', err);
    return res.status(500).json({ error: 'Failed to delete event' });
  }
});

// ─── PUT /:eventId/settings - Update event settings (host only) ─────────────

router.put('/:eventId/settings', (req, res) => {
  try {
    const { eventId } = req.params;
    const hostId = req.headers['x-host-id'];
    const event = getEventById(eventId);

    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.host_id !== hostId) return res.status(403).json({ error: 'Host only' });

    const { moderationEnabled, expiresAt } = req.body;

    if (moderationEnabled !== undefined) {
      updateEventModeration(eventId, moderationEnabled ? 1 : 0);
    }
    if (expiresAt !== undefined) {
      updateEventExpiry(eventId, expiresAt);
    }

    const updated = getEventById(eventId);
    return res.json({ event: updated });
  } catch (err) {
    console.error('Error updating event settings:', err);
    return res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ─── GET /:eventId/stats - Get event statistics ─────────────────────────────

router.get('/:eventId/stats', (req, res) => {
  try {
    const { eventId } = req.params;
    const event = getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const stats = getEventStats(eventId);
    return res.json({ stats });
  } catch (err) {
    console.error('Error getting event stats:', err);
    return res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ─── GET /:eventId/recap - Generate shareable event recap card ───────────────

router.get('/:eventId/recap', async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const stats = getEventStats(eventId);

    const width = 600;
    const height = 400;

    // Create SVG with event recap
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1e1b4b;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#6366f1" />
            <stop offset="100%" style="stop-color:#a855f7" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#bg)" rx="20"/>
        <rect x="30" y="30" width="${width - 60}" height="4" fill="url(#accent)" rx="2"/>
        <text x="30" y="75" font-family="Arial,sans-serif" font-size="14" fill="#94a3b8" font-weight="500">EVENT RECAP</text>
        <text x="30" y="115" font-family="Arial,sans-serif" font-size="28" fill="#f1f5f9" font-weight="bold">${escapeXml(event.name || 'Untitled Event')}</text>
        <text x="30" y="145" font-family="Arial,sans-serif" font-size="14" fill="#64748b">Hosted by ${escapeXml(event.host_name || 'Unknown')}${event.event_date ? ' · ' + event.event_date : ''}</text>

        <rect x="30" y="175" width="${(width - 90) / 3}" height="90" fill="#1e293b" rx="12"/>
        <text x="${30 + (width - 90) / 6}" y="215" font-family="Arial,sans-serif" font-size="32" fill="#f1f5f9" font-weight="bold" text-anchor="middle">${stats?.photo_count || 0}</text>
        <text x="${30 + (width - 90) / 6}" y="245" font-family="Arial,sans-serif" font-size="12" fill="#94a3b8" text-anchor="middle">Photos</text>

        <rect x="${30 + (width - 90) / 3 + 15}" y="175" width="${(width - 90) / 3}" height="90" fill="#1e293b" rx="12"/>
        <text x="${30 + (width - 90) / 3 + 15 + (width - 90) / 6}" y="215" font-family="Arial,sans-serif" font-size="32" fill="#f1f5f9" font-weight="bold" text-anchor="middle">${stats?.participant_count || 0}</text>
        <text x="${30 + (width - 90) / 3 + 15 + (width - 90) / 6}" y="245" font-family="Arial,sans-serif" font-size="12" fill="#94a3b8" text-anchor="middle">Guests</text>

        <rect x="${30 + 2 * ((width - 90) / 3 + 15)}" y="175" width="${(width - 90) / 3}" height="90" fill="#1e293b" rx="12"/>
        <text x="${30 + 2 * ((width - 90) / 3 + 15) + (width - 90) / 6}" y="215" font-family="Arial,sans-serif" font-size="32" fill="#f1f5f9" font-weight="bold" text-anchor="middle">${stats?.face_count || 0}</text>
        <text x="${30 + 2 * ((width - 90) / 3 + 15) + (width - 90) / 6}" y="245" font-family="Arial,sans-serif" font-size="12" fill="#94a3b8" text-anchor="middle">Faces</text>

        <rect x="30" y="285" width="${width - 60}" height="50" fill="#1e293b" rx="12"/>
        <text x="${width / 2}" y="316" font-family="Arial,sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">${stats?.reaction_count || 0} reactions · ${stats?.comment_count || 0} comments · ${stats?.story_count || 0} stories</text>

        <text x="30" y="375" font-family="Arial,sans-serif" font-size="11" fill="#475569">The Guest Book</text>
        <text x="${width - 30}" y="375" font-family="Arial,sans-serif" font-size="11" fill="#475569" text-anchor="end">Created with love</text>
      </svg>
    `;

    const png = await sharp(Buffer.from(svg)).png().toBuffer();

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=60');
    res.send(png);
  } catch (err) {
    console.error('Error generating recap card:', err);
    res.status(500).json({ error: 'Failed to generate recap card' });
  }
});

// ─── PUT /:eventId/theme - Update event theme (host only) ────────────────────
router.put('/:eventId/theme', (req, res) => {
  try {
    const { eventId } = req.params;
    const hostId = req.headers['x-host-id'];
    const event = getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.host_id !== hostId) return res.status(403).json({ error: 'Host only' });

    const { accentColor, fontFamily, coverLayout, templateId } = req.body;
    const updated = updateEventTheme(eventId, { accentColor, fontFamily, coverLayout, templateId });
    return res.json({ event: sanitizeEvent(updated) });
  } catch (err) {
    console.error('Error updating theme:', err);
    return res.status(500).json({ error: 'Failed to update theme' });
  }
});

// ─── PUT /:eventId/vip/:userId - Set VIP status for participant ──────────────
router.put('/:eventId/vip/:userId', (req, res) => {
  try {
    const { eventId, userId } = req.params;
    const hostId = req.headers['x-host-id'];
    const event = getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.host_id !== hostId) return res.status(403).json({ error: 'Host only' });

    const { isVip } = req.body;
    setParticipantVip(eventId, userId, isVip);
    return res.json({ success: true });
  } catch (err) {
    console.error('Error setting VIP:', err);
    return res.status(500).json({ error: 'Failed to set VIP status' });
  }
});

// ─── GET /:eventId/vip - Get VIP participants ────────────────────────────────
router.get('/:eventId/vip', (req, res) => {
  try {
    const { eventId } = req.params;
    const vips = getVipParticipants(eventId);
    return res.json({ participants: vips });
  } catch (err) {
    console.error('Error fetching VIPs:', err);
    return res.status(500).json({ error: 'Failed to fetch VIP participants' });
  }
});

export default router;
