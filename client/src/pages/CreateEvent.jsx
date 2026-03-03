import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  PartyPopper,
  CalendarDays,
  Lock,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { useUser } from '../context/UserContext';
import { createEvent } from '../utils/api';
import EventTemplatesPicker from '../components/event/EventTemplatesPicker';

const RECENT_EVENTS_KEY = 'pd-events';

function saveRecentEvent(event) {
  try {
    const raw = localStorage.getItem(RECENT_EVENTS_KEY);
    const events = raw ? JSON.parse(raw) : [];
    events.unshift(event);
    localStorage.setItem(RECENT_EVENTS_KEY, JSON.stringify(events.slice(0, 20)));
  } catch {
    // ignore
  }
}

export default function CreateEvent() {
  const navigate = useNavigate();
  const { userId, userName, setUserName } = useUser();

  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Name prompt modal
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempName, setTempName] = useState('');
  const [pendingSubmit, setPendingSubmit] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Event name is required');
      return;
    }

    if (!userName) {
      setTempName('');
      setShowNameModal(true);
      setPendingSubmit(true);
      return;
    }

    await doCreate();
  };

  const handleNameConfirm = async () => {
    if (!tempName.trim()) return;
    setUserName(tempName.trim());
    setShowNameModal(false);
    // Small delay so context updates
    setTimeout(() => doCreate(tempName.trim()), 50);
  };

  const doCreate = async (overrideName) => {
    setLoading(true);
    try {
      const data = {
        name: name.trim(),
        hostName: overrideName || userName,
        hostId: userId,
      };
      if (eventDate) data.eventDate = eventDate;
      if (hasPassword && password) data.password = password;
      if (selectedTemplate) {
        data.templateId = selectedTemplate.id;
        data.accentColor = selectedTemplate.accent_color;
        data.fontFamily = selectedTemplate.font_family;
        data.coverLayout = selectedTemplate.cover_layout;
      }

      const result = await createEvent(data);
      const evt = result.event || result;

      saveRecentEvent({
        code: evt.code,
        name: name.trim(),
        date: eventDate || new Date().toISOString(),
        role: 'host',
      });

      navigate(`/event/${evt.code}`);
    } catch (err) {
      setError(err.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            to="/"
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-white">Create Event</h1>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit}>
          <div className="rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-slate-800/60 p-6 space-y-5">
            {/* Decorative icon */}
            <div className="flex justify-center mb-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center">
                <PartyPopper size={26} className="text-indigo-400" />
              </div>
            </div>

            {/* Event name */}
            <Input
              label="Event Name"
              placeholder="Birthday party, Wedding, Meetup..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              icon={PartyPopper}
              error={error && !name.trim() ? 'Required' : ''}
              autoFocus
            />

            {/* Event date */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Event Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                  <CalendarDays size={18} />
                </div>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200 [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Password toggle */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Lock size={14} className="text-slate-500" />
                  Password Protection
                </label>
                <button
                  type="button"
                  onClick={() => setHasPassword(!hasPassword)}
                  className={`
                    relative w-11 h-6 rounded-full transition-colors duration-200
                    ${hasPassword ? 'bg-indigo-600' : 'bg-slate-700'}
                  `}
                >
                  <span
                    className={`
                      absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200
                      ${hasPassword ? 'translate-x-5.5 left-0.5' : 'left-0.5'}
                    `}
                    style={{
                      transform: hasPassword ? 'translateX(22px)' : 'translateX(0)',
                      left: '2px',
                    }}
                  />
                </button>
              </div>

              {hasPassword && (
                <div className="relative animate-fade-in">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter event password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    icon={Lock}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              )}
            </div>

            {/* Template picker */}
            <EventTemplatesPicker
              selectedTemplate={selectedTemplate}
              onSelect={setSelectedTemplate}
            />
          </div>

          {/* Error message */}
          {error && name.trim() && (
            <p className="mt-3 text-sm text-red-400 text-center">{error}</p>
          )}

          {/* Submit button */}
          <div className="mt-6">
            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={loading}
              className="shadow-xl shadow-indigo-500/20"
            >
              {loading ? 'Creating...' : 'Create Event'}
            </Button>
          </div>
        </form>
      </div>

      {/* Name prompt modal */}
      <Modal
        open={showNameModal}
        onClose={() => {
          setShowNameModal(false);
          setPendingSubmit(false);
        }}
        title="What's your name?"
      >
        <p className="text-sm text-slate-400 mb-4">
          Enter your name so others know who you are.
        </p>
        <Input
          placeholder="Your name"
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleNameConfirm()}
          autoFocus
        />
        <div className="mt-4">
          <Button fullWidth onClick={handleNameConfirm} disabled={!tempName.trim()}>
            Continue
          </Button>
        </div>
      </Modal>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.25s ease-out; }
      `}</style>
    </div>
  );
}
