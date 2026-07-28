'use client';
import { useEffect, useRef, useCallback } from 'react';
import { useVoiceStore } from '../../lib/stores/voiceStore';
import { getSocket } from '../../lib/socket';

export default function useWebRTC(channelId) {
  const {
    setLocalStream,
    addPeer,
    removePeer,
    setStream,
    setActiveChannel,
    leaveCall,
    localStream,
  } = useVoiceStore();

  const peersRef = useRef({});
  const localStreamRef = useRef(null);

  const createPeer = useCallback(async (targetUserId, initiator, stream) => {
    // Dynamic import to avoid SSR issues
    const SimplePeer = (await import('simple-peer')).default;
    const socket = getSocket();

    const peer = new SimplePeer({
      initiator,
      stream,
      trickle: true,
      config: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      },
    });

    peer.on('signal', (signal) => {
      socket?.emit('voice:signal', { channelId, targetUserId, signal });
    });

    peer.on('stream', (remoteStream) => {
      setStream(targetUserId, remoteStream);
    });

    peer.on('error', (err) => console.error('Peer error:', err));

    peer.on('close', () => {
      removePeer(targetUserId);
      delete peersRef.current[targetUserId];
    });

    peersRef.current[targetUserId] = peer;
    addPeer(targetUserId, peer);
    return peer;
  }, [channelId]);

  const joinCall = useCallback(async () => {
    const socket = getSocket();
    if (!socket) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setActiveChannel(channelId);

      socket.emit('voice:join', { channelId });

      // When we get existing participants list, initiate connections to each
      const onParticipants = async ({ channelId: cId, userIds }) => {
        if (cId != channelId) return;
        for (const userId of userIds) {
          await createPeer(userId, true, stream);
        }
      };

      // When a new user joins, they initiate — we respond
      const onUserJoined = async ({ channelId: cId, userId }) => {
        if (cId != channelId) return;
        await createPeer(userId, false, stream);
      };

      const onUserLeft = ({ channelId: cId, userId }) => {
        if (cId != channelId) return;
        removePeer(userId);
        delete peersRef.current[userId];
      };

      const onSignal = ({ fromUserId, signal }) => {
        const peer = peersRef.current[fromUserId];
        if (peer && !peer.destroyed) {
          peer.signal(signal);
        }
      };

      socket.on('voice:participants', onParticipants);
      socket.on('voice:user-joined', onUserJoined);
      socket.on('voice:user-left', onUserLeft);
      socket.on('voice:signal', onSignal);

      return () => {
        socket.off('voice:participants', onParticipants);
        socket.off('voice:user-joined', onUserJoined);
        socket.off('voice:user-left', onUserLeft);
        socket.off('voice:signal', onSignal);
      };
    } catch (err) {
      console.error('Failed to get media:', err);
    }
  }, [channelId, createPeer]);

  const leave = useCallback(() => {
    const socket = getSocket();
    socket?.emit('voice:leave', { channelId });

    // Cleanup local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }

    // Destroy all peers
    Object.values(peersRef.current).forEach((p) => p.destroy());
    peersRef.current = {};

    leaveCall();
  }, [channelId]);

  return { joinCall, leave };
}
