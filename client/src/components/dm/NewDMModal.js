'use client';
import { useState } from 'react';
import Modal from '../ui/Modal';
import api from '../../lib/api';
import Avatar from '../ui/Avatar';

export default function NewDMModal({ onClose, onOpen }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e) {
    const q = e.target.value;
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
      setResults(data);
    } catch {}
    setLoading(false);
  }

  async function handleSelect(userId) {
    try {
      const { data } = await api.post('/dm', { userId });
      onOpen(data.id);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <Modal onClose={onClose} title="New Message">
      <div className="flex flex-col gap-3">
        <input
          autoFocus
          value={query}
          onChange={handleSearch}
          placeholder="Find or start a conversation"
          className="bg-discord-darker rounded p-2.5 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none w-full"
        />

        <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
          {loading && <p className="text-discord-muted text-sm px-2">Searching...</p>}
          {results.map((u) => (
            <button
              key={u.id}
              onClick={() => handleSelect(u.id)}
              className="flex items-center gap-3 px-2 py-2 rounded hover:bg-discord-input transition-colors text-left"
            >
              <Avatar username={u.username} size={32} />
              <span className="text-discord-text text-sm font-medium">{u.username}</span>
            </button>
          ))}
          {!loading && query && results.length === 0 && (
            <p className="text-discord-muted text-sm px-2">No users found</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
