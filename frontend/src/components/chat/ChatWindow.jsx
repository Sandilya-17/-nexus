import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Phone, Video, MoreVertical, Search,
  Star, Archive, Bell, BellOff, Trash2, Info, Pin
} from 'lucide-react';
import useChatStore from '../../context/chatStore';
import useAuthStore from '../../context/authStore';
import useCallStore from '../../context/callStore';
import api from '../../services/api';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import Avatar from '../ui/Avatar';
import { getSocket } from '../../services/socket';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export default function ChatWindow() {
  const { activeChat, messages, setMessages, typingUsers, clearUnread, setHasMore, hasMore } = useChatStore();
  const { user } = useAuthStore();
  const { setActiveCall } = useCallStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  const chatId = activeChat?._id;
  const chatMessages = messages[chatId] || [];
  const typing = typingUsers[chatId] || [];

  const getOtherParticipant = () => {
    if (activeChat?.type !== 'direct') return null;
    return activeChat.participants?.find(p => (p._id || p) !== user?._id);
  };

  const chatName = activeChat?.type === 'direct'
    ? getOtherParticipant()?.name || 'Unknown'
    : activeChat?.name;

  const chatAvatar = activeChat?.type === 'direct'
    ? getOtherParticipant()?.avatar
    : activeChat?.avatar;

  const isOnline = activeChat?.type === 'direct' ? getOtherParticipant()?.isOnline : false;
  const memberCount = activeChat?.members?.length;

  const fetchMessages = useCallback(async (before = null) => {
    if (!chatId) return;
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (before) params.before = before;
      const { data } = await api.get(`/messages/${chatId}`, { params });
      if (before) {
        useChatStore.getState().prependMessages(chatId, data.messages);
      } else {
        setMessages(chatId, data.messages);
      }
      setHasMore(chatId, data.hasMore);
    } catch (e) {
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    if (chatId) {
      fetchMessages();
      clearUnread(chatId);
    }
  }, [chatId]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initiateCall = async (type) => {
    try {
      const other = getOtherParticipant();
      if (!other) return toast.error('Cannot call a group directly from here');
      const { data } = await api.post('/calls/initiate', {
        chatId,
        type,
        participants: [other._id || other],
      });
      // This is the fix: without setActiveCall here, the ActiveCallOverlay
      // never mounts on the caller's side, so getUserMedia/RTCPeerConnection
      // never run and no WebRTC offer is ever sent — the call silently goes
      // nowhere even though the receiver gets the incoming-call popup.
      setActiveCall({ ...data.call, roomId: data.roomId, isInitiator: true });
      navigate(`/calls?callId=${data.call._id}`);
    } catch (e) {
      toast.error('Failed to start call');
    }
  };

  const handleArchive = async () => {
    try {
      await api.put(`/chats/${chatId}/archive`, { archived: true });
      toast.success('Chat archived');
      navigate('/chats');
    } catch (e) { toast.error('Failed to archive'); }
  };

  const handleClearChat = async () => {
    if (!window.confirm('Clear all messages for you?')) return;
    try {
      await api.delete(`/chats/${chatId}/clear`);
      setMessages(chatId, []);
      toast.success('Chat cleared');
    } catch (e) { toast.error('Failed to clear'); }
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-sidebar)] shrink-0">
        {/* Back btn (mobile) */}
        <button
          onClick={() => { navigate('/chats'); useChatStore.getState().setActiveChat(null); }}
          className="md:hidden btn-ghost p-1.5 -ml-1"
        >
          <ArrowLeft size={20} />
        </button>

        <Avatar src={chatAvatar} name={chatName} size={40} online={activeChat?.type === 'direct' ? isOnline : undefined} />

        <div className="flex-1 min-w-0">
          <h2 className="font-medium text-[15px] truncate" style={{ color: 'var(--text-1)' }}>{chatName}</h2>
          <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>
            {typing.length > 0
              ? <span style={{ color: 'var(--accent-bright)' }}>{typing.map(u => u.name).join(', ')} typing...</span>
              : activeChat?.type === 'direct'
                ? isOnline ? 'online' : 'offline'
                : `${memberCount} members`}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {activeChat?.type === 'direct' && (
            <>
              <button onClick={() => initiateCall('audio')} className="btn-ghost p-2" title="Voice call">
                <Phone size={19} />
              </button>
              <button onClick={() => initiateCall('video')} className="btn-ghost p-2" title="Video call">
                <Video size={19} />
              </button>
            </>
          )}
          <div className="relative" ref={menuRef}>
            <button onClick={() => setShowMenu(!showMenu)} className="btn-ghost p-2">
              <MoreVertical size={19} />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 card shadow-xl z-50 py-1 animate-fade-in">
                {[
                  { icon: Search, label: 'Search Messages', action: () => {} },
                  { icon: Pin, label: 'Pinned Messages', action: () => {} },
                  { icon: Star, label: 'Starred Messages', action: () => {} },
                  { icon: Archive, label: 'Archive Chat', action: handleArchive },
                  { icon: Trash2, label: 'Clear Chat', action: handleClearChat, danger: true },
                ].map(({ icon: Icon, label, action, danger }) => (
                  <button
                    key={label}
                    onClick={() => { action(); setShowMenu(false); }}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                      danger ? 'text-red-400 hover:bg-red-500/10' : 'hover:bg-[var(--bg-hover)]'
                    )}
                  >
                    <Icon size={15} /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <MessageList
        messages={chatMessages}
        loading={loading}
        hasMore={hasMore[chatId]}
        onLoadMore={() => {
          const first = chatMessages[0];
          if (first) fetchMessages(first.createdAt);
        }}
      />

      {/* Input */}
      <MessageInput chatId={chatId} />
    </div>
  );
}
