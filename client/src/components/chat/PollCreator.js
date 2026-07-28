'use client';
import { useState, useRef, useEffect } from 'react';

export default function PollCreator({ onSubmit, onClose }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiVote, setMultiVote] = useState(false);
  const questionRef = useRef(null);

  useEffect(() => { questionRef.current?.focus(); }, []);

  function updateOption(idx, value) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  }

  function addOption() {
    if (options.length < 10) setOptions((prev) => [...prev, '']);
  }

  function removeOption(idx) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  function submit() {
    const q = question.trim();
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!q || opts.length < 2) return;
    onSubmit({ question: q, options: opts, multi_vote: multiVote });
    onClose();
  }

  const filledOptions = options.filter((o) => o.trim()).length;
  const valid = question.trim().length > 0 && filledOptions >= 2;

  return (
    <div className="bg-discord-sidebar border border-discord-darker rounded-lg p-4 mb-2 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-discord-blurple">
            <path d="M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zM16 13h3v6h-3v-6z"/>
          </svg>
          <span className="text-white font-semibold text-sm">Create Poll</span>
        </div>
        <button onClick={onClose} className="text-discord-muted hover:text-white transition-colors leading-none text-lg">✕</button>
      </div>

      {/* Question */}
      <div className="mb-3">
        <label className="text-discord-muted text-[10px] uppercase font-semibold tracking-wide block mb-1">Question</label>
        <input
          ref={questionRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); } }}
          placeholder="Ask something..."
          maxLength={300}
          className="w-full bg-discord-input rounded px-3 py-1.5 text-sm text-discord-text placeholder-discord-muted focus:outline-none"
        />
      </div>

      {/* Options */}
      <div className="mb-3">
        <label className="text-discord-muted text-[10px] uppercase font-semibold tracking-wide block mb-1">
          Options <span className="normal-case font-normal">(2–10)</span>
        </label>
        <div className="flex flex-col gap-1.5">
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <input
                value={opt}
                onChange={(e) => updateOption(idx, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addOption(); }
                }}
                placeholder={`Option ${idx + 1}`}
                maxLength={100}
                className="flex-1 bg-discord-input rounded px-3 py-1.5 text-sm text-discord-text placeholder-discord-muted focus:outline-none"
              />
              {options.length > 2 && (
                <button
                  onClick={() => removeOption(idx)}
                  className="text-discord-muted hover:text-discord-red transition-colors shrink-0 p-0.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < 10 && (
          <button
            onClick={addOption}
            className="mt-1.5 text-discord-blurple hover:text-white text-xs transition-colors flex items-center gap-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Add option
          </button>
        )}
      </div>

      {/* Multi-vote */}
      <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={multiVote}
          onChange={(e) => setMultiVote(e.target.checked)}
          className="accent-discord-blurple"
        />
        <span className="text-discord-text text-sm">Allow multiple choices</span>
      </label>

      <button
        onClick={submit}
        disabled={!valid}
        className="w-full py-1.5 bg-discord-blurple hover:bg-discord-blurple/80 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded transition-colors"
      >
        Create Poll
      </button>
    </div>
  );
}
