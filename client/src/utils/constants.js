export const APP_NAME = 'The Guest Book';
export const SOCKET_EVENTS = {
  JOIN_EVENT: 'join-event',
  LEAVE_EVENT: 'leave-event',
  NEW_PHOTO: 'new-photo',
  PHOTO_DELETED: 'photo-deleted',
  PARTICIPANT_JOINED: 'participant-joined',
  PARTICIPANT_LEFT: 'participant-left',
  PHOTO_REACTION: 'photo-reaction',
  NEW_COMMENT: 'new-comment',
  USER_ACTIVITY: 'user-activity',
  PHOTO_APPROVED: 'photo-approved',
};
export const MAX_UPLOAD_FILES = 20;
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
export const FACE_DISTANCE_THRESHOLD = 0.55;
export const REEL_DEFAULTS = {
  fps: 30,
  photoDuration: 3000,
  transitionDuration: 500,
  transition: 'fade',
};
export const STORY_SLIDE_DURATION = 5000;

export const REACTION_TYPES = [
  { key: 'heart', emoji: '❤️', label: 'Love' },
  { key: 'fire', emoji: '🔥', label: 'Fire' },
  { key: 'laugh', emoji: '😂', label: 'Haha' },
  { key: 'wow', emoji: '😮', label: 'Wow' },
  { key: 'sad', emoji: '😢', label: 'Sad' },
];

export const SLIDESHOW_INTERVALS = [3000, 5000, 8000, 10000];

export const EXIF_FIELDS = ['Make', 'Model', 'FocalLength', 'ExposureTime', 'FNumber', 'ISO', 'DateTimeOriginal', 'GPSLatitude', 'GPSLongitude'];

// Album settings
export const MAX_ALBUM_NAME_LENGTH = 50;
export const MAX_ALBUM_DESCRIPTION_LENGTH = 200;

// Chat
export const MAX_CHAT_MESSAGE_LENGTH = 500;
export const CHAT_LOAD_LIMIT = 200;

// Voting
export const LEADERBOARD_LIMIT = 10;

// Photo filters
export const PHOTO_FILTER_NAMES = [
  'original', 'brighten', 'contrast', 'warmth', 'cool',
  'vintage', 'noir', 'vivid', 'fade', 'dramatic', 'bloom',
];

// Event template categories
export const TEMPLATE_CATEGORIES = [
  'wedding', 'birthday', 'corporate', 'baby-shower',
  'graduation', 'holiday', 'reunion', 'concert',
];

// Caption
export const MAX_CAPTION_LENGTH = 300;

// GIF/Boomerang
export const GIF_MAX_PHOTOS = 20;
export const GIF_MIN_PHOTOS = 2;
export const GIF_SPEEDS = [100, 200, 300, 500];

// Push notification topics
export const NOTIFICATION_TOPICS = {
  NEW_PHOTO: 'new-photo',
  NEW_COMMENT: 'new-comment',
  NEW_REACTION: 'new-reaction',
  PHOTO_APPROVED: 'photo-approved',
  NEW_CHAT: 'new-chat',
  VOTE_UPDATE: 'vote-update',
};
