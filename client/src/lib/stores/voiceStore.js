import { create } from 'zustand';

export const useVoiceStore = create((set) => ({
  activeChannelId: null,
  peers: {},          // { [userId]: SimplePeer instance }
  streams: {},        // { [userId]: MediaStream }
  screenStreams: {},  // { [userId]: MediaStream } — remote screen shares
  localStream: null,
  localScreenStream: null,
  isMuted: false,
  isCamOn: false,
  isDeafened: false,
  isScreenSharing: false,
  isAfkChannel: false,
  voiceParticipants: {}, // { [channelId]: { id, username, avatar_url }[] }
  voiceStates: {},       // { [userId]: { isMuted, isCamOn, isScreenSharing } }

  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),

  setLocalStream: (stream) => set({ localStream: stream }),

  addPeer: (userId, peer) =>
    set((s) => ({ peers: { ...s.peers, [userId]: peer } })),

  removePeer: (userId) =>
    set((s) => {
      const peers = { ...s.peers };
      const streams = { ...s.streams };
      if (peers[userId]) {
        peers[userId].destroy();
        delete peers[userId];
      }
      delete streams[userId];
      return { peers, streams };
    }),

  setStream: (userId, stream) =>
    set((s) => ({ streams: { ...s.streams, [userId]: stream } })),

  setVoiceRoom: (channelId, users) =>
    set((s) => ({ voiceParticipants: { ...s.voiceParticipants, [channelId]: users } })),

  setVoiceState: (userId, state) =>
    set((s) => ({ voiceStates: { ...s.voiceStates, [userId]: { ...(s.voiceStates[userId] || {}), ...state } } })),

  removeVoiceState: (userId) =>
    set((s) => {
      const voiceStates = { ...s.voiceStates };
      delete voiceStates[userId];
      return { voiceStates };
    }),

  setScreenStream: (userId, stream) =>
    set((s) => ({ screenStreams: { ...s.screenStreams, [userId]: stream } })),

  removeScreenStream: (userId) =>
    set((s) => {
      const screenStreams = { ...s.screenStreams };
      delete screenStreams[userId];
      return { screenStreams };
    }),

  setLocalScreenStream: (stream) => set({ localScreenStream: stream }),
  setScreenSharing: (isScreenSharing) => set({ isScreenSharing }),

  setMuted: (isMuted) => set({ isMuted }),
  setCamOn: (isCamOn) => set({ isCamOn }),
  setDeafened: (isDeafened) => set({ isDeafened }),
  setAfkChannel: (isAfkChannel) => set({ isAfkChannel }),

  leaveCall: () =>
    set((s) => {
      Object.values(s.peers).forEach((p) => p.destroy());
      if (s.localStream) s.localStream.getTracks().forEach((t) => t.stop());
      if (s.localScreenStream) s.localScreenStream.getTracks().forEach((t) => t.stop());
      return {
        activeChannelId: null,
        peers: {},
        streams: {},
        screenStreams: {},
        localStream: null,
        localScreenStream: null,
        isMuted: false,
        isCamOn: false,
        isDeafened: false,
        isScreenSharing: false,
        isAfkChannel: false,
        voiceStates: {},
      };
    }),
}));
