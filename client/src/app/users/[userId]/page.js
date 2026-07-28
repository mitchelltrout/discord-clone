'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, fromUnixTime } from 'date-fns';
import api from '../../../lib/api';
import { useAuthStore } from '../../../lib/stores/authStore';
import Avatar from '../../../components/ui/Avatar';

const STATUS_COLOR = {
  online: 'bg-discord-green',
  idle: 'bg-yellow-400',
  dnd: 'bg-discord-red',
  offline: 'bg-gray-500',
};

const STATUS_LABEL = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
};

export default function ProfilePage() {
  const { userId } = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) { router.replace('/login'); return; }
    api.get(`/users/${userId}/profile`)
      .then(({ data }) => setProfile(data))
      .catch(() => router.push('/channels/me'))
      .finally(() => setLoading(false));
  }, [userId, currentUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-discord-dark flex items-center justify-center text-discord-muted">
        Loading...
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-discord-dark flex flex-col">
      {/* Top nav */}
      <div className="bg-discord-sidebar border-b border-discord-darker/50 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-discord-muted hover:text-white transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>
        <span className="text-white font-semibold">{profile.username}'s Profile</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-8 px-4">
        <div className="max-w-xl mx-auto">
          {/* Banner */}
          <div
            className="h-36 rounded-t-lg w-full"
            style={{ backgroundColor: profile.banner_color || '#5865F2' }}
          />

          {/* Profile card */}
          <div className="bg-discord-sidebar rounded-b-lg px-6 pb-6">
            {/* Avatar row */}
            <div className="flex items-end justify-between -mt-12 mb-4">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-[5px] border-discord-sidebar overflow-hidden">
                  <Avatar username={profile.username} avatarUrl={profile.avatar_url} size={96} />
                </div>
                <span
                  className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-discord-sidebar ${STATUS_COLOR[profile.status] || STATUS_COLOR.offline}`}
                  title={STATUS_LABEL[profile.status] || 'Offline'}
                />
              </div>
              <span
                className={`mb-1 text-xs font-semibold px-2.5 py-1 rounded-full text-white ${STATUS_COLOR[profile.status] || STATUS_COLOR.offline}`}
              >
                {STATUS_LABEL[profile.status] || 'Offline'}
              </span>
            </div>

            {/* Name */}
            <div className="mb-4">
              <h1 className="text-white font-bold text-2xl leading-tight">{profile.username}</h1>
              {profile.pronouns && (
                <p className="text-discord-muted text-sm mt-0.5">{profile.pronouns}</p>
              )}
              {profile.status_message && (
                <p className="text-discord-muted text-sm italic mt-1">{profile.status_message}</p>
              )}
            </div>

            {/* Bio */}
            {profile.bio && (
              <div className="bg-discord-darker rounded-lg p-4 mb-4">
                <p className="text-xs font-semibold text-discord-muted uppercase tracking-wide mb-2">About Me</p>
                <p className="text-discord-text text-sm whitespace-pre-wrap">{profile.bio}</p>
              </div>
            )}

            {/* Details */}
            <div className="bg-discord-darker rounded-lg p-4 flex flex-col gap-2">
              <p className="text-xs font-semibold text-discord-muted uppercase tracking-wide mb-1">Details</p>
              {profile.location && (
                <div className="flex items-center gap-2 text-discord-text text-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-discord-muted shrink-0">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                  {profile.location}
                </div>
              )}
              <div className="flex items-center gap-2 text-discord-text text-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-discord-muted shrink-0">
                  <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" />
                </svg>
                Member since {format(fromUnixTime(profile.created_at), 'MMMM d, yyyy')}
              </div>
            </div>

            {/* Send DM button — hidden on own profile */}
            {currentUser && currentUser.id !== profile.id && (
              <button
                onClick={async () => {
                  try {
                    const { data } = await api.post('/dm', { userId: profile.id });
                    router.push(`/channels/me/${data.id}`);
                  } catch {}
                }}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-discord-blurple hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
                Send Message
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
