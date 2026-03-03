import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageCircle, X, Reply, Trash2, SmilePlus } from 'lucide-react';

const QUICK_EMOJIS = ['\ud83d\udc4d', '\u2764\ufe0f', '\ud83d\ude02', '\ud83c\udf89', '\ud83d\udcf8', '\ud83d\udd25', '\u2728', '\ud83e\udd73'];

export default function GuestChat({
  eventId, eventCode, userId, userName, hostId, socket, isOpen, onClose
}) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load messages
  useEffect(() => {
    if (!isOpen || !eventId) return;
    setLoading(true);
    fetch(`/api/chat/${eventId}`)
      .then(r => r.json())
      .then(data => {
        setMessages(data.messages || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [eventId, isOpen]);

  // Listen for real-time messages
  useEffect(() => {
    if (!socket || !isOpen) return;

    const handleMessage = (msg) => {
      setMessages(prev => [...prev, msg]);
    };
    const handleDelete = ({ messageId }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    };

    socket.on('chat-message', handleMessage);
    socket.on('chat-message-deleted', handleDelete);
    return () => {
      socket.off('chat-message', handleMessage);
      socket.off('chat-message-deleted', handleDelete);
    };
  }, [socket, isOpen]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    try {
      const res = await fetch(`/api/chat/${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userName,
          text: trimmed,
          replyTo: replyTo?.id || null,
        }),
      });
      const data = await res.json();
      if (data.message) {
        setMessages(prev => [...prev, data.message]);
      }
      setText('');
      setReplyTo(null);
      setShowEmojis(false);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  }, [eventId, userId, userName, text, replyTo]);

  const handleDelete = async (messageId) => {
    try {
      await fetch(`/api/chat/${messageId}`, {
        method: 'DELETE',
        headers: { 'x-host-id': hostId || '', 'x-user-id': userId },
      });
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-white">Event Chat</h2>
          <span className="text-xs text-slate-500">{messages.length} messages</span>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <MessageCircle className="w-10 h-10 mb-2 opacity-50" />
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === userId;
            const replyMsg = msg.reply_to ? messages.find(m => m.id === msg.reply_to) : null;

            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Reply preview */}
                  {replyMsg && (
                    <div className="text-xs text-slate-500 mb-1 pl-3 border-l-2 border-slate-600 truncate">
                      {replyMsg.user_name}: {replyMsg.text}
                    </div>
                  )}

                  <div className={`rounded-2xl px-3.5 py-2 ${
                    isMe
                      ? 'bg-indigo-500 text-white rounded-br-md'
                      : 'bg-slate-800 text-slate-200 rounded-bl-md'
                  }`}>
                    {!isMe && (
                      <p className="text-xs font-medium text-indigo-400 mb-0.5">{msg.user_name || 'Anonymous'}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5 px-1">
                    <span className="text-[10px] text-slate-600">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      onClick={() => setReplyTo(msg)}
                      className="text-slate-600 hover:text-slate-400"
                    >
                      <Reply className="w-3 h-3" />
                    </button>
                    {(isMe || hostId === userId) && (
                      <button
                        onClick={() => handleDelete(msg.id)}
                        className="text-slate-600 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview bar */}
      {replyTo && (
        <div className="px-4 py-2 bg-slate-800 border-t border-slate-700 flex items-center gap-2">
          <Reply className="w-4 h-4 text-indigo-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-indigo-400 font-medium">{replyTo.user_name}</p>
            <p className="text-xs text-slate-400 truncate">{replyTo.text}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-slate-500 hover:text-slate-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick emojis */}
      {showEmojis && (
        <div className="px-4 py-2 bg-slate-800 border-t border-slate-700 flex gap-2 overflow-x-auto">
          {QUICK_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => { setText(prev => prev + emoji); setShowEmojis(false); inputRef.current?.focus(); }}
              className="text-xl hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="px-4 py-3 border-t border-slate-700 flex items-center gap-2">
        <button
          onClick={() => setShowEmojis(!showEmojis)}
          className="p-2 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        >
          <SmilePlus className="w-5 h-5" />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 bg-slate-800 text-white rounded-full px-4 py-2.5 text-sm border border-slate-700 focus:border-indigo-500 focus:outline-none placeholder-slate-500"
        />
        <button
          onClick={sendMessage}
          disabled={!text.trim()}
          className="p-2.5 rounded-full bg-indigo-500 text-white disabled:opacity-40 hover:bg-indigo-400 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
