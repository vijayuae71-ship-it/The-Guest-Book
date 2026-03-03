/**
 * Generate a smart caption for a photo based on available metadata.
 * This uses heuristics since there's no AI API available.
 * @param {Object} photo - Photo object with metadata
 * @param {Object} options - Additional context
 * @returns {string} Generated caption
 */
export function generateCaption(photo, options = {}) {
  const { eventName, uploaderName, faceCount, timeOfDay, isHighlight } = options;

  const captions = [];

  // Time-based captions
  const time = getTimeOfDay(photo.taken_at || photo.uploaded_at);
  const timeCaptions = {
    morning: ['Good morning vibes', 'Starting the day right', 'Morning magic'],
    afternoon: ['Afternoon moments', 'Midday memories', 'Sunny afternoon'],
    evening: ['Evening glow', 'Golden hour magic', 'Twilight moments'],
    night: ['Night out', 'Under the stars', 'After dark'],
  };

  // Face-based captions
  if (faceCount) {
    if (faceCount === 1) captions.push('Portrait moment', 'Solo shot', 'Caught in the moment');
    else if (faceCount === 2) captions.push('Dynamic duo', 'Two of a kind', 'Better together');
    else if (faceCount <= 5) captions.push('Squad goals', 'The crew', 'Group moment');
    else captions.push('The whole gang', 'Party vibes', 'Group photo');
  }

  // Quality-based
  if (isHighlight) {
    captions.push('Highlight reel material', 'One for the album', 'Picture perfect');
  }

  // Event-based
  if (eventName) {
    const lower = eventName.toLowerCase();
    if (lower.includes('wedding')) captions.push('Wedding bliss', 'Love in the air', 'Celebrating love');
    else if (lower.includes('birthday')) captions.push('Birthday vibes', 'Make a wish', 'Party time');
    else if (lower.includes('graduation')) captions.push('Achievement unlocked', 'Cap toss', 'Proud moment');
    else if (lower.includes('party')) captions.push('Party mode on', 'Let the good times roll', 'Celebration');
    else if (lower.includes('reunion')) captions.push('Together again', 'Reunion vibes', 'Back together');
  }

  // Time of day
  if (time && timeCaptions[time]) {
    captions.push(...timeCaptions[time]);
  }

  // Generic fun captions
  captions.push(
    'Making memories',
    'Moments like these',
    'Living our best life',
    'Good times',
    'Unforgettable',
    'Cheers to this',
    'One for the books',
  );

  // Pick a semi-random caption (deterministic based on photo id)
  const hash = simpleHash(photo.id || Math.random().toString());
  const idx = hash % captions.length;

  let caption = captions[idx];

  // Add emoji
  const emojis = ['\u2728', '\ud83d\udcf8', '\ud83c\udf89', '\ud83d\udcab', '\ud83e\udd42', '\ud83c\udf1f', '\ud83d\udc96', '\ud83c\udf8a', '\ud83d\udd25', '\u2b50'];
  const emojiIdx = hash % emojis.length;
  caption = `${caption} ${emojis[emojiIdx]}`;

  return caption;
}

function getTimeOfDay(dateStr) {
  if (!dateStr) return null;
  const hour = new Date(dateStr).getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate captions for multiple photos
 */
export function generateCaptions(photos, options = {}) {
  return photos.map(photo => ({
    photoId: photo.id,
    caption: generateCaption(photo, options),
  }));
}
