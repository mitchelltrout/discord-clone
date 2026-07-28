'use client';
import { useState } from 'react';
import Modal from '../ui/Modal';
import api from '../../lib/api';
import { useServerStore } from '../../lib/stores/serverStore';

export default function CreateChannelModal({ serverId, defaultType = 'text', onClose }) {
  const addChannel = useServerStore((s) => s.addChannel);
  const [name, setName] = useState('');
  const [type, setType] = useState(defaultType);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post(`/servers/${serverId}/channels`, { name: name.trim(), type });
      addChannel(serverId, data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create channel');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Create Channel">
      <form onSubmit={handleCreate} className="flex flex-col gap-4">
        {error && <p className="text-discord-red text-sm">{error}</p>}

        <div className="flex gap-2">
          {['text', 'voice', 'canvas'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 py-2 rounded font-semibold capitalize transition-colors
                ${type === t ? 'bg-discord-blurple text-white' : 'bg-discord-darker text-discord-muted hover:text-white'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-discord-muted uppercase tracking-wide">
            Channel Name
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
            placeholder={type === 'text' ? 'new-channel' : type === 'voice' ? 'New Voice' : 'New Canvas'}
            className="bg-discord-darker rounded p-2.5 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-discord-muted hover:text-white transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="px-4 py-2 bg-discord-blurple hover:bg-blue-500 text-white rounded font-semibold transition-colors disabled:opacity-60"
          >
            {loading ? 'Creating...' : 'Create Channel'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
