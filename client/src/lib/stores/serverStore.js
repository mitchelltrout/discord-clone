import { create } from 'zustand';

const ORDER_KEY = 'server_order';

function applyOrder(servers) {
  try {
    const order = JSON.parse(localStorage.getItem(ORDER_KEY) || '[]');
    if (!order.length) return servers;
    return [
      ...order.map((id) => servers.find((s) => s.id === id)).filter(Boolean),
      ...servers.filter((s) => !order.includes(s.id)),
    ];
  } catch {
    return servers;
  }
}

function saveOrder(servers) {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(servers.map((s) => s.id)));
  } catch {}
}

export const useServerStore = create((set, get) => ({
  servers: [],
  activeServerId: null,
  channels: {},   // { [serverId]: Channel[] }
  members: {},    // { [serverId]: Member[] }

  setServers: (servers) => set({ servers: applyOrder(servers) }),

  reorderServers: (fromIndex, toIndex) =>
    set((s) => {
      const list = [...s.servers];
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);
      saveOrder(list);
      return { servers: list };
    }),

  addServer: (server) =>
    set((s) => ({ servers: [...s.servers, server] })),

  removeServer: (serverId) =>
    set((s) => ({
      servers: s.servers.filter((sv) => sv.id !== serverId),
      activeServerId: s.activeServerId === serverId ? null : s.activeServerId,
    })),

  setActiveServer: (serverId) => set({ activeServerId: serverId }),

  setServerData: (serverId, channels, members) =>
    set((s) => ({
      channels: { ...s.channels, [serverId]: channels },
      members: { ...s.members, [serverId]: members },
    })),

  addChannel: (serverId, channel) =>
    set((s) => ({
      channels: {
        ...s.channels,
        [serverId]: [...(s.channels[serverId] || []), channel],
      },
    })),

  removeChannel: (serverId, channelId) =>
    set((s) => ({
      channels: {
        ...s.channels,
        [serverId]: (s.channels[serverId] || []).filter((c) => c.id !== channelId),
      },
    })),

  updateServer: (serverId, patch) =>
    set((s) => ({
      servers: s.servers.map((sv) => sv.id === serverId ? { ...sv, ...patch } : sv),
    })),

  updateChannel: (serverId, channelId, patch) =>
    set((s) => ({
      channels: {
        ...s.channels,
        [serverId]: (s.channels[serverId] || []).map((c) =>
          c.id === channelId ? { ...c, ...patch } : c
        ),
      },
    })),

  updateMemberStatus: (userId, status, statusMessage) =>
    set((s) => {
      const newMembers = {};
      Object.keys(s.members).forEach((sid) => {
        newMembers[sid] = s.members[sid].map((m) =>
          m.id === userId ? { ...m, status, ...(statusMessage !== undefined && { status_message: statusMessage }) } : m
        );
      });
      return { members: newMembers };
    }),

  addMember: (serverId, member) =>
    set((s) => {
      const existing = s.members[serverId] || [];
      if (existing.some((m) => m.id === member.id)) return {}; // already present
      return { members: { ...s.members, [serverId]: [...existing, member] } };
    }),

  removeMember: (serverId, userId) =>
    set((s) => ({
      members: {
        ...s.members,
        [serverId]: (s.members[serverId] || []).filter((m) => m.id !== userId),
      },
    })),
}));
