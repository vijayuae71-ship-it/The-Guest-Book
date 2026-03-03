import React, { useState, useCallback } from 'react';
import { Palette, Check, X, Type, Layout } from 'lucide-react';

const ACCENT_COLORS = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Gold', value: '#d4a574' },
  { name: 'Coral', value: '#ff6b6b' },
];

const FONTS = [
  { name: 'Inter', value: 'Inter' },
  { name: 'Playfair Display', value: 'Playfair Display' },
  { name: 'Poppins', value: 'Poppins' },
  { name: 'Montserrat', value: 'Montserrat' },
  { name: 'Quicksand', value: 'Quicksand' },
  { name: 'Raleway', value: 'Raleway' },
  { name: 'Nunito', value: 'Nunito' },
];

const LAYOUTS = [
  { name: 'Classic', value: 'classic', desc: 'Clean and minimal' },
  { name: 'Elegant', value: 'elegant', desc: 'Sophisticated feel' },
  { name: 'Festive', value: 'festive', desc: 'Fun and colorful' },
  { name: 'Minimal', value: 'minimal', desc: 'Less is more' },
  { name: 'Bold', value: 'bold', desc: 'Strong and vibrant' },
];

export default function EventThemeCustomizer({ event, hostId, onThemeUpdate, onClose }) {
  const [accentColor, setAccentColor] = useState(event?.accent_color || '#6366f1');
  const [fontFamily, setFontFamily] = useState(event?.font_family || 'Inter');
  const [coverLayout, setCoverLayout] = useState(event?.cover_layout || 'classic');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${event.id}/theme`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-host-id': hostId },
        body: JSON.stringify({ accentColor, fontFamily, coverLayout }),
      });
      const data = await res.json();
      if (data.event) {
        onThemeUpdate?.(data.event);
      }
      onClose?.();
    } catch (err) {
      console.error('Failed to save theme:', err);
    } finally {
      setSaving(false);
    }
  }, [event, hostId, accentColor, fontFamily, coverLayout, onThemeUpdate, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 w-full max-w-md max-h-[85vh] rounded-t-2xl sm:rounded-2xl border border-slate-700 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Customize Theme</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Preview */}
          <div
            className="rounded-xl p-4 border border-slate-700"
            style={{ fontFamily }}
          >
            <div className="h-1.5 rounded-full mb-3" style={{ backgroundColor: accentColor }} />
            <p className="text-lg font-bold text-white">{event?.name || 'Event Preview'}</p>
            <p className="text-sm mt-1" style={{ color: accentColor }}>Theme Preview</p>
          </div>

          {/* Accent Color */}
          <div>
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4" /> Accent Color
            </label>
            <div className="grid grid-cols-5 gap-2">
              {ACCENT_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setAccentColor(c.value)}
                  className={`w-full aspect-square rounded-xl flex items-center justify-center transition-all ${
                    accentColor === c.value ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                >
                  {accentColor === c.value && <Check className="w-4 h-4 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Font */}
          <div>
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2 mb-3">
              <Type className="w-4 h-4" /> Font Style
            </label>
            <div className="space-y-1.5">
              {FONTS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFontFamily(f.value)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                    fontFamily === f.value
                      ? 'bg-indigo-500/20 border border-indigo-500/50 text-white'
                      : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-750'
                  }`}
                  style={{ fontFamily: f.value }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          {/* Layout */}
          <div>
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2 mb-3">
              <Layout className="w-4 h-4" /> Cover Layout
            </label>
            <div className="grid grid-cols-2 gap-2">
              {LAYOUTS.map(l => (
                <button
                  key={l.value}
                  onClick={() => setCoverLayout(l.value)}
                  className={`text-left px-3 py-2.5 rounded-lg transition-colors ${
                    coverLayout === l.value
                      ? 'bg-indigo-500/20 border border-indigo-500/50'
                      : 'bg-slate-800 border border-slate-700 hover:bg-slate-750'
                  }`}
                >
                  <p className="text-sm font-medium text-white">{l.name}</p>
                  <p className="text-xs text-slate-400">{l.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 flex gap-3 sticky bottom-0 bg-slate-900">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-400 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Apply Theme'}
          </button>
        </div>
      </div>
    </div>
  );
}
