'use client';
import { useEffect, useRef } from 'react';
import Avatar from '../ui/Avatar';

export default function VoiceParticipant({ userId, username, avatarUrl, stream, isMuted, isCamOn, isLocal }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="flex flex-col items-center gap-2 w-48">
      <div className="relative w-48 h-36 bg-discord-darker rounded-xl overflow-hidden flex items-center justify-center">
        {stream && isCamOn ? (
          <video
            ref={videoRef}
            autoPlay
            muted={isLocal}
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <Avatar username={username} avatarUrl={avatarUrl} size={72} />
        )}

        {/* Mute indicator */}
        {isMuted && (
          <div className="absolute bottom-2 right-2 bg-discord-red rounded-full p-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
              <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
            </svg>
          </div>
        )}
      </div>
      <span className="text-discord-text text-sm font-medium">{username}</span>
    </div>
  );
}
