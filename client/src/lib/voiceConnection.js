/**
 * Module-level WebRTC connection manager.
 * Lives outside React component lifecycle so voice persists across navigation.
 */
import { getSocket } from './socket';
import { useVoiceStore } from './stores/voiceStore';
import { playJoinSelf, playLeaveSelf, playUserJoined, playUserLeft } from './sounds';

const peers = {};         // userId -> SimplePeer instance
let localStream = null;
let localScreenStream = null;
let activeChannelId = null;
let cleanupListeners = null;
let joining = false;      // prevents concurrent joinVoice calls

// Broadcast current mute/cam/screen state to others in the active channel
export function broadcastVoiceState(state) {
  const socket = getSocket();
  if (!activeChannelId || !socket) return;
  socket.emit('voice:state-update', { channelId: activeChannelId, ...state });
}

// AFK mute tracking
let isCurrentlyAfkChannel = false;  // whether the active channel is AFK
let preAfkMutedState = false;       // mute state the user had before entering AFK
let pendingMuteOnJoin = false;      // whether the next join should start muted (restoring pre-AFK state)

async function createPeer(channelId, targetUserId, initiator, stream) {
  const SimplePeer = (await import('simple-peer')).default;
  const socket = getSocket();
  const { addPeer, removePeer, setStream, setScreenStream, removeScreenStream } = useVoiceStore.getState();

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
    if (remoteStream.getVideoTracks().length > 0) {
      // Screen share stream — auto-clear when the sender stops sharing
      setScreenStream(targetUserId, remoteStream);
      remoteStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        removeScreenStream(targetUserId);
      });
    } else {
      setStream(targetUserId, remoteStream);
    }
  });

  peer.on('error', (err) => console.error('Peer error:', err));

  peer.on('close', () => {
    removePeer(targetUserId);
    delete peers[targetUserId];
  });

  peers[targetUserId] = peer;
  addPeer(targetUserId, peer);
  return peer;
}

export async function joinVoice(channelId) {
  const socket = getSocket();
  if (!socket) return;

  // Already in this channel
  if (activeChannelId === channelId) return;

  // Prevent concurrent join attempts (e.g. React StrictMode double-invoke)
  if (joining) return;
  joining = true;

  // Inline cleanup of any existing session — avoids resetting the `joining` flag
  // Capture AFK state before leaveCall() resets it
  if (isCurrentlyAfkChannel) {
    pendingMuteOnJoin = preAfkMutedState; // restore pre-AFK mute when joining next channel
    isCurrentlyAfkChannel = false;
    preAfkMutedState = false;
  }
  if (activeChannelId) {
    socket?.emit('voice:leave', { channelId: activeChannelId });
    playLeaveSelf();
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  Object.values(peers).forEach((p) => p.destroy());
  Object.keys(peers).forEach((k) => delete peers[k]);
  if (cleanupListeners) {
    cleanupListeners();
    cleanupListeners = null;
  }
  activeChannelId = null;
  useVoiceStore.getState().leaveCall();

  const { setLocalStream, setActiveChannel } = useVoiceStore.getState();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    // leaveVoice() was called while we were waiting for media — discard the stream
    if (!joining) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    localStream = stream;
    activeChannelId = channelId;
    joining = false;
    setLocalStream(stream);
    setActiveChannel(channelId);

    // Restore pre-AFK mute state when moving from AFK to another channel
    if (pendingMuteOnJoin) {
      stream.getAudioTracks().forEach((t) => { t.enabled = false; });
      useVoiceStore.getState().setMuted(true);
      pendingMuteOnJoin = false;
    }

    socket.emit('voice:join', { channelId });
    playJoinSelf();

    const onParticipants = async ({ channelId: cId, userIds, isAfk }) => {
      if (cId != channelId) return;
      // Auto-mute when joining an AFK channel
      if (isAfk) {
        const { isMuted, setMuted, setAfkChannel } = useVoiceStore.getState();
        preAfkMutedState = isMuted;
        isCurrentlyAfkChannel = true;
        setAfkChannel(true);
        if (!isMuted) {
          stream.getAudioTracks().forEach((t) => { t.enabled = false; });
          setMuted(true);
        }
      }
      // Broadcast our initial state so existing participants can show our status
      const { isMuted, isCamOn, isScreenSharing, isDeafened } = useVoiceStore.getState();
      socket.emit('voice:state-update', { channelId, isMuted: isAfk ? true : isMuted, isCamOn, isScreenSharing, isDeafened });
      for (const userId of userIds) {
        await createPeer(channelId, userId, true, stream);
      }
    };

    const onUserJoined = async ({ channelId: cId, userId }) => {
      if (cId != channelId) return;
      // Re-broadcast our state so the new joiner can see our status
      const { isMuted, isCamOn, isScreenSharing, isDeafened } = useVoiceStore.getState();
      socket.emit('voice:state-update', { channelId, isMuted, isCamOn, isScreenSharing, isDeafened });
      playUserJoined();
      await createPeer(channelId, userId, false, stream);
    };

    const onUserLeft = ({ channelId: cId, userId }) => {
      if (cId != channelId) return;
      const { removePeer, removeVoiceState } = useVoiceStore.getState();
      removePeer(userId);
      removeVoiceState(userId);
      delete peers[userId];
      playUserLeft();
    };

    const onVoiceStateUpdate = ({ userId, isMuted, isCamOn, isScreenSharing, isDeafened }) => {
      useVoiceStore.getState().setVoiceState(userId, { isMuted, isCamOn, isScreenSharing, isDeafened });
    };

    const onSignal = ({ fromUserId, signal }) => {
      const peer = peers[fromUserId];
      if (peer && !peer.destroyed) {
        peer.signal(signal);
      }
    };

    socket.on('voice:participants', onParticipants);
    socket.on('voice:user-joined', onUserJoined);
    socket.on('voice:user-left', onUserLeft);
    socket.on('voice:signal', onSignal);
    socket.on('voice:state-update', onVoiceStateUpdate);

    cleanupListeners = () => {
      socket.off('voice:participants', onParticipants);
      socket.off('voice:user-joined', onUserJoined);
      socket.off('voice:user-left', onUserLeft);
      socket.off('voice:signal', onSignal);
      socket.off('voice:state-update', onVoiceStateUpdate);
    };
  } catch (err) {
    joining = false;
    console.error('Failed to get media:', err);
  }
}

export function leaveVoice() {
  joining = false; // cancel any in-progress join before media is acquired
  // Reset AFK state — user is fully leaving voice, don't carry mute state forward
  isCurrentlyAfkChannel = false;
  preAfkMutedState = false;
  pendingMuteOnJoin = false;
  const socket = getSocket();
  if (activeChannelId) {
    socket?.emit('voice:leave', { channelId: activeChannelId });
    playLeaveSelf();
  }

  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }

  if (localScreenStream) {
    localScreenStream.getTracks().forEach((t) => t.stop());
    localScreenStream = null;
  }

  Object.values(peers).forEach((p) => p.destroy());
  Object.keys(peers).forEach((k) => delete peers[k]);

  if (cleanupListeners) {
    cleanupListeners();
    cleanupListeners = null;
  }

  activeChannelId = null;
  useVoiceStore.getState().leaveCall();
}

export async function startScreenShare() {
  if (!activeChannelId) return;
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    localScreenStream = screenStream;
    const videoTrack = screenStream.getVideoTracks()[0];

    // Push the screen video track into every existing peer connection
    Object.values(peers).forEach((peer) => {
      peer.addTrack(videoTrack, screenStream);
    });

    useVoiceStore.getState().setLocalScreenStream(screenStream);
    useVoiceStore.getState().setScreenSharing(true);
    const { isMuted, isCamOn, isDeafened } = useVoiceStore.getState();
    broadcastVoiceState({ isMuted, isCamOn, isScreenSharing: true, isDeafened });

    // When user clicks "Stop sharing" in the browser UI, clean up
    videoTrack.addEventListener('ended', () => stopScreenShare());
  } catch (err) {
    console.error('Screen share failed:', err);
  }
}

export function stopScreenShare() {
  if (!localScreenStream) return;
  const videoTrack = localScreenStream.getVideoTracks()[0];

  // Remove the sender from each peer connection
  Object.values(peers).forEach((peer) => {
    if (!peer._pc) return;
    const sender = peer._pc.getSenders().find((s) => s.track === videoTrack);
    if (sender) peer._pc.removeTrack(sender);
  });

  localScreenStream.getTracks().forEach((t) => t.stop());
  localScreenStream = null;
  useVoiceStore.getState().setLocalScreenStream(null);
  useVoiceStore.getState().setScreenSharing(false);
  const { isMuted, isCamOn, isDeafened } = useVoiceStore.getState();
  broadcastVoiceState({ isMuted, isCamOn, isScreenSharing: false, isDeafened });
}
