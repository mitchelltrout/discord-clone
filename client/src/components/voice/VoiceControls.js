'use client';
import { useVoiceStore } from '../../lib/stores/voiceStore';
import { startScreenShare, stopScreenShare, broadcastVoiceState } from '../../lib/voiceConnection';

export default function VoiceControls({ onLeave }) {
  const { isMuted, isCamOn, isDeafened, isScreenSharing, isAfkChannel, setMuted, setCamOn, setDeafened, localStream } = useVoiceStore();

  function toggleMute() {
    if (isAfkChannel) return; // cannot unmute in AFK channel
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => { t.enabled = isMuted; });
    }
    const next = !isMuted;
    setMuted(next);
    broadcastVoiceState({ isMuted: next, isCamOn, isScreenSharing, isDeafened });
  }

  function toggleCam() {
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => { t.enabled = !isCamOn; });
    }
    const next = !isCamOn;
    setCamOn(next);
    broadcastVoiceState({ isMuted, isCamOn: next, isScreenSharing, isDeafened });
  }

  function toggleDeafen() {
    const next = !isDeafened;
    setDeafened(next);
    broadcastVoiceState({ isMuted, isCamOn, isScreenSharing, isDeafened: next });
  }

  return (
    <div className="flex items-center gap-3 bg-discord-sidebar rounded-xl px-6 py-3 shadow-lg">
      {/* Mute */}
      <button
        onClick={toggleMute}
        disabled={isAfkChannel}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors
          ${isAfkChannel ? 'bg-discord-red text-white opacity-60 cursor-not-allowed' : isMuted ? 'bg-discord-red text-white' : 'bg-discord-input text-discord-text hover:bg-discord-muted hover:text-white'}`}
        title={isAfkChannel ? 'Muted in AFK channel' : isMuted ? 'Unmute' : 'Mute'}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          {isMuted ? (
            <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
          ) : (
            <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
          )}
        </svg>
      </button>

      {/* Camera */}
      <button
        onClick={toggleCam}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors
          ${!isCamOn ? 'bg-discord-input text-discord-muted hover:bg-discord-muted hover:text-white' : 'bg-discord-green text-white'}`}
        title={isCamOn ? 'Turn off camera' : 'Turn on camera'}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
        </svg>
      </button>

      {/* Screen share */}
      <button
        onClick={() => isScreenSharing ? stopScreenShare() : startScreenShare()}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors
          ${isScreenSharing ? 'bg-discord-green text-white' : 'bg-discord-input text-discord-text hover:bg-discord-muted hover:text-white'}`}
        title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h6l-2 3v1h8v-1l-2-3h6c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H4V5h16v11z"/>
        </svg>
      </button>

      {/* Deafen */}
      <button
        onClick={toggleDeafen}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors
          ${isDeafened ? 'bg-discord-red text-white' : 'bg-discord-input text-discord-text hover:bg-discord-muted hover:text-white'}`}
        title={isDeafened ? 'Undeafen' : 'Deafen'}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3a9 9 0 0 0-9 9v5a3 3 0 0 0 3 3h1a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H5v-2a7 7 0 0 1 7-7 7 7 0 0 1 6.93 6H17a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1a3 3 0 0 0 3-3v-5a9 9 0 0 0-9-9z" />
          {isDeafened && <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>}
        </svg>
      </button>

      {/* Leave */}
      <button
        onClick={onLeave}
        className="w-12 h-12 rounded-full bg-discord-red hover:bg-red-600 text-white flex items-center justify-center transition-colors"
        title="Leave call"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08C.11 12.9 0 12.65 0 12.37c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.66c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
        </svg>
      </button>
    </div>
  );
}
