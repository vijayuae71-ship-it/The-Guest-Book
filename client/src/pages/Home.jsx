import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  BookOpen,
  Users,
  ChevronRight,
  Calendar,
  Sparkles,
  Image as ImageIcon,
  Trash2,
  Heart,
  Camera,
  Film,
} from 'lucide-react';
import Button from '../components/ui/Button';
import { APP_NAME } from '../utils/constants';

const RECENT_EVENTS_KEY = 'pd-events';

function getRecentEvents() {
  try {
    const raw = localStorage.getItem(RECENT_EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function removeRecentEvent(code) {
  const events = getRecentEvents().filter((e) => e.code !== code);
  localStorage.setItem(RECENT_EVENTS_KEY, JSON.stringify(events));
  return events;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function Home() {
  const navigate = useNavigate();
  const [recentEvents, setRecentEvents] = useState([]);

  useEffect(() => {
    setRecentEvents(getRecentEvents());
  }, []);

  const handleRemoveEvent = (e, code) => {
    e.preventDefault();
    e.stopPropagation();
    setRecentEvents(removeRecentEvent(code));
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Warm ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] animate-mesh-slow">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-600/15 rounded-full blur-[128px]" />
          <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-rose-600/12 rounded-full blur-[128px]" />
          <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-indigo-600/15 rounded-full blur-[128px]" />
          <div className="absolute top-2/3 right-1/3 w-64 h-64 bg-purple-500/10 rounded-full blur-[128px]" />
        </div>
      </div>

      {/* Hero section */}
      <main className="flex-1 relative z-10 flex flex-col items-center justify-center px-6 pt-20 pb-10">
        {/* Logo */}
        <div className="mb-6 relative">
          <div className="w-22 h-22 flex items-center justify-center">
            <img
              src="/logo.svg"
              alt={APP_NAME}
              className="w-20 h-20 rounded-2xl shadow-2xl shadow-indigo-500/30"
            />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight mb-3 text-center">
          <span className="bg-gradient-to-r from-amber-300 via-rose-400 to-purple-400 bg-clip-text text-transparent">
            {APP_NAME}
          </span>
        </h1>

        {/* Tagline */}
        <p className="text-slate-300 text-lg sm:text-xl text-center max-w-sm mb-2 leading-relaxed font-medium italic">
          Every moment. Every guest. One book.
        </p>

        {/* Subtitle */}
        <p className="text-slate-500 text-sm text-center max-w-xs mb-10">
          Capture, share, and relive your event memories together
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
          <Button
            size="lg"
            icon={BookOpen}
            fullWidth
            onClick={() => navigate('/create')}
            className="shadow-xl shadow-indigo-500/25"
          >
            Create a Book
          </Button>
          <Button
            variant="secondary"
            size="lg"
            icon={Users}
            fullWidth
            onClick={() => navigate('/join')}
          >
            Join Event
          </Button>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mt-8">
          {[
            { label: 'Real-time Sync', icon: Sparkles },
            { label: 'AI Faces', icon: Users },
            { label: 'Auto Reels', icon: Film },
            { label: 'Stories', icon: Heart },
          ].map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800/60 text-slate-400 border border-slate-700/50"
            >
              <Icon size={12} className="text-slate-500" />
              {label}
            </span>
          ))}
        </div>
      </main>

      {/* Recent Events */}
      <section className="relative z-10 px-6 pb-8">
        <div className="max-w-lg mx-auto">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Your Books
          </h2>

          {recentEvents.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen size={32} className="mx-auto text-slate-700 mb-2" />
              <p className="text-sm text-slate-600">Your guest books will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentEvents.map((event) => (
                <Link
                  key={event.code}
                  to={`/event/${event.code}`}
                  className="group flex items-center gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/60 hover:bg-slate-800/60 hover:border-slate-700/60 transition-all duration-200"
                >
                  {/* Event icon */}
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600/20 to-rose-600/20 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <BookOpen size={18} className="text-amber-400" />
                  </div>

                  {/* Event info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {event.name || 'Untitled Event'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {event.date && (
                        <>
                          <Calendar size={11} />
                          <span>{formatDate(event.date)}</span>
                          <span className="text-slate-700">|</span>
                        </>
                      )}
                      <span className="uppercase tracking-wide font-mono">
                        {event.code}
                      </span>
                      {event.role && (
                        <>
                          <span className="text-slate-700">|</span>
                          <span
                            className={
                              event.role === 'host'
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }
                          >
                            {event.role}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={(e) => handleRemoveEvent(e, event.code)}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-700 text-slate-500 hover:text-red-400 transition-all"
                    title="Remove from recents"
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight
                    size={16}
                    className="text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0"
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 text-center py-6 px-6 border-t border-slate-900">
        <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
          {APP_NAME} — Every guest leaves a memory. AI-powered face grouping,
          auto-generated reels, and collaborative stories.
        </p>
      </footer>

      {/* Animations */}
      <style>{`
        @keyframes mesh-slow {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(-2%, 1%) rotate(1deg); }
          50% { transform: translate(1%, -1%) rotate(-0.5deg); }
          75% { transform: translate(-1%, 2%) rotate(0.5deg); }
        }
        .animate-mesh-slow {
          animation: mesh-slow 30s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
