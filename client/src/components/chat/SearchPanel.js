'use client';
import { useState, useEffect, useRef } from 'react';
import { format, fromUnixTime } from 'date-fns';
import api from '../../lib/api';
import Avatar from '../ui/Avatar';

function highlight(text, query) {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-yellow-400/40 text-yellow-200 rounded-sm">{part}</mark>
      : part
  );
}

export default function SearchPanel({ channelId, isDM, onClose, onJumpToMessage }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const endpoint = isDM
          ? `/dm/${channelId}/search?q=${encodeURIComponent(query)}`
          : `/channels/${channelId}/search?q=${encodeURIComponent(query)}`;
        const { data } = await api.get(endpoint);
        setResults(data);
      } catch {}
      setLoading(false);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query, channelId, isDM]);

  return (
    <div className="w-72 bg-discord-sidebar border-l border-discord-darker/50 flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-discord-darker/50 flex items-center justify-between gap-2">
        <span className="text-white font-semibold text-sm">Search</span>
        <button onClick={onClose} className="text-discord-muted hover:text-white transition-colors text-lg leading-none">✕</button>
      </div>

      <div className="px-3 pt-3">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-discord-muted" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages..."
            className="w-full bg-discord-darker rounded pl-8 pr-3 py-1.5 text-sm text-discord-text placeholder-discord-muted focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 mt-2">
        {loading && (
          <p className="text-discord-muted text-xs text-center mt-4">Searching...</p>
        )}
        {!loading && query.trim() && results.length === 0 && (
          <p className="text-discord-muted text-xs text-center mt-4">No results found.</p>
        )}
        {!loading && results.map((msg) => (
          <button
            key={msg.id}
            onClick={() => onJumpToMessage(msg.id)}
            className="bg-discord-darker rounded-lg p-3 text-left w-full hover:bg-discord-input transition-colors"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Avatar username={msg.username} avatarUrl={msg.avatar_url} size={18} />
              <span className="text-white text-xs font-semibold">{msg.username}</span>
              <span className="text-discord-muted text-xs ml-auto shrink-0">
                {format(fromUnixTime(msg.created_at), 'MMM d, yyyy')}
              </span>
            </div>
            <p className="text-discord-text text-xs break-words line-clamp-4">
              {highlight(msg.content, query)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
