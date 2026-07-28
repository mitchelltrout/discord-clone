'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useVoiceStore } from '../../lib/stores/voiceStore';
import { useAuthStore } from '../../lib/stores/authStore';
import { useServerStore } from '../../lib/stores/serverStore';
import { joinVoice, leaveVoice } from '../../lib/voiceConnection';
import VoiceParticipant from './VoiceParticipant';
import VoiceControls from './VoiceControls';

export default function VoiceChannelView({ channelId, channelName, serverId }) {
  const router = useRouter();
  const { activeChannelId, streams, screenStreams, localStream, localScreenStream, isMuted, isCamOn, isScreenSharing } = useVoiceStore();
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
  const user = useAuthStore((s) => s.user);
  const members = useServerStore((s) => s.members[serverId] || []);
  const serverChannels = useServerStore((s) => s.channels[serverId] || []);

  function handleLeave() {
    leaveVoice();
    const firstText = serverChannels.find((c) => c.type === 'text');
    if (firstText) {
      router.push(`/channels/${serverId}/${firstText.id}`);
    } else {
      router.push(`/channels/${serverId}`);
    }
  }

  const isInThisChannel = activeChannelId == channelId;
  const peerUserIds = Object.keys(streams).map(Number);

  // Active screen share: local takes priority, then first remote sharer
  const remoteScreenEntry = Object.entries(screenStreams)[0];
  const activeScreenStream = localScreenStream || remoteScreenEntry?.[1] || null;
  const activeScreenLabel = localScreenStream
    ? 'You'
    : remoteScreenEntry
      ? (getMember(Number(remoteScreenEntry[0]))?.username ?? `User ${remoteScreenEntry[0]}`)
      : null;

  useEffect(() => {
    if (screenVideoRef.current && activeScreenStream) {
      screenVideoRef.current.srcObject = activeScreenStream;
    }
  }, [activeScreenStream]);

  useEffect(() => {
    if (!isInThisChannel) {
      joinVoice(channelId);
    }
  }, [channelId]);

  function getMember(userId) {
    return members.find((m) => m.id === userId);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-12 px-4 flex items-center border-b border-discord-darker/50 shrink-0 shadow">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-discord-muted mr-2">
          <path d="M12 2c-4.411 0-8 3.589-8 8v7c0 1.657 1.343 3 3 3h1v-8H6v-2c0-3.309 2.691-6 6-6s6 2.691 6 6v2h-2v8h1c1.657 0 3-1.343 3-3v-7c0-4.411-3.589-8-8-8z" />
        </svg>
        <span className="text-white font-semibold">{channelName}</span>
      </div>

      {/* Screen share display */}
      {activeScreenStream && (
        <div
          ref={screenContainerRef}
          className="relative bg-black shrink-0 group cursor-pointer"
          style={{ height: '60%' }}
          onDoubleClick={toggleFullscreen}
        >
          <video
            ref={screenVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-contain"
          />
          <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
            {activeScreenLabel} is presenting
          </span>
          <button
            onClick={toggleFullscreen}
            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
              </svg>
            )}
          </button>
        </div>
      )}

      <div className={`flex flex-wrap content-start gap-4 justify-center p-6 overflow-y-auto ${activeScreenStream ? 'flex-1' : 'flex-1'}`}>
        {/* Local user */}
        <VoiceParticipant
          userId={user?.id}
          username={user?.username}
          avatarUrl={user?.avatar_url}
          stream={localStream}
          isMuted={isMuted}
          isCamOn={isCamOn}
          isLocal
        />

        {/* Remote peers */}
        {peerUserIds.map((uid) => {
          const member = getMember(uid);
          return (
            <VoiceParticipant
              key={uid}
              userId={uid}
              username={member?.username || `User ${uid}`}
              avatarUrl={member?.avatar_url}
              stream={streams[uid]}
              isMuted={false}
              isCamOn={false}
            />
          );
        })}

        {/* Controls pinned to bottom */}
        <div className="w-full flex justify-center mt-auto pt-4">
          <VoiceControls channelId={channelId} onLeave={handleLeave} />
        </div>
      </div>
    </div>
  );
}
