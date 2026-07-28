'use client';
import { useEffect, useRef, useState } from 'react';
import Message from './Message';

export default function MessageList({ messages, loading, hasMore, onLoadMore, channelId, isDM, onReply, pinnedIds, onPin, onUnpin, isServerAdmin, jumpToId, onJumpHandled }) {
  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const prevScrollHeight = useRef(0);
  const isPrepending = useRef(false);
  const messageRefs = useRef(new Map());
  const [highlightedId, setHighlightedId] = useState(null);

  // Only auto-scroll to bottom for new messages, not when loading older ones
  useEffect(() => {
    if (isPrepending.current) {
      isPrepending.current = false;
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Restore scroll position after older messages are prepended
  useEffect(() => {
    if (listRef.current && prevScrollHeight.current > 0) {
      const newScrollHeight = listRef.current.scrollHeight;
      const diff = newScrollHeight - prevScrollHeight.current;
      if (diff > 0) {
        listRef.current.scrollTop += diff;
      }
      prevScrollHeight.current = 0;
    }
  }, [messages]);

  // Scroll to and highlight jumped-to message
  useEffect(() => {
    if (!jumpToId) return;
    const el = messageRefs.current.get(Number(jumpToId));
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedId(Number(jumpToId));
      const t = setTimeout(() => setHighlightedId(null), 2000);
      onJumpHandled?.();
      return () => clearTimeout(t);
    }
  }, [jumpToId, messages]);

  function handleScroll(e) {
    if (e.target.scrollTop === 0 && hasMore && !loading) {
      prevScrollHeight.current = e.target.scrollHeight;
      isPrepending.current = true;
      onLoadMore();
    }
  }

  return (
    <div
      ref={listRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-0.5"
    >
      {loading && hasMore && (
        <p className="text-discord-muted text-sm text-center py-2">Loading...</p>
      )}

      {!hasMore && messages.length > 0 && (
        <div className="py-6 text-center">
          <p className="text-white font-bold text-lg">
            {isDM ? 'This is the beginning of your DM' : 'This is the beginning of this channel'}
          </p>
        </div>
      )}

      {messages.length === 0 && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-discord-muted">No messages yet. Say hello!</p>
        </div>
      )}

      {messages.map((msg, i) => {
        const prev = messages[i - 1];
        const isGrouped =
          !msg.reply_to_id &&
          prev &&
          prev.user_id === msg.user_id &&
          msg.created_at - prev.created_at < 300;

        return (
          <div
            key={msg.id}
            ref={(el) => { if (el) messageRefs.current.set(msg.id, el); else messageRefs.current.delete(msg.id); }}
            className={highlightedId === msg.id ? 'transition-colors duration-300 rounded bg-yellow-400/20' : ''}
          >
            <Message
              message={msg}
              isGrouped={isGrouped}
              channelId={channelId}
              isDM={isDM}
              onReply={onReply}
              isPinned={pinnedIds?.has(msg.id)}
              onPin={onPin}
              onUnpin={onUnpin}
              isServerAdmin={isServerAdmin}
            />
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
