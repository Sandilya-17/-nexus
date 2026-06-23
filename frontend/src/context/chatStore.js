import { create } from 'zustand';

const useChatStore = create((set, get) => ({
  chats: [],
  activeChat: null,
  messages: {},          // { chatId: Message[] }
  typingUsers: {},       // { chatId: User[] }
  hasMore: {},           // { chatId: boolean }
  isLoading: false,

  setChats: (chats) => set({ chats }),

  updateChat: (chatId, updates) => set(state => ({
    chats: state.chats.map(c => c._id === chatId ? { ...c, ...updates } : c),
    activeChat: state.activeChat?._id === chatId ? { ...state.activeChat, ...updates } : state.activeChat,
  })),

  addChat: (chat) => set(state => {
    const exists = state.chats.some(c => c._id === chat._id);
    if (exists) return state;
    return { chats: [chat, ...state.chats] };
  }),

  setActiveChat: (chat) => set({ activeChat: chat }),

  // Messages
  setMessages: (chatId, messages) => set(state => ({
    messages: { ...state.messages, [chatId]: messages },
  })),

  prependMessages: (chatId, messages) => set(state => ({
    messages: { ...state.messages, [chatId]: [...messages, ...(state.messages[chatId] || [])] },
  })),

  addMessage: (chatId, message) => set(state => {
    const existing = state.messages[chatId] || [];
    const isDupe = existing.some(m => m._id === message._id);
    if (isDupe) return state;
    return {
      messages: { ...state.messages, [chatId]: [...existing, message] },
      chats: state.chats.map(c =>
        c._id === chatId
          ? { ...c, lastMessage: message, lastActivity: message.createdAt, unreadCount: c._id === state.activeChat?._id ? 0 : (c.unreadCount || 0) + 1 }
          : c
      ).sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)),
    };
  }),

  updateMessage: (chatId, messageId, updates) => set(state => ({
    messages: {
      ...state.messages,
      [chatId]: (state.messages[chatId] || []).map(m => m._id === messageId ? { ...m, ...updates } : m),
    },
  })),

  deleteMessage: (chatId, messageId) => set(state => ({
    messages: {
      ...state.messages,
      [chatId]: (state.messages[chatId] || []).map(m =>
        m._id === messageId ? { ...m, isDeletedForEveryone: true, content: null, mediaUrl: null } : m
      ),
    },
  })),

  clearUnread: (chatId) => set(state => ({
    chats: state.chats.map(c => c._id === chatId ? { ...c, unreadCount: 0 } : c),
  })),

  setHasMore: (chatId, hasMore) => set(state => ({ hasMore: { ...state.hasMore, [chatId]: hasMore } })),

  // Typing
  setTyping: (chatId, user, isTyping) => set(state => {
    const current = state.typingUsers[chatId] || [];
    let updated;
    if (isTyping) {
      const exists = current.some(u => u._id === user._id);
      updated = exists ? current : [...current, user];
    } else {
      updated = current.filter(u => u._id !== user._id);
    }
    return { typingUsers: { ...state.typingUsers, [chatId]: updated } };
  }),

  setLoading: (isLoading) => set({ isLoading }),
}));

export default useChatStore;
