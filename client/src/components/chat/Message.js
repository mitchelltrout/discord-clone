'use client';
import { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { format, fromUnixTime } from 'date-fns';
import { useAuthStore } from '../../lib/stores/authStore';
import { useServerStore } from '../../lib/stores/serverStore';
import { getSocket } from '../../lib/socket';
import Avatar from '../ui/Avatar';
import { ProfileHover } from '../ui/ProfileCard';
import LinkPreview from './LinkPreview';
import PollMessage from './PollMessage';
import dynamic from 'next/dynamic';
import data from '@emoji-mart/data';

const Picker = dynamic(() => import('@emoji-mart/react').then((m) => m.default), { ssr: false });

const QUICK_REACTIONS = ['😂', '👍', '❤️'];

const URL_REGEX = /https?:\/\/[^\s<>"]+/g;
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg|bmp)(\?[^\s]*)?$/i;
const MARKDOWN_REGEX = /(\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|\*(.+?)\*|`(.+?)`)/gs;

function isImageUrl(url) {
  try {
    const { pathname } = new URL(url);
    return IMAGE_EXTENSIONS.test(pathname);
  } catch {
    return false;
  }
}

function getYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0] || null;
    if (u.hostname === 'youtube.com' || u.hostname === 'www.youtube.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(shorts|embed|v)\/([^/?]+)/);
      if (m) return m[2];
    }
  } catch {}
  return null;
}

let _mdKey = 0;
function renderMarkdown(text) {
  const parts = [];
  let lastIndex = 0;
  const regex = new RegExp(MARKDOWN_REGEX.source, 'gs');
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const key = _mdKey++;
    const raw = match[0];
    if (raw.startsWith('**')) {
      parts.push(<strong key={key}>{match[2]}</strong>);
    } else if (raw.startsWith('__')) {
      parts.push(<u key={key}>{match[3]}</u>);
    } else if (raw.startsWith('~~')) {
      parts.push(<s key={key}>{match[4]}</s>);
    } else if (raw.startsWith('*')) {
      parts.push(<em key={key}>{match[5]}</em>);
    } else if (raw.startsWith('`')) {
      parts.push(
        <code key={key} className="bg-discord-darker/70 text-discord-text rounded px-1 py-0.5 text-xs font-mono">
          {match[6]}
        </code>
      );
    }
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

// Renders a text segment, highlighting @mentions for the given usernames
function renderSegment(text, mentionRegex, currentUsername) {
  if (!mentionRegex) return renderMarkdown(text);
  const parts = [];
  let lastIndex = 0;
  const regex = new RegExp(mentionRegex.source, mentionRegex.flags);
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...renderMarkdown(text.slice(lastIndex, match.index)));
    }
    const name = match[1];
    const isSelf =
      name.toLowerCase() === currentUsername?.toLowerCase() ||
      name.toLowerCase() === 'everyone';
    parts.push(
      <span
        key={`m-${match.index}-${_mdKey++}`}
        className={`rounded px-0.5 font-medium cursor-default
          ${isSelf
            ? 'bg-yellow-500/30 text-yellow-200 hover:bg-yellow-500/50'
            : 'bg-discord-blurple/30 text-indigo-300 hover:bg-discord-blurple/50'
          }`}
      >
        @{name}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) parts.push(...renderMarkdown(text.slice(lastIndex)));
  return parts;
}

function renderContent(text, mentionRegex, currentUsername) {
  const parts = [];
  const imageUrls = [];
  const youtubeIds = [];
  const previewUrls = [];
  let lastIndex = 0;
  let match;
  const regex = new RegExp(URL_REGEX.source, 'g');

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...renderSegment(text.slice(lastIndex, match.index), mentionRegex, currentUsername));
    }
    const url = match[0];
    const ytId = getYouTubeId(url);
    if (ytId) {
      youtubeIds.push(ytId);
    } else if (isImageUrl(url)) {
      imageUrls.push(url);
    } else {
      previewUrls.push(url);
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-discord-blurple hover:underline break-all"
        >
          {url}
        </a>
      );
    }
    lastIndex = match.index + url.length;
  }

  if (lastIndex < text.length) {
    parts.push(...renderSegment(text.slice(lastIndex), mentionRegex, currentUsername));
  }

  return { parts, imageUrls, youtubeIds, previewUrls };
}

export default function Message({ message, isGrouped, channelId, isDM, onReply, isPinned, onPin, onUnpin, isServerAdmin: isServerAdminProp }) {
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showReactPicker, setShowReactPicker] = useState(false);

  const serverMatch = pathname?.match(/^\/channels\/(\d+)/);
  const serverId = serverMatch ? parseInt(serverMatch[1]) : null;
  const serverMembers = useServerStore((s) => serverId ? (s.members[serverId] || []) : []);
  const myRole = serverMembers.find((m) => m.id === user?.id)?.role;
  const isServerAdmin = isServerAdminProp ?? (!isDM && (myRole === 'owner' || myRole === 'admin'));

  // Build mention regex from all member usernames + "everyone"
  const mentionRegex = useMemo(() => {
    const names = ['everyone', ...serverMembers.map((m) => m.username)];
    const escaped = [...names]
      .sort((a, b) => b.length - a.length)
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return escaped.length ? new RegExp(`@(${escaped.join('|')})`, 'gi') : null;
  }, [serverMembers]);

  // Whether this message mentions the current user or @everyone
  const isMentioned = useMemo(() => {
    if (!user) return false;
    if (message.reply_user_id === user.id) return true;
    if (!message.content) return false;
    const escaped = user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const selfRegex = new RegExp(`@${escaped}(?!\\S)`, 'i');
    return selfRegex.test(message.content) || /@everyone(?!\S)/i.test(message.content);
  }, [message.content, message.reply_user_id, user]);

  useEffect(() => {
    if (!showReactPicker) return;
    function close() { setShowReactPicker(false); }
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showReactPicker]);

  const isOwn = message.user_id === user?.id;
  const time = format(fromUnixTime(message.created_at), 'h:mm a');
  const fullTime = format(fromUnixTime(message.created_at), 'PPp');

  function handleEdit() {
    const socket = getSocket();
    if (!socket || !editContent.trim()) return;
    socket.emit('message:edit', { messageId: message.id, content: editContent.trim() });
    setEditing(false);
  }

  function handleDelete() {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('message:delete', { messageId: message.id });
  }

  function toggleReaction(emoji) {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('reaction:toggle', { messageId: message.id, emoji });
    setShowReactPicker(false);
  }

  return (
    <div
      className={`flex gap-4 px-2 py-0.5 rounded group relative
        ${isMentioned
          ? 'bg-yellow-500/10 border-l-2 border-yellow-400 pl-[calc(0.5rem-2px)]'
          : `hover:bg-discord-input/30 ${!isGrouped ? 'mt-4' : ''}`
        }
        ${isMentioned && !isGrouped ? 'mt-4' : ''}`}
    >
      {/* Avatar or spacer */}
      <div className="w-10 shrink-0 mt-0.5">
        {!isGrouped ? (
          <ProfileHover userId={message.user_id}>
            <Avatar username={message.username} avatarUrl={message.avatar_url} size={40} />
          </ProfileHover>
        ) : null}
      </div>

      <div className="flex-1 min-w-0">
        {!isGrouped && (
          <div className="flex items-center gap-2 mb-0.5">
            <ProfileHover userId={message.user_id}>
              <span className="text-white font-semibold text-sm cursor-pointer hover:underline">{message.username}</span>
            </ProfileHover>
            <span className="text-discord-muted text-xs" title={fullTime}>{time}</span>
          </div>
        )}

        {/* Reply-to quote */}
        {message.reply_to_id && (
          <div className="flex items-center gap-1.5 mb-1 text-xs text-discord-muted max-w-full overflow-hidden">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 opacity-60">
              <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
            </svg>
            <span className="font-semibold text-white/70 shrink-0">{message.reply_username}</span>
            <span className="truncate opacity-70">{message.reply_content?.slice(0, 80)}{message.reply_content?.length > 80 ? '…' : ''}</span>
          </div>
        )}

        {/* Pin indicator */}
        {isPinned && (
          <div className="flex items-center gap-1 mb-0.5 text-[10px] text-yellow-400/70 font-semibold">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
            </svg>
            Pinned
          </div>
        )}

        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea
              autoFocus
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEdit(); }
                if (e.key === 'Escape') setEditing(false);
              }}
              className="bg-discord-input rounded p-2 text-discord-text resize-none w-full focus:outline-none text-sm"
              rows={2}
            />
            <div className="flex gap-2 text-xs text-discord-muted">
              <span>escape to <button onClick={() => setEditing(false)} className="text-discord-blurple hover:underline">cancel</button></span>
              <span>enter to <button onClick={handleEdit} className="text-discord-blurple hover:underline">save</button></span>
            </div>
          </div>
        ) : (() => {
          const reactions = message.reactions || [];
          const reactionBar = reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {reactions.map((r) => {
                const reacted = r.userIds.includes(user?.id);
                return (
                  <button
                    key={r.emoji}
                    onClick={() => toggleReaction(r.emoji)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors
                      ${reacted
                        ? 'bg-discord-blurple/20 border-discord-blurple text-white'
                        : 'bg-discord-input border-transparent text-discord-muted hover:border-discord-muted'}`}
                    title={`${r.count} reaction${r.count !== 1 ? 's' : ''}`}
                  >
                    <span>{r.emoji}</span>
                    <span>{r.count}</span>
                  </button>
                );
              })}
            </div>
          );

          if (message.poll) {
            return (
              <div>
                <PollMessage
                  poll={message.poll}
                  messageUserId={message.user_id}
                  isDM={isDM}
                  isServerAdmin={isServerAdmin}
                />
                {reactionBar}
              </div>
            );
          }

          const { parts, imageUrls, youtubeIds, previewUrls } = renderContent(message.content, mentionRegex, user?.username);
          return (
            <div>
              <p className="text-discord-text text-sm break-words whitespace-pre-wrap">
                {parts}
                {message.edited_at && (
                  <span className="text-discord-muted text-xs ml-1">(edited)</span>
                )}
              </p>
              {imageUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt="" className="mt-1 rounded max-h-72 max-w-sm object-contain block" />
                </a>
              ))}
              {youtubeIds.map((id, i) => (
                <div key={i} className="mt-2 rounded overflow-hidden bg-black" style={{ maxWidth: 480 }}>
                  <div style={{ position: 'relative', paddingTop: '56.25%' }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${id}`}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="YouTube video"
                    />
                  </div>
                </div>
              ))}
              {previewUrls.map((url, i) => (
                <LinkPreview key={i} url={url} />
              ))}
              {reactionBar}
            </div>
          );
        })()}
      </div>

      {/* Hover actions */}
      {!editing && (
        <div className={`absolute right-4 top-0 -translate-y-full items-center gap-1 bg-discord-sidebar border border-discord-darker rounded shadow-lg ${showReactPicker ? 'flex' : 'hidden group-hover:flex'}`}>
          {/* Quick reactions */}
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => toggleReaction(emoji)}
              className="p-1.5 text-xl hover:bg-discord-input rounded transition-colors"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
          {/* Full emoji picker button */}
          <div className="relative">
            <button
              onClick={() => setShowReactPicker((v) => !v)}
              className="p-1.5 text-discord-muted hover:text-white hover:bg-discord-input rounded transition-colors"
              title="More Reactions"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm-3.5-8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm7 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm-3.5 5c2.33 0 4.32-1.45 5.12-3.5H6.38c.8 2.05 2.79 3.5 5.12 3.5z"/>
              </svg>
            </button>
            {showReactPicker && (
              <div className="absolute right-0 bottom-full mb-1 z-50" onClick={(e) => e.stopPropagation()}>
                <Picker
                  data={data}
                  onEmojiSelect={(e) => toggleReaction(e.native)}
                  theme="dark"
                  previewPosition="none"
                  skinTonePosition="none"
                />
              </div>
            )}
          </div>
          {/* Reply button */}
          {!isDM && onReply && (
            <button
              onClick={() => onReply({ id: message.id, username: message.username, content: message.content })}
              className="p-1.5 text-discord-muted hover:text-white hover:bg-discord-input rounded transition-colors"
              title="Reply"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
              </svg>
            </button>
          )}
          {/* Pin / unpin button */}
          {isServerAdmin && !isDM && (
            <button
              onClick={() => isPinned ? onUnpin(message.id) : onPin(message.id)}
              className="p-1.5 text-discord-muted hover:text-white hover:bg-discord-input rounded transition-colors"
              title={isPinned ? 'Unpin' : 'Pin'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={isPinned ? 0 : 1.5}>
                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" fill="currentColor"/>
              </svg>
            </button>
          )}
          {isOwn && (
            <button
              onClick={() => { setEditing(true); setEditContent(message.content); }}
              className="p-1.5 text-discord-muted hover:text-white hover:bg-discord-input rounded transition-colors"
              title="Edit"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
              </svg>
            </button>
          )}
          {(isOwn || isServerAdmin) && (
            <button
              onClick={handleDelete}
              className="p-1.5 text-discord-muted hover:text-discord-red hover:bg-discord-input rounded transition-colors"
              title="Delete"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
