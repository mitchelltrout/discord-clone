'use client';
import { useState, useEffect } from 'react';
import api from '../../lib/api';

// Module-level cache so previews persist across re-renders
const previewCache = new Map();

export default function LinkPreview({ url }) {
  const [preview, setPreview] = useState(previewCache.get(url) ?? null);
  const [failed, setFailed] = useState(previewCache.get(url) === null);

  useEffect(() => {
    if (previewCache.has(url)) return; // already fetched (hit or miss)
    let cancelled = false;
    api.get(`/link-preview?url=${encodeURIComponent(url)}`)
      .then(({ data }) => {
        if (cancelled) return;
        // Only show if there's something meaningful
        if (data.title || data.description || data.image) {
          previewCache.set(url, data);
          setPreview(data);
        } else {
          previewCache.set(url, null);
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          previewCache.set(url, null);
          setFailed(true);
        }
      });
    return () => { cancelled = true; };
  }, [url]);

  if (failed || !preview) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex flex-col max-w-md border-l-4 border-discord-blurple bg-discord-darker rounded-r overflow-hidden hover:bg-discord-input/50 transition-colors"
    >
      {preview.image && (
        <img
          src={preview.image}
          alt=""
          className="w-full object-cover max-h-52"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <div className="p-3">
        {preview.siteName && (
          <p className="text-discord-muted text-xs mb-0.5">{preview.siteName}</p>
        )}
        {preview.title && (
          <p className="text-discord-blurple text-sm font-semibold leading-snug line-clamp-2">{preview.title}</p>
        )}
        {preview.description && (
          <p className="text-discord-muted text-xs mt-1 line-clamp-3 leading-snug">{preview.description}</p>
        )}
      </div>
    </a>
  );
}
