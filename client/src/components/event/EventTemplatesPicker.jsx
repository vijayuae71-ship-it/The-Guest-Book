import React, { useState, useEffect } from 'react';
import { Sparkles, Check } from 'lucide-react';

export default function EventTemplatesPicker({ selectedTemplate, onSelect }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then(d => { setTemplates(d.templates || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-slate-400">
        <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <span className="text-sm">Loading templates...</span>
      </div>
    );
  }

  return (
    <div>
      <label className="text-sm font-medium text-slate-300 flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-indigo-400" />
        Event Template (optional)
      </label>
      <div className="grid grid-cols-2 gap-2">
        {/* No template option */}
        <button
          onClick={() => onSelect(null)}
          className={`text-left p-3 rounded-xl border transition-colors ${
            !selectedTemplate
              ? 'border-indigo-500 bg-indigo-500/10'
              : 'border-slate-700 bg-slate-800 hover:bg-slate-750'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-lg">🎨</span>
            {!selectedTemplate && <Check className="w-4 h-4 text-indigo-400" />}
          </div>
          <p className="text-sm font-medium text-white mt-1">Custom</p>
          <p className="text-xs text-slate-400">Start from scratch</p>
        </button>

        {templates.map(t => {
          const isSelected = selectedTemplate?.id === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className={`text-left p-3 rounded-xl border transition-colors ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-slate-700 bg-slate-800 hover:bg-slate-750'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-lg">{t.icon || '📷'}</span>
                {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
              </div>
              <p className="text-sm font-medium text-white mt-1">{t.name}</p>
              <p className="text-xs text-slate-400">{t.description}</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-4 h-4 rounded-full border border-slate-600" style={{ backgroundColor: t.accent_color }} />
                <span className="text-[10px] text-slate-500">{t.font_family}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
