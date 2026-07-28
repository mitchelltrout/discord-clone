'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useServerStore } from '../../lib/stores/serverStore';
import { useVoiceStore } from '../../lib/stores/voiceStore';
import { useAuthStore } from '../../lib/stores/authStore';
import { useUnreadStore } from '../../lib/stores/unreadStore';
import { useDMCallStore } from '../../lib/stores/dmCallStore';
import { joinVoice, leaveVoice } from '../../lib/voiceConnection';
import { getSocket, connectSocket } from '../../lib/socket';
import { registerMobileShowChat } from '../../lib/mobileNav';
import api from '../../lib/api';
import ServerSidebar from './ServerSidebar';
import ChannelSidebar from './ChannelSidebar';
import MemberList from './MemberList';
import DMCallOverlay from '../dm/DMCallOverlay';
import DownloadBanner from '../ui/DownloadBanner';

function notify(title, body, onClick) {
  if (typeof window === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  if (!document.hidden) return; // tab is visible — don't spam
  const n = new Notification(title, {
    body,
    icon: '/favicon.svg',
    silent: false,
  });
  if (onClick) n.onclick = () => { window.focus(); onClick(); n.close(); };
}

export default function AppShell({ children }) {
  const { setServers, updateMemberStatus, addMember, removeMember, addChannel, removeChannel, removeServer } = useServerStore();
  const { setVoiceRoom } = useVoiceStore();
  const { markChannelUnread, markDMUnread } = useUnreadStore();
  const { setIncomingCall, setActiveCall, clearOutgoingCall, clearActiveCall, endAllCalls } = useDMCallStore();

  const pathname = usePathname();
  const router = useRouter();
  // true = show chat panel on mobile; false = show sidebars
  const inChat = pathname.split('/').filter(Boolean).length >= 3;
  const [mobileShowChat, setMobileShowChat] = useState(inChat);
  const [mobileShowMembers, setMobileShowMembers] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => { setMobileShowChat(inChat); }, [pathname]);
  useEffect(() => { registerMobileShowChat(setMobileShowChat); }, []);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  function handleMobileBack() {
    setMobileShowChat(false);
  }

  // Request browser notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Reconnect socket on page refresh (login() already does this on fresh login,
  // but Zustand persist restores auth state without reconnecting the socket)
  useEffect(() => {
    if (!getSocket()) {
      const accessToken = useAuthStore.getState().accessToken;
      if (accessToken) connectSocket(accessToken);
    }
  }, []);

  // Load servers on mount
  useEffect(() => {
    api.get('/servers').then(({ data }) => setServers(data)).catch(console.error);
  }, []);

  // Fetch initial voice room state
  useEffect(() => {
    api.get('/voice/rooms').then(({ data }) => {
      Object.entries(data).forEach(([channelId, users]) => {
        setVoiceRoom(Number(channelId), users);
      });
    }).catch(console.error);
  }, []);

  // Idle detection — move user to AFK voice channel after 30 minutes of inactivity
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let lastActivity = Date.now();

    const resetActivity = () => { lastActivity = Date.now(); };
    document.addEventListener('mousemove', resetActivity, { passive: true });
    document.addEventListener('keydown', resetActivity, { passive: true });
    document.addEventListener('click', resetActivity, { passive: true });

    const interval = setInterval(() => {
      const idleMs = Date.now() - lastActivity;
      if (idleMs < 30 * 60 * 1000) return;
      const { activeChannelId } = useVoiceStore.getState();
      if (!activeChannelId || String(activeChannelId).startsWith('dm-')) return;
      const socket = getSocket();
      socket?.emit('voice:afk');
    }, 60_000);

    return () => {
      document.removeEventListener('mousemove', resetActivity);
      document.removeEventListener('keydown', resetActivity);
      document.removeEventListener('click', resetActivity);
      clearInterval(interval);
    };
  }, []);

  // Listen to global socket events
  useEffect(() => {
    // If socket isn't ready yet (page refresh), wait for it then register
    let socket = getSocket();
    let cleanup = null;

    function register(s) {
      const onStatus = ({ userId, status, statusMessage }) => updateMemberStatus(userId, status, statusMessage);
      const onVoiceRoomUpdated = ({ channelId, users }) => setVoiceRoom(channelId, users);
      const onMemberJoined = ({ serverId, member }) => addMember(serverId, member);
      const onMemberLeft = ({ serverId, userId }) => removeMember(serverId, userId);

      const onChannelNotification = ({ channelId, serverId, channelName, username, content }) => {
        const path = window.location.pathname;
        const isViewing = path === `/channels/${serverId}/${channelId}`;
        if (!isViewing) {
          markChannelUnread(channelId);
          const preview = content?.length > 80 ? content.slice(0, 80) + '…' : content;
          notify(
            `#${channelName}`,
            `${username}: ${preview}`,
            () => { window.location.href = `/channels/${serverId}/${channelId}`; }
          );
        }
      };

      const onDMNotification = ({ conversationId, message }) => {
        const path = window.location.pathname;
        const isViewing = path === `/channels/me/${conversationId}`;
        if (!isViewing) {
          markDMUnread(conversationId);
          if (message) {
            const preview = message.content?.length > 80 ? message.content.slice(0, 80) + '…' : message.content;
            notify(
              message.username,
              preview,
              () => { window.location.href = `/channels/me/${conversationId}`; }
            );
          }
        }
      };

      // On reconnect, re-fetch server list so member statuses are fresh
      const onConnect = () => {
        api.get('/servers').then(({ data }) => setServers(data)).catch(console.error);
        api.get('/voice/rooms').then(({ data }) => {
          Object.entries(data).forEach(([channelId, users]) => {
            setVoiceRoom(Number(channelId), users);
          });
        }).catch(console.error);
      };

      // DM voice call signaling
      const onIncomingCall = ({ conversationId, callerId, callerUsername }) => {
        setIncomingCall({ conversationId, callerId, callerUsername });
      };
      const onCallAccepted = ({ conversationId }) => {
        const { outgoingCall } = useDMCallStore.getState();
        if (!outgoingCall) return;
        joinVoice(`dm-${conversationId}`);
        setActiveCall({ conversationId, partnerUsername: outgoingCall.partnerUsername });
        clearOutgoingCall();
      };
      const onCallDeclined = () => {
        clearOutgoingCall();
      };
      const onCallCancelled = () => {
        useDMCallStore.getState().clearIncomingCall();
      };
      const onCallEnded = () => {
        leaveVoice();
        clearActiveCall();
      };

      s.on('status:update', onStatus);
      s.on('voice:room-updated', onVoiceRoomUpdated);
      s.on('member:joined', onMemberJoined);
      s.on('member:left', onMemberLeft);
      s.on('channel:notification', onChannelNotification);
      s.on('dm:notification', onDMNotification);
      s.on('connect', onConnect);
      // AFK channel management
      const onChannelAdded = ({ serverId, channel }) => addChannel(serverId, channel);
      const onChannelRemoved = ({ serverId, channelId }) => removeChannel(serverId, channelId);
      const onMoveToAfk = ({ channelId, serverId }) => {
        joinVoice(channelId);
        // Navigate to the AFK channel view if we're in the affected server
        const path = window.location.pathname;
        if (path.startsWith(`/channels/${serverId}`)) {
          window.location.href = `/channels/${serverId}/${channelId}`;
        }
      };

      s.on('dm:incoming-call', onIncomingCall);
      s.on('dm:call-accepted', onCallAccepted);
      s.on('dm:call-declined', onCallDeclined);
      s.on('dm:call-cancelled', onCallCancelled);
      s.on('dm:call-ended', onCallEnded);
      const onServerKicked = ({ serverId }) => {
        removeServer(serverId);
        const path = window.location.pathname;
        if (path.startsWith(`/channels/${serverId}`)) {
          window.location.href = '/channels/me';
        }
      };

      s.on('channel:added', onChannelAdded);
      s.on('channel:removed', onChannelRemoved);
      s.on('voice:move-to-afk', onMoveToAfk);
      s.on('server:kicked', onServerKicked);

      return () => {
        s.off('status:update', onStatus);
        s.off('voice:room-updated', onVoiceRoomUpdated);
        s.off('member:joined', onMemberJoined);
        s.off('member:left', onMemberLeft);
        s.off('channel:notification', onChannelNotification);
        s.off('dm:notification', onDMNotification);
        s.off('connect', onConnect);
        s.off('dm:incoming-call', onIncomingCall);
        s.off('dm:call-accepted', onCallAccepted);
        s.off('dm:call-declined', onCallDeclined);
        s.off('dm:call-cancelled', onCallCancelled);
        s.off('dm:call-ended', onCallEnded);
        s.off('channel:added', onChannelAdded);
        s.off('channel:removed', onChannelRemoved);
        s.off('voice:move-to-afk', onMoveToAfk);
        s.off('server:kicked', onServerKicked);
      };
    }

    if (socket) {
      cleanup = register(socket);
    } else {
      // Socket not yet connected (page refresh) — poll briefly until it appears
      const interval = setInterval(() => {
        socket = getSocket();
        if (socket) {
          clearInterval(interval);
          cleanup = register(socket);
        }
      }, 100);
      return () => clearInterval(interval);
    }

    return () => cleanup?.();
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-discord-bg">
      {/* Sidebars — hidden on mobile when chat is open */}
      <div className={`flex shrink-0 ${mobileShowChat ? 'hidden md:flex' : 'flex'}`}>
        <ServerSidebar />
        <ChannelSidebar />
      </div>

      {/* Main content — hidden on mobile when sidebars are shown */}
      <main className={`flex-1 flex flex-col overflow-hidden ${mobileShowChat ? 'flex' : 'hidden md:flex'}`}>
        {/* Mobile nav bar — only rendered on actual mobile screens when chat is open */}
        {mobileShowChat && isMobile && (
          <div className="flex items-center px-3 h-10 bg-discord-sidebar border-b border-discord-darker/50 shrink-0">
            <button
              onClick={handleMobileBack}
              className="text-discord-muted hover:text-white transition-colors flex items-center gap-1.5 text-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
              </svg>
              Channels
            </button>
            <div className="flex-1" />
            <button
              onClick={() => setMobileShowMembers(v => !v)}
              className="text-discord-muted hover:text-white transition-colors flex items-center gap-1.5 text-sm"
            >
              Members
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
      </main>

      {/* Member list — always visible on desktop, overlay on mobile */}
      <div className="hidden md:block">
        <MemberList />
      </div>

      {/* Mobile members overlay */}
      {mobileShowMembers && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button
            className="flex-1 bg-black/50"
            onClick={() => setMobileShowMembers(false)}
            aria-label="Close members"
          />
          <div className="w-56 bg-discord-sidebar overflow-y-auto">
            <MemberList />
          </div>
        </div>
      )}


<DMCallOverlay />
      <DownloadBanner />
    </div>
  );
}
