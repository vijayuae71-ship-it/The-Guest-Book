const BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `Request failed: ${res.status}`);
  }

  return res.json();
}

// Events
export function createEvent(data) {
  return request('/events', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getEvent(code) {
  return request(`/events/${code}`);
}

export function joinEvent(code, data) {
  return request(`/events/${code}/join`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getParticipants(eventId) {
  return request(`/events/${eventId}/participants`);
}

export function deleteEvent(eventId, hostId) {
  return request(`/events/${eventId}`, {
    method: 'DELETE',
    headers: { 'x-host-id': hostId },
  });
}

// Photos
export function getPhotos(eventId) {
  return request(`/photos/${eventId}`);
}

export function uploadPhotos(eventId, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('POST', `${BASE}/photos/${eventId}`);

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      });
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve(xhr.responseText);
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.message || `Upload failed: ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Upload failed: network error'));
    xhr.ontimeout = () => reject(new Error('Upload failed: timeout'));

    xhr.send(formData);
  });
}

export function deletePhoto(photoId, hostId) {
  return request(`/photos/${photoId}`, {
    method: 'DELETE',
    headers: hostId ? { 'x-host-id': hostId } : {},
  });
}

// Faces
export function saveFaces(photoId, data) {
  return request(`/faces/${photoId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getFaces(eventId) {
  return request(`/faces/event/${eventId}`);
}

export function clearFaces(eventId) {
  return request(`/faces/event/${eventId}`, {
    method: 'DELETE',
  });
}

export function saveClusters(data) {
  return request('/faces/cluster', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function getClusters(eventId) {
  return request(`/faces/event/${eventId}/clusters`);
}

export function updateClusterLabel(clusterId, label) {
  return request(`/faces/${clusterId}/label`, {
    method: 'PUT',
    body: JSON.stringify({ label }),
  });
}

// Stories
export function createStory(eventId, data) {
  return request(`/stories/${eventId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getStories(eventId) {
  return request(`/stories/event/${eventId}`);
}

export function deleteStory(storyId) {
  return request(`/stories/${storyId}`, {
    method: 'DELETE',
  });
}

// Reactions
export function toggleReaction(photoId, data) {
  return request(`/reactions/${photoId}/react`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getReactions(photoId, userId) {
  const query = userId ? `?userId=${userId}` : '';
  return request(`/reactions/${photoId}${query}`);
}

export function getEventReactions(eventId, userId) {
  const query = userId ? `?userId=${userId}` : '';
  return request(`/reactions/event/${eventId}${query}`);
}

// Comments
export function addComment(photoId, data) {
  return request(`/comments/${photoId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getComments(photoId) {
  return request(`/comments/${photoId}`);
}

export function deleteComment(commentId) {
  return request(`/comments/${commentId}`, {
    method: 'DELETE',
  });
}

// Moderation
export function getPendingPhotos(eventId, hostId) {
  return request(`/photos/${eventId}/pending`, {
    headers: { 'x-host-id': hostId },
  });
}

export function approvePhoto(photoId, hostId) {
  return request(`/photos/${photoId}/approve`, {
    method: 'PUT',
    headers: { 'x-host-id': hostId },
  });
}

export function rejectPhoto(photoId, hostId) {
  return request(`/photos/${photoId}/reject`, {
    method: 'PUT',
    headers: { 'x-host-id': hostId },
  });
}

// Event settings
export function updateEventSettings(eventId, hostId, settings) {
  return request(`/events/${eventId}/settings`, {
    method: 'PUT',
    headers: { 'x-host-id': hostId },
    body: JSON.stringify(settings),
  });
}

export function getEventStats(eventId) {
  return request(`/events/${eventId}/stats`);
}

// Highlights
export function getHighlightPhotos(eventId, limit = 20) {
  return request(`/photos/${eventId}/highlights?limit=${limit}`);
}

// Sharing
export function getFaceCollageUrl(eventId) {
  return `${BASE}/faces/event/${eventId}/collage`;
}

export function getRecapCardUrl(eventId) {
  return `${BASE}/events/${eventId}/recap`;
}

// Albums
export function getAlbums(eventId) {
  return request(`/albums/${eventId}`);
}

export function createAlbum(eventId, data) {
  return request(`/albums/${eventId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAlbum(albumId, data) {
  return request(`/albums/${albumId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteAlbum(albumId) {
  return request(`/albums/${albumId}`, {
    method: 'DELETE',
  });
}

export function getAlbumPhotos(albumId) {
  return request(`/albums/${albumId}/photos`);
}

export function addPhotosToAlbum(albumId, photoIds) {
  return request(`/albums/${albumId}/photos`, {
    method: 'POST',
    body: JSON.stringify({ photoIds }),
  });
}

export function removePhotoFromAlbum(albumId, photoId) {
  return request(`/albums/${albumId}/photos/${photoId}`, {
    method: 'DELETE',
  });
}

// Votes / Contest
export function toggleVote(photoId, data) {
  return request(`/votes/${photoId}/vote`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getPhotoVotes(photoId, userId) {
  return request(`/votes/${photoId}/votes?userId=${userId || ''}`);
}

export function getLeaderboard(eventId, limit = 10) {
  return request(`/votes/event/${eventId}/leaderboard?limit=${limit}`);
}

export function getVoteCounts(eventId) {
  return request(`/votes/event/${eventId}/counts`);
}

// Chat
export function getChatMessages(eventId) {
  return request(`/chat/${eventId}`);
}

export function sendChatMessage(eventId, data) {
  return request(`/chat/${eventId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteChatMessage(messageId, hostId, userId) {
  return request(`/chat/${messageId}`, {
    method: 'DELETE',
    headers: {
      'x-host-id': hostId || '',
      'x-user-id': userId || '',
    },
  });
}

// Templates
export function getTemplates(category) {
  const query = category ? `?category=${category}` : '';
  return request(`/templates${query}`);
}

export function getTemplate(id) {
  return request(`/templates/${id}`);
}

// Event Theme
export function updateEventTheme(eventId, hostId, theme) {
  return request(`/events/${eventId}/theme`, {
    method: 'PUT',
    headers: { 'x-host-id': hostId },
    body: JSON.stringify(theme),
  });
}

// VIP / Guest of Honor
export function setParticipantVip(eventId, userId, isVip, hostId) {
  return request(`/events/${eventId}/vip/${userId}`, {
    method: 'PUT',
    headers: { 'x-host-id': hostId },
    body: JSON.stringify({ isVip }),
  });
}

export function getVipParticipants(eventId) {
  return request(`/events/${eventId}/vip`);
}

// Photo Caption
export function updatePhotoCaption(photoId, caption) {
  return request(`/photos/${photoId}/caption`, {
    method: 'PUT',
    body: JSON.stringify({ caption }),
  });
}
