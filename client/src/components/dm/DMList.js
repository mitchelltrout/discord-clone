'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../../lib/stores/authStore';
import { useUnreadStore } from '../../lib/stores/unreadStore';
import { getSocket } from '../../lib/socket';
import api from '../../lib/api';
import Avatar from '../ui/Avatar';
import NewDMModal from './NewDMModal';
import UserPanel from '../layout/UserPanel';

export default function DMList() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const unreadDMs = useUnreadStore((s) => s.dms);
  const [conversations, setConversations] = useState([]);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    api.get('/dm').then(({ data }) => setConversations(data)).catch(console.error);
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNotification = ({ conversationId }) => {
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === conversationId);
        if (existing) {
          return [existing, ...prev.filter((c) => c.id !== conversationId)];
        }
        api.get('/dm').then(({ data }) => setConversations(data));
        return prev;
      });
    };

    const onStatus = ({ userId, status }) => {
      setConversations((prev) =>
        prev.map((c) => c.partner_id === userId ? { ...c, partner_status: status } : c)
      );
    };

    socket.on('dm:notification', onNotification);
    socket.on('status:update', onStatus);
    return () => {
      socket.off('dm:notification', onNotification);
      socket.off('status:update', onStatus);
    };
  }, []);

  function handleOpenDM(convoId) {
    router.push(`/channels/me/${convoId}`);
  }

  return (
    <div className="w-60 bg-discord-sidebar flex flex-col shrink-0">
      <div className="p-4 border-b border-discord-darker/50 flex items-center justify-between">
        <p className="text-white font-semibold text-sm">Direct Messages</p>
        <button
          onClick={() => setShowNew(true)}
          className="text-discord-muted hover:text-white transition-colors"
          title="New DM"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11.1111H12.8889V4H11.1111V11.1111H4V12.8889H11.1111V20H12.8889V12.8889H20V11.1111Z" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
        {conversations.map((convo) => {
          const isActive = pathname === `/channels/me/${convo.id}`;
          return (
            <button
              key={convo.id}
              onClick={() => handleOpenDM(convo.id)}
              className={`w-full flex items-center gap-3 px-2 py-1.5 rounded transition-colors
                ${isActive
                  ? 'bg-discord-input text-white'
                  : unreadDMs.has(String(convo.id))
                    ? 'text-white hover:bg-discord-input/50'
                    : 'text-discord-muted hover:bg-discord-input/50 hover:text-discord-text'}`}
            >
              <div className="relative shrink-0">
                <Avatar username={convo.partner_username} size={32} />
                <StatusDot status={convo.partner_status} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className={`text-sm truncate ${unreadDMs.has(String(convo.id)) && !isActive ? 'font-semibold' : 'font-medium'}`}>
                  {convo.partner_username}
                </p>
              </div>
              {unreadDMs.has(String(convo.id)) && !isActive && (
                <span className="shrink-0 w-2 h-2 rounded-full bg-white" />
              )}
            </button>
          );
        })}

        {conversations.length === 0 && (
          <p className="text-discord-muted text-xs px-2 py-2">No conversations yet.</p>
        )}
      </div>

      {showNew && (
        <NewDMModal
          onClose={() => setShowNew(false)}
          onOpen={(convoId) => {
            setShowNew(false);
            router.push(`/channels/me/${convoId}`);
            api.get('/dm').then(({ data }) => setConversations(data));
          }}
        />
      )}

      <UserPanel />
    </div>
  );
}

const STATUS_COLOR = {
  online:  'bg-discord-green',
  idle:    'bg-yellow-400',
  dnd:     'bg-discord-red',
  offline: 'bg-gray-500',
};

function StatusDot({ status }) {
  return (
    <span
      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-discord-sidebar ${STATUS_COLOR[status] || STATUS_COLOR.offline}`}
    />
  );
}
