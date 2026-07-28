'use client';
import { useAuthStore } from '../../lib/stores/authStore';
import { getSocket } from '../../lib/socket';

export default function PollMessage({ poll, messageUserId, isDM, isServerAdmin }) {
  const user = useAuthStore((s) => s.user);
  if (!poll) return null;

  const totalVotes = Object.values(poll.votes).reduce((sum, v) => sum + v, 0);
  const canClose = !poll.closed && !isDM && (messageUserId === user?.id || isServerAdmin);

  function vote(optionIdx) {
    if (poll.closed || isDM) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit('poll:vote', { pollId: poll.id, optionIdx });
  }

  function closePoll() {
    if (!confirm('End this poll? Voting will stop.')) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit('poll:close', { pollId: poll.id });
  }

  return (
    <div className="mt-1 bg-discord-darker/40 rounded-lg p-3 border border-discord-darker/60 max-w-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-discord-blurple shrink-0">
            <path d="M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zM16 13h3v6h-3v-6z"/>
          </svg>
          <span className="text-white font-semibold text-sm leading-snug">{poll.question}</span>
        </div>
        {canClose && (
          <button
            onClick={closePoll}
            className="text-discord-muted hover:text-discord-red text-xs shrink-0 transition-colors"
          >
            End
          </button>
        )}
      </div>

      {poll.closed && (
        <p className="text-discord-muted text-xs italic mb-2">Poll ended</p>
      )}

      {/* Options */}
      <div className="flex flex-col gap-1.5">
        {poll.options.map((opt, idx) => {
          const count = poll.votes[idx] || 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const voted = poll.my_votes?.includes(idx);

          return (
            <button
              key={idx}
              onClick={() => vote(idx)}
              disabled={poll.closed || isDM}
              className={`relative flex items-center gap-2 rounded-md px-3 py-2 text-left overflow-hidden transition-colors
                ${!poll.closed && !isDM ? 'cursor-pointer hover:bg-white/5' : 'cursor-default'}
                ${voted ? 'ring-1 ring-inset ring-discord-blurple/60' : ''}`}
            >
              {/* Bar background */}
              <div
                className={`absolute inset-0 rounded-md transition-[width] duration-500
                  ${voted ? 'bg-discord-blurple/20' : 'bg-discord-input/50'}`}
                style={{ width: `${pct}%` }}
              />
              {/* Radio indicator */}
              <div className={`relative w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors
                ${voted ? 'border-discord-blurple bg-discord-blurple' : 'border-discord-muted'}`}>
                {voted && (
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              {/* Label */}
              <span className={`relative text-sm flex-1 truncate ${voted ? 'text-white' : 'text-discord-text'}`}>
                {opt}
              </span>
              {/* Percentage */}
              <span className="relative text-discord-muted text-xs w-8 text-right shrink-0">{pct}%</span>
            </button>
          );
        })}
      </div>

      <p className="text-discord-muted text-xs mt-2">
        {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
        {poll.multi_vote && <span className="ml-1">· multiple choices allowed</span>}
      </p>
    </div>
  );
}
