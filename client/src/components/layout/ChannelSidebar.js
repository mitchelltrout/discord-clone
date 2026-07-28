'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { useServerStore } from '../../lib/stores/serverStore';
import { useAuthStore } from '../../lib/stores/authStore';
import { useVoiceStore } from '../../lib/stores/voiceStore';
import { useUnreadStore } from '../../lib/stores/unreadStore';
import { leaveVoice } from '../../lib/voiceConnection';
import { showMobileChat } from '../../lib/mobileNav';
import api from '../../lib/api';
import { getSocket } from '../../lib/socket';
import Avatar from '../ui/Avatar';
import UserPanel from './UserPanel';
import CreateChannelModal from '../channel/CreateChannelModal';
import ServerSettingsModal from '../settings/ServerSettingsModal';

export default function ChannelSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { activeServerId, channels, members, setServerData, setActiveServer, updateServer, updateChannel, removeServer, removeChannel } = useServerStore();
  const user = useAuthStore((s) => s.user);
  const activeVoiceChannelId = useVoiceStore((s) => s.activeChannelId);
  const voiceParticipants = useVoiceStore((s) => s.voiceParticipants);
  const voiceStates = useVoiceStore((s) => s.voiceStates);
  const localVoiceState = useVoiceStore((s) => ({ isMuted: s.isMuted, isCamOn: s.isCamOn, isScreenSharing: s.isScreenSharing, isDeafened: s.isDeafened }));
  const unreadChannels = useUnreadStore((s) => s.channels);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [createChannelType, setCreateChannelType] = useState('text');
  const [inviteCode, setInviteCode] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState(null);
  const [channelNameDraft, setChannelNameDraft] = useState('');
  const [showServerSettings, setShowServerSettings] = useState(false);

  async function handleLeaveServer() {
    if (!urlServerId) return;
    if (!confirm('Are you sure you want to leave this server?')) return;
    try {
      await api.delete(`/servers/${urlServerId}/leave`);
      removeServer(urlServerId);
      router.push('/channels/me');
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.error || 'Failed to leave server');
    }
  }

  async function handleShowInvite() {
    if (!urlServerId) return;
    try {
      const { data } = await api.get(`/servers/${urlServerId}/invite`);
      setInviteCode(data.invite_code);
      setShowInvite(true);
      setCopied(false);
    } catch (e) {
      console.error(e);
    }
  }

  function getInviteUrl() {
    const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    return `${base}/invite/${inviteCode}`;
  }

  function handleCopy() {
    const url = getInviteUrl();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    } else {
      // Fallback for non-HTTPS contexts
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleResetInvite() {
    if (!urlServerId) return;
    if (!confirm('Reset the invite link? The old link will stop working immediately.')) return;
    try {
      const { data } = await api.post(`/servers/${urlServerId}/reset-invite`);
      setInviteCode(data.invite_code);
      setCopied(false);
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.error || 'Failed to reset invite link');
    }
  }

  async function handleChannelRename(e, channelId) {
    e.preventDefault();
    const name = channelNameDraft.trim();
    if (!name || !urlServerId) return;
    try {
      await api.patch(`/channels/${channelId}`, { name });
      updateChannel(urlServerId, channelId, { name });
      getSocket()?.emit('channel:renamed', { serverId: urlServerId, channelId, name });
    } catch (err) {
      console.error(err);
    }
    setEditingChannelId(null);
  }

  async function handleDeleteChannel(channelId) {
    if (!confirm('Delete this channel? This cannot be undone.')) return;
    try {
      await api.delete(`/channels/${channelId}`);
      removeChannel(urlServerId, channelId);
      if (activeChannelId === channelId) router.push(`/channels/${urlServerId}`);
    } catch (err) {
      console.error(err);
    }
  }

  // Determine active server from URL
  const urlMatch = pathname.match(/^\/channels\/(\d+)/);
  const urlServerId = urlMatch ? parseInt(urlMatch[1]) : null;

  useEffect(() => {
    if (urlServerId && urlServerId !== activeServerId) {
      setActiveServer(urlServerId);
      api.get(`/servers/${urlServerId}`).then(({ data }) => {
        setServerData(urlServerId, data.channels, data.members);
      }).catch(console.error);
    }
  }, [urlServerId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function onServerRenamed({ serverId, name }) {
      updateServer(serverId, { name });
    }
    function onChannelRenamed({ serverId, channelId, name }) {
      updateChannel(serverId, channelId, { name });
    }

    socket.on('server:renamed', onServerRenamed);
    socket.on('channel:renamed', onChannelRenamed);
    return () => {
      socket.off('server:renamed', onServerRenamed);
      socket.off('channel:renamed', onChannelRenamed);
    };
  }, []);

  const isDMView = pathname.startsWith('/channels/me');

  if (isDMView) return null;

  if (!urlServerId) return null;

  const serverChannels = channels[urlServerId] || [];
  const serverMembers = members[urlServerId] || [];
  const textChannels = serverChannels.filter((c) => c.type === 'text');
  const voiceChannels = serverChannels.filter((c) => c.type === 'voice');
  const canvasChannels = serverChannels.filter((c) => c.type === 'canvas');

  const currentServer = useServerStore.getState().servers.find((s) => s.id === urlServerId);
  const myRole = serverMembers.find((m) => m.id === user?.id)?.role;
  const canManage = myRole === 'owner' || myRole === 'admin';

  const activeChannelMatch = pathname.match(/^\/channels\/\d+\/(\d+)/);
  const activeChannelId = activeChannelMatch ? parseInt(activeChannelMatch[1]) : null;

  function handleSidebarLeaveVoice() {
    leaveVoice();
    const onVoiceChannel = voiceChannels.some((c) => c.id === activeChannelId);
    if (onVoiceChannel) {
      const firstText = textChannels[0];
      router.push(firstText ? `/channels/${urlServerId}/${firstText.id}` : `/channels/${urlServerId}`);
    }
  }

  function renderChannelRow(ch, icon) {
    return (
      <div key={ch.id} className="group relative flex items-center">
        {editingChannelId === ch.id ? (
          <form onSubmit={(e) => handleChannelRename(e, ch.id)} className="flex-1 flex gap-1 px-2 py-1 items-center">
            {icon}
            <input
              autoFocus
              value={channelNameDraft}
              onChange={(e) => setChannelNameDraft(e.target.value)}
              maxLength={32}
              onBlur={() => setEditingChannelId(null)}
              onKeyDown={(e) => e.key === 'Escape' && setEditingChannelId(null)}
              className="flex-1 min-w-0 bg-discord-darker text-white text-sm px-1 rounded outline-none border border-discord-blurple"
            />
          </form>
        ) : (
          <>
            <button
              onClick={() => { showMobileChat(); router.push(`/channels/${urlServerId}/${ch.id}`); }}
              className={`flex-1 flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors
                ${activeChannelId === ch.id
                  ? 'bg-discord-input text-white'
                  : 'text-discord-muted hover:bg-discord-input/50 hover:text-discord-text'}`}
            >
              {icon}
              <span className="truncate">{ch.name}</span>
            </button>
            {canManage && (
              <div className="absolute right-1 hidden group-hover:flex items-center gap-0.5">
                <button
                  onClick={() => { setChannelNameDraft(ch.name); setEditingChannelId(ch.id); }}
                  className="text-discord-muted hover:text-white p-0.5 rounded"
                  title="Rename Channel"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteChannel(ch.id)}
                  className="text-discord-muted hover:text-discord-red p-0.5 rounded"
                  title="Delete Channel"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="w-60 bg-discord-sidebar flex flex-col shrink-0">
      {/* Server header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-discord-darker/50 font-semibold text-white shadow">
        <span className="truncate flex-1">{currentServer?.name || 'Server'}</span>
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {myRole === 'owner' && (
            <button
              onClick={() => setShowServerSettings(true)}
              className="text-discord-muted hover:text-white"
              title="Server Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
              </svg>
            </button>
          )}
          {myRole !== 'owner' && (
            <button
              onClick={handleLeaveServer}
              className="text-discord-muted hover:text-discord-red transition-colors"
              title="Leave Server"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
              </svg>
            </button>
          )}
          <button
            onClick={handleShowInvite}
            className="text-discord-muted hover:text-white"
            title="Invite People"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0-6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 8c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm-6 4c.22-.72 3.31-2 6-2 2.7 0 5.8 1.29 6 2H9zM1 14h2v-2h2v2h2v2H5v2H3v-2H1v-2z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Text channels */}
        <div className="mb-4">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-xs font-semibold text-discord-muted uppercase tracking-wide">Text Channels</span>
            {canManage && (
              <button
                onClick={() => { setCreateChannelType('text'); setShowCreateChannel(true); }}
                className="text-discord-muted hover:text-white"
                title="Create Text Channel"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 11.1111H12.8889V4H11.1111V11.1111H4V12.8889H11.1111V20H12.8889V12.8889H20V11.1111Z" />
                </svg>
              </button>
            )}
          </div>
          {textChannels.map((ch) => (
            <div key={ch.id} className="group relative flex items-center">
              {editingChannelId === ch.id ? (
                <form onSubmit={(e) => handleChannelRename(e, ch.id)} className="flex-1 flex gap-1 px-2 py-1">
                  <span className="text-discord-muted">#</span>
                  <input
                    autoFocus
                    value={channelNameDraft}
                    onChange={(e) => setChannelNameDraft(e.target.value)}
                    maxLength={32}
                    onBlur={() => setEditingChannelId(null)}
                    onKeyDown={(e) => e.key === 'Escape' && setEditingChannelId(null)}
                    className="flex-1 min-w-0 bg-discord-darker text-white text-sm px-1 rounded outline-none border border-discord-blurple"
                  />
                </form>
              ) : (
                <>
                  <button
                    onClick={() => { showMobileChat(); router.push(`/channels/${urlServerId}/${ch.id}`); }}
                    className={`flex-1 flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors
                      ${activeChannelId === ch.id
                        ? 'bg-discord-input text-white'
                        : unreadChannels.has(String(ch.id))
                          ? 'text-white hover:bg-discord-input/50'
                          : 'text-discord-muted hover:bg-discord-input/50 hover:text-discord-text'}`}
                  >
                    <span className="text-discord-muted shrink-0">#</span>
                    <span className={`truncate ${unreadChannels.has(String(ch.id)) && activeChannelId !== ch.id ? 'font-semibold' : ''}`}>{ch.name}</span>
                    {unreadChannels.has(String(ch.id)) && activeChannelId !== ch.id && (
                      <span className="ml-auto shrink-0 w-2 h-2 rounded-full bg-white" />
                    )}
                  </button>
                  {canManage && (
                    <div className="absolute right-1 hidden group-hover:flex items-center gap-0.5">
                      <button
                        onClick={() => { setChannelNameDraft(ch.name); setEditingChannelId(ch.id); }}
                        className="text-discord-muted hover:text-white p-0.5 rounded"
                        title="Rename Channel"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteChannel(ch.id)}
                        className="text-discord-muted hover:text-discord-red p-0.5 rounded"
                        title="Delete Channel"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Canvas channels */}
        {canvasChannels.length > 0 || canManage ? (
          <div className="mb-4">
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-xs font-semibold text-discord-muted uppercase tracking-wide">Canvas Channels</span>
              {canManage && (
                <button
                  onClick={() => { setCreateChannelType('canvas'); setShowCreateChannel(true); }}
                  className="text-discord-muted hover:text-white"
                  title="Create Canvas Channel"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 11.1111H12.8889V4H11.1111V11.1111H4V12.8889H11.1111V20H12.8889V12.8889H20V11.1111Z" />
                  </svg>
                </button>
              )}
            </div>
            {canvasChannels.map((ch) => renderChannelRow(ch, (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                <path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37-1.34-1.34c-.39-.39-1.02-.39-1.41 0L9 12.25 11.75 15l8.96-8.96c.39-.39.39-1.02 0-1.41z"/>
              </svg>
            )))}
          </div>
        ) : null}

        {/* Voice channels */}
        <div className="mb-4">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-xs font-semibold text-discord-muted uppercase tracking-wide">Voice Channels</span>
            {canManage && (
              <button
                onClick={() => { setCreateChannelType('voice'); setShowCreateChannel(true); }}
                className="text-discord-muted hover:text-white"
                title="Create Voice Channel"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 11.1111H12.8889V4H11.1111V11.1111H4V12.8889H11.1111V20H12.8889V12.8889H20V11.1111Z" />
                </svg>
              </button>
            )}
          </div>
          {voiceChannels.map((ch) => (
            <div key={ch.id}>
              <div className="group relative flex items-center">
                {editingChannelId === ch.id ? (
                  <form onSubmit={(e) => handleChannelRename(e, ch.id)} className="flex-1 flex gap-1 px-2 py-1 items-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-discord-muted">
                      <path d="M12 2c-4.411 0-8 3.589-8 8v7c0 1.657 1.343 3 3 3h1v-8H6v-2c0-3.309 2.691-6 6-6s6 2.691 6 6v2h-2v8h1c1.657 0 3-1.343 3-3v-7c0-4.411-3.589-8-8-8z" />
                    </svg>
                    <input
                      autoFocus
                      value={channelNameDraft}
                      onChange={(e) => setChannelNameDraft(e.target.value)}
                      maxLength={32}
                      onBlur={() => setEditingChannelId(null)}
                      onKeyDown={(e) => e.key === 'Escape' && setEditingChannelId(null)}
                      className="flex-1 min-w-0 bg-discord-darker text-white text-sm px-1 rounded outline-none border border-discord-blurple"
                    />
                  </form>
                ) : (
                  <>
                    <button
                      onClick={() => { showMobileChat(); router.push(`/channels/${urlServerId}/${ch.id}`); }}
                      className={`flex-1 flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors
                        ${activeChannelId === ch.id
                          ? 'bg-discord-input text-white'
                          : 'text-discord-muted hover:bg-discord-input/50 hover:text-discord-text'}
                        ${activeVoiceChannelId === ch.id ? 'text-discord-green' : ''}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                        <path d="M12 2c-4.411 0-8 3.589-8 8v7c0 1.657 1.343 3 3 3h1v-8H6v-2c0-3.309 2.691-6 6-6s6 2.691 6 6v2h-2v8h1c1.657 0 3-1.343 3-3v-7c0-4.411-3.589-8-8-8z" />
                      </svg>
                      <span className="truncate">{ch.name}</span>
                      {activeVoiceChannelId === ch.id && (
                        <span className="ml-auto shrink-0 text-xs text-discord-green">●</span>
                      )}
                    </button>
                    {canManage && (
                      <div className="absolute right-1 hidden group-hover:flex items-center gap-0.5">
                        <button
                          onClick={() => { setChannelNameDraft(ch.name); setEditingChannelId(ch.id); }}
                          className="text-discord-muted hover:text-white p-0.5 rounded"
                          title="Rename Channel"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteChannel(ch.id)}
                          className="text-discord-muted hover:text-discord-red p-0.5 rounded"
                          title="Delete Channel"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
              {/* Voice participants list */}
              {(voiceParticipants[ch.id] || []).map((participant) => {
                const isLocal = participant.id === user?.id;
                const state = isLocal ? localVoiceState : (voiceStates[participant.id] || {});
                return (
                  <div key={participant.id} className="flex items-center gap-1.5 pl-7 pr-2 py-0.5">
                    <div className="relative shrink-0">
                      <Avatar username={participant.username} avatarUrl={participant.avatar_url} size={18} />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-discord-green rounded-full border border-discord-sidebar" />
                    </div>
                    <span className="text-xs text-discord-muted truncate flex-1">{participant.username}</span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {state.isMuted && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-discord-red" title="Muted">
                          <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                        </svg>
                      )}
                      {state.isCamOn && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-discord-green" title="Camera on">
                          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                        </svg>
                      )}
                      {state.isScreenSharing && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-discord-blurple" title="Screen sharing">
                          <path d="M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h6l-2 3v1h8v-1l-2-3h6c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H4V5h16v11z"/>
                        </svg>
                      )}
                      {state.isDeafened && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-discord-red" title="Deafened">
                          <path d="M12 3a9 9 0 0 0-9 9v5a3 3 0 0 0 3 3h1a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H5v-2a7 7 0 0 1 7-7 7 7 0 0 1 6.93 6H17a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1a3 3 0 0 0 3-3v-5a9 9 0 0 0-9-9z" />
                          <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

      </div>

      {/* Persistent voice status bar */}
      {activeVoiceChannelId && (() => {
        const vcName = serverChannels.find((c) => c.id === activeVoiceChannelId)?.name;
        return (
          <div className="bg-discord-darker/60 px-3 py-2 border-t border-discord-darker/50">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-discord-green text-xs font-semibold leading-tight">Voice Connected</p>
                <p className="text-discord-muted text-xs truncate">{vcName || 'Voice Channel'}</p>
              </div>
              <button
                onClick={handleSidebarLeaveVoice}
                className="shrink-0 w-7 h-7 rounded flex items-center justify-center text-discord-muted hover:bg-discord-red hover:text-white transition-colors"
                title="Disconnect from voice"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08C.11 12.9 0 12.65 0 12.37c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.66c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                </svg>
              </button>
            </div>
          </div>
        );
      })()}

      <UserPanel />

      {showCreateChannel && (
        <CreateChannelModal
          serverId={urlServerId}
          defaultType={createChannelType}
          onClose={() => setShowCreateChannel(false)}
        />
      )}

      {showServerSettings && (
        <ServerSettingsModal serverId={urlServerId} onClose={() => setShowServerSettings(false)} />
      )}

      {showInvite && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowInvite(false)}>
          <div className="bg-discord-sidebar rounded-lg p-6 w-96 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-white font-semibold text-lg mb-1">Invite People</h2>
            <p className="text-discord-muted text-sm mb-4">Share this link with friends so they can join.</p>
            <div className="flex gap-2">
              <div className="flex-1 bg-discord-darker rounded px-3 py-2 text-white text-sm select-all overflow-hidden" dir="rtl">
                <span dir="ltr">{getInviteUrl()}</span>
              </div>
              <button
                onClick={handleCopy}
                className={`px-4 py-2 rounded font-semibold text-sm transition-colors ${copied ? 'bg-discord-green text-white' : 'bg-discord-blurple hover:bg-blue-500 text-white'}`}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            {myRole === 'owner' && (
              <button
                onClick={handleResetInvite}
                className="mt-3 block text-discord-muted hover:text-discord-red text-xs transition-colors"
              >
                Reset invite link
              </button>
            )}
            <button onClick={() => setShowInvite(false)} className="mt-4 text-discord-muted hover:text-white text-sm transition-colors">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
