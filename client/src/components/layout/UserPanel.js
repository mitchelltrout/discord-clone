'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../lib/stores/authStore';
import { useIdleStatus } from '../../lib/useIdleStatus';
import api from '../../lib/api';
import Avatar from '../ui/Avatar';
import UserSettingsModal from '../settings/UserSettingsModal';

const STATUS_OPTIONS = [
  { value: 'online',  label: 'Online',          color: 'bg-discord-green' },
  { value: 'idle',    label: 'Away',             color: 'bg-yellow-400' },
  { value: 'dnd',     label: 'Do Not Disturb',   color: 'bg-discord-red' },
  { value: 'offline', label: 'Offline',          color: 'bg-gray-500' },
];

function statusColor(status) {
  switch (status) {
    case 'online':  return 'bg-discord-green';
    case 'idle':    return 'bg-yellow-400';
    case 'dnd':     return 'bg-discord-red';
    default:        return 'bg-gray-500';
  }
}

function statusLabel(status) {
  switch (status) {
    case 'online':  return 'Online';
    case 'idle':    return 'Away';
    case 'dnd':     return 'Do Not Disturb';
    default:        return 'Offline';
  }
}

export default function UserPanel() {
  const router = useRouter();
  const { user, logout, refreshToken } = useAuthStore();
  const { setManualStatus } = useIdleStatus();
  const [showSettings, setShowSettings] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  // Sync input with user's current status_message when menu opens
  useEffect(() => {
    if (showStatusMenu) {
      setMessageInput(user?.status_message || '');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showStatusMenu]);

  useEffect(() => {
    if (!showStatusMenu) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowStatusMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showStatusMenu]);

  function handleMessageSave() {
    const trimmed = messageInput.trim();
    setManualStatus(user.status, trimmed);
  }

  async function handleLogout() {
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch {}
    logout();
    router.push('/login');
  }

  if (!user) return null;

  const hasMessage = !!user.status_message;

  return (
    <>
      <div className="h-14 bg-discord-darker px-2 flex items-center gap-2 shrink-0">
        {/* Avatar + status dot — click to open status menu */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setShowStatusMenu((v) => !v)}
            className="relative block"
            title="Set status"
          >
            <Avatar username={user.username} avatarUrl={user.avatar_url} size={32} />
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-discord-darker ${statusColor(user.status)}`}
            />
          </button>

          {showStatusMenu && (
            <div className="absolute bottom-full left-0 mb-2 bg-discord-sidebar border border-discord-darker/70 rounded-lg shadow-xl py-2 w-56 z-50">
              {/* Custom status message input */}
              <div className="px-3 pb-2 border-b border-discord-darker/60 mb-1">
                <div className="flex items-center gap-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value.slice(0, 128))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { handleMessageSave(); setShowStatusMenu(false); }
                      if (e.key === 'Escape') setShowStatusMenu(false);
                    }}
                    onBlur={handleMessageSave}
                    placeholder="Set a custom message…"
                    className="flex-1 min-w-0 bg-discord-input text-discord-text text-xs rounded px-2 py-1.5 outline-none placeholder-discord-muted/60 focus:ring-1 focus:ring-discord-blurple/50"
                  />
                  {messageInput && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault(); // prevent input blur before click
                        setMessageInput('');
                        setManualStatus(user.status, '');
                      }}
                      className="shrink-0 text-discord-muted hover:text-discord-red transition-colors p-0.5"
                      title="Clear status message"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Status options */}
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setManualStatus(opt.value, messageInput.trim()); setShowStatusMenu(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors
                    ${user.status === opt.value
                      ? 'text-white bg-discord-input/50'
                      : 'text-discord-muted hover:text-white hover:bg-discord-input/30'}`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${opt.color}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{user.username}</p>
          <p className="text-discord-muted text-xs truncate">
            {hasMessage ? user.status_message : statusLabel(user.status)}
          </p>
        </div>

        {!!user.is_admin && (
          <button
            onClick={() => router.push('/admin')}
            className="text-discord-muted hover:text-white transition-colors p-1 rounded"
            title="Admin Panel"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l5 2.18V11c0 3.5-2.33 6.79-5 7.93-2.67-1.14-5-4.43-5-7.93V7.18L12 5z"/>
            </svg>
          </button>
        )}
        <button
          onClick={() => router.push('/help')}
          className="text-discord-muted hover:text-white transition-colors p-1 rounded"
          title="Help"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
          </svg>
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="text-discord-muted hover:text-white transition-colors p-1 rounded"
          title="User Settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
          </svg>
        </button>
        <button
          onClick={handleLogout}
          className="text-discord-muted hover:text-discord-red transition-colors p-1 rounded"
          title="Log out"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 13v-2H7V8l-5 4 5 4v-3z" />
            <path d="M20 3h-9c-1.103 0-2 .897-2 2v4h2V5h9v14h-9v-4H9v4c0 1.103.897 2 2 2h9c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2z" />
          </svg>
        </button>
      </div>
      {showSettings && <UserSettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
