import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Share2,
  Users,
  Camera,
  Image as ImageIcon,
  Film,
  BookOpen,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Copy,
  ExternalLink,
  ArrowLeft,
  UserCircle2,
  Clock,
  Sparkles,
  MessageCircle,
  Send,
  Trash2,
  Settings,
  Palette,
  Check,
  Pencil,
  Heart,
  Play,
  Pause,
  SkipForward,
  CheckSquare,
  Square,
  Shield,
  Eye,
  Info,
  Timer,
} from 'lucide-react';
import { MessageCircle as ChatIcon, Trophy, FolderOpen, Map, Zap, Crown, Archive } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import EventTimeline from '../components/event/EventTimeline';
import PhotoMapView from '../components/event/PhotoMapView';
import GuestChat from '../components/event/GuestChat';
import VotingContest from '../components/event/VotingContest';
import EventThemeCustomizer from '../components/event/EventThemeCustomizer';
import AlbumsManager from '../components/event/AlbumsManager';
import GifCreator from '../components/event/GifCreator';
import ExportAlbum from '../components/event/ExportAlbum';
import { useUser } from '../context/UserContext';
import { useSocket } from '../context/SocketContext';
import {
  getEvent,
  getPhotos,
  uploadPhotos,
  getParticipants,
  getStories,
  deletePhoto as apiDeletePhoto,
  deleteEvent as apiDeleteEvent,
  toggleReaction,
  getReactions,
  getEventReactions,
  addComment,
  getComments,
  deleteComment,
  getPendingPhotos,
  approvePhoto,
  rejectPhoto,
} from '../utils/api';
import {
  SOCKET_EVENTS,
  MAX_UPLOAD_FILES,
  REACTION_TYPES,
  SLIDESHOW_INTERVALS,
  STORY_SLIDE_DURATION,
} from '../utils/constants';

const TABS = [
  { key: 'photos', label: 'Photos', icon: ImageIcon },
  { key: 'timeline', label: 'Timeline', icon: Clock },
  { key: 'moments', label: 'Moments', icon: Palette },
  { key: 'albums', label: 'Albums', icon: FolderOpen },
  { key: 'people', label: 'People', icon: Users },
  { key: 'contest', label: 'Contest', icon: Trophy },
  { key: 'reels', label: 'Reels', icon: Film },
  { key: 'stories', label: 'Stories', icon: BookOpen },
];

const PHOTO_FILTERS = [
  {
    key: 'original',
    label: 'Original',
    css: 'none',
    desc: 'No filter applied',
    ring: 'ring-slate-500',
  },
  {
    key: 'bw',
    label: 'B&W',
    css: 'grayscale(100%) contrast(1.1)',
    desc: 'Classic black & white',
    ring: 'ring-gray-400',
  },
  {
    key: 'vintage',
    label: 'Vintage',
    css: 'sepia(0.6) contrast(1.05) brightness(0.95) saturate(0.8)',
    desc: 'Warm vintage classic',
    ring: 'ring-amber-500',
  },
  {
    key: 'vibrant',
    label: 'Vibrant',
    css: 'saturate(1.6) contrast(1.1) brightness(1.05)',
    desc: 'Bold & colorful',
    ring: 'ring-pink-500',
  },
];

function Skeleton({ className = '' }) {
  return (
    <div
      className={`bg-slate-800/50 rounded-xl animate-pulse ${className}`}
    />
  );
}

export default function EventRoom() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { userId, userName } = useUser();
  const { getSocket, joinRoom, leaveRoom } = useSocket();

  const [event, setEvent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [stories, setStories] = useState([]);
  const [activeTab, setActiveTab] = useState('photos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showShareModal, setShowShareModal] = useState(false);
  const [showUploadSheet, setShowUploadSheet] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [copied, setCopied] = useState(false);

  // Delete state
  const [showDeleteEventModal, setShowDeleteEventModal] = useState(false);
  const [showDeletePhotoModal, setShowDeletePhotoModal] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);

  // Moments state
  const [activeFilter, setActiveFilter] = useState('original');
  const [momentsLightboxIndex, setMomentsLightboxIndex] = useState(-1);
  const [savingFiltered, setSavingFiltered] = useState(false);

  // --- NEW STATE: Reactions ---
  const [reactions, setReactions] = useState({}); // { photoId: { heart: 3, fire: 1, ... } }
  const [userReactions, setUserReactions] = useState({}); // { photoId: ['heart', 'fire'] }

  // --- NEW STATE: Comments ---
  const [comments, setComments] = useState([]); // comments for current lightbox photo
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);

  // --- NEW STATE: Photo Toast ---
  const [photoToast, setPhotoToast] = useState(null);

  // --- NEW STATE: Live Activity ---
  const [activeUsers, setActiveUsers] = useState([]);

  // --- NEW STATE: Slideshow ---
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [slideshowInterval, setSlideshowInterval] = useState(5000);
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const [slideshowPaused, setSlideshowPaused] = useState(false);

  // --- NEW STATE: Story Viewer ---
  const [viewingStory, setViewingStory] = useState(null);
  const [storySlideIndex, setStorySlideIndex] = useState(0);

  // --- NEW STATE: Bulk Select ---
  const [selectMode, setSelectMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState(new Set());

  // --- NEW STATE: EXIF Display ---
  const [showExif, setShowExif] = useState(false);

  // --- NEW STATE: Moderation ---
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [showPending, setShowPending] = useState(false);

  // --- NEW: Chat ---
  const [showChat, setShowChat] = useState(false);

  // --- NEW: Theme Customizer ---
  const [showThemeCustomizer, setShowThemeCustomizer] = useState(false);

  // --- NEW: GIF Creator ---
  const [showGifCreator, setShowGifCreator] = useState(false);

  // --- NEW: Export ---
  const [showExport, setShowExport] = useState(false);

  // --- NEW: Caption editing ---
  const [editingCaption, setEditingCaption] = useState(null);
  const [captionText, setCaptionText] = useState('');

  const isHost = event?.host_id === userId;

  const approvedPhotos = photos.filter(p => p.status === 'approved' || !p.status);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const commentInputRef = useRef(null);
  const photoToastTimerRef = useRef(null);

  // ---- Load event data ----
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const eventRes = await getEvent(code);
        const evt = eventRes.event || eventRes;
        if (cancelled) return;
        setEvent(evt);

        // Fetch photos using event id
        const photosData = await getPhotos(evt.id).catch(() => ({ photos: [] }));
        if (cancelled) return;
        setPhotos(
          Array.isArray(photosData) ? photosData : photosData.photos || []
        );
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load event');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // ---- Load participants when People tab opens ----
  useEffect(() => {
    if (activeTab === 'people' && event) {
      const id = event._id || event.id || code;
      getParticipants(id)
        .then((data) =>
          setParticipants(
            Array.isArray(data) ? data : data.participants || []
          )
        )
        .catch(() => {});
    }
  }, [activeTab, event, code]);

  // ---- Load stories when Stories tab opens ----
  useEffect(() => {
    if (activeTab === 'stories' && event) {
      const id = event._id || event.id || code;
      getStories(id)
        .then((data) =>
          setStories(Array.isArray(data) ? data : data.stories || [])
        )
        .catch(() => {});
    }
  }, [activeTab, event, code]);

  // ---- Load event reactions on mount ----
  useEffect(() => {
    if (!event) return;
    const id = event._id || event.id || code;
    getEventReactions(id, userId)
      .then((data) => {
        if (data && data.reactions) {
          const rMap = {};
          const uMap = {};
          Object.entries(data.reactions).forEach(([photoId, rData]) => {
            rMap[photoId] = rData.counts || {};
            uMap[photoId] = rData.userReactions || [];
          });
          setReactions(rMap);
          setUserReactions(uMap);
        }
      })
      .catch(() => {});
  }, [event, code]);

  // ---- Load pending photos for host ----
  useEffect(() => {
    if (isHost && event) {
      const id = event._id || event.id || code;
      getPendingPhotos(id, userId)
        .then((data) => {
          const pending = Array.isArray(data) ? data : data.photos || [];
          setPendingPhotos(pending);
        })
        .catch(() => {});
    }
  }, [isHost, event, code, userId]);

  // ---- Load reactions when lightbox opens ----
  useEffect(() => {
    if (lightboxIndex < 0 || lightboxIndex >= photos.length) {
      setShowComments(false);
      setComments([]);
      setCommentText('');
      setShowExif(false);
      return;
    }
    const photo = photos[lightboxIndex];
    const photoId = photo._id || photo.id;
    if (!photoId) return;

    getReactions(photoId, userId)
      .then((data) => {
        if (data) {
          setReactions((prev) => ({
            ...prev,
            [photoId]: data.counts || {},
          }));
          setUserReactions((prev) => ({
            ...prev,
            [photoId]: data.userReactions || [],
          }));
        }
      })
      .catch(() => {});
  }, [lightboxIndex, photos]);

  // ---- Load comments when comments panel opens ----
  useEffect(() => {
    if (!showComments || lightboxIndex < 0 || lightboxIndex >= photos.length) return;
    const photo = photos[lightboxIndex];
    const photoId = photo._id || photo.id;
    if (!photoId) return;

    getComments(photoId)
      .then((data) => {
        setComments(Array.isArray(data) ? data : data.comments || []);
      })
      .catch(() => {});
  }, [showComments, lightboxIndex, photos]);

  // ---- Socket ----
  useEffect(() => {
    if (!code || !userName) return;

    joinRoom(code, userName);
    const socket = getSocket();

    function handleNewPhoto(photo) {
      setPhotos((prev) => [photo, ...prev]);

      // Show toast if not on photos tab
      setActiveTab((currentTab) => {
        if (currentTab !== 'photos') {
          setPhotoToast({
            userName: photo.userName || 'Someone',
            thumbnail: photo.thumbnail || photo.filename || photo.file,
            photoId: photo._id || photo.id,
          });
        }
        return currentTab;
      });
    }
    function handleParticipantJoined(data) {
      setParticipants((prev) => {
        if (prev.find((p) => p.userId === data.userId)) return prev;
        return [...prev, data];
      });
    }
    function handleParticipantLeft(data) {
      setParticipants((prev) =>
        prev.filter((p) => p.userId !== data.userId)
      );
    }
    function handlePhotoDeleted({ photoId }) {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    }
    function handlePhotoReaction({ photoId, counts, userReactions: ur }) {
      setReactions((prev) => ({ ...prev, [photoId]: counts || {} }));
      if (ur) {
        setUserReactions((prev) => ({ ...prev, [photoId]: ur }));
      }
    }
    function handleNewComment({ photoId, comment }) {
      setComments((prev) => {
        // Only add if we're viewing comments for this photo
        return [...prev, comment];
      });
    }
    function handleUserActivity(data) {
      setActiveUsers((prev) => {
        const filtered = prev.filter((u) => u.userId !== data.userId);
        if (data.activity === 'left') return filtered;
        return [...filtered, { ...data, timestamp: Date.now() }];
      });
    }
    function handlePhotoApproved({ photo }) {
      if (photo) {
        setPhotos((prev) => [photo, ...prev]);
        setPendingPhotos((prev) => prev.filter((p) => (p._id || p.id) !== (photo._id || photo.id)));
      }
    }

    if (socket) {
      socket.on(SOCKET_EVENTS.NEW_PHOTO, handleNewPhoto);
      socket.on(SOCKET_EVENTS.PARTICIPANT_JOINED, handleParticipantJoined);
      socket.on(SOCKET_EVENTS.PARTICIPANT_LEFT, handleParticipantLeft);
      socket.on('photo-deleted', handlePhotoDeleted);
      socket.on(SOCKET_EVENTS.PHOTO_REACTION, handlePhotoReaction);
      socket.on(SOCKET_EVENTS.NEW_COMMENT, handleNewComment);
      socket.on(SOCKET_EVENTS.USER_ACTIVITY, handleUserActivity);
      socket.on(SOCKET_EVENTS.PHOTO_APPROVED, handlePhotoApproved);

      // Emit viewing activity
      socket.emit(SOCKET_EVENTS.USER_ACTIVITY, {
        eventCode: code,
        userId,
        userName,
        activity: 'viewing',
      });
    }

    return () => {
      leaveRoom(code);
      if (socket) {
        socket.off(SOCKET_EVENTS.NEW_PHOTO, handleNewPhoto);
        socket.off(SOCKET_EVENTS.PARTICIPANT_JOINED, handleParticipantJoined);
        socket.off(SOCKET_EVENTS.PARTICIPANT_LEFT, handleParticipantLeft);
        socket.off('photo-deleted', handlePhotoDeleted);
        socket.off(SOCKET_EVENTS.PHOTO_REACTION, handlePhotoReaction);
        socket.off(SOCKET_EVENTS.NEW_COMMENT, handleNewComment);
        socket.off(SOCKET_EVENTS.USER_ACTIVITY, handleUserActivity);
        socket.off(SOCKET_EVENTS.PHOTO_APPROVED, handlePhotoApproved);
      }
    };
  }, [code, userName, joinRoom, leaveRoom, getSocket, userId]);

  // ---- Photo toast auto-dismiss ----
  useEffect(() => {
    if (!photoToast) return;
    if (photoToastTimerRef.current) clearTimeout(photoToastTimerRef.current);
    photoToastTimerRef.current = setTimeout(() => {
      setPhotoToast(null);
    }, 4000);
    return () => {
      if (photoToastTimerRef.current) clearTimeout(photoToastTimerRef.current);
    };
  }, [photoToast]);

  // ---- Active users cleanup (stale after 30s) ----
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveUsers((prev) => prev.filter((u) => Date.now() - u.timestamp < 30000));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // ---- Slideshow auto-advance ----
  useEffect(() => {
    if (!slideshowActive || slideshowPaused || photos.length === 0) return;
    const timer = setInterval(() => {
      setSlideshowIndex((prev) => {
        if (prev >= photos.length - 1) return 0;
        return prev + 1;
      });
    }, slideshowInterval);
    return () => clearInterval(timer);
  }, [slideshowActive, slideshowPaused, slideshowInterval, photos.length]);

  // ---- Story viewer auto-advance ----
  useEffect(() => {
    if (!viewingStory) return;
    let slides = [];
    try {
      slides = typeof viewingStory.slides === 'string'
        ? JSON.parse(viewingStory.slides)
        : viewingStory.slides || [];
    } catch {
      slides = [];
    }
    if (slides.length === 0) return;

    const timer = setTimeout(() => {
      setStorySlideIndex((prev) => {
        if (prev >= slides.length - 1) {
          // End of story, close viewer
          setViewingStory(null);
          return 0;
        }
        return prev + 1;
      });
    }, STORY_SLIDE_DURATION);
    return () => clearTimeout(timer);
  }, [viewingStory, storySlideIndex]);

  // ---- Upload handler ----
  const handleFileSelect = useCallback(
    async (files) => {
      if (!files?.length || !event) return;

      const fileList = Array.from(files).slice(0, MAX_UPLOAD_FILES);
      const formData = new FormData();
      formData.append('userId', userId);
      formData.append('userName', userName);
      fileList.forEach((f) => formData.append('photos', f));

      setShowUploadSheet(false);
      setUploadProgress(0);

      try {
        const result = await uploadPhotos(
          event._id || event.id || code,
          formData,
          (pct) => setUploadProgress(pct)
        );
        const newPhotos = result.photos || result;
        if (Array.isArray(newPhotos)) {
          setPhotos((prev) => [...newPhotos, ...prev]);
        }
      } catch (err) {
        setError(err.message || 'Upload failed');
      } finally {
        setUploadProgress(null);
      }
    },
    [event, userId, userName, code]
  );

  // ---- Copy link (with fallback for non-HTTPS) ----
  const handleCopyLink = async () => {
    const url = `${window.location.origin}/join/${code}`;
    let success = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        success = true;
      }
    } catch {
      // clipboard API failed
    }
    if (!success) {
      // Fallback: textarea + execCommand
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        success = true;
      } catch {
        // last resort
      }
    }
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ---- Native share (with copy fallback) ----
  const handleShare = async () => {
    const url = `${window.location.origin}/join/${code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: event?.name || 'The Guest Book Event',
          text: `Join my event on The Guest Book: ${event?.name || ''}`,
          url,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      // Fallback to copy if share API not available
      handleCopyLink();
    }
  };

  // ---- Lightbox touch / swipe ----
  const handleTouchStart = (e) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx > 0 && lightboxIndex > 0) {
        setLightboxIndex(lightboxIndex - 1);
      } else if (dx < 0 && lightboxIndex < photos.length - 1) {
        setLightboxIndex(lightboxIndex + 1);
      }
    }
    // Swipe down to close
    if (Math.abs(dy) > 100 && Math.abs(dy) > Math.abs(dx)) {
      setLightboxIndex(-1);
    }
  };

  // ---- Helpers ----
  const eventId = event?._id || event?.id || code;

  // ---- Delete photo handler (host only) ----
  const handleDeletePhoto = async () => {
    if (!isHost || lightboxIndex < 0 || lightboxIndex >= photos.length) return;
    const photo = photos[lightboxIndex];
    setDeletingPhoto(true);
    try {
      await apiDeletePhoto(photo.id, userId);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      // Adjust lightbox index
      if (photos.length <= 1) {
        setLightboxIndex(-1);
      } else if (lightboxIndex >= photos.length - 1) {
        setLightboxIndex(lightboxIndex - 1);
      }
      setShowDeletePhotoModal(false);
    } catch (err) {
      setError(err.message || 'Failed to delete photo');
    } finally {
      setDeletingPhoto(false);
    }
  };

  // ---- Delete event handler (host only) ----
  const handleDeleteEvent = async () => {
    if (!isHost) return;
    setDeletingEvent(true);
    try {
      await apiDeleteEvent(eventId, userId);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to delete event');
      setDeletingEvent(false);
    }
  };

  const getPhotoUrl = (photo, thumb = false) => {
    const uidParam = `?uid=${encodeURIComponent(userId)}`;
    if (thumb && photo.thumbnail)
      return `/uploads/${eventId}/${photo.thumbnail}${uidParam}`;
    if (photo.url) return photo.url;
    return `/uploads/${eventId}/${photo.filename || photo.file}${uidParam}`;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const avatarColor = (name) => {
    const hue = ((name || '').charCodeAt(0) * 47) % 360;
    return {
      backgroundColor: `hsl(${hue}, 50%, 25%)`,
      color: `hsl(${hue}, 70%, 70%)`,
    };
  };

  // ---- Download filtered photo via canvas ----
  const handleDownloadFiltered = async (photo) => {
    setSavingFiltered(true);
    try {
      const filter = PHOTO_FILTERS.find((f) => f.key === activeFilter);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = getPhotoUrl(photo);
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.filter = filter?.css || 'none';
      ctx.drawImage(img, 0, 0);

      const link = document.createElement('a');
      link.download = `moment_${activeFilter}_${photo.filename || photo.file || 'photo'}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.92);
      link.click();
    } catch {
      setError('Failed to save filtered photo');
    } finally {
      setSavingFiltered(false);
    }
  };

  // ---- Moments lightbox touch ----
  const momentsTouchStartRef = useRef({ x: 0, y: 0 });
  const handleMomentsTouchStart = (e) => {
    momentsTouchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };
  const handleMomentsTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - momentsTouchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - momentsTouchStartRef.current.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx > 0 && momentsLightboxIndex > 0) {
        setMomentsLightboxIndex(momentsLightboxIndex - 1);
      } else if (dx < 0 && momentsLightboxIndex < photos.length - 1) {
        setMomentsLightboxIndex(momentsLightboxIndex + 1);
      }
    }
    if (Math.abs(dy) > 100 && Math.abs(dy) > Math.abs(dx)) {
      setMomentsLightboxIndex(-1);
    }
  };

  const currentFilter = PHOTO_FILTERS.find((f) => f.key === activeFilter) || PHOTO_FILTERS[0];

  // ---- NEW: Reaction handler ----
  const handleToggleReaction = async (reactionType) => {
    if (lightboxIndex < 0 || lightboxIndex >= photos.length) return;
    const photo = photos[lightboxIndex];
    const photoId = photo._id || photo.id;
    if (!photoId) return;

    try {
      const result = await toggleReaction(photoId, {
        userId,
        eventId,
        reactionType,
      });
      if (result) {
        setReactions((prev) => ({
          ...prev,
          [photoId]: result.counts || prev[photoId] || {},
        }));
        setUserReactions((prev) => ({
          ...prev,
          [photoId]: result.userReactions || prev[photoId] || [],
        }));
      }
    } catch {
      // silently fail
    }
  };

  // ---- NEW: Comment submit handler ----
  const handleSubmitComment = async () => {
    if (!commentText.trim() || lightboxIndex < 0 || lightboxIndex >= photos.length) return;
    const photo = photos[lightboxIndex];
    const photoId = photo._id || photo.id;
    if (!photoId) return;

    try {
      const result = await addComment(photoId, {
        userId,
        userName,
        text: commentText.trim(),
        eventId,
      });
      if (result) {
        const newComment = result.comment || result;
        setComments((prev) => [...prev, newComment]);
      }
      setCommentText('');
    } catch {
      setError('Failed to add comment');
    }
  };

  // ---- NEW: Delete comment handler ----
  const handleDeleteComment = async (commentId) => {
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => (c._id || c.id) !== commentId));
    } catch {
      setError('Failed to delete comment');
    }
  };

  // ---- NEW: Bulk select toggle ----
  const handleToggleSelect = (photoId) => {
    setSelectedPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  // ---- NEW: Bulk download ----
  const handleBulkDownload = () => {
    if (selectedPhotos.size === 0) return;
    // Download as ZIP via API
    const url = `/api/photos/${eventId}/download-all?photoIds=${Array.from(selectedPhotos).join(',')}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `event_${code}_photos.zip`;
    link.click();
  };

  // ---- NEW: Approve pending photo ----
  const handleApprovePhoto = async (photoId) => {
    try {
      await approvePhoto(photoId, userId);
      setPendingPhotos((prev) => prev.filter((p) => (p._id || p.id) !== photoId));
    } catch {
      setError('Failed to approve photo');
    }
  };

  // ---- NEW: Reject pending photo ----
  const handleRejectPhoto = async (photoId) => {
    try {
      await rejectPhoto(photoId, userId);
      setPendingPhotos((prev) => prev.filter((p) => (p._id || p.id) !== photoId));
    } catch {
      setError('Failed to reject photo');
    }
  };

  // ---- NEW: Story viewer helpers ----
  const getStorySlides = (story) => {
    if (!story) return [];
    try {
      return typeof story.slides === 'string'
        ? JSON.parse(story.slides)
        : story.slides || [];
    } catch {
      return [];
    }
  };

  const handleStoryTap = (e, slides) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const half = rect.width / 2;
    if (x < half) {
      // Left side - go back
      setStorySlideIndex((prev) => Math.max(0, prev - 1));
    } else {
      // Right side - go forward
      if (storySlideIndex >= slides.length - 1) {
        setViewingStory(null);
        setStorySlideIndex(0);
      } else {
        setStorySlideIndex((prev) => prev + 1);
      }
    }
  };

  // ---- Helper: format interval label ----
  const formatInterval = (ms) => `${ms / 1000}s`;

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---- Error state ----
  if (error && !event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <X size={28} className="text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">
            Event Not Found
          </h2>
          <p className="text-sm text-slate-400 mb-6">{error}</p>
          <Button variant="secondary" onClick={() => navigate('/')}>
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  // ---- Lightbox current photo helpers ----
  const lightboxPhoto = lightboxIndex >= 0 && lightboxIndex < photos.length ? photos[lightboxIndex] : null;
  const lightboxPhotoId = lightboxPhoto ? (lightboxPhoto._id || lightboxPhoto.id) : null;
  const lightboxReactions = lightboxPhotoId ? (reactions[lightboxPhotoId] || {}) : {};
  const lightboxUserReactions = lightboxPhotoId ? (userReactions[lightboxPhotoId] || []) : [];
  const totalReactions = Object.values(lightboxReactions).reduce((sum, c) => sum + (c || 0), 0);
  const totalComments = comments.length;

  // ---- Main render ----
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* ===== TOP BAR ===== */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-lg border-b border-slate-800/50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/"
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors flex-shrink-0"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-white truncate">
                {event?.name || 'Event'}
              </h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-500 font-mono">{code}</p>
                {/* Live activity indicator */}
                {activeUsers.length > 0 && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    {activeUsers.length === 1
                      ? `${activeUsers[0].userName || 'Someone'} is viewing`
                      : `${activeUsers.length} people viewing`}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/60 text-xs text-slate-400">
              <Users size={12} />
              {participants.length || event?.participantCount || 0}
            </span>
            {/* Chat button */}
            <button
              onClick={() => setShowChat(true)}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-colors"
              title="Chat"
            >
              <ChatIcon size={18} />
            </button>
            <button
              onClick={() => setShowShareModal(true)}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-colors"
            >
              <Share2 size={18} />
            </button>
            {/* Export button */}
            <button
              onClick={() => setShowExport(true)}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-green-400 transition-colors"
              title="Export"
            >
              <Archive size={18} />
            </button>
            {/* GIF creator button */}
            <button
              onClick={() => setShowGifCreator(true)}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-yellow-400 transition-colors"
              title="Create GIF"
            >
              <Zap size={18} />
            </button>
            {isHost && (
              <button
                onClick={() => setShowThemeCustomizer(true)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-purple-400 transition-colors"
                title="Theme"
              >
                <Palette size={18} />
              </button>
            )}
            {isHost && (
              <button
                onClick={() => setShowDeleteEventModal(true)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                title="Delete Event"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ===== PHOTO TOAST NOTIFICATION ===== */}
      {photoToast && (
        <div className="fixed top-16 left-4 right-4 z-40 max-w-lg mx-auto animate-slide-down">
          <button
            onClick={() => {
              setActiveTab('photos');
              setPhotoToast(null);
            }}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-lg"
          >
            {photoToast.thumbnail && (
              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-slate-800">
                <img
                  src={`/uploads/${eventId}/${photoToast.thumbnail}?uid=${encodeURIComponent(userId)}`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm text-white font-medium truncate">
                {photoToast.userName} uploaded a new photo
              </p>
              <p className="text-xs text-indigo-400">Tap to view</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPhotoToast(null);
              }}
              className="text-slate-400 hover:text-white p-1"
            >
              <X size={14} />
            </button>
          </button>
        </div>
      )}

      {/* ===== TAB BAR ===== */}
      <div className="sticky top-[57px] z-20 bg-slate-950/90 backdrop-blur-lg border-b border-slate-800/30">
        <div className="max-w-lg mx-auto px-2">
          <div className="flex overflow-x-auto er-no-scrollbar">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`
                    relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap
                    border-b-2 transition-all duration-200
                    ${
                      isActive
                        ? 'text-indigo-400 border-indigo-400'
                        : 'text-slate-500 border-transparent hover:text-slate-300'
                    }
                  `}
                >
                  <Icon size={16} />
                  {tab.label}
                  {/* Pending badge on Photos tab for host */}
                  {tab.key === 'photos' && isHost && pendingPhotos.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {pendingPhotos.length > 9 ? '9+' : pendingPhotos.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== CONTENT ===== */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-24">
        {/* --- PHOTOS TAB --- */}
        {activeTab === 'photos' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-slate-400">
                {photos.length}{' '}
                {photos.length === 1 ? 'photo' : 'photos'}
              </h2>
              <div className="flex items-center gap-2">
                {/* Pending toggle (host only) */}
                {isHost && pendingPhotos.length > 0 && (
                  <button
                    onClick={() => setShowPending(!showPending)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      showPending
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-800/60 text-slate-400 hover:text-amber-400'
                    }`}
                  >
                    <Shield size={12} />
                    Pending ({pendingPhotos.length})
                  </button>
                )}
                {/* Select mode toggle */}
                <button
                  onClick={() => {
                    setSelectMode(!selectMode);
                    if (selectMode) setSelectedPhotos(new Set());
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    selectMode
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                      : 'bg-slate-800/60 text-slate-400 hover:text-white'
                  }`}
                >
                  {selectMode ? <CheckSquare size={12} /> : <Square size={12} />}
                  {selectMode ? `${selectedPhotos.size} selected` : 'Select'}
                </button>
                {/* Slideshow button */}
                {photos.length >= 2 && (
                  <button
                    onClick={() => {
                      setSlideshowActive(true);
                      setSlideshowIndex(0);
                      setSlideshowPaused(false);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/60 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                  >
                    <Play size={12} />
                    Slideshow
                  </button>
                )}
              </div>
            </div>

            {/* Bulk action bar */}
            {selectMode && selectedPhotos.size > 0 && (
              <div className="flex items-center gap-2 mb-3 p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <button
                  onClick={() => {
                    const allIds = photos.map((p) => p._id || p.id).filter(Boolean);
                    setSelectedPhotos(new Set(allIds));
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedPhotos(new Set())}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1"
                >
                  Deselect All
                </button>
                <div className="flex-1" />
                <Button
                  size="sm"
                  icon={Download}
                  onClick={handleBulkDownload}
                >
                  Download ({selectedPhotos.size})
                </Button>
              </div>
            )}

            {/* Pending photos moderation queue (host only) */}
            {isHost && showPending && pendingPhotos.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={14} className="text-amber-400" />
                  <span className="text-sm font-medium text-amber-400">Pending Approval</span>
                </div>
                <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
                  {pendingPhotos.map((photo, index) => {
                    const pId = photo._id || photo.id;
                    return (
                      <div
                        key={pId || index}
                        className="relative aspect-square overflow-hidden rounded-lg bg-slate-800/50 group"
                      >
                        <img
                          src={getPhotoUrl(photo, true)}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleApprovePhoto(pId)}
                            className="p-2 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                            title="Approve"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => handleRejectPhoto(pId)}
                            className="p-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                            title="Reject"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-amber-500/80 text-[9px] font-bold text-white">
                          PENDING
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {photos.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
                  <Camera size={28} className="text-slate-600" />
                </div>
                <p className="text-slate-500 mb-1">No photos yet</p>
                <p className="text-sm text-slate-600">
                  Be the first to share a photo
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
                {photos.map((photo, index) => {
                  const pId = photo._id || photo.id;
                  const isSelected = selectedPhotos.has(pId);
                  return (
                    <button
                      key={pId || index}
                      onClick={() => {
                        if (selectMode) {
                          handleToggleSelect(pId);
                        } else {
                          setLightboxIndex(index);
                        }
                      }}
                      className="relative aspect-square overflow-hidden rounded-lg bg-slate-800/50 group"
                    >
                      <img
                        src={getPhotoUrl(photo, true)}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                      {/* Select checkbox overlay */}
                      {selectMode && (
                        <div className="absolute top-1.5 left-1.5">
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-indigo-500 border-indigo-500'
                              : 'border-white/60 bg-black/30'
                          }`}>
                            {isSelected && <Check size={12} className="text-white" />}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- TIMELINE TAB --- */}
        {activeTab === 'timeline' && (
          <EventTimeline
            photos={approvedPhotos}
            eventId={event?.id || event?._id}
            userId={userId}
            onPhotoClick={(photo) => {
              const idx = approvedPhotos.findIndex(p => p.id === photo.id);
              if (idx >= 0) setLightboxIndex(idx);
            }}
          />
        )}

        {/* --- MOMENTS TAB --- */}
        {activeTab === 'moments' && (
          <div>
            {/* Filter selector */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-slate-400">
                  {photos.length}{' '}
                  {photos.length === 1 ? 'moment' : 'moments'}
                </h2>
                <p className="text-xs text-slate-500 italic">{currentFilter.desc}</p>
              </div>
              <div className="flex gap-2 overflow-x-auto er-no-scrollbar pb-1">
                {PHOTO_FILTERS.map((filter) => {
                  const isActive = activeFilter === filter.key;
                  return (
                    <button
                      key={filter.key}
                      onClick={() => setActiveFilter(filter.key)}
                      className={`
                        relative flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-200
                        ${isActive
                          ? 'bg-slate-800 ring-2 ' + filter.ring
                          : 'bg-slate-900/40 hover:bg-slate-800/60'
                        }
                      `}
                    >
                      {/* Preview thumbnail */}
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-800">
                        {photos.length > 0 ? (
                          <img
                            src={getPhotoUrl(photos[0], true)}
                            alt=""
                            className="w-full h-full object-cover"
                            style={{ filter: filter.css }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Palette size={18} className="text-slate-600" />
                          </div>
                        )}
                      </div>
                      <span className={`text-[11px] font-medium ${isActive ? 'text-white' : 'text-slate-500'}`}>
                        {filter.label}
                      </span>
                      {isActive && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                          <Check size={10} className="text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {photos.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
                  <Palette size={28} className="text-slate-600" />
                </div>
                <p className="text-slate-500 mb-1">No moments yet</p>
                <p className="text-sm text-slate-600">
                  Upload photos to see them come to life with filters
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
                {photos.map((photo, index) => (
                  <div
                    key={photo._id || photo.id || index}
                    className="relative aspect-square overflow-hidden rounded-lg bg-slate-800/50 group"
                  >
                    <button
                      onClick={() => setMomentsLightboxIndex(index)}
                      className="w-full h-full"
                    >
                      <img
                        src={getPhotoUrl(photo, true)}
                        alt=""
                        className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
                        style={{ filter: currentFilter.css }}
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    </button>
                    <button
                      onClick={() => navigate(`/event/${code}/moment?photo=${index}&filter=${activeFilter}`)}
                      className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white/80 hover:bg-indigo-600 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      title="Edit with text & emoji"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- ALBUMS TAB --- */}
        {activeTab === 'albums' && (
          <AlbumsManager
            eventId={event?.id || event?._id}
            userId={userId}
            photos={approvedPhotos}
            onPhotoClick={(photo) => {
              const idx = approvedPhotos.findIndex(p => p.id === photo.id);
              if (idx >= 0) setLightboxIndex(idx);
            }}
          />
        )}

        {/* --- PEOPLE TAB --- */}
        {activeTab === 'people' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-slate-400">
                {participants.length}{' '}
                {participants.length === 1
                  ? 'participant'
                  : 'participants'}
              </h2>
              <Link
                to={`/event/${code}/faces`}
                className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
              >
                <Sparkles size={14} />
                AI Faces
              </Link>
            </div>

            {participants.length === 0 ? (
              <div className="text-center py-12">
                <UserCircle2
                  size={40}
                  className="mx-auto text-slate-700 mb-3"
                />
                <p className="text-sm text-slate-500">
                  Participants will appear here
                </p>
              </div>
            ) : (
              participants.map((p, i) => (
                <div
                  key={p.userId || p._id || i}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800/40"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={avatarColor(p.userName || p.name)}
                  >
                    {(p.userName || p.name || '?')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {p.userName || p.name || 'Anonymous'}
                      {p.userId === userId && (
                        <span className="ml-1.5 text-xs text-indigo-400">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {p.photoCount ?? 0} photos uploaded
                    </p>
                  </div>
                  {p.isHost && (
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-xs text-indigo-400 font-medium">
                      Host
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* --- CONTEST TAB --- */}
        {activeTab === 'contest' && (
          <VotingContest
            eventId={event?.id || event?._id}
            photos={approvedPhotos}
            userId={userId}
            eventCode={event?.code}
            socket={getSocket()}
            onPhotoClick={(photo) => {
              const idx = approvedPhotos.findIndex(p => p.id === photo.id);
              if (idx >= 0) setLightboxIndex(idx);
            }}
          />
        )}

        {/* --- REELS TAB --- */}
        {activeTab === 'reels' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
              <Film size={28} className="text-indigo-400" />
            </div>
            <h3 className="text-white font-medium mb-1">Create a Reel</h3>
            <p className="text-sm text-slate-500 mb-5 max-w-xs mx-auto">
              Turn your event photos into a beautiful video montage
            </p>
            <Button
              icon={Plus}
              onClick={() => navigate(`/event/${code}/reel`)}
              disabled={photos.length < 2}
            >
              Create Reel
            </Button>
            {photos.length < 2 && (
              <p className="text-xs text-slate-600 mt-3">
                Need at least 2 photos to create a reel
              </p>
            )}
          </div>
        )}

        {/* --- STORIES TAB --- */}
        {activeTab === 'stories' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-slate-400">
                Stories
              </h2>
              <Button
                size="sm"
                icon={Plus}
                onClick={() => navigate(`/event/${code}/story`)}
              >
                Create Story
              </Button>
            </div>

            {stories.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen
                  size={32}
                  className="mx-auto text-slate-700 mb-3"
                />
                <p className="text-sm text-slate-500">No stories yet</p>
                <p className="text-xs text-slate-600 mt-1">
                  Create the first story for this event
                </p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 er-no-scrollbar">
                {stories.map((story, i) => (
                  <div
                    key={story._id || story.id || i}
                    className="flex-shrink-0 w-20 text-center cursor-pointer group"
                    onClick={() => {
                      setViewingStory(story);
                      setStorySlideIndex(0);
                    }}
                  >
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 p-0.5 mb-1.5">
                      <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
                        {story.coverUrl ? (
                          <img
                            src={story.coverUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <BookOpen
                            size={20}
                            className="text-slate-600"
                          />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      {story.title ||
                        story.userName ||
                        `Story ${i + 1}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ===== FAB ===== */}
      <button
        onClick={() => setShowUploadSheet(true)}
        className="fixed bottom-6 right-4 z-20 w-14 h-14 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        <Plus size={24} />
      </button>

      {/* ===== UPLOAD SHEET ===== */}
      <Modal
        open={showUploadSheet}
        onClose={() => setShowUploadSheet(false)}
        title="Add Photos"
      >
        <div className="space-y-3 mt-2">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-slate-700/50 hover:bg-slate-700 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Camera size={20} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Take Photo</p>
              <p className="text-xs text-slate-400">Use your camera</p>
            </div>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-slate-700/50 hover:bg-slate-700 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <ImageIcon size={20} className="text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                Choose from Gallery
              </p>
              <p className="text-xs text-slate-400">
                Select multiple photos
              </p>
            </div>
          </button>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </Modal>

      {/* ===== UPLOAD PROGRESS ===== */}
      {uploadProgress !== null && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full border-4 border-slate-700 border-t-indigo-500 animate-spin mx-auto mb-4" />
            <p className="text-white font-medium mb-2">
              Uploading photos...
            </p>
            <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden mx-auto">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-sm text-slate-400 mt-2">{uploadProgress}%</p>
          </div>
        </div>
      )}

      {/* ===== SHARE MODAL ===== */}
      <Modal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Share Event"
      >
        <div className="flex flex-col items-center space-y-4 mt-2">
          <div className="bg-white p-4 rounded-2xl">
            <QRCodeSVG
              value={`${window.location.origin}/join/${code}`}
              size={180}
              bgColor="#ffffff"
              fgColor="#1e1b4b"
              level="M"
            />
          </div>

          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
              Room Code
            </p>
            <p className="text-3xl font-bold font-mono tracking-[0.2em] text-white">
              {code}
            </p>
          </div>

          {/* Direct share buttons */}
          <div className="w-full">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 text-center">
              Share via
            </p>
            <div className="grid grid-cols-4 gap-2">
              {/* WhatsApp */}
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  `Join my event on The Guest Book: "${event?.name || ''}"!\n\nRoom Code: ${code}\n\n${window.location.origin}/join/${code}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center">
                  <MessageCircle size={20} className="text-white" />
                </div>
                <span className="text-[11px] text-slate-400">WhatsApp</span>
              </a>

              {/* Telegram */}
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(
                  `${window.location.origin}/join/${code}`
                )}&text=${encodeURIComponent(
                  `Join my event on The Guest Book: "${event?.name || ''}"! Room Code: ${code}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[#0088cc] flex items-center justify-center">
                  <Send size={20} className="text-white" />
                </div>
                <span className="text-[11px] text-slate-400">Telegram</span>
              </a>

              {/* SMS/Messages */}
              <a
                href={`sms:?body=${encodeURIComponent(
                  `Join my event on The Guest Book: "${event?.name || ''}"! Room Code: ${code} - ${window.location.origin}/join/${code}`
                )}`}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[#5856D6] flex items-center justify-center">
                  <MessageCircle size={20} className="text-white" />
                </div>
                <span className="text-[11px] text-slate-400">SMS</span>
              </a>

              {/* More / Native share */}
              <button
                onClick={handleShare}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
                  <ExternalLink size={20} className="text-white" />
                </div>
                <span className="text-[11px] text-slate-400">More</span>
              </button>
            </div>
          </div>

          {/* Copy link button */}
          <Button
            variant="secondary"
            fullWidth
            icon={Copy}
            onClick={handleCopyLink}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
        </div>
      </Modal>

      {/* ===== LIGHTBOX ===== */}
      {lightboxIndex >= 0 && lightboxIndex < photos.length && (
        <div
          className="fixed inset-0 z-50 bg-black flex flex-col"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm">
            <button
              onClick={() => {
                setLightboxIndex(-1);
                setShowComments(false);
              }}
              className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
            >
              <X size={20} />
            </button>
            <p className="text-xs text-slate-400">
              {lightboxIndex + 1} / {photos.length}
            </p>
            <div className="flex items-center gap-1">
              {/* Comment toggle button */}
              <button
                onClick={() => setShowComments(!showComments)}
                className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors relative"
              >
                <MessageCircle size={20} />
                {totalComments > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {totalComments > 9 ? '9+' : totalComments}
                  </span>
                )}
              </button>
              {isHost && (
                <button
                  onClick={() => setShowDeletePhotoModal(true)}
                  className="p-2 rounded-lg hover:bg-white/10 text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 size={20} />
                </button>
              )}
              <a
                href={getPhotoUrl(photos[lightboxIndex])}
                download
                className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
              >
                <Download size={20} />
              </a>
            </div>
          </div>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            <img
              src={getPhotoUrl(photos[lightboxIndex])}
              alt=""
              className="max-w-full max-h-full object-contain select-none"
              draggable={false}
            />

            {lightboxIndex > 0 && (
              <button
                onClick={() => setLightboxIndex(lightboxIndex - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors hidden sm:block"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            {lightboxIndex < photos.length - 1 && (
              <button
                onClick={() => setLightboxIndex(lightboxIndex + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors hidden sm:block"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>

          {/* Reaction Bar */}
          <div className="px-4 py-2 bg-black/60 backdrop-blur-sm">
            <div className="flex items-center gap-1 justify-center mb-1">
              {REACTION_TYPES.map((rt) => {
                const isReacted = lightboxUserReactions.includes(rt.key);
                const count = lightboxReactions[rt.key] || 0;
                return (
                  <button
                    key={rt.key}
                    onClick={() => handleToggleReaction(rt.key)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-all duration-200 ${
                      isReacted
                        ? 'bg-indigo-500/20 border border-indigo-500/40 scale-105'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                    }`}
                    title={rt.label}
                  >
                    <span className="text-base">{rt.emoji}</span>
                    {count > 0 && (
                      <span className={`text-[11px] font-medium ${isReacted ? 'text-indigo-300' : 'text-slate-400'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {totalReactions > 0 && (
              <p className="text-center text-[10px] text-slate-500">
                {totalReactions} {totalReactions === 1 ? 'reaction' : 'reactions'}
              </p>
            )}
          </div>

          {/* Footer with user info and EXIF */}
          <div className="px-4 py-3 bg-black/60 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={avatarColor(
                  photos[lightboxIndex].userName
                )}
              >
                {(photos[lightboxIndex].userName || '?')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">
                  {photos[lightboxIndex].userName || 'Anonymous'}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock size={10} />
                  {formatTime(
                    photos[lightboxIndex].createdAt ||
                      photos[lightboxIndex].uploadedAt
                  )}
                </p>
              </div>
              {/* EXIF toggle */}
              <button
                onClick={() => setShowExif(!showExif)}
                className={`p-1.5 rounded-lg transition-colors ${
                  showExif ? 'bg-white/10 text-indigo-400' : 'text-slate-500 hover:text-white'
                }`}
                title="Photo details"
              >
                <Info size={16} />
              </button>
            </div>

            {/* EXIF Metadata Collapsible */}
            {showExif && (
              <div className="mt-2 p-2.5 rounded-lg bg-white/5 border border-white/10 space-y-1 animate-slide-down">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1">Photo Details</p>
                {photos[lightboxIndex].width && photos[lightboxIndex].height && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Dimensions:</span>
                    <span className="text-slate-300">{photos[lightboxIndex].width} x {photos[lightboxIndex].height}</span>
                  </div>
                )}
                {photos[lightboxIndex].taken_at && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Taken:</span>
                    <span className="text-slate-300">
                      {new Date(photos[lightboxIndex].taken_at).toLocaleString()}
                    </span>
                  </div>
                )}
                {photos[lightboxIndex].camera && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Camera:</span>
                    <span className="text-slate-300">{photos[lightboxIndex].camera}</span>
                  </div>
                )}
                {photos[lightboxIndex].make && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Make:</span>
                    <span className="text-slate-300">{photos[lightboxIndex].make}</span>
                  </div>
                )}
                {photos[lightboxIndex].model && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Model:</span>
                    <span className="text-slate-300">{photos[lightboxIndex].model}</span>
                  </div>
                )}
                {photos[lightboxIndex].fileSize && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Size:</span>
                    <span className="text-slate-300">
                      {(photos[lightboxIndex].fileSize / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                )}
                {photos[lightboxIndex].filename && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">File:</span>
                    <span className="text-slate-300 truncate">{photos[lightboxIndex].filename}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Comments Panel (slide up overlay) */}
          {showComments && (
            <div className="absolute bottom-0 left-0 right-0 z-10 bg-slate-900/95 backdrop-blur-lg border-t border-slate-700/50 rounded-t-2xl max-h-[60vh] flex flex-col animate-slide-up">
              {/* Comments header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/50">
                <h3 className="text-sm font-semibold text-white">
                  Comments {totalComments > 0 && `(${totalComments})`}
                </h3>
                <button
                  onClick={() => setShowComments(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Comments list */}
              <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
                {comments.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageCircle size={24} className="mx-auto text-slate-700 mb-2" />
                    <p className="text-xs text-slate-500">No comments yet. Be the first!</p>
                  </div>
                ) : (
                  comments.map((comment, idx) => {
                    const cId = comment._id || comment.id || idx;
                    return (
                      <div key={cId} className="flex gap-2 group">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0 mt-0.5"
                          style={avatarColor(comment.userName)}
                        >
                          {(comment.userName || '?').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-medium text-slate-300">
                              {comment.userName || 'Anonymous'}
                            </span>
                            <span className="text-[10px] text-slate-600">
                              {formatTime(comment.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 break-words">
                            {comment.text}
                          </p>
                        </div>
                        {(comment.userId === userId || isHost) && (
                          <button
                            onClick={() => handleDeleteComment(cId)}
                            className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Comment input */}
              <div className="px-4 py-3 border-t border-slate-800/50">
                <div className="flex items-center gap-2">
                  <input
                    ref={commentInputRef}
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitComment();
                      }
                    }}
                    placeholder="Add a comment..."
                    className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                  />
                  <button
                    onClick={handleSubmitComment}
                    disabled={!commentText.trim()}
                    className="p-2 rounded-xl bg-indigo-500 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-600 transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== MOMENTS LIGHTBOX ===== */}
      {momentsLightboxIndex >= 0 && momentsLightboxIndex < photos.length && (
        <div
          className="fixed inset-0 z-50 bg-black flex flex-col"
          onTouchStart={handleMomentsTouchStart}
          onTouchEnd={handleMomentsTouchEnd}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm">
            <button
              onClick={() => setMomentsLightboxIndex(-1)}
              className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[11px] font-medium text-slate-300">
                {currentFilter.label}
              </span>
              <p className="text-xs text-slate-400">
                {momentsLightboxIndex + 1} / {photos.length}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setMomentsLightboxIndex(-1);
                  navigate(`/event/${code}/moment?photo=${momentsLightboxIndex}&filter=${activeFilter}`);
                }}
                className="p-2 rounded-lg hover:bg-white/10 text-indigo-400 hover:text-indigo-300 transition-colors"
                title="Add text & emoji"
              >
                <Pencil size={20} />
              </button>
              <button
                onClick={() => handleDownloadFiltered(photos[momentsLightboxIndex])}
                disabled={savingFiltered}
                className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors disabled:opacity-50"
              >
                {savingFiltered ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Download size={20} />
                )}
              </button>
            </div>
          </div>

          {/* Filtered image */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            <img
              src={getPhotoUrl(photos[momentsLightboxIndex])}
              alt=""
              className="max-w-full max-h-full object-contain select-none transition-all duration-500"
              style={{ filter: currentFilter.css }}
              draggable={false}
            />

            {momentsLightboxIndex > 0 && (
              <button
                onClick={() => setMomentsLightboxIndex(momentsLightboxIndex - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors hidden sm:block"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            {momentsLightboxIndex < photos.length - 1 && (
              <button
                onClick={() => setMomentsLightboxIndex(momentsLightboxIndex + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors hidden sm:block"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>

          {/* Bottom filter strip */}
          <div className="px-4 py-3 bg-black/60 backdrop-blur-sm">
            <div className="flex gap-3 justify-center overflow-x-auto er-no-scrollbar">
              {PHOTO_FILTERS.map((filter) => {
                const isActive = activeFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    onClick={() => setActiveFilter(filter.key)}
                    className={`flex flex-col items-center gap-1 flex-shrink-0 transition-all duration-200
                      ${isActive ? 'opacity-100 scale-105' : 'opacity-60 hover:opacity-80'}
                    `}
                  >
                    <div className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-colors
                      ${isActive ? 'border-indigo-400' : 'border-transparent'}
                    `}>
                      <img
                        src={getPhotoUrl(photos[momentsLightboxIndex], true)}
                        alt=""
                        className="w-full h-full object-cover"
                        style={{ filter: filter.css }}
                      />
                    </div>
                    <span className={`text-[10px] ${isActive ? 'text-white font-medium' : 'text-slate-500'}`}>
                      {filter.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== SLIDESHOW MODE ===== */}
      {slideshowActive && photos.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
          {/* Slideshow image */}
          <div className="flex-1 flex items-center justify-center w-full relative overflow-hidden">
            <img
              src={getPhotoUrl(photos[slideshowIndex])}
              alt=""
              className="max-w-full max-h-full object-contain select-none transition-opacity duration-700"
              draggable={false}
            />
          </div>

          {/* Progress bar */}
          <div className="w-full px-4">
            <div className="flex gap-1">
              {photos.map((_, i) => (
                <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      i < slideshowIndex ? 'bg-white/60 w-full' :
                      i === slideshowIndex ? 'bg-indigo-400 w-full' : 'w-0'
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Floating control bar */}
          <div className="w-full px-4 py-4">
            <div className="flex items-center justify-center gap-3 p-3 rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10 max-w-sm mx-auto">
              {/* Speed selector */}
              <div className="flex items-center gap-1">
                <Timer size={14} className="text-slate-400" />
                {SLIDESHOW_INTERVALS.map((interval) => (
                  <button
                    key={interval}
                    onClick={() => setSlideshowInterval(interval)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                      slideshowInterval === interval
                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                        : 'text-slate-500 hover:text-white'
                    }`}
                  >
                    {formatInterval(interval)}
                  </button>
                ))}
              </div>

              <div className="w-px h-6 bg-white/10" />

              {/* Previous */}
              <button
                onClick={() => setSlideshowIndex((prev) => Math.max(0, prev - 1))}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors"
              >
                <ChevronLeft size={18} />
              </button>

              {/* Play/Pause */}
              <button
                onClick={() => setSlideshowPaused(!slideshowPaused)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                {slideshowPaused ? <Play size={18} /> : <Pause size={18} />}
              </button>

              {/* Next */}
              <button
                onClick={() => setSlideshowIndex((prev) => Math.min(photos.length - 1, prev + 1))}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors"
              >
                <ChevronRight size={18} />
              </button>

              <div className="w-px h-6 bg-white/10" />

              {/* Close */}
              <button
                onClick={() => setSlideshowActive(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Counter */}
          <p className="text-xs text-slate-500 pb-2">
            {slideshowIndex + 1} / {photos.length}
          </p>
        </div>
      )}

      {/* ===== STORY VIEWER ===== */}
      {viewingStory && (() => {
        const slides = getStorySlides(viewingStory);
        if (slides.length === 0) {
          // No slides, close viewer
          return (
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
              <div className="text-center">
                <p className="text-slate-400 mb-4">This story has no slides</p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setViewingStory(null);
                    setStorySlideIndex(0);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          );
        }
        const currentSlide = slides[Math.min(storySlideIndex, slides.length - 1)] || slides[0];
        return (
          <div
            className="fixed inset-0 z-50 bg-black flex flex-col"
            onClick={(e) => handleStoryTap(e, slides)}
          >
            {/* Progress bars */}
            <div className="absolute top-0 left-0 right-0 z-10 px-2 pt-2 flex gap-1">
              {slides.map((_, i) => (
                <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/20">
                  <div
                    className={`h-full rounded-full transition-all ${
                      i < storySlideIndex
                        ? 'bg-white w-full'
                        : i === storySlideIndex
                        ? 'bg-white w-full animate-story-progress'
                        : 'w-0'
                    }`}
                    style={i === storySlideIndex ? { animation: `story-progress ${STORY_SLIDE_DURATION}ms linear` } : {}}
                  />
                </div>
              ))}
            </div>

            {/* Story header */}
            <div className="absolute top-4 left-0 right-0 z-10 px-4 pt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={avatarColor(viewingStory.userName || viewingStory.title)}
                >
                  {(viewingStory.userName || viewingStory.title || '?').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm text-white font-medium">
                    {viewingStory.title || viewingStory.userName || 'Story'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {formatTime(viewingStory.createdAt)}
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingStory(null);
                  setStorySlideIndex(0);
                }}
                className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Slide content */}
            <div className="flex-1 flex items-center justify-center relative overflow-hidden">
              {currentSlide.photoUrl && (
                <img
                  src={currentSlide.photoUrl}
                  alt=""
                  className="max-w-full max-h-full object-contain select-none"
                  draggable={false}
                />
              )}

              {/* Text overlays */}
              {currentSlide.textOverlays && Array.isArray(currentSlide.textOverlays) && (
                currentSlide.textOverlays.map((overlay, ti) => (
                  <div
                    key={ti}
                    className="absolute text-white font-medium drop-shadow-lg"
                    style={{
                      left: overlay.x ? `${overlay.x}%` : '50%',
                      top: overlay.y ? `${overlay.y}%` : '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: overlay.fontSize || '18px',
                      color: overlay.color || '#ffffff',
                    }}
                  >
                    {overlay.text}
                  </div>
                ))
              )}

              {/* Stickers */}
              {currentSlide.stickers && Array.isArray(currentSlide.stickers) && (
                currentSlide.stickers.map((sticker, si) => (
                  <div
                    key={si}
                    className="absolute"
                    style={{
                      left: sticker.x ? `${sticker.x}%` : '50%',
                      top: sticker.y ? `${sticker.y}%` : '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: sticker.size || '32px',
                    }}
                  >
                    {sticker.emoji || sticker.content}
                  </div>
                ))
              )}
            </div>

            {/* Slide indicator */}
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <p className="text-xs text-slate-500">
                {Math.min(storySlideIndex + 1, slides.length)} / {slides.length}
              </p>
            </div>
          </div>
        );
      })()}

      {/* ===== DELETE PHOTO CONFIRMATION ===== */}
      <Modal
        open={showDeletePhotoModal}
        onClose={() => setShowDeletePhotoModal(false)}
        title="Delete Photo"
      >
        <p className="text-sm text-slate-400 mb-4">
          Are you sure you want to delete this photo? This action cannot be undone.
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => setShowDeletePhotoModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            fullWidth
            loading={deletingPhoto}
            onClick={handleDeletePhoto}
          >
            {deletingPhoto ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Modal>

      {/* ===== DELETE EVENT CONFIRMATION ===== */}
      <Modal
        open={showDeleteEventModal}
        onClose={() => setShowDeleteEventModal(false)}
        title="Delete Event"
      >
        <p className="text-sm text-slate-400 mb-2">
          Are you sure you want to delete <strong className="text-white">{event?.name}</strong>?
        </p>
        <p className="text-sm text-red-400/80 mb-4">
          All photos, stories, and data for this event will be permanently deleted. This cannot be undone.
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => setShowDeleteEventModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            fullWidth
            loading={deletingEvent}
            onClick={handleDeleteEvent}
          >
            {deletingEvent ? 'Deleting...' : 'Delete Event'}
          </Button>
        </div>
      </Modal>

      {/* ===== INLINE ERROR TOAST ===== */}
      {error && event && (
        <div className="fixed bottom-24 left-4 right-4 z-40 max-w-lg mx-auto">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={() => setError('')}
              className="text-red-400 hover:text-red-300"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ===== GUEST CHAT ===== */}
      <GuestChat
        eventId={event?.id || event?._id}
        eventCode={event?.code}
        userId={userId}
        userName={userName}
        hostId={event?.host_id}
        socket={getSocket()}
        isOpen={showChat}
        onClose={() => setShowChat(false)}
      />

      {/* ===== THEME CUSTOMIZER ===== */}
      {showThemeCustomizer && (
        <EventThemeCustomizer
          event={event}
          hostId={userId}
          onThemeUpdate={(updated) => setEvent(prev => ({ ...prev, ...updated }))}
          onClose={() => setShowThemeCustomizer(false)}
        />
      )}

      {/* ===== GIF CREATOR ===== */}
      <GifCreator
        eventId={event?.id || event?._id}
        userId={userId}
        photos={approvedPhotos}
        isOpen={showGifCreator}
        onClose={() => setShowGifCreator(false)}
      />

      {/* ===== EXPORT MODAL ===== */}
      <ExportAlbum
        eventId={event?.id || event?._id}
        eventName={event?.name}
        photoCount={approvedPhotos.length}
        isOpen={showExport}
        onClose={() => setShowExport(false)}
      />

      <style>{`
        .er-no-scrollbar::-webkit-scrollbar { display: none; }
        .er-no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes slide-down {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes story-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        .animate-slide-down { animation: slide-down 0.3s ease-out; }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>
    </div>
  );
}
