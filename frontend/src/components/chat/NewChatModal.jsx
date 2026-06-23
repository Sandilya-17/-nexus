import { useState, useEffect } from 'react';
import { X, Search, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import Avatar from '../ui/Avatar';
import toast from 'react-hot-toast';
import useChatStore from '../../context/chatStore';

export default function NewChatModal({ onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { addChat } = useChatStore();

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/users/search?q=${query}`);
        setResults(data.users);
      } catch (e) { } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const startChat = async (userId) => {
    try {
      const { data } = await api.post('/chats/direct', { userId });
      addChat(data.chat);
      navigate(`/chats/${data.chat._id}`);
      onClose();
    } catch (e) {
      toast.error('Failed to start chat');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="font-semibold">New Chat</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>
        <div className="p-4">
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-2)]" />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              className="input-field pl-9 text-sm" placeholder="Search users by name or username..." />
          </div>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-[var(--accent-dim)] border-t-[var(--accent)] rounded-full animate-spin" />
              </div>
            ) : results.length === 0 && query.length >= 2 ? (
              <p className="text-center text-[var(--text-2)] text-sm py-6">No users found</p>
            ) : (
              results.map(user => (
                <button key={user._id} onClick={() => startChat(user._id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--bg-hover)] transition-colors text-left">
                  <Avatar src={user.avatar} name={user.name} size={40} online={user.isOnline} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{user.name}</p>
                    <p className="text-xs text-[var(--text-2)] truncate">{user.username ? `@${user.username}` : user.email}</p>
                  </div>
                  {user.department && <span className="text-xs text-[var(--text-2)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-full">{user.department}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
