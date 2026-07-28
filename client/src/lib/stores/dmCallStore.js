import { create } from 'zustand';

export const useDMCallStore = create((set) => ({
  incomingCall: null,  // { conversationId, callerId, callerUsername }
  outgoingCall: null,  // { conversationId, partnerUsername }
  activeCall: null,    // { conversationId, partnerUsername }

  setIncomingCall: (call) => set({ incomingCall: call }),
  clearIncomingCall: () => set({ incomingCall: null }),

  setOutgoingCall: (call) => set({ outgoingCall: call }),
  clearOutgoingCall: () => set({ outgoingCall: null }),

  setActiveCall: (call) => set({ activeCall: call }),
  clearActiveCall: () => set({ activeCall: null }),

  endAllCalls: () => set({ incomingCall: null, outgoingCall: null, activeCall: null }),
}));
