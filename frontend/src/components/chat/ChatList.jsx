import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Users, Filter, Archive } from 'lucide-react';
import useChatStore from '../../context/chatStore';
import useAuthStore from '../../context/authStore';
import Avatar from '../ui/Avatar';
import NewChatModal from './NewChatModal';
import NewGroupModal from './NewGroupModal';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

export default function ChatList({ loading }) {
  const { chats, activeChat } = useChatStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, unread, groups, archived
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const getOtherParticipant = (chat) => {
    if (chat.type !== 'direct') return null;
    return chat.participants?.find(p => (p._id || p) !== user?._id);
  };

  const getChatName = (chat) => {
    if (chat.type === 'direct') return getOtherParticipant(chat)?.name || 'Unknown';
    return chat.name;
  };

  const getChatAvatar = (chat) => {
    if (chat.type === 'direct') return getOtherParticipant(chat)?.avatar;
    return chat.avatar;
  };

  const isOnline = (chat) => {
    if (chat.type === 'direct') return getOtherParticipant(chat)?.isOnline;
    return false;
  };

  const getLastMessagePreview = (chat) => {
    const msg = chat.lastMessage;
    if (!msg) return 'No messages yet';
    if (msg.isDeletedForEveryone) return '🚫 Message deleted';
    const prefix = msg.sender?._id === user?._id ? 'You: ' : '';
    switch (msg.type) {
      case 'image': return `${prefix}📷 Photo`;
      case 'video': return `${prefix}🎥 Video`;
      case 'audio': return `${prefix}🎵 Audio`;
      case 'voice': return `${prefix}🎤 Voice message`;
      case 'file': return `${prefix}📎 ${msg.mediaName || 'File'}`;
      case 'location': return `${prefix}📍 Location`;
      case 'poll': return `${prefix}📊 Poll: ${msg.poll?.question}`;
      case 'system': return msg.content;
      default: return `${prefix}${msg.content || ''}`;
    }
  };

  const filteredChats = chats
    .filter(chat => {
      const name = getChatName(chat).toLowerCase();
      if (search && !name.includes(search.toLowerCase())) return false;
      const userSetting = chat.userSettings?.find(s => s.user === user?._id);
      switch (filter) {
        case 'unread': return (chat.unreadCount || 0) > 0;
        case 'groups': return ['group', 'channel'].includes(chat.type);
        case 'archived': return userSetting?.archived;
        default: return !userSetting?.archived;
      }
    });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3" style={{ background: 'var(--bg-sidebar)' }}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Chats</h1>
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="w-10 h-10 flex items-center justify-center rounded-full text-white transition-colors"
              style={{ background: 'var(--accent)' }}
            >
              <Plus size={20} />
            </button>
            {showActions && (
              <div className="absolute right-0 top-12 w-48 card shadow-xl z-50 py-1 animate-fade-in">
                <button onClick={() => { setShowNewChat(true); setShowActions(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-hover)] text-sm transition-colors">
                  <Plus size={16} /> New Chat
                </button>
                <button onClick={() => { setShowNewGroup(true); setShowActions(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-hover)] text-sm transition-colors">
                  <Users size={16} /> New Group
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-2)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm rounded-full px-9 py-2.5 transition-all duration-200
                       focus:outline-none focus:ring-1"
            style={{
              background: 'var(--bg-input)',
              color: 'var(--text-1)',
            }}
            placeholder="Search or start a new chat"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-3 overflow-x-auto hide-scrollbar">
          {['all', 'unread', 'groups', 'archived'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'px-3.5 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-all',
                filter === f
                  ? 'text-white'
                  : 'text-[var(--text-2)] hover:bg-[var(--bg-hover)]'
              )}
              style={filter === f ? { background: 'var(--accent)' } : { background: 'var(--bg-card)' }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
              <div className="w-12 h-12 rounded-full bg-[var(--bg-hover)]" />
              <div className="flex-1">
                <div className="h-4 bg-[var(--bg-hover)] rounded w-3/4 mb-2" />
                <div className="h-3 bg-[var(--bg-hover)] rounded w-1/2" />
              </div>
            </div>
          ))
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48" style={{ color: 'var(--text-2)' }}>
            <p className="text-sm">{search ? 'No chats found' : 'No conversations yet'}</p>
            {!search && (
              <button onClick={() => setShowNewChat(true)} className="mt-3 text-sm hover:underline" style={{ color: 'var(--accent-bright)' }}>
                Start a new chat
              </button>
            )}
          </div>
        ) : (
          filteredChats.map(chat => {
            const name = getChatName(chat);
            const avatar = getChatAvatar(chat);
            const online = isOnline(chat);
            const unread = chat.unreadCount || 0;
            const isActive = activeChat?._id === chat._id;
            const lastMsg = chat.lastMessage;
            const time = lastMsg?.createdAt
              ? formatDistanceToNow(new Date(lastMsg.createdAt), { addSuffix: false })
              : '';

            return (
              <div
                key={chat._id}
                onClick={() => navigate(`/chats/${chat._id}`)}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-150',
                  isActive ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]'
                )}
              >
                <Avatar src={avatar} name={name} size={49} online={chat.type === 'direct' ? online : undefined} />

                <div className="flex-1 min-w-0 border-b border-[var(--border)] pb-3 -mb-3 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[15px] truncate" style={{ color: 'var(--text-1)' }}>{name}</span>
                    <span className="text-xs shrink-0" style={{ color: unread > 0 ? 'var(--accent-bright)' : 'var(--text-2)' }}>{time}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[13px] truncate" style={{ color: 'var(--text-2)' }}>{getLastMessagePreview(chat)}</span>
                    {unread > 0 && <span className="badge shrink-0">{unread > 99 ? '99+' : unread}</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
      {showNewGroup && <NewGroupModal onClose={() => setShowNewGroup(false)} />}
    </div>
  );
}
