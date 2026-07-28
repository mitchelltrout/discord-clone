'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import api, { getMediaUrl } from '../../../lib/api';
import { useAuthStore } from '../../../lib/stores/authStore';
import { useServerStore } from '../../../lib/stores/serverStore';

export default function InvitePage() {
  const { code } = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { addServer, setServerData } = useServerStore();

  const [server, setServer] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    api.get(`/invites/${code}`)
      .then(({ data }) => setServer(data))
      .catch(() => setNotFound(true));
  }, [code]);

  async function handleJoin() {
    setJoining(true);
    setError('');
    try {
      const { data } = await api.post('/servers/join', { invite_code: code });
      addServer(data);
      setServerData(data.id, data.channels, data.members);
      router.push(`/channels/${data.id}`);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to join';
      // Already a member — just navigate there
      if (err.response?.status === 409) {
        const existing = useServerStore.getState().servers.find((s) => s.name === server?.name);
        if (existing) { router.push(`/channels/${existing.id}`); return; }
      }
      setError(msg);
      setJoining(false);
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-discord-darker">
        <div className="bg-discord-sidebar rounded-lg p-8 w-full max-w-sm text-center shadow-xl">
          <p className="text-4xl mb-4">🔗</p>
          <h1 className="text-white font-bold text-xl mb-2">Invite Invalid</h1>
          <p className="text-discord-muted text-sm mb-6">This invite link is invalid or has expired.</p>
          <Link href="/channels/me" className="text-discord-blurple hover:underline text-sm">
            Go to home
          </Link>
        </div>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-discord-darker">
        <div className="text-discord-muted text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-discord-darker">
      <div className="bg-discord-sidebar rounded-lg p-8 w-full max-w-sm text-center shadow-xl flex flex-col items-center gap-4">
        {/* Server icon */}
        {server.icon_url ? (
          <img
            src={getMediaUrl(server.icon_url)}
            alt={server.name}
            className="w-20 h-20 rounded-full object-cover"
          />
        ) : (
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold"
            style={{ background: '#5865f2' }}
          >
            {server.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div>
          <p className="text-discord-muted text-xs uppercase font-semibold tracking-wide mb-1">
            You've been invited to join
          </p>
          <h1 className="text-white font-bold text-2xl">{server.name}</h1>
          <p className="text-discord-muted text-sm mt-1">{server.memberCount} member{server.memberCount !== 1 ? 's' : ''}</p>
        </div>

        {error && <p className="text-discord-red text-sm">{error}</p>}

        {user ? (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full bg-discord-blurple hover:bg-blue-500 text-white font-semibold rounded py-2.5 transition-colors disabled:opacity-60"
          >
            {joining ? 'Joining...' : `Accept Invite`}
          </button>
        ) : (
          <div className="flex flex-col gap-2 w-full">
            <Link
              href={`/register?invite=${code}`}
              className="w-full block text-center bg-discord-blurple hover:bg-blue-500 text-white font-semibold rounded py-2.5 transition-colors"
            >
              Create an Account
            </Link>
            <Link
              href={`/login?invite=${code}`}
              className="w-full block text-center bg-discord-input hover:bg-discord-darker text-white font-semibold rounded py-2.5 transition-colors text-sm"
            >
              Already have an account? Log in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
