import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'photo-dump.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read/write performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    code        TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    host_name   TEXT NOT NULL,
    host_id     TEXT NOT NULL,
    cover_photo TEXT,
    event_date  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS participants (
    id           TEXT PRIMARY KEY,
    event_id     TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    display_name TEXT NOT NULL,
    joined_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(event_id, user_id),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS photos (
    id            TEXT PRIMARY KEY,
    event_id      TEXT NOT NULL,
    filename      TEXT NOT NULL,
    thumbnail     TEXT,
    original_name TEXT,
    uploader_id   TEXT,
    uploader_name TEXT,
    width         INTEGER,
    height        INTEGER,
    file_size     INTEGER,
    mime_type     TEXT,
    taken_at      TEXT,
    uploaded_at   TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS faces (
    id              TEXT PRIMARY KEY,
    photo_id        TEXT NOT NULL,
    event_id        TEXT NOT NULL,
    descriptor      TEXT,
    cluster_id      TEXT,
    label           TEXT,
    thumbnail       TEXT,
    box_x           REAL,
    box_y           REAL,
    box_width       REAL,
    box_height      REAL,
    detection_score REAL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS face_clusters (
    id                    TEXT PRIMARY KEY,
    event_id              TEXT NOT NULL,
    label                 TEXT,
    representative_face_id TEXT,
    face_count            INTEGER NOT NULL DEFAULT 0,
    created_at            TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (representative_face_id) REFERENCES faces(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS stories (
    id           TEXT PRIMARY KEY,
    event_id     TEXT NOT NULL,
    creator_id   TEXT,
    creator_name TEXT,
    title        TEXT,
    slides       TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_events_code ON events(code);
  CREATE INDEX IF NOT EXISTS idx_participants_event ON participants(event_id);
  CREATE INDEX IF NOT EXISTS idx_photos_event ON photos(event_id);
  CREATE INDEX IF NOT EXISTS idx_faces_photo ON faces(photo_id);
  CREATE INDEX IF NOT EXISTS idx_faces_event ON faces(event_id);
  CREATE INDEX IF NOT EXISTS idx_faces_cluster ON faces(cluster_id);
  CREATE INDEX IF NOT EXISTS idx_face_clusters_event ON face_clusters(event_id);
  CREATE INDEX IF NOT EXISTS idx_stories_event ON stories(event_id);

  CREATE TABLE IF NOT EXISTS reactions (
    id TEXT PRIMARY KEY,
    photo_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    reaction_type TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(photo_id, user_id, reaction_type),
    FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_reactions_photo ON reactions(photo_id);

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    photo_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_comments_photo ON comments(photo_id);

  CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    cover_photo TEXT,
    creator_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_albums_event ON albums(event_id);

  CREATE TABLE IF NOT EXISTS album_photos (
    album_id TEXT NOT NULL,
    photo_id TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (album_id, photo_id),
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS votes (
    id TEXT PRIMARY KEY,
    photo_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(photo_id, user_id),
    FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_votes_photo ON votes(photo_id);
  CREATE INDEX IF NOT EXISTS idx_votes_event ON votes(event_id);

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT,
    text TEXT NOT NULL,
    reply_to TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_messages_event ON messages(event_id);

  CREATE TABLE IF NOT EXISTS event_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    accent_color TEXT DEFAULT '#6366f1',
    font_family TEXT DEFAULT 'Inter',
    cover_layout TEXT DEFAULT 'classic',
    icon TEXT
  );
`);

// Migration: add thumbnail column to faces if missing
try {
  db.exec(`ALTER TABLE faces ADD COLUMN thumbnail TEXT`);
} catch {
  // Column already exists
}

// Migration: add expires_at column to events if missing
try {
  db.exec(`ALTER TABLE events ADD COLUMN expires_at TEXT`);
} catch {
  // Column already exists
}

// Migration: add status column to photos if missing
try {
  db.exec(`ALTER TABLE photos ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'`);
} catch {
  // Column already exists
}

// Migration: add moderation_enabled column to events if missing
try {
  db.exec(`ALTER TABLE events ADD COLUMN moderation_enabled INTEGER NOT NULL DEFAULT 0`);
} catch {
  // Column already exists
}

// Migration: add image_hash column to photos if missing
try {
  db.exec(`ALTER TABLE photos ADD COLUMN image_hash TEXT`);
} catch {
  // Column already exists
}

// Migration: add is_duplicate column to photos if missing
try {
  db.exec(`ALTER TABLE photos ADD COLUMN is_duplicate INTEGER NOT NULL DEFAULT 0`);
} catch {
  // Column already exists
}

// Migration: add highlight_score column to photos if missing
try {
  db.exec(`ALTER TABLE photos ADD COLUMN highlight_score INTEGER`);
} catch {
  // Column already exists
}

// Migration: add caption column to photos if missing
try {
  db.exec(`ALTER TABLE photos ADD COLUMN caption TEXT`);
} catch {
  // Column already exists
}

// Migration: add latitude column to photos if missing
try {
  db.exec(`ALTER TABLE photos ADD COLUMN latitude REAL`);
} catch {
  // Column already exists
}

// Migration: add longitude column to photos if missing
try {
  db.exec(`ALTER TABLE photos ADD COLUMN longitude REAL`);
} catch {
  // Column already exists
}

// Migration: add is_vip column to participants if missing
try {
  db.exec(`ALTER TABLE participants ADD COLUMN is_vip INTEGER NOT NULL DEFAULT 0`);
} catch {
  // Column already exists
}

// Migration: add theme columns to events
try {
  db.exec(`ALTER TABLE events ADD COLUMN accent_color TEXT DEFAULT '#6366f1'`);
} catch {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE events ADD COLUMN font_family TEXT DEFAULT 'Inter'`);
} catch {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE events ADD COLUMN cover_layout TEXT DEFAULT 'classic'`);
} catch {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE events ADD COLUMN template_id TEXT`);
} catch {
  // Column already exists
}

// Insert default event templates
db.exec(`
  INSERT OR IGNORE INTO event_templates (id, name, category, description, accent_color, font_family, cover_layout, icon) VALUES
  ('wedding', 'Elegant Wedding', 'wedding', 'A timeless theme for your special day', '#d4a574', 'Playfair Display', 'elegant', '💍'),
  ('birthday', 'Fun Birthday', 'birthday', 'Colorful and festive birthday party', '#f43f5e', 'Poppins', 'festive', '🎂'),
  ('corporate', 'Corporate Event', 'corporate', 'Professional and sleek for business events', '#3b82f6', 'Inter', 'minimal', '🏢'),
  ('baby-shower', 'Baby Shower', 'baby-shower', 'Soft and sweet for the little one', '#f9a8d4', 'Quicksand', 'soft', '🍼'),
  ('graduation', 'Graduation Party', 'graduation', 'Celebrate academic achievements', '#8b5cf6', 'Montserrat', 'classic', '🎓'),
  ('holiday', 'Holiday Gathering', 'holiday', 'Festive themes for holiday celebrations', '#22c55e', 'Raleway', 'festive', '🎄'),
  ('reunion', 'Family Reunion', 'reunion', 'Warm and inviting for family gatherings', '#f59e0b', 'Nunito', 'warm', '👨‍👩‍👧‍👦'),
  ('concert', 'Live Concert', 'concert', 'Bold and vibrant for music events', '#ec4899', 'Bebas Neue', 'bold', '🎵')
`);

// ─── Prepared Statements ─────────────────────────────────────────────────────

const stmts = {
  insertEvent: db.prepare(`
    INSERT INTO events (id, name, code, password_hash, host_name, host_id, cover_photo, event_date, created_at, updated_at)
    VALUES (@id, @name, @code, @password_hash, @host_name, @host_id, @cover_photo, @event_date, datetime('now'), datetime('now'))
  `),
  getEventByCode: db.prepare(`SELECT * FROM events WHERE code = ?`),
  getEventById: db.prepare(`SELECT * FROM events WHERE id = ?`),
  deleteEvent: db.prepare(`DELETE FROM events WHERE id = ?`),
  updateEventCover: db.prepare(`UPDATE events SET cover_photo = ?, updated_at = datetime('now') WHERE id = ?`),

  insertParticipant: db.prepare(`
    INSERT OR IGNORE INTO participants (id, event_id, user_id, display_name, joined_at)
    VALUES (@id, @event_id, @user_id, @display_name, datetime('now'))
  `),
  getParticipants: db.prepare(`SELECT * FROM participants WHERE event_id = ? ORDER BY joined_at ASC`),
  isParticipant: db.prepare(`SELECT 1 FROM participants WHERE event_id = ? AND user_id = ? LIMIT 1`),

  insertPhoto: db.prepare(`
    INSERT INTO photos (id, event_id, filename, thumbnail, original_name, uploader_id, uploader_name, width, height, file_size, mime_type, taken_at, status, uploaded_at)
    VALUES (@id, @event_id, @filename, @thumbnail, @original_name, @uploader_id, @uploader_name, @width, @height, @file_size, @mime_type, @taken_at, @status, datetime('now'))
  `),
  getPhotosForEvent: db.prepare(`SELECT * FROM photos WHERE event_id = ? ORDER BY uploaded_at DESC`),
  getPhotoById: db.prepare(`SELECT * FROM photos WHERE id = ?`),
  deletePhoto: db.prepare(`DELETE FROM photos WHERE id = ?`),

  insertFace: db.prepare(`
    INSERT INTO faces (id, photo_id, event_id, descriptor, cluster_id, label, thumbnail, box_x, box_y, box_width, box_height, detection_score, created_at)
    VALUES (@id, @photo_id, @event_id, @descriptor, @cluster_id, @label, @thumbnail, @box_x, @box_y, @box_width, @box_height, @detection_score, datetime('now'))
  `),
  getFacesForEvent: db.prepare(`
    SELECT f.*, p.filename, p.thumbnail AS photo_thumbnail
    FROM faces f
    JOIN photos p ON f.photo_id = p.id
    WHERE f.event_id = ?
    ORDER BY f.created_at ASC
  `),
  updateFaceCluster: db.prepare(`UPDATE faces SET cluster_id = ? WHERE id = ?`),
  updateFaceLabel: db.prepare(`UPDATE faces SET label = ? WHERE cluster_id = ?`),
  deleteFacesForEvent: db.prepare(`DELETE FROM faces WHERE event_id = ?`),
  deleteClustersForEvent: db.prepare(`DELETE FROM face_clusters WHERE event_id = ?`),

  insertFaceCluster: db.prepare(`
    INSERT INTO face_clusters (id, event_id, label, representative_face_id, face_count, created_at)
    VALUES (@id, @event_id, @label, @representative_face_id, @face_count, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      representative_face_id = excluded.representative_face_id,
      face_count = excluded.face_count
  `),
  getFaceClusters: db.prepare(`
    SELECT fc.*, f.photo_id, f.box_x, f.box_y, f.box_width, f.box_height, f.thumbnail AS face_thumbnail, p.thumbnail
    FROM face_clusters fc
    LEFT JOIN faces f ON fc.representative_face_id = f.id
    LEFT JOIN photos p ON f.photo_id = p.id
    WHERE fc.event_id = ?
    ORDER BY fc.face_count DESC
  `),
  updateClusterLabel: db.prepare(`UPDATE face_clusters SET label = ? WHERE id = ?`),

  insertStory: db.prepare(`
    INSERT INTO stories (id, event_id, creator_id, creator_name, title, slides, created_at)
    VALUES (@id, @event_id, @creator_id, @creator_name, @title, @slides, datetime('now'))
  `),
  getStoriesForEvent: db.prepare(`SELECT * FROM stories WHERE event_id = ? ORDER BY created_at DESC`),
  getStory: db.prepare(`SELECT * FROM stories WHERE id = ?`),
  deleteStory: db.prepare(`DELETE FROM stories WHERE id = ?`),

  // ─── Reactions ──────────────────────────────────────────────────────────
  insertReaction: db.prepare(`
    INSERT OR IGNORE INTO reactions (id, photo_id, event_id, user_id, reaction_type, created_at)
    VALUES (@id, @photo_id, @event_id, @user_id, @reaction_type, datetime('now'))
  `),
  deleteReaction: db.prepare(`DELETE FROM reactions WHERE photo_id = ? AND user_id = ? AND reaction_type = ?`),
  getReactionsForPhoto: db.prepare(`
    SELECT reaction_type, COUNT(*) as count, GROUP_CONCAT(user_id) as user_ids
    FROM reactions WHERE photo_id = ? GROUP BY reaction_type
  `),
  getReactionsForEvent: db.prepare(`
    SELECT photo_id, reaction_type, COUNT(*) as count, GROUP_CONCAT(user_id) as user_ids
    FROM reactions WHERE event_id = ? GROUP BY photo_id, reaction_type
  `),

  // ─── Comments ───────────────────────────────────────────────────────────
  insertComment: db.prepare(`
    INSERT INTO comments (id, photo_id, event_id, user_id, user_name, text, created_at)
    VALUES (@id, @photo_id, @event_id, @user_id, @user_name, @text, datetime('now'))
  `),
  getCommentsForPhoto: db.prepare(`SELECT * FROM comments WHERE photo_id = ? ORDER BY created_at ASC`),
  deleteComment: db.prepare(`DELETE FROM comments WHERE id = ?`),
  getCommentById: db.prepare(`SELECT * FROM comments WHERE id = ?`),
  getCommentCountsForEvent: db.prepare(`
    SELECT photo_id, COUNT(*) as count FROM comments WHERE event_id = ? GROUP BY photo_id
  `),

  // ─── Event Expiry ──────────────────────────────────────────────────────
  getExpiredEvents: db.prepare(`SELECT * FROM events WHERE expires_at IS NOT NULL AND expires_at < datetime('now')`),
  updateEventExpiry: db.prepare(`UPDATE events SET expires_at = ?, updated_at = datetime('now') WHERE id = ?`),

  // ─── Event Moderation ─────────────────────────────────────────────────
  updateEventModeration: db.prepare(`UPDATE events SET moderation_enabled = ?, updated_at = datetime('now') WHERE id = ?`),

  // ─── Photo Moderation ──────────────────────────────────────────────────
  getPendingPhotos: db.prepare(`SELECT * FROM photos WHERE event_id = ? AND status = 'pending' ORDER BY uploaded_at DESC`),
  approvePhoto: db.prepare(`UPDATE photos SET status = 'approved' WHERE id = ?`),
  getPendingCount: db.prepare(`SELECT COUNT(*) as pending_count FROM photos WHERE event_id = ? AND status = 'pending'`),

  // ─── Event Stats ────────────────────────────────────────────────────────
  getEventStats: db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM photos WHERE event_id = ?) as photo_count,
      (SELECT COUNT(*) FROM participants WHERE event_id = ?) as participant_count,
      (SELECT COUNT(*) FROM stories WHERE event_id = ?) as story_count,
      (SELECT COUNT(*) FROM faces WHERE event_id = ?) as face_count,
      (SELECT COUNT(*) FROM reactions WHERE event_id = ?) as reaction_count,
      (SELECT COUNT(*) FROM comments WHERE event_id = ?) as comment_count
  `),

  // ─── Image Hash / Duplicate Detection ─────────────────────────────────
  getPhotoHashesForEvent: db.prepare('SELECT id, image_hash FROM photos WHERE event_id = ? AND image_hash IS NOT NULL'),
  updatePhotoHash: db.prepare('UPDATE photos SET image_hash = ? WHERE id = ?'),
  markDuplicate: db.prepare('UPDATE photos SET is_duplicate = 1 WHERE id = ?'),

  // ─── Highlight Scoring ────────────────────────────────────────────────
  updateHighlightScore: db.prepare('UPDATE photos SET highlight_score = ? WHERE id = ?'),
  getTopPhotos: db.prepare(`SELECT * FROM photos WHERE event_id = ? AND status = 'approved' ORDER BY highlight_score DESC, uploaded_at DESC LIMIT ?`),

  // ─── Photo Captions ──────────────────────────────────────────────────
  updatePhotoCaption: db.prepare('UPDATE photos SET caption = ? WHERE id = ?'),

  // ─── Photo GPS ──────────────────────────────────────────────────────
  updatePhotoGPS: db.prepare('UPDATE photos SET latitude = ?, longitude = ? WHERE id = ?'),

  // ─── VIP / Guest of Honor ────────────────────────────────────────────
  setParticipantVip: db.prepare('UPDATE participants SET is_vip = ? WHERE event_id = ? AND user_id = ?'),
  getVipParticipants: db.prepare('SELECT * FROM participants WHERE event_id = ? AND is_vip = 1'),

  // ─── Albums ──────────────────────────────────────────────────────────
  insertAlbum: db.prepare(`
    INSERT INTO albums (id, event_id, name, description, cover_photo, creator_id, created_at)
    VALUES (@id, @event_id, @name, @description, @cover_photo, @creator_id, datetime('now'))
  `),
  getAlbumsForEvent: db.prepare('SELECT * FROM albums WHERE event_id = ? ORDER BY created_at DESC'),
  getAlbumById: db.prepare('SELECT * FROM albums WHERE id = ?'),
  deleteAlbum: db.prepare('DELETE FROM albums WHERE id = ?'),
  updateAlbum: db.prepare('UPDATE albums SET name = ?, description = ? WHERE id = ?'),
  addPhotoToAlbum: db.prepare('INSERT OR IGNORE INTO album_photos (album_id, photo_id) VALUES (?, ?)'),
  removePhotoFromAlbum: db.prepare('DELETE FROM album_photos WHERE album_id = ? AND photo_id = ?'),
  getPhotosForAlbum: db.prepare(`
    SELECT p.* FROM photos p
    JOIN album_photos ap ON p.id = ap.photo_id
    WHERE ap.album_id = ?
    ORDER BY ap.added_at DESC
  `),
  getAlbumPhotoCount: db.prepare('SELECT COUNT(*) as count FROM album_photos WHERE album_id = ?'),

  // ─── Votes / Contest ─────────────────────────────────────────────────
  insertVote: db.prepare(`
    INSERT OR IGNORE INTO votes (id, photo_id, event_id, user_id, created_at)
    VALUES (@id, @photo_id, @event_id, @user_id, datetime('now'))
  `),
  deleteVote: db.prepare('DELETE FROM votes WHERE photo_id = ? AND user_id = ?'),
  getVotesForPhoto: db.prepare('SELECT COUNT(*) as count FROM votes WHERE photo_id = ?'),
  getUserVoteForPhoto: db.prepare('SELECT 1 FROM votes WHERE photo_id = ? AND user_id = ? LIMIT 1'),
  getLeaderboard: db.prepare(`
    SELECT p.*, COUNT(v.id) as vote_count
    FROM photos p
    LEFT JOIN votes v ON p.id = v.photo_id
    WHERE p.event_id = ? AND p.status = 'approved'
    GROUP BY p.id
    HAVING vote_count > 0
    ORDER BY vote_count DESC
    LIMIT ?
  `),
  getVoteCountsForEvent: db.prepare(`
    SELECT photo_id, COUNT(*) as count FROM votes WHERE event_id = ? GROUP BY photo_id
  `),

  // ─── Chat Messages ───────────────────────────────────────────────────
  insertMessage: db.prepare(`
    INSERT INTO messages (id, event_id, user_id, user_name, text, reply_to, created_at)
    VALUES (@id, @event_id, @user_id, @user_name, @text, @reply_to, datetime('now'))
  `),
  getMessagesForEvent: db.prepare('SELECT * FROM messages WHERE event_id = ? ORDER BY created_at ASC LIMIT 200'),
  getRecentMessages: db.prepare('SELECT * FROM messages WHERE event_id = ? ORDER BY created_at DESC LIMIT ?'),
  deleteMessage: db.prepare('DELETE FROM messages WHERE id = ?'),
  getMessageById: db.prepare('SELECT * FROM messages WHERE id = ?'),

  // ─── Event Templates ─────────────────────────────────────────────────
  getAllTemplates: db.prepare('SELECT * FROM event_templates ORDER BY category ASC'),
  getTemplateById: db.prepare('SELECT * FROM event_templates WHERE id = ?'),
  getTemplatesByCategory: db.prepare('SELECT * FROM event_templates WHERE category = ?'),

  // ─── Event Theme ─────────────────────────────────────────────────────
  updateEventTheme: db.prepare(`
    UPDATE events SET accent_color = ?, font_family = ?, cover_layout = ?, template_id = ?, updated_at = datetime('now')
    WHERE id = ?
  `),
};

// ─── Exported Functions ──────────────────────────────────────────────────────

export function createEvent({ id, name, code, password_hash, host_name, host_id, cover_photo, event_date }) {
  stmts.insertEvent.run({
    id,
    name,
    code,
    password_hash: password_hash || null,
    host_name,
    host_id,
    cover_photo: cover_photo || null,
    event_date: event_date || null,
  });
  return stmts.getEventById.get(id);
}

export function getEventByCode(code) {
  return stmts.getEventByCode.get(code);
}

export function getEventById(id) {
  return stmts.getEventById.get(id);
}

export function addParticipant({ id, event_id, user_id, display_name }) {
  stmts.insertParticipant.run({ id, event_id, user_id, display_name });
  return { id, event_id, user_id, display_name };
}

export function getParticipants(eventId) {
  return stmts.getParticipants.all(eventId);
}

export function isParticipant(eventId, userId) {
  return !!stmts.isParticipant.get(eventId, userId);
}

export function addPhoto({ id, event_id, filename, thumbnail, original_name, uploader_id, uploader_name, width, height, file_size, mime_type, taken_at, status }) {
  stmts.insertPhoto.run({
    id,
    event_id,
    filename,
    thumbnail: thumbnail || null,
    original_name: original_name || null,
    uploader_id: uploader_id || null,
    uploader_name: uploader_name || null,
    width: width || null,
    height: height || null,
    file_size: file_size || null,
    mime_type: mime_type || null,
    taken_at: taken_at || null,
    status: status || 'approved',
  });

  // Set as cover photo if it's the first photo for the event
  const event = stmts.getEventById.get(event_id);
  if (event && !event.cover_photo) {
    stmts.updateEventCover.run(thumbnail || filename, event_id);
  }

  return stmts.getPhotoById.get(id);
}

export function getPhotosForEvent(eventId) {
  return stmts.getPhotosForEvent.all(eventId);
}

export function getPhotoById(id) {
  return stmts.getPhotoById.get(id);
}

export function deletePhoto(id) {
  const photo = stmts.getPhotoById.get(id);
  stmts.deletePhoto.run(id);
  return photo;
}

export function saveFace({ id, photo_id, event_id, descriptor, cluster_id, label, thumbnail, box_x, box_y, box_width, box_height, detection_score }) {
  stmts.insertFace.run({
    id,
    photo_id,
    event_id,
    descriptor: typeof descriptor === 'string' ? descriptor : JSON.stringify(descriptor),
    cluster_id: cluster_id || null,
    label: label || null,
    thumbnail: thumbnail || null,
    box_x: box_x ?? null,
    box_y: box_y ?? null,
    box_width: box_width ?? null,
    box_height: box_height ?? null,
    detection_score: detection_score ?? null,
  });
  return { id, photo_id, event_id };
}

export function getFacesForEvent(eventId) {
  const faces = stmts.getFacesForEvent.all(eventId);
  return faces.map((f) => ({
    ...f,
    descriptor: f.descriptor ? JSON.parse(f.descriptor) : null,
  }));
}

export function updateFaceCluster(faceId, clusterId) {
  stmts.updateFaceCluster.run(clusterId, faceId);
}

export function saveFaceCluster({ id, event_id, label, representative_face_id, face_count }) {
  stmts.insertFaceCluster.run({
    id,
    event_id,
    label: label || null,
    representative_face_id: representative_face_id || null,
    face_count: face_count || 0,
  });
}

export function getFaceClusters(eventId) {
  return stmts.getFaceClusters.all(eventId);
}

export function updateFaceLabel(clusterId, label) {
  stmts.updateClusterLabel.run(label, clusterId);
  stmts.updateFaceLabel.run(label, clusterId);
}

export function deleteFacesForEvent(eventId) {
  stmts.deleteFacesForEvent.run(eventId);
  stmts.deleteClustersForEvent.run(eventId);
}

export function createStory({ id, event_id, creator_id, creator_name, title, slides }) {
  stmts.insertStory.run({
    id,
    event_id,
    creator_id: creator_id || null,
    creator_name: creator_name || null,
    title: title || null,
    slides: typeof slides === 'string' ? slides : JSON.stringify(slides),
  });
  const story = stmts.getStory.get(id);
  if (story && story.slides) {
    story.slides = JSON.parse(story.slides);
  }
  return story;
}

export function getStoriesForEvent(eventId) {
  const stories = stmts.getStoriesForEvent.all(eventId);
  return stories.map((s) => ({
    ...s,
    slides: s.slides ? JSON.parse(s.slides) : [],
  }));
}

export function getStory(id) {
  const story = stmts.getStory.get(id);
  if (story && story.slides) {
    story.slides = JSON.parse(story.slides);
  }
  return story;
}

export function deleteStory(id) {
  const story = stmts.getStory.get(id);
  stmts.deleteStory.run(id);
  return story;
}

export function deleteEvent(id) {
  stmts.deleteEvent.run(id);
}

// ─── Reactions ────────────────────────────────────────────────────────────────

export function addReaction({ id, photo_id, event_id, user_id, reaction_type }) {
  const result = stmts.insertReaction.run({ id, photo_id, event_id, user_id, reaction_type });
  return result.changes; // 1 if inserted, 0 if already existed (INSERT OR IGNORE)
}

export function removeReaction(photo_id, user_id, reaction_type) {
  stmts.deleteReaction.run(photo_id, user_id, reaction_type);
}

export function getReactionsForPhoto(photoId) {
  return stmts.getReactionsForPhoto.all(photoId);
}

export function getReactionsForEvent(eventId) {
  return stmts.getReactionsForEvent.all(eventId);
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export function addComment({ id, photo_id, event_id, user_id, user_name, text }) {
  stmts.insertComment.run({
    id,
    photo_id,
    event_id,
    user_id,
    user_name: user_name || null,
    text,
  });
  return stmts.getCommentById.get(id);
}

export function getCommentById(id) {
  return stmts.getCommentById.get(id);
}

export function getCommentsForPhoto(photoId) {
  return stmts.getCommentsForPhoto.all(photoId);
}

export function deleteComment(id) {
  const comment = stmts.getCommentById.get(id);
  stmts.deleteComment.run(id);
  return comment;
}

export function getCommentCountsForEvent(eventId) {
  return stmts.getCommentCountsForEvent.all(eventId);
}

// ─── Event Expiry ─────────────────────────────────────────────────────────────

export function getExpiredEvents() {
  return stmts.getExpiredEvents.all();
}

export function updateEventExpiry(eventId, expiresAt) {
  stmts.updateEventExpiry.run(expiresAt, eventId);
}

// ─── Photo Moderation ─────────────────────────────────────────────────────────

export function getPendingPhotos(eventId) {
  return stmts.getPendingPhotos.all(eventId);
}

export function approvePhoto(id) {
  stmts.approvePhoto.run(id);
  return stmts.getPhotoById.get(id);
}

export function rejectPhoto(id) {
  const photo = stmts.getPhotoById.get(id);
  stmts.deletePhoto.run(id);
  return photo;
}

export function getPendingCount(eventId) {
  return stmts.getPendingCount.get(eventId);
}

// ─── Event Moderation ─────────────────────────────────────────────────────────

export function updateEventModeration(eventId, enabled) {
  stmts.updateEventModeration.run(enabled, eventId);
}

// ─── Event Stats ──────────────────────────────────────────────────────────────

export function getEventStats(eventId) {
  return stmts.getEventStats.get(eventId, eventId, eventId, eventId, eventId, eventId);
}

// ─── Image Hash / Duplicate Detection ──────────────────────────────────────

export function updatePhotoHash(photoId, hash) {
  stmts.updatePhotoHash.run(hash, photoId);
}

export function markDuplicate(photoId) {
  stmts.markDuplicate.run(photoId);
}

export function getPhotoHashesForEvent(eventId) {
  return stmts.getPhotoHashesForEvent.all(eventId);
}

// ─── Highlight Scoring ─────────────────────────────────────────────────────

export function updateHighlightScore(photoId, score) {
  stmts.updateHighlightScore.run(score, photoId);
}

export function getTopPhotos(eventId, limit) {
  return stmts.getTopPhotos.all(eventId, limit);
}

// ─── Photo Captions ────────────────────────────────────────────────────
export function updatePhotoCaption(photoId, caption) {
  stmts.updatePhotoCaption.run(caption, photoId);
  return stmts.getPhotoById.get(photoId);
}

// ─── Photo GPS ─────────────────────────────────────────────────────────
export function updatePhotoGPS(photoId, latitude, longitude) {
  stmts.updatePhotoGPS.run(latitude, longitude, photoId);
}

// ─── VIP / Guest of Honor ──────────────────────────────────────────────
export function setParticipantVip(eventId, userId, isVip) {
  stmts.setParticipantVip.run(isVip ? 1 : 0, eventId, userId);
}

export function getVipParticipants(eventId) {
  return stmts.getVipParticipants.all(eventId);
}

// ─── Albums ────────────────────────────────────────────────────────────
export function createAlbum({ id, event_id, name, description, cover_photo, creator_id }) {
  stmts.insertAlbum.run({
    id, event_id, name,
    description: description || null,
    cover_photo: cover_photo || null,
    creator_id: creator_id || null,
  });
  return stmts.getAlbumById.get(id);
}

export function getAlbumsForEvent(eventId) {
  const albums = stmts.getAlbumsForEvent.all(eventId);
  return albums.map(a => ({
    ...a,
    photo_count: stmts.getAlbumPhotoCount.get(a.id)?.count || 0,
  }));
}

export function getAlbumById(id) {
  return stmts.getAlbumById.get(id);
}

export function deleteAlbum(id) {
  stmts.deleteAlbum.run(id);
}

export function updateAlbum(id, name, description) {
  stmts.updateAlbum.run(name, description, id);
  return stmts.getAlbumById.get(id);
}

export function addPhotoToAlbum(albumId, photoId) {
  stmts.addPhotoToAlbum.run(albumId, photoId);
}

export function removePhotoFromAlbum(albumId, photoId) {
  stmts.removePhotoFromAlbum.run(albumId, photoId);
}

export function getPhotosForAlbum(albumId) {
  return stmts.getPhotosForAlbum.all(albumId);
}

// ─── Votes / Contest ───────────────────────────────────────────────────
export function addVote({ id, photo_id, event_id, user_id }) {
  stmts.insertVote.run({ id, photo_id, event_id, user_id });
}

export function removeVote(photoId, userId) {
  stmts.deleteVote.run(photoId, userId);
}

export function getVotesForPhoto(photoId) {
  return stmts.getVotesForPhoto.get(photoId)?.count || 0;
}

export function hasUserVoted(photoId, userId) {
  return !!stmts.getUserVoteForPhoto.get(photoId, userId);
}

export function getLeaderboard(eventId, limit = 10) {
  return stmts.getLeaderboard.all(eventId, limit);
}

export function getVoteCountsForEvent(eventId) {
  return stmts.getVoteCountsForEvent.all(eventId);
}

// ─── Chat Messages ─────────────────────────────────────────────────────
export function addMessage({ id, event_id, user_id, user_name, text, reply_to }) {
  stmts.insertMessage.run({
    id, event_id, user_id,
    user_name: user_name || null,
    text,
    reply_to: reply_to || null,
  });
  return stmts.getMessageById.get(id);
}

export function getMessagesForEvent(eventId) {
  return stmts.getMessagesForEvent.all(eventId);
}

export function getRecentMessages(eventId, limit = 50) {
  return stmts.getRecentMessages.all(eventId, limit);
}

export function deleteMessage(id) {
  stmts.deleteMessage.run(id);
}

export function getMessageById(id) {
  return stmts.getMessageById.get(id);
}

// ─── Event Templates ───────────────────────────────────────────────────
export function getAllTemplates() {
  return stmts.getAllTemplates.all();
}

export function getTemplateById(id) {
  return stmts.getTemplateById.get(id);
}

export function getTemplatesByCategory(category) {
  return stmts.getTemplatesByCategory.all(category);
}

// ─── Event Theme ───────────────────────────────────────────────────────
export function updateEventTheme(eventId, { accentColor, fontFamily, coverLayout, templateId }) {
  stmts.updateEventTheme.run(
    accentColor || '#6366f1',
    fontFamily || 'Inter',
    coverLayout || 'classic',
    templateId || null,
    eventId,
  );
  return stmts.getEventById.get(eventId);
}

export default db;
