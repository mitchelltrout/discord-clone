import { create } from 'zustand';

export const useConnectionStore = create((set) => ({
  status: 'connected', // 'connected' | 'reconnecting' | 'failed'
  setStatus: (status) => set({ status }),
}));
