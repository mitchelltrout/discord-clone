'use client';
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getSocket } from '../../lib/socket';
import { useServerStore } from '../../lib/stores/serverStore';
import Avatar from '../ui/Avatar';
import dynamic from 'next/dynamic';
import data from '@emoji-mart/data';
import GifPicker from './GifPicker';
import PollCreator from './PollCreator';

const Picker = dynamic(() => import('@emoji-mart/react').then((m) => m.default), { ssr: false });

const TYPING_DEBOUNCE = 1500;
const TYPING_EXPIRE_MS = 6000; // auto-clear stale typing indicators
const EVERYONE_OPTION = { id: 'everyone', username: 'everyone', avatar_url: null };

export default function MessageInput({ onSend, onSendPoll, placeholder, channelId, isDM, replyTo, onClearReply }) {
  const [content, setContent] = useState('');
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const typingExpireTimers = useRef({});
  const [showPicker, setShowPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const textareaRef = useRef(null);
  const pickerRef = useRef(null);
  const gifPickerRef = useRef(null);

  // Mention autocomplete state
  const [mentionState, setMentionState] = useState(null); // { query, atIndex } | null
  const [mentionIdx, setMentionIdx] = useState(0);

  const pathname = usePathname();
  const serverMatch = pathname?.match(/^\/channels\/(\d+)/);
  const serverId = serverMatch ? parseInt(serverMatch[1]) : null;
  const members = useServerStore((s) => serverId ? (s.members[serverId] || []) : []);

  const mentionOptions = mentionState != null
    ? [EVERYONE_OPTION, ...members]
        .filter((m) => m.username.toLowerCase().includes(mentionState.query.toLowerCase()))
        .slice(0, 8)
    : [];

  useEffect(() => {
    if (!showPicker) return;
    function close(e) {
      // composedPath() traverses shadow DOM boundaries (emoji-mart uses a shadow DOM internally)
      if (pickerRef.current && e.composedPath().includes(pickerRef.current)) return;
      setShowPicker(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showPicker]);

  useEffect(() => {
    if (!showGifPicker) return;
    function close(e) {
      if (gifPickerRef.current && e.composedPath().includes(gifPickerRef.current)) return;
      setShowGifPicker(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showGifPicker]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const clearExpireTimer = (userId) => {
      clearTimeout(typingExpireTimers.current[userId]);
      delete typingExpireTimers.current[userId];
    };

    const setExpireTimer = (userId) => {
      clearExpireTimer(userId);
      typingExpireTimers.current[userId] = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
        delete typingExpireTimers.current[userId];
      }, TYPING_EXPIRE_MS);
    };

    if (isDM) {
      const onDmTyping = ({ conversationId: cId, userId, username, typing }) => {
        if (cId != channelId) return;
        if (typing) {
          setExpireTimer(userId);
          setTypingUsers((prev) => {
            if (prev.find((u) => u.userId === userId)) return prev;
            return [...prev, { userId, username }];
          });
        } else {
          clearExpireTimer(userId);
          setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
        }
      };
      socket.on('dm:typing', onDmTyping);
      return () => {
        socket.off('dm:typing', onDmTyping);
        Object.values(typingExpireTimers.current).forEach(clearTimeout);
        typingExpireTimers.current = {};
      };
    }

    const onTyping = ({ channelId: cId, userId, username, typing }) => {
      if (cId != channelId) return;
      if (typing) {
        setExpireTimer(userId);
        setTypingUsers((prev) => {
          if (prev.find((u) => u.userId === userId)) return prev;
          return [...prev, { userId, username }];
        });
      } else {
        clearExpireTimer(userId);
        setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
      }
    };

    socket.on('typing:update', onTyping);
    return () => {
      socket.off('typing:update', onTyping);
      Object.values(typingExpireTimers.current).forEach(clearTimeout);
      typingExpireTimers.current = {};
    };
  }, [channelId, isDM]);

  function sendTyping(typing) {
    if (isDM) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit(typing ? 'typing:start' : 'typing:stop', { channelId });
  }

  function checkMention(value, cursorPos) {
    const before = value.slice(0, cursorPos);
    const match = before.match(/@([^\s]*)$/);
    if (match) {
      setMentionState({ query: match[1], atIndex: cursorPos - match[0].length });
      setMentionIdx(0);
    } else {
      setMentionState(null);
    }
  }

  function handleChange(e) {
    const newVal = e.target.value;
    setContent(newVal);
    checkMention(newVal, e.target.selectionStart);

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTyping(true);
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTyping(false);
    }, TYPING_DEBOUNCE);
  }

  function handleSelect(e) {
    // Re-check mention when cursor moves (click / keyboard nav inside textarea)
    checkMention(e.target.value, e.target.selectionStart);
  }

  function selectMention(username) {
    const ta = textareaRef.current;
    const cursorPos = ta ? ta.selectionStart : content.length;
    const before = content.slice(0, mentionState.atIndex);
    const after = content.slice(cursorPos);
    const inserted = `@${username} `;
    const newContent = before + inserted + after;
    setContent(newContent);
    setMentionState(null);
    setTimeout(() => {
      if (!ta) return;
      ta.focus();
      const pos = mentionState.atIndex + inserted.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  }

  function handleKeyDown(e) {
    if (mentionState && mentionOptions.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIdx((i) => Math.min(mentionOptions.length - 1, i + 1));
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && mentionOptions.length > 0)) {
        e.preventDefault();
        selectMention(mentionOptions[mentionIdx].username);
        return;
      }
      if (e.key === 'Escape') {
        setMentionState(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function wrapSelection(syntax) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.slice(start, end);
    const newContent = content.slice(0, start) + syntax + selected + syntax + content.slice(end);
    setContent(newContent);
    setTimeout(() => {
      ta.focus();
      if (selected) {
        ta.setSelectionRange(start + syntax.length, end + syntax.length);
      } else {
        ta.setSelectionRange(start + syntax.length, start + syntax.length);
      }
    }, 0);
  }

  function handleEmojiSelect(emoji) {
    const native = emoji.native;
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      setContent((c) => c.slice(0, start) + native + c.slice(end));
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(start + native.length, start + native.length);
      }, 0);
    } else {
      setContent((c) => c + native);
    }
    setShowPicker(false);
  }

  function submit() {
    if (!content.trim()) return;
    onSend(content.trim(), replyTo?.id);
    setContent('');
    setMentionState(null);
    clearTimeout(typingTimerRef.current);
    isTypingRef.current = false;
    sendTyping(false);
  }

  function handleGifSelect(url) {
    onSend(url);
  }

  return (
    <div className="px-4 pb-6 shrink-0">
      {typingUsers.length > 0 && (
        <p className="text-discord-muted text-xs mb-1 h-4">
          {typingUsers.map((u) => u.username).join(', ')}
          {typingUsers.length === 1 ? ' is typing...' : ' are typing...'}
        </p>
      )}
      {typingUsers.length === 0 && <div className="h-4 mb-1" />}

      {/* Reply preview bar */}
      {replyTo && (
        <div className="flex items-center gap-2 bg-discord-input/60 rounded-t-lg px-3 py-1.5 border-b border-discord-darker/50 text-xs">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-discord-muted shrink-0">
            <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
          </svg>
          <span className="text-discord-muted">Replying to</span>
          <span className="text-white font-semibold">{replyTo.username}</span>
          <span className="text-discord-muted truncate flex-1">{replyTo.content?.slice(0, 60)}{replyTo.content?.length > 60 ? '…' : ''}</span>
          <button onClick={onClearReply} className="text-discord-muted hover:text-white transition-colors shrink-0 ml-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      )}

      <div className="relative">
        {/* Mention autocomplete dropdown */}
        {mentionState && mentionOptions.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 w-72 bg-discord-sidebar border border-discord-darker rounded-lg shadow-xl z-50 overflow-hidden">
            <p className="text-discord-muted text-[10px] font-semibold uppercase tracking-wide px-3 pt-2 pb-1">Members</p>
            {mentionOptions.map((m, i) => (
              <div
                key={m.id}
                onMouseDown={(e) => { e.preventDefault(); selectMention(m.username); }}
                className={`flex items-center gap-2.5 px-3 py-1.5 cursor-pointer transition-colors
                  ${i === mentionIdx ? 'bg-discord-input' : 'hover:bg-discord-input/60'}`}
              >
                {m.id === 'everyone' ? (
                  <div className="w-7 h-7 rounded-full bg-discord-blurple flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                    </svg>
                  </div>
                ) : (
                  <Avatar username={m.username} avatarUrl={m.avatar_url} size={28} />
                )}
                <span className="text-discord-text text-sm font-medium">
                  {m.id === 'everyone' ? '@everyone — notify all members' : m.username}
                </span>
              </div>
            ))}
          </div>
        )}

        {showPollCreator && !isDM && (
          <div className="absolute bottom-full left-0 right-0 mb-2 z-50">
            <PollCreator
              onSubmit={(pollData) => { onSendPoll?.(pollData); }}
              onClose={() => setShowPollCreator(false)}
            />
          </div>
        )}

        {showGifPicker && (
          <div ref={gifPickerRef} className="absolute bottom-full right-0 mb-2 z-50">
            <GifPicker onSelect={handleGifSelect} onClose={() => setShowGifPicker(false)} />
          </div>
        )}

        {showPicker && (
          <div ref={pickerRef} className="absolute bottom-full right-0 mb-2 z-50">
            <Picker
              data={data}
              onEmojiSelect={handleEmojiSelect}
              theme="dark"
              previewPosition="none"
              skinTonePosition="none"
            />
          </div>
        )}
        <div className={`bg-discord-input flex items-center gap-2 px-4 py-2.5 ${replyTo ? 'rounded-b-lg' : 'rounded-lg'}`}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onSelect={handleSelect}
            onClick={handleSelect}
            placeholder={placeholder || 'Message'}
            rows={1}
            className="flex-1 bg-transparent text-discord-text placeholder-discord-muted resize-none focus:outline-none text-sm max-h-40 overflow-y-auto"
            style={{ lineHeight: '1.5rem' }}
          />
          {/* Formatting buttons */}
          <div className="group/fmt flex items-center shrink-0 border-r border-discord-darker/50 pr-2 mr-0.5">
            <div className="flex items-center gap-0.5 overflow-hidden max-w-0 group-hover/fmt:max-w-xs transition-all duration-200 ease-in-out">
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); wrapSelection('**'); }}
                className="w-6 h-6 flex items-center justify-center rounded text-discord-muted hover:text-white hover:bg-discord-darker/50 transition-colors font-bold text-sm"
                title="Bold (**text**)"
              >B</button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); wrapSelection('*'); }}
                className="w-6 h-6 flex items-center justify-center rounded text-discord-muted hover:text-white hover:bg-discord-darker/50 transition-colors italic text-sm"
                title="Italic (*text*)"
              >I</button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); wrapSelection('__'); }}
                className="w-6 h-6 flex items-center justify-center rounded text-discord-muted hover:text-white hover:bg-discord-darker/50 transition-colors underline text-sm"
                title="Underline (__text__)"
              >U</button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); wrapSelection('~~'); }}
                className="w-6 h-6 flex items-center justify-center rounded text-discord-muted hover:text-white hover:bg-discord-darker/50 transition-colors line-through text-sm"
                title="Strikethrough (~~text~~)"
              >S</button>
            </div>
            <div className="w-6 h-6 flex items-center justify-center rounded text-discord-muted group-hover/fmt:text-white transition-colors cursor-default" title="Text formatting">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z"/>
              </svg>
            </div>
          </div>
          {!isDM && (
            <button
              type="button"
              onClick={() => { setShowPollCreator((v) => !v); setShowPicker(false); setShowGifPicker(false); }}
              className={`text-discord-muted hover:text-white transition-colors shrink-0 ${showPollCreator ? 'text-white' : ''}`}
              title="Create Poll"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zM16 13h3v6h-3v-6z"/>
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowGifPicker((v) => !v); setShowPicker(false); setShowPollCreator(false); }}
            className="text-discord-muted hover:text-white transition-colors shrink-0 text-xs font-bold tracking-tight border border-discord-muted/40 hover:border-white/40 rounded px-1 py-0.5 leading-none"
            title="GIF"
          >
            GIF
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowPicker((v) => !v); setShowGifPicker(false); setShowPollCreator(false); }}
            className="text-discord-muted hover:text-white transition-colors shrink-0"
            title="Emoji"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm-3.5-8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm7 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm-3.5 5c2.33 0 4.32-1.45 5.12-3.5H6.38c.8 2.05 2.79 3.5 5.12 3.5z"/>
            </svg>
          </button>
          <button
            onClick={submit}
            disabled={!content.trim()}
            className="text-discord-muted hover:text-white disabled:opacity-40 transition-colors shrink-0"
            title="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
