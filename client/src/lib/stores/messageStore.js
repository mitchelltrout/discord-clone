import { create } from 'zustand';

export const useMessageStore = create((set) => ({
  // { [channelId]: Message[] }
  messages: {},

  setMessages: (channelId, messages) =>
    set((s) => ({ messages: { ...s.messages, [channelId]: messages } })),

  prependMessages: (channelId, older) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: [...older, ...(s.messages[channelId] || [])],
      },
    })),

  addMessage: (channelId, message) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: [...(s.messages[channelId] || []), message],
      },
    })),

  deleteMessage: (channelId, messageId) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: (s.messages[channelId] || []).filter((m) => m.id !== messageId),
      },
    })),

  updateMessageReactions: (channelId, messageId, reactions) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: (s.messages[channelId] || []).map((m) =>
          m.id === messageId ? { ...m, reactions } : m
        ),
      },
    })),

  updateMessagePoll: (channelId, messageId, pollUpdate) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: (s.messages[channelId] || []).map((m) =>
          m.id === messageId ? { ...m, poll: { ...m.poll, ...pollUpdate } } : m
        ),
      },
    })),

  updateMessage: (channelId, message) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: (s.messages[channelId] || []).map((m) => {
          if (m.id !== message.id) return m;
          // Preserve my_votes when a message update arrives with empty my_votes
          if (m.poll && message.poll && message.poll.my_votes.length === 0) {
            return { ...message, poll: { ...message.poll, my_votes: m.poll.my_votes } };
          }
          return message;
        }),
      },
    })),
}));
