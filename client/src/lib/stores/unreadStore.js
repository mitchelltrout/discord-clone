import { create } from 'zustand';

export const useUnreadStore = create((set) => ({
  channels: new Set(), // Set<string> of channelIds
  dms: new Set(),      // Set<string> of conversationIds

  markChannelUnread: (channelId) =>
    set((s) => {
      const id = String(channelId);
      if (s.channels.has(id)) return {};
      return { channels: new Set([...s.channels, id]) };
    }),

  markDMUnread: (conversationId) =>
    set((s) => {
      const id = String(conversationId);
      if (s.dms.has(id)) return {};
      return { dms: new Set([...s.dms, id]) };
    }),

  markChannelRead: (channelId) =>
    set((s) => {
      const id = String(channelId);
      if (!s.channels.has(id)) return {};
      const channels = new Set(s.channels);
      channels.delete(id);
      return { channels };
    }),

  markDMRead: (conversationId) =>
    set((s) => {
      const id = String(conversationId);
      if (!s.dms.has(id)) return {};
      const dms = new Set(s.dms);
      dms.delete(id);
      return { dms };
    }),
}));
