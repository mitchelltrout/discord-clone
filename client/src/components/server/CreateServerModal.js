'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '../ui/Modal';
import api from '../../lib/api';
import { useServerStore } from '../../lib/stores/serverStore';

export default function CreateServerModal({ onClose }) {
  const router = useRouter();
  const { addServer, setServerData } = useServerStore();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/servers', { name: name.trim() });
      addServer(data);
      // Fetch full server data
      const full = await api.get(`/servers/${data.id}`);
      setServerData(data.id, full.data.channels, full.data.members);
      onClose();
      router.push(`/channels/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Create a Server">
      <form onSubmit={handleCreate} className="flex flex-col gap-4">
        {error && <p className="text-discord-red text-sm">{error}</p>}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-discord-muted uppercase tracking-wide">
            Server Name
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My awesome server"
            className="bg-discord-darker rounded p-2.5 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-discord-muted hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="px-4 py-2 bg-discord-blurple hover:bg-blue-500 text-white rounded font-semibold transition-colors disabled:opacity-60"
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
