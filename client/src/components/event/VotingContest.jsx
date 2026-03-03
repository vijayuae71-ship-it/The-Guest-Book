import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Heart, Crown, Medal, Award, ChevronUp } from 'lucide-react';

export default function VotingContest({ eventId, photos, userId, eventCode, socket, onPhotoClick }) {
  const [voteCounts, setVoteCounts] = useState({});
  const [userVotes, setUserVotes] = useState(new Set());
  const [leaderboard, setLeaderboard] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [voting, setVoting] = useState(null);

  // Load vote counts
  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/votes/event/${eventId}/counts`)
      .then(r => r.json())
      .then(data => {
        const counts = {};
        (data.counts || []).forEach(c => { counts[c.photo_id] = c.count; });
        setVoteCounts(counts);
      })
      .catch(() => {});
  }, [eventId]);

  // Load leaderboard
  const loadLeaderboard = useCallback(() => {
    fetch(`/api/votes/event/${eventId}/leaderboard?limit=10`)
      .then(r => r.json())
      .then(data => setLeaderboard(data.leaderboard || []))
      .catch(() => {});
  }, [eventId]);

  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);

  // Listen for real-time vote updates
  useEffect(() => {
    if (!socket) return;
    const handleVoteUpdate = ({ photoId, userId: voterId, voted, count }) => {
      setVoteCounts(prev => ({ ...prev, [photoId]: count }));
      if (voterId === userId) {
        setUserVotes(prev => {
          const next = new Set(prev);
          if (voted) next.add(photoId);
          else next.delete(photoId);
          return next;
        });
      }
    };
    socket.on('vote-update', handleVoteUpdate);
    return () => socket.off('vote-update', handleVoteUpdate);
  }, [socket, userId]);

  const toggleVote = useCallback(async (photoId) => {
    if (voting) return;
    setVoting(photoId);
    try {
      const res = await fetch(`/api/votes/${photoId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, eventId }),
      });
      const data = await res.json();
      setVoteCounts(prev => ({ ...prev, [photoId]: data.count }));
      setUserVotes(prev => {
        const next = new Set(prev);
        if (data.voted) next.add(photoId);
        else next.delete(photoId);
        return next;
      });

      // Broadcast via socket
      if (socket && eventCode) {
        socket.emit('vote', { photoId, userId, voted: data.voted, count: data.count, eventCode });
      }

      loadLeaderboard();
    } catch (err) {
      console.error('Vote failed:', err);
    } finally {
      setVoting(null);
    }
  }, [eventId, userId, socket, eventCode, voting, loadLeaderboard]);

  const rankIcons = [
    <Crown className="w-5 h-5 text-yellow-400" />,
    <Medal className="w-5 h-5 text-slate-300" />,
    <Award className="w-5 h-5 text-amber-600" />,
  ];

  return (
    <div className="px-4 pb-8">
      {/* Leaderboard toggle */}
      <button
        onClick={() => setShowLeaderboard(!showLeaderboard)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/20 rounded-xl mb-4"
      >
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <span className="text-sm font-semibold text-yellow-300">Photo Contest Leaderboard</span>
        </div>
        <ChevronUp className={`w-4 h-4 text-yellow-400 transition-transform ${showLeaderboard ? '' : 'rotate-180'}`} />
      </button>

      {/* Leaderboard */}
      {showLeaderboard && (
        <div className="mb-6 space-y-2">
          {leaderboard.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-4">No votes yet. Be the first to vote!</p>
          ) : (
            leaderboard.map((photo, i) => (
              <div
                key={photo.id}
                onClick={() => onPhotoClick?.(photo)}
                className="flex items-center gap-3 px-3 py-2 bg-slate-800/50 rounded-xl cursor-pointer hover:bg-slate-800 transition-colors"
              >
                <div className="w-8 text-center">
                  {i < 3 ? rankIcons[i] : <span className="text-sm text-slate-500">#{i + 1}</span>}
                </div>
                <img
                  src={`/uploads/${eventId}/${photo.thumbnail || photo.filename}?uid=${userId}`}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-300 truncate">{photo.original_name || 'Photo'}</p>
                  <p className="text-xs text-slate-500">by {photo.uploader_name || 'Anonymous'}</p>
                </div>
                <div className="flex items-center gap-1 text-sm font-semibold text-rose-400">
                  <Heart className="w-4 h-4 fill-current" />
                  {photo.vote_count}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Voting grid */}
      <div className="grid grid-cols-2 gap-3">
        {(photos || []).filter(p => p.status === 'approved').map(photo => {
          const votes = voteCounts[photo.id] || 0;
          const hasVoted = userVotes.has(photo.id);

          return (
            <div key={photo.id} className="bg-slate-800 rounded-xl overflow-hidden">
              <div
                className="aspect-square cursor-pointer relative"
                onClick={() => onPhotoClick?.(photo)}
              >
                <img
                  src={`/uploads/${eventId}/${photo.thumbnail || photo.filename}?uid=${userId}`}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-2 flex items-center justify-between">
                <button
                  onClick={() => toggleVote(photo.id)}
                  disabled={voting === photo.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    hasVoted
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-slate-700 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${hasVoted ? 'fill-current' : ''} ${voting === photo.id ? 'animate-pulse' : ''}`} />
                  {votes > 0 && <span>{votes}</span>}
                </button>
                <span className="text-xs text-slate-500 truncate max-w-[80px]">
                  {photo.uploader_name || ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
