'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useMessageStore } from '../../lib/stores/messageStore';
import { useUnreadStore } from '../../lib/stores/unreadStore';
import { useDMCallStore } from '../../lib/stores/dmCallStore';
import { useServerStore } from '../../lib/stores/serverStore';
import { useAuthStore } from '../../lib/stores/authStore';
import { getSocket } from '../../lib/socket';
import { playNotification } from '../../lib/sounds';
import { format, fromUnixTime } from 'date-fns';
import api from '../../lib/api';
import Avatar from '../ui/Avatar';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import SearchPanel from './SearchPanel';

export default function ChatView({ channelId, isDM = false, channelName = '', serverId }) {
  const { messages, setMessages, addMessage, updateMessage, deleteMessage, prependMessages, updateMessageReactions, updateMessagePoll } = useMessageStore();
  const { markChannelRead, markDMRead } = useUnreadStore();
  const { setOutgoingCall } = useDMCallStore();
  const channelMessages = messages[channelId] || [];
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const socketRef = useRef(null);

  // Reply state
  const [replyTo, setReplyTo] = useState(null); // { id, username, content }

  // Pins state
  const [pins, setPins] = useState([]);
  const [showPins, setShowPins] = useState(false);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [jumpToId, setJumpToId] = useState(null);

  // Server admin check for pin permissions
  const user = useAuthStore((s) => s.user);
  const serverMembers = useServerStore((s) => serverId ? (s.members[serverId] || []) : []);
  const myRole = serverMembers.find((m) => m.id === user?.id)?.role;
  const isServerAdmin = !isDM && (myRole === 'owner' || myRole === 'admin');

  useEffect(() => {
    if (!channelId) return;
    if (isDM) markDMRead(channelId);
    else markChannelRead(channelId);
  }, [channelId, isDM]);

  useEffect(() => {
    if (!channelId) return;
    setLoading(true);
    const endpoint = isDM ? `/dm/${channelId}/messages` : `/channels/${channelId}/messages`;
    api.get(endpoint)
      .then(({ data }) => { setMessages(channelId, data); setHasMore(data.length === 50); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [channelId, isDM]);

  // Load pins when panel opens
  useEffect(() => {
    if (!showPins || isDM || !channelId) return;
    setPinsLoading(true);
    api.get(`/channels/${channelId}/pins`)
      .then(({ data }) => setPins(data))
      .catch(console.error)
      .finally(() => setPinsLoading(false));
  }, [showPins, channelId, isDM]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !channelId) return;
    socketRef.current = socket;

    if (!isDM) {
      socket.emit('channel:join', { channelId });
      const onConnect = () => socket.emit('channel:join', { channelId });
      const onNew = (msg) => {
        if (msg.channel_id == channelId) {
          addMessage(channelId, msg);
          if (msg.user_id !== user?.id) playNotification();
        }
      };
      const onUpdated = (msg) => { if (msg.channel_id == channelId) updateMessage(channelId, msg); };
      const onDeleted = ({ messageId, channelId: cId }) => { if (cId == channelId) deleteMessage(channelId, messageId); };
      const onReaction = ({ messageId, channelId: cId, reactions }) => { if (cId == channelId) updateMessageReactions(channelId, messageId, reactions); };
      const onPinNew = ({ channelId: cId, message }) => {
        if (cId == channelId) setPins((prev) => [message, ...prev.filter((p) => p.id !== message.id)]);
      };
      const onPinRemoved = ({ channelId: cId, messageId }) => {
        if (cId == channelId) setPins((prev) => prev.filter((p) => p.id !== messageId));
      };
      const onPollUpdated = ({ messageId, channelId: cId, votes }) => {
        if (cId != channelId) return;
        // votes = { [optionIdx]: { count, userIds } } — compute my_votes from userIds
        const voteCounts = {};
        const myVotes = [];
        for (const [idx, v] of Object.entries(votes)) {
          voteCounts[Number(idx)] = v.count;
          if (user?.id && v.userIds.includes(user.id)) myVotes.push(Number(idx));
        }
        updateMessagePoll(channelId, messageId, { votes: voteCounts, my_votes: myVotes });
      };
      const onPollClosed = ({ messageId, channelId: cId }) => {
        if (cId == channelId) updateMessagePoll(channelId, messageId, { closed: true });
      };

      socket.on('connect', onConnect);
      socket.on('message:new', onNew);
      socket.on('message:updated', onUpdated);
      socket.on('message:deleted', onDeleted);
      socket.on('reaction:updated', onReaction);
      socket.on('pin:new', onPinNew);
      socket.on('pin:removed', onPinRemoved);
      socket.on('poll:updated', onPollUpdated);
      socket.on('poll:closed', onPollClosed);

      return () => {
        socket.emit('channel:leave', { channelId });
        socket.off('connect', onConnect);
        socket.off('message:new', onNew);
        socket.off('message:updated', onUpdated);
        socket.off('message:deleted', onDeleted);
        socket.off('reaction:updated', onReaction);
        socket.off('pin:new', onPinNew);
        socket.off('pin:removed', onPinRemoved);
        socket.off('poll:updated', onPollUpdated);
        socket.off('poll:closed', onPollClosed);
      };
    } else {
      socket.emit('dm:join', { conversationId: channelId });
      const onConnect = () => socket.emit('dm:join', { conversationId: channelId });
      const onDM = ({ message, conversationId }) => {
        if (conversationId == channelId) {
          addMessage(channelId, message);
          if (message.user_id !== user?.id) playNotification();
        }
      };
      socket.on('connect', onConnect);
      socket.on('dm:new', onDM);
      return () => { socket.off('connect', onConnect); socket.off('dm:new', onDM); };
    }
  }, [channelId, isDM]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || channelMessages.length === 0) return;
    const oldest = channelMessages[0];
    setLoading(true);
    try {
      const endpoint = isDM
        ? `/dm/${channelId}/messages?before=${oldest.id}&limit=50`
        : `/channels/${channelId}/messages?before=${oldest.id}&limit=50`;
      const { data } = await api.get(endpoint);
      prependMessages(channelId, data);
      setHasMore(data.length === 50);
    } catch {}
    setLoading(false);
  }, [channelId, isDM, hasMore, loading, channelMessages]);

  function handleSend(content, replyToId) {
    const socket = socketRef.current || getSocket();
    if (!socket) return;
    if (isDM) {
      socket.emit('dm:send', { conversationId: channelId, content });
    } else {
      socket.emit('message:send', { channelId, content, replyToId: replyToId || undefined });
    }
    setReplyTo(null);
  }

  function handleSendPoll(pollData) {
    const socket = socketRef.current || getSocket();
    if (!socket) return;
    socket.emit('poll:send', { channelId, ...pollData });
  }

  function handlePin(messageId) {
    (socketRef.current || getSocket())?.emit('message:pin', { channelId, messageId });
  }

  function handleUnpin(messageId) {
    (socketRef.current || getSocket())?.emit('message:unpin', { channelId, messageId });
  }

  async function handleJumpToMessage(messageId) {
    try {
      const endpoint = isDM
        ? `/dm/${channelId}/messages/around/${messageId}`
        : `/channels/${channelId}/messages/around/${messageId}`;
      const { data } = await api.get(endpoint);
      setMessages(channelId, data.messages);
      setHasMore(data.hasMoreBefore);
      setJumpToId(messageId);
    } catch {}
  }

  const pinnedIds = new Set(pins.map((p) => p.id));

  return (
    <div className="flex flex-col h-full">
      {/* Channel header */}
      <div className="h-12 px-4 flex items-center border-b border-discord-darker/50 shrink-0 shadow gap-2">
        {!isDM && <span className="text-discord-muted">#</span>}
        <span className="text-white font-semibold flex-1">{channelName}</span>

        {!isDM && (
          <button
            onClick={() => setShowPins((v) => !v)}
            className={`transition-colors ${showPins ? 'text-white' : 'text-discord-muted hover:text-white'}`}
            title="Pinned Messages"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
            </svg>
          </button>
        )}

        <button
          onClick={() => setShowSearch((v) => !v)}
          className={`transition-colors ${showSearch ? 'text-white' : 'text-discord-muted hover:text-white'}`}
          title="Search Messages"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
        </button>

        {isDM && (
          <button
            onClick={() => {
              const socket = getSocket();
              if (!socket) return;
              socket.emit('dm:call', { conversationId: channelId });
              setOutgoingCall({ conversationId: channelId, partnerUsername: channelName });
            }}
            className="text-discord-muted hover:text-white transition-colors"
            title="Start Voice Call"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        <div className="flex flex-col flex-1 min-w-0">
          <MessageList
            messages={channelMessages}
            loading={loading}
            hasMore={hasMore}
            onLoadMore={loadMore}
            channelId={channelId}
            isDM={isDM}
            onReply={setReplyTo}
            pinnedIds={pinnedIds}
            onPin={handlePin}
            onUnpin={handleUnpin}
            isServerAdmin={isServerAdmin}
            jumpToId={jumpToId}
            onJumpHandled={() => setJumpToId(null)}
          />
          <MessageInput
            onSend={handleSend}
            onSendPoll={handleSendPoll}
            placeholder={isDM ? `Message` : `# ${channelName}`}
            channelId={channelId}
            isDM={isDM}
            replyTo={replyTo}
            onClearReply={() => setReplyTo(null)}
          />
        </div>

        {/* Search panel */}
        {showSearch && (
          <SearchPanel channelId={channelId} isDM={isDM} onClose={() => setShowSearch(false)} onJumpToMessage={handleJumpToMessage} />
        )}

        {/* Pins panel */}
        {showPins && !isDM && (
          <div className="w-64 bg-discord-sidebar border-l border-discord-darker/50 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-discord-darker/50 flex items-center justify-between">
              <span className="text-white font-semibold text-sm">Pinned Messages</span>
              <button onClick={() => setShowPins(false)} className="text-discord-muted hover:text-white transition-colors text-lg leading-none">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
              {pinsLoading && <p className="text-discord-muted text-xs text-center mt-4">Loading...</p>}
              {!pinsLoading && pins.length === 0 && (
                <p className="text-discord-muted text-xs text-center mt-4">No pinned messages yet.</p>
              )}
              {!pinsLoading && pins.map((msg) => (
                <PinnedMessage key={msg.id} message={msg} isServerAdmin={isServerAdmin} onUnpin={() => handleUnpin(msg.id)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PinnedMessage({ message, isServerAdmin, onUnpin }) {
  const time = format(fromUnixTime(message.created_at), 'MMM d, yyyy');
  return (
    <div className="bg-discord-darker rounded-lg p-3 group relative">
      <div className="flex items-center gap-2 mb-1.5">
        <Avatar username={message.username} avatarUrl={message.avatar_url} size={20} />
        <span className="text-white text-xs font-semibold">{message.username}</span>
        <span className="text-discord-muted text-xs ml-auto">{time}</span>
      </div>
      <p className="text-discord-text text-xs line-clamp-3 break-words">{message.content}</p>
      {isServerAdmin && (
        <button
          onClick={onUnpin}
          className="absolute top-2 right-2 text-discord-muted hover:text-discord-red transition-colors opacity-0 group-hover:opacity-100"
          title="Unpin"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      )}
    </div>
  );
}
