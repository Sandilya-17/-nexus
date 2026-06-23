import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { onSocketReady } from '../services/socket';
import useChatStore from '../context/chatStore';
import useCallStore from '../context/callStore';
import useAuthStore from '../context/authStore';

export default function useSocketEvents() {
  const { addMessage, updateMessage, deleteMessage, setTyping, addChat, updateChat } = useChatStore();
  const { setIncomingCall } = useCallStore();
  const { updateUser } = useAuthStore();

  useEffect(() => {
    // onSocketReady fires immediately with whatever socket exists right now,
    // AND again any time a new socket is created later (e.g. App.jsx's
    // initSocket() effect running on a later tick than this one, or after a
    // fresh login). This guarantees listeners always get attached, even if
    // this effect mounts before the socket connection exists yet — which was
    // the root cause of messages/typing/calls never updating live.
    let cleanupPrev = null;

    const unsubscribe = onSocketReady((socket) => {
      if (cleanupPrev) { cleanupPrev(); cleanupPrev = null; }
      if (!socket) return;
      cleanupPrev = bindEvents(socket);
    });

    function bindEvents(socket) {

    const onNewMessage = ({ message, chatId }) => {
      addMessage(chatId, message);
      const activeChat = useChatStore.getState().activeChat;
      if (activeChat?._id !== chatId && document.hidden) {
        new Notification(message.sender?.name || 'Nexus', {
          body: message.type === 'text' ? message.content : `Sent a ${message.type}`,
          icon: message.sender?.avatar || '/pwa-192x192.png',
          tag: chatId,
        });
      }
    };

    const onMessageEdited = ({ messageId, content, editedAt }) => {
      const { activeChat } = useChatStore.getState();
      if (activeChat) updateMessage(activeChat._id, messageId, { content, isEdited: true, editedAt });
    };

    const onMessageDeleted = ({ messageId, deletedForEveryone }) => {
      const { activeChat } = useChatStore.getState();
      if (activeChat && deletedForEveryone) deleteMessage(activeChat._id, messageId);
    };

    const onMessageReaction = ({ messageId, reactions }) => {
      const { activeChat } = useChatStore.getState();
      if (activeChat) updateMessage(activeChat._id, messageId, { reactions });
    };

    const onPollUpdated = ({ messageId, poll }) => {
      const { activeChat } = useChatStore.getState();
      if (activeChat) updateMessage(activeChat._id, messageId, { poll });
    };

    const onTypingStart = ({ chatId, user }) => setTyping(chatId, user, true);
    const onTypingStop = ({ chatId, userId }) => {
      const { typingUsers } = useChatStore.getState();
      const user = typingUsers[chatId]?.find(u => u._id === userId);
      if (user) setTyping(chatId, user, false);
    };

    const onNewChat = ({ chat }) => addChat(chat);
    const onChatPinned = ({ chatId, messageId, pinned }) => updateChat(chatId, { pinnedMessages: pinned });

    const onUserOnline = ({ userId, isOnline, lastSeen }) => {
      const { chats } = useChatStore.getState();
      chats.forEach(chat => {
        if (chat.type === 'direct') {
          const other = chat.participants?.find(p => (p._id || p) === userId);
          if (other) updateChat(chat._id, {
            participants: chat.participants.map(p =>
              (p._id || p) === userId ? { ...p, isOnline, lastSeen } : p
            )
          });
        }
      });
    };

    const onIncomingCall = (data) => {
      setIncomingCall(data);
      toast(`📞 ${data.from?.name} is calling (${data.type})`, { duration: 30000 });
    };

    const onGroupUpdated = ({ groupId, ...updates }) => updateChat(groupId, updates);
    const onGroupRemoved = ({ groupId }) => {
      useChatStore.getState().setChats(
        useChatStore.getState().chats.filter(c => c._id !== groupId)
      );
    };

    socket.on('message:new', onNewMessage);
    socket.on('message:edited', onMessageEdited);
    socket.on('message:deleted', onMessageDeleted);
    socket.on('message:reaction', onMessageReaction);
    socket.on('message:poll-updated', onPollUpdated);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('chat:new', onNewChat);
    socket.on('chat:pinned', onChatPinned);
    socket.on('user:online', onUserOnline);
    socket.on('call:incoming', onIncomingCall);
    socket.on('group:updated', onGroupUpdated);
    socket.on('group:removed', onGroupRemoved);

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('message:edited', onMessageEdited);
      socket.off('message:deleted', onMessageDeleted);
      socket.off('message:reaction', onMessageReaction);
      socket.off('message:poll-updated', onPollUpdated);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('chat:new', onNewChat);
      socket.off('chat:pinned', onChatPinned);
      socket.off('user:online', onUserOnline);
      socket.off('call:incoming', onIncomingCall);
      socket.off('group:updated', onGroupUpdated);
      socket.off('group:removed', onGroupRemoved);
    };
    } // end bindEvents

    return () => {
      unsubscribe();
      if (cleanupPrev) cleanupPrev();
    };
  }, []);
}
