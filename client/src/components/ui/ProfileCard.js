'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { format, fromUnixTime } from 'date-fns';
import api from '../../lib/api';
import { useAuthStore } from '../../lib/stores/authStore';
import Avatar from './Avatar';

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

// Wrap any child with this to show a profile card on hover
export function ProfileHover({ userId, children }) {
  const [show, setShow] = useState(false);
  const [profile, setProfile] = useState(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const anchorRef = useRef(null);
  const timerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const profileRef = useRef(null);

  const open = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    timerRef.current = setTimeout(() => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({ x: rect.right + 10, y: rect.top });
      setShow(true);
      if (!profileRef.current) {
        api.get(`/users/${userId}/profile`)
          .then(({ data }) => { profileRef.current = data; setProfile(data); })
          .catch(() => {});
      }
    }, 350);
  }, [userId]);

  const close = useCallback(() => {
    clearTimeout(timerRef.current);
    hideTimerRef.current = setTimeout(() => setShow(false), 120);
  }, []);

  useEffect(() => () => { clearTimeout(timerRef.current); clearTimeout(hideTimerRef.current); }, []);

  return (
    <span ref={anchorRef} onMouseEnter={open} onMouseLeave={close} className="inline">
      {children}
      {show && profile && typeof document !== 'undefined' && createPortal(
        <ProfileCardPopup profile={profile} pos={pos} onMouseEnter={() => clearTimeout(hideTimerRef.current)} onMouseLeave={close} />,
        document.body
      )}
    </span>
  );
}

function ProfileCardPopup({ profile, pos, onMouseEnter, onMouseLeave }) {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const isSelf = currentUser?.id === profile.id;
  const cardWidth = 288;
  const cardHeight = 260;
  const x = Math.min(pos.x, window.innerWidth - cardWidth - 16);
  const y = Math.min(pos.y, window.innerHeight - cardHeight - 16);

  async function handleSendMessage() {
    try {
      const { data } = await api.post('/dm', { userId: profile.id });
      router.push(`/channels/me/${data.id}`);
    } catch {}
  }

  return (
    <div
      className="fixed z-[300] rounded-lg overflow-hidden shadow-2xl bg-discord-sidebar border border-discord-darker/80"
      style={{ left: x, top: y, width: cardWidth }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Banner */}
      <div className="h-16 w-full" style={{ backgroundColor: profile.banner_color || '#5865F2' }} />

      {/* Body */}
      <div className="px-4 pb-4">
        {/* Avatar */}
        <div className="-mt-8 mb-2">
          <div className="relative inline-block">
            <div className="w-16 h-16 rounded-full border-4 border-discord-sidebar overflow-hidden">
              <Avatar username={profile.username} avatarUrl={profile.avatar_url} size={64} />
            </div>
            <span
              className={`absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-2 border-discord-sidebar ${STATUS_COLOR[profile.status] || STATUS_COLOR.offline}`}
              title={STATUS_LABEL[profile.status] || 'Offline'}
            />
          </div>
        </div>

        {/* Name + pronouns */}
        <div className="mb-1">
          <span className="text-white font-bold text-base">{profile.username}</span>
          {profile.pronouns && (
            <span className="text-discord-muted text-xs ml-2">{profile.pronouns}</span>
          )}
        </div>

        {/* Custom status message */}
        {profile.status_message && (
          <p className="text-discord-muted text-xs italic mb-1 truncate">{profile.status_message}</p>
        )}

        {/* Bio */}
        {profile.bio && (
          <p className="text-discord-text text-xs mb-2 line-clamp-2">{profile.bio}</p>
        )}

        <div className="border-t border-discord-darker/50 my-2" />

        {/* Location + joined */}
        <div className="flex flex-col gap-0.5 mb-3">
          {profile.location && (
            <p className="text-discord-muted text-xs flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              {profile.location}
            </p>
          )}
          <p className="text-discord-muted text-xs">
            Member since {format(fromUnixTime(profile.created_at), 'MMM d, yyyy')}
          </p>
        </div>

        <div className={`flex gap-2 ${isSelf ? '' : ''}`}>
          {!isSelf && (
            <button
              onClick={handleSendMessage}
              className="flex-1 bg-discord-blurple hover:bg-blue-500 text-white text-xs font-semibold py-1.5 rounded transition-colors"
            >
              Send Message
            </button>
          )}
          <button
            onClick={() => router.push(`/users/${profile.id}`)}
            className={`${isSelf ? 'w-full' : 'flex-1'} bg-discord-input hover:bg-discord-darker text-discord-text text-xs font-semibold py-1.5 rounded transition-colors`}
          >
            View Profile
          </button>
        </div>
      </div>
    </div>
  );
}
