'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '../ui/Modal';
import api from '../../lib/api';
import { useServerStore } from '../../lib/stores/serverStore';

export default function JoinServerModal({ onClose }) {
  const router = useRouter();
  const { addServer, setServerData } = useServerStore();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleJoin(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/servers/join', { invite_code: code.trim() });
      addServer(data);
      setServerData(data.id, data.channels, data.members);
      onClose();
      router.push(`/channels/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Join a Server">
      <p className="text-discord-muted text-sm mb-4">Enter an invite code to join an existing server.</p>
      <form onSubmit={handleJoin} className="flex flex-col gap-4">
        {error && <p className="text-discord-red text-sm">{error}</p>}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-discord-muted uppercase tracking-wide">
            Invite Code
          </label>
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. abc12345"
            className="bg-discord-darker rounded p-2.5 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-discord-muted hover:text-white transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="px-4 py-2 bg-discord-blurple hover:bg-blue-500 text-white rounded font-semibold transition-colors disabled:opacity-60"
          >
            {loading ? 'Joining...' : 'Join Server'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
