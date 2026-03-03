import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, ScanLine, Keyboard, Lock } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { useUser } from '../context/UserContext';
import { joinEvent, getEvent } from '../utils/api';

const RECENT_EVENTS_KEY = 'pd-events';
const CODE_LENGTH = 6;

function saveRecentEvent(event) {
  try {
    const raw = localStorage.getItem(RECENT_EVENTS_KEY);
    const events = raw ? JSON.parse(raw) : [];
    const filtered = events.filter((e) => e.code !== event.code);
    filtered.unshift(event);
    localStorage.setItem(RECENT_EVENTS_KEY, JSON.stringify(filtered.slice(0, 20)));
  } catch {
    // ignore
  }
}

export default function JoinEvent() {
  const navigate = useNavigate();
  const { code: urlCode } = useParams();
  const { userId, userName, setUserName } = useUser();

  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''));
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showNameModal, setShowNameModal] = useState(false);
  const [tempName, setTempName] = useState('');
  const [codeToJoin, setCodeToJoin] = useState('');

  const inputRefs = useRef([]);
  const hasAutoSubmitted = useRef(false);

  useEffect(() => {
    if (urlCode && urlCode.length === CODE_LENGTH && !hasAutoSubmitted.current) {
      hasAutoSubmitted.current = true;
      const chars = urlCode.toUpperCase().split('');
      setDigits(chars);
      setTimeout(() => attemptJoin(urlCode.toUpperCase()), 300);
    }
  }, [urlCode]);

  const getFullCode = () => {
    if (showManual) return manualCode.toUpperCase().trim();
    return digits.join('').toUpperCase();
  };

  const handleDigitChange = (index, value) => {
    if (value.length > 1) {
      const pasted = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
      const newDigits = Array(CODE_LENGTH).fill('');
      for (let i = 0; i < pasted.length; i++) {
        newDigits[i] = pasted[i];
      }
      setDigits(newDigits);
      setError('');
      if (pasted.length === CODE_LENGTH) {
        inputRefs.current[CODE_LENGTH - 1]?.blur();
        setTimeout(() => attemptJoin(pasted), 200);
      } else {
        inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
      }
      return;
    }

    const char = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value && !char) return;

    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);
    setError('');

    if (char && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    const full = newDigits.join('');
    if (full.length === CODE_LENGTH) {
      setTimeout(() => attemptJoin(full), 200);
    }
  };

  const handleDigitKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const attemptJoin = async (code) => {
    if (!code || code.length !== CODE_LENGTH) {
      setError('Enter a 6-character event code');
      return;
    }
    if (!userName) {
      setCodeToJoin(code);
      setTempName('');
      setShowNameModal(true);
      return;
    }
    await doJoin(code);
  };

  const handleNameConfirm = async () => {
    if (!tempName.trim()) return;
    setUserName(tempName.trim());
    setShowNameModal(false);
    setTimeout(() => doJoin(codeToJoin, tempName.trim()), 50);
  };

  const doJoin = async (code, overrideName) => {
    setLoading(true);
    setError('');
    try {
      const eventRes = await getEvent(code);
      const eventInfo = eventRes.event || eventRes;
      if (eventInfo.hasPassword && !needsPassword && !password) {
        setNeedsPassword(true);
        setCodeToJoin(code);
        setLoading(false);
        return;
      }
      const result = await joinEvent(code, {
        userName: overrideName || userName,
        userId,
        password: password || undefined,
      });
      saveRecentEvent({
        code,
        name: eventInfo.name || result.name || 'Event',
        date: eventInfo.eventDate || new Date().toISOString(),
        role: 'participant',
      });
      navigate(`/event/${code}`);
    } catch (err) {
      if (err.message?.toLowerCase().includes('password')) {
        setNeedsPassword(true);
        setCodeToJoin(code);
        setError('Incorrect password');
      } else {
        setError(err.message || 'Failed to join event');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (needsPassword && codeToJoin) {
      doJoin(codeToJoin);
    } else {
      attemptJoin(getFullCode());
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-0 w-[300px] h-[300px] bg-indigo-600/10 rounded-full blur-[100px]" />
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
          <h1 className="text-xl font-bold text-white">Join Event</h1>
        </div>

        {/* QR scan placeholder */}
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-2 border-dashed border-slate-700 flex items-center justify-center">
            <ScanLine size={40} className="text-slate-600" />
          </div>
        </div>

        {!needsPassword ? (
          <>
            <p className="text-center text-slate-400 mb-6">
              Enter the 6-character event code
            </p>

            {/* OTP-style digit inputs */}
            {!showManual && (
              <form onSubmit={handleSubmit}>
                <div className="flex justify-center gap-2 sm:gap-3 mb-4">
                  {digits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => (inputRefs.current[i] = el)}
                      type="text"
                      inputMode="text"
                      maxLength={CODE_LENGTH}
                      value={digit}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(i, e)}
                      onFocus={(e) => e.target.select()}
                      className={`
                        w-11 h-14 sm:w-12 sm:h-14 text-center text-xl font-bold uppercase
                        bg-slate-900/80 border rounded-xl
                        focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500
                        transition-all duration-200
                        ${digit ? 'border-indigo-500/50 text-white' : 'border-slate-700/80 text-slate-400'}
                        ${error ? 'border-red-500/50 shake' : ''}
                      `}
                      autoFocus={i === 0 && !urlCode}
                    />
                  ))}
                </div>
              </form>
            )}

            {/* Toggle manual entry */}
            <div className="text-center mb-6">
              <button
                type="button"
                onClick={() => setShowManual(!showManual)}
                className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-400 transition-colors"
              >
                <Keyboard size={14} />
                {showManual ? 'Use code boxes' : 'Type code instead'}
              </button>
            </div>

            {/* Manual text input */}
            {showManual && (
              <form onSubmit={handleSubmit} className="space-y-4 pd-animate-in">
                <Input
                  placeholder="Enter event code"
                  value={manualCode}
                  onChange={(e) => {
                    setManualCode(e.target.value.toUpperCase());
                    setError('');
                  }}
                  maxLength={CODE_LENGTH}
                  className="text-center text-xl font-mono tracking-[0.3em] uppercase"
                  autoFocus
                />
                <Button type="submit" fullWidth size="lg" loading={loading}>
                  Join
                </Button>
              </form>
            )}

            {/* Join button for OTP mode */}
            {!showManual && (
              <Button
                onClick={handleSubmit}
                fullWidth
                size="lg"
                loading={loading}
                disabled={digits.join('').length !== CODE_LENGTH}
              >
                Join Event
              </Button>
            )}
          </>
        ) : (
          /* Password entry */
          <form onSubmit={handleSubmit} className="pd-animate-in">
            <div className="rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-slate-800/60 p-6 space-y-4">
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Lock size={22} className="text-amber-400" />
                </div>
              </div>
              <p className="text-center text-slate-300 font-medium">
                This event requires a password
              </p>
              <p className="text-center text-sm text-slate-500">
                Code: <span className="font-mono text-slate-400">{codeToJoin}</span>
              </p>
              <Input
                type="password"
                label="Event Password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                icon={Lock}
                autoFocus
              />
              <Button type="submit" fullWidth size="lg" loading={loading}>
                Join
              </Button>
            </div>
          </form>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-400 text-center pd-animate-in">
            {error}
          </p>
        )}
      </div>

      {/* Name prompt modal */}
      <Modal
        open={showNameModal}
        onClose={() => setShowNameModal(false)}
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
        @keyframes pd-slide-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pd-animate-in { animation: pd-slide-in 0.25s ease-out; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
        .shake { animation: shake 0.4s ease-out; }
      `}</style>
    </div>
  );
}
