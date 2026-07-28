'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../lib/api';

export default function GifPicker({ onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  // Load trending on mount
  useEffect(() => {
    inputRef.current?.focus();
    fetchGifs('');
  }, []);

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchGifs(query), 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  async function fetchGifs(q) {
    setLoading(true);
    setError('');
    try {
      const endpoint = q.trim() ? `/giphy/search?q=${encodeURIComponent(q.trim())}` : '/giphy/trending';
      const { data } = await api.get(endpoint);
      setGifs(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load GIFs');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-discord-sidebar border border-discord-darker rounded-lg shadow-2xl w-80 flex flex-col overflow-hidden" style={{ maxHeight: '400px' }}>
      {/* Header */}
      <div className="p-2 border-b border-discord-darker/50 shrink-0">
        <div className="flex items-center gap-2 bg-discord-darker rounded-md px-3 py-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-discord-muted shrink-0">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search GIFs..."
            className="bg-transparent text-discord-text placeholder-discord-muted text-sm flex-1 focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-discord-muted hover:text-white transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Label */}
      <p className="text-discord-muted text-[10px] font-semibold uppercase tracking-wide px-3 pt-2 shrink-0">
        {query.trim() ? `Results for "${query.trim()}"` : 'Trending'}
      </p>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading && (
          <div className="flex items-center justify-center h-24 text-discord-muted text-sm">Loading...</div>
        )}
        {!loading && error && (
          <div className="flex items-center justify-center h-24 text-discord-muted text-sm">{error}</div>
        )}
        {!loading && !error && gifs.length === 0 && (
          <div className="flex items-center justify-center h-24 text-discord-muted text-sm">No GIFs found</div>
        )}
        {!loading && !error && gifs.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => { onSelect(gif.url); onClose(); }}
                className="relative rounded overflow-hidden bg-discord-darker aspect-video hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-discord-blurple"
                title={gif.title}
              >
                <img
                  src={gif.preview}
                  alt={gif.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Powered by Giphy */}
      <div className="px-3 py-1.5 border-t border-discord-darker/50 shrink-0 flex justify-end">
        <span className="text-discord-muted text-[10px]">Powered by GIPHY</span>
      </div>
    </div>
  );
}
