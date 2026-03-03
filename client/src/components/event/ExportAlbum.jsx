import React, { useState } from 'react';
import { Download, Share2, Link, Copy, Check, ExternalLink, Archive } from 'lucide-react';

export default function ExportAlbum({ eventId, eventName, photoCount, isOpen, onClose }) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadAll = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/photos/${eventId}/download-all`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(eventName || 'event').replace(/[^a-zA-Z0-9]/g, '_')}_photos.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
    setDownloading(false);
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${eventName} Photos`,
          text: `Check out the photos from ${eventName}!`,
          url: window.location.href,
        });
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Share failed:', err);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-slate-900 w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-700 p-5"
        onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-1">
          <Archive className="w-5 h-5 text-indigo-400" />
          Export Photos
        </h2>
        <p className="text-sm text-slate-400 mb-5">{photoCount} photos from {eventName}</p>

        <div className="space-y-3">
          {/* Download all as ZIP */}
          <button
            onClick={handleDownloadAll}
            disabled={downloading}
            className="w-full flex items-center gap-3 p-4 bg-slate-800 rounded-xl border border-slate-700 hover:bg-slate-750 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <Download className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-white">
                {downloading ? 'Preparing download...' : 'Download as ZIP'}
              </p>
              <p className="text-xs text-slate-400">All photos in original quality</p>
            </div>
          </button>

          {/* Copy link */}
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center gap-3 p-4 bg-slate-800 rounded-xl border border-slate-700 hover:bg-slate-750 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-purple-400" />}
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-white">{copied ? 'Copied!' : 'Copy Event Link'}</p>
              <p className="text-xs text-slate-400">Share with others to view photos</p>
            </div>
          </button>

          {/* Share (Web Share API) */}
          {typeof navigator !== 'undefined' && navigator.share && (
            <button
              onClick={handleShare}
              className="w-full flex items-center gap-3 p-4 bg-slate-800 rounded-xl border border-slate-700 hover:bg-slate-750 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Share2 className="w-5 h-5 text-green-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-white">Share via...</p>
                <p className="text-xs text-slate-400">Send to Google Photos, iCloud, WhatsApp, etc.</p>
              </div>
            </button>
          )}

          {/* Google Photos tip */}
          <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <p className="text-xs text-slate-400">
              <span className="font-medium text-slate-300">Tip:</span> Download the ZIP, then upload to Google Photos
              or iCloud Photos for permanent backup. You can also use the share option to send directly to your
              preferred cloud storage app.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}
