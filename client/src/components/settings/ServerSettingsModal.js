'use client';
import { useState, useRef } from 'react';
import api, { getMediaUrl } from '../../lib/api';
import { useServerStore } from '../../lib/stores/serverStore';
import { getSocket } from '../../lib/socket';

export default function ServerSettingsModal({ serverId, onClose }) {
  const { servers, updateServer } = useServerStore();
  const server = servers.find((s) => s.id === serverId);

  const [serverName, setServerName] = useState(server?.name || '');
  const [iconPreview, setIconPreview] = useState(getMediaUrl(server?.icon_url) || null);
  const [iconFile, setIconFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fakeSteveEnabled, setFakeSteveEnabled] = useState(!!server?.fakesteve_enabled);
  const fileInputRef = useRef(null);
  const isOwner = server?.owner_id != null;

  function handleFilePick(e) {
    const file = e.target.files[0];
    if (!file) return;
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
    setSuccess('');
    setError('');
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const nameChanged = serverName.trim() && serverName.trim() !== server?.name;

      // Upload icon if a new file was picked
      if (iconFile) {
        const fd = new FormData();
        fd.append('icon', iconFile);
        const { data } = await api.post(`/servers/${serverId}/icon`, fd);
        updateServer(serverId, { icon_url: data.icon_url });
        setIconFile(null);
      }

      // Rename if changed
      if (nameChanged) {
        const name = serverName.trim();
        await api.patch(`/servers/${serverId}`, { name });
        updateServer(serverId, { name });
        getSocket()?.emit('server:renamed', { serverId, name });
      }

      setSuccess('Server updated!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setLoading(false);
    }
  }

  async function toggleFakeSteve() {
    const next = !fakeSteveEnabled;
    setFakeSteveEnabled(next);
    try {
      await api.patch(`/servers/${serverId}/fakesteve`, { enabled: next });
      updateServer(serverId, { fakesteve_enabled: next ? 1 : 0 });
    } catch {
      setFakeSteveEnabled(!next); // revert on error
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-discord-sidebar rounded-lg shadow-2xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-discord-darker/50">
          <h2 className="text-white font-bold text-lg">Server Settings</h2>
          <button onClick={onClose} className="text-discord-muted hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-5 flex flex-col gap-5">
          {/* Icon picker */}
          <div>
            <p className="text-discord-muted text-xs font-semibold uppercase tracking-wide mb-3">Server Icon</p>
            <div className="flex flex-col items-center gap-2">
              <div
                className="relative cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                {iconPreview ? (
                  <img src={iconPreview} alt="server icon" className="w-20 h-20 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                    style={{ background: '#5865f2' }}
                  >
                    {server?.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                  </svg>
                </div>
              </div>
              <p className="text-discord-muted text-xs">Click to change icon</p>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFilePick} />
            </div>
          </div>

          {/* Server name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-discord-muted uppercase tracking-wide">Server Name</label>
            <input
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              className="bg-discord-darker rounded p-2.5 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none"
            />
          </div>

          {/* FakeSteve toggle (owner only) */}
          {isOwner && (
            <div className="border-t border-discord-darker/50 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-discord-text text-sm font-semibold">Steve 2.0</p>
                  <p className="text-discord-muted text-xs mt-0.5">
                    Enable the Steve 2.0 bot. He will occasionally chime in on conversations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleFakeSteve}
                  className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${fakeSteveEnabled ? 'bg-discord-green' : 'bg-discord-input'}`}
                  title={fakeSteveEnabled ? 'Disable Steve 2.0' : 'Enable Steve 2.0'}
                >
                  <span className={`absolute left-0.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow transition-transform ${fakeSteveEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-discord-red text-sm">{error}</p>}
          {success && <p className="text-discord-green text-sm">{success}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-discord-blurple hover:bg-blue-500 text-white font-semibold rounded py-2 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded text-discord-muted hover:text-white transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
