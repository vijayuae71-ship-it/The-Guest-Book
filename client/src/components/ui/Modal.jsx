import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, className = '' }) {
  const handleEsc = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose?.();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [open, handleEsc]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={`
          relative w-full max-w-md
          bg-slate-800 rounded-2xl
          shadow-2xl shadow-black/50
          animate-scale-in
          max-h-[85vh] overflow-y-auto
          ${className}
        `}
      >
        {/* Header */}
        {(title || onClose) && (
          <div className="flex items-center justify-between px-6 pt-6 pb-2">
            {title && (
              <h3 className="text-lg font-semibold text-white">{title}</h3>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors ml-auto"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}
        {/* Body */}
        <div className="px-6 pb-6">{children}</div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-scale-in { animation: scale-in 0.2s ease-out; }
      `}</style>
    </div>
  );
}
