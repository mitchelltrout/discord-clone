'use client';
import { useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useServerStore } from '../../lib/stores/serverStore';
import { useUnreadStore } from '../../lib/stores/unreadStore';
import { getMediaUrl } from '../../lib/api';
import CreateServerModal from '../server/CreateServerModal';
import JoinServerModal from '../server/JoinServerModal';
import Avatar from '../ui/Avatar';

export default function ServerSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const servers = useServerStore((s) => s.servers);
  const serverChannels = useServerStore((s) => s.channels);
  const reorderServers = useServerStore((s) => s.reorderServers);
  const unreadChannels = useUnreadStore((s) => s.channels);
  const unreadDMs = useUnreadStore((s) => s.dms);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [dragOver, setDragOver] = useState(null);
  const dragIndex = useRef(null);

  const isDMActive = pathname.startsWith('/channels/me');

  function handleDragStart(e, index) {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(index);
  }

  function handleDrop(e, index) {
    e.preventDefault();
    if (dragIndex.current !== null && dragIndex.current !== index) {
      reorderServers(dragIndex.current, index);
    }
    dragIndex.current = null;
    setDragOver(null);
  }

  function handleDragEnd() {
    dragIndex.current = null;
    setDragOver(null);
  }

  return (
    <div className="w-[72px] bg-discord-darker flex flex-col items-center py-3 gap-2 overflow-y-auto shrink-0">
      {/* DM / Home button */}
      <div className="relative">
        <button
          onClick={() => router.push('/channels/me')}
          className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold transition-all
            ${isDMActive ? 'bg-discord-blurple rounded-2xl' : 'bg-discord-sidebar hover:bg-discord-blurple hover:rounded-2xl'}`}
          title="Direct Messages"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
        </button>
        {unreadDMs.size > 0 && !isDMActive && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-discord-red rounded-full border-2 border-discord-darker" />
        )}
      </div>

      <div className="w-8 h-px bg-discord-muted/40 my-1" />

      {/* Server list */}
      {servers.map((server, index) => {
        const isActive = pathname.startsWith(`/channels/${server.id}`);
        const isOver = dragOver === index;
        return (
          <div
            key={server.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`relative transition-transform ${isOver ? 'scale-110' : ''}`}
          >
            {isOver && (
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-discord-blurple rounded-full" />
            )}
            <button
              onClick={() => router.push(`/channels/${server.id}`)}
              title={server.name}
              className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-white font-bold transition-all shrink-0
                ${isActive ? 'rounded-2xl ring-2 ring-discord-blurple' : 'hover:rounded-2xl'}`}
              style={{ background: server.icon_url ? undefined : '#5865f2' }}
            >
              {server.icon_url ? (
                <img src={getMediaUrl(server.icon_url)} alt={server.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm">{server.name.charAt(0).toUpperCase()}</span>
              )}
            </button>
            {!isActive && (serverChannels[server.id] || []).some((ch) => unreadChannels.has(String(ch.id))) && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-discord-red rounded-full border-2 border-discord-darker" />
            )}
          </div>
        );
      })}

      {/* Create server button */}
      <button
        onClick={() => setShowCreate(true)}
        className="w-12 h-12 rounded-full bg-discord-sidebar hover:bg-discord-green hover:rounded-2xl flex items-center justify-center text-discord-green hover:text-white transition-all mt-1"
        title="Create a Server"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11.1111H12.8889V4H11.1111V11.1111H4V12.8889H11.1111V20H12.8889V12.8889H20V11.1111Z" />
        </svg>
      </button>

      {/* Join server button */}
      <button
        onClick={() => setShowJoin(true)}
        className="w-12 h-12 rounded-full bg-discord-sidebar hover:bg-discord-blurple hover:rounded-2xl flex items-center justify-center text-discord-blurple hover:text-white transition-all"
        title="Join a Server"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
        </svg>
      </button>

      {showCreate && <CreateServerModal onClose={() => setShowCreate(false)} />}
      {showJoin && <JoinServerModal onClose={() => setShowJoin(false)} />}
    </div>
  );
}
