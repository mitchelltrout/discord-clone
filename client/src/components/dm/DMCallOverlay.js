'use client';
import { useEffect, useRef, useState } from 'react';
import { useDMCallStore } from '../../lib/stores/dmCallStore';
import { useVoiceStore } from '../../lib/stores/voiceStore';
import { getSocket } from '../../lib/socket';
import { joinVoice, leaveVoice, startScreenShare, stopScreenShare } from '../../lib/voiceConnection';

export default function DMCallOverlay() {
  const {
    incomingCall, outgoingCall, activeCall,
    setActiveCall, clearIncomingCall, clearOutgoingCall, clearActiveCall,
  } = useDMCallStore();
  const { isMuted, setMuted, localStream, streams, screenStreams, localScreenStream, isScreenSharing } = useVoiceStore();
  const audioRefs = useRef({});
  const screenVideoRef = useRef(null);
  const screenContainerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onFsChange() { setIsFullscreen(!!document.fullscreenElement); }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  function toggleFullscreen() {
    if (!screenContainerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      screenContainerRef.current.requestFullscreen();
    }
  }

  // Active screen: local takes priority, then remote
  const remoteScreenStream = Object.values(screenStreams)[0] || null;
  const activeScreenStream = localScreenStream || remoteScreenStream || null;
  const screenLabel = localScreenStream ? 'You are presenting' : (remoteScreenStream ? 'Partner is presenting' : null);

  useEffect(() => {
    if (screenVideoRef.current && activeScreenStream) {
      screenVideoRef.current.srcObject = activeScreenStream;
    }
  }, [activeScreenStream]);

  // Render remote audio streams
  useEffect(() => {
    Object.entries(streams).forEach(([userId, stream]) => {
      if (!audioRefs.current[userId]) return;
      const el = audioRefs.current[userId];
      if (el.srcObject !== stream) {
        el.srcObject = stream;
        el.play().catch(() => {});
      }
    });
  }, [streams]);

  function handleAccept() {
    const socket = getSocket();
    if (!socket || !incomingCall) return;
    socket.emit('dm:call-accept', { conversationId: incomingCall.conversationId });
    joinVoice(`dm-${incomingCall.conversationId}`);
    setActiveCall({ conversationId: incomingCall.conversationId, partnerUsername: incomingCall.callerUsername });
    clearIncomingCall();
  }

  function handleDecline() {
    const socket = getSocket();
    if (!socket || !incomingCall) return;
    socket.emit('dm:call-decline', { conversationId: incomingCall.conversationId });
    clearIncomingCall();
  }

  function handleCancel() {
    const socket = getSocket();
    if (!socket || !outgoingCall) return;
    socket.emit('dm:call-cancel', { conversationId: outgoingCall.conversationId });
    clearOutgoingCall();
  }

  function handleHangup() {
    const socket = getSocket();
    const conversationId = activeCall?.conversationId ?? outgoingCall?.conversationId;
    if (conversationId) socket?.emit('dm:call-end', { conversationId });
    leaveVoice();
    clearActiveCall();
    clearOutgoingCall();
  }

  function toggleMute() {
    if (!localStream) return;
    const next = !isMuted;
    localStream.getAudioTracks().forEach((t) => { t.enabled = !next; });
    setMuted(next);
  }

  const showCallBar = outgoingCall || activeCall;

  return (
    <>
      {/* Hidden audio elements for remote streams */}
      {Object.keys(streams).map((userId) => (
        <audio
          key={userId}
          ref={(el) => { if (el) audioRefs.current[userId] = el; }}
          autoPlay
          playsInline
        />
      ))}

      {/* Incoming call popup */}
      {incomingCall && (
        <div className="fixed bottom-24 right-4 z-50 bg-discord-sidebar border border-discord-darker/60 rounded-lg p-4 shadow-2xl w-72">
          <p className="text-white font-semibold text-sm mb-0.5">Incoming Voice Call</p>
          <p className="text-discord-muted text-sm mb-3">{incomingCall.callerUsername} is calling...</p>
          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              className="flex-1 bg-discord-green hover:bg-green-500 text-white text-sm font-semibold py-1.5 rounded transition-colors"
            >
              Accept
            </button>
            <button
              onClick={handleDecline}
              className="flex-1 bg-discord-red hover:bg-red-500 text-white text-sm font-semibold py-1.5 rounded transition-colors"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Floating screen share window */}
      {activeCall && activeScreenStream && (
        <div
          ref={screenContainerRef}
          className="fixed bottom-12 right-4 z-40 bg-black rounded-lg overflow-hidden shadow-2xl border border-discord-darker group cursor-pointer"
          style={{ width: 360, height: 203 }}
          onDoubleClick={toggleFullscreen}
        >
          <video
            ref={screenVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-contain"
          />
          <span className="absolute top-1.5 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
            {screenLabel}
          </span>
          <button
            onClick={toggleFullscreen}
            className="absolute top-1.5 right-2 bg-black/60 hover:bg-black/80 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Active / outgoing call bar */}
      {showCallBar && (
        <div className="fixed bottom-0 left-0 right-0 bg-discord-darker border-t border-black/30 px-4 py-2 flex items-center gap-3 z-40" style={{ paddingLeft: '276px' }}>
          <div className="flex-1 min-w-0">
            <p className="text-discord-green text-xs font-semibold leading-tight">
              {activeCall ? 'Voice Call' : 'Calling...'}
            </p>
            <p className="text-discord-muted text-xs truncate">
              {activeCall?.partnerUsername ?? outgoingCall?.partnerUsername}
            </p>
          </div>

          {activeCall && (
            <>
              <button
                onClick={toggleMute}
                className={`w-8 h-8 rounded flex items-center justify-center transition-colors
                  ${isMuted ? 'bg-discord-red text-white' : 'text-discord-muted hover:bg-discord-input hover:text-white'}`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                )}
              </button>
              <button
                onClick={() => isScreenSharing ? stopScreenShare() : startScreenShare()}
                className={`w-8 h-8 rounded flex items-center justify-center transition-colors
                  ${isScreenSharing ? 'bg-discord-green text-white' : 'text-discord-muted hover:bg-discord-input hover:text-white'}`}
                title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h6l-2 3v1h8v-1l-2-3h6c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H4V5h16v11z"/>
                </svg>
              </button>
            </>
          )}

          <button
            onClick={activeCall ? handleHangup : handleCancel}
            className="w-8 h-8 rounded bg-discord-red hover:bg-red-500 flex items-center justify-center text-white transition-colors"
            title={activeCall ? 'End Call' : 'Cancel'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08C.11 12.9 0 12.65 0 12.37c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.66c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
