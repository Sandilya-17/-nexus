import { useState, useEffect } from 'react';
import { Search, UserPlus, MessageSquare, Phone, Video } from 'lucide-react';
import api from '../services/api';
import useCallStore from '../context/callStore';
import Avatar from '../components/ui/Avatar';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const { setActiveCall } = useCallStore();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/users/contacts').then(({ data }) => setContacts(data.contacts)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await api.get(`/users/search?q=${search}`);
      setSearchResults(data.users);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const addContact = async (userId) => {
    try {
      const { data } = await api.post(`/users/contacts/${userId}`);
      setContacts(prev => [...prev, data.contact]);
      toast.success('Contact added');
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const startChat = async (userId) => {
    const { data } = await api.post('/chats/direct', { userId });
    navigate(`/chats/${data.chat._id}`);
  };

  const startCall = async (userId, type) => {
    try {
      const { data } = await api.post('/calls/initiate', { type, participants: [userId] });
      // Same fix as ChatWindow: must set activeCall so ActiveCallOverlay
      // mounts and actually starts the WebRTC offer for the caller.
      setActiveCall({ ...data.call, roomId: data.roomId, isInitiator: true });
      navigate(`/calls?callId=${data.call._id}`);
    } catch (e) { toast.error('Failed to start call'); }
  };

  const displayed = search.length >= 2 ? searchResults : contacts;
  const isContact = (id) => contacts.some(c => c._id === id);

  const grouped = displayed.reduce((acc, user) => {
    const letter = user.name[0].toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(user);
    return acc;
  }, {});

  return (
    <div className="flex h-full">
      <div className="w-full max-w-lg border-r border-[var(--border)] flex flex-col">
        <div className="p-4 border-b border-[var(--border)]">
          <h1 className="text-xl font-bold mb-4">Contacts</h1>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-2)]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="input-field pl-9 text-sm" placeholder="Search contacts or add new..." />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-[var(--bg-hover)]" />
                <div className="flex-1"><div className="h-4 bg-[var(--bg-hover)] rounded w-32 mb-2" /><div className="h-3 bg-[var(--bg-hover)] rounded w-20" /></div>
              </div>
            ))
          ) : Object.keys(grouped).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[var(--text-2)]">
              <UserPlus size={36} className="mb-3 opacity-30" />
              <p className="text-sm">{search ? 'No users found' : 'No contacts yet'}</p>
              <p className="text-xs mt-1">{!search && 'Search for team members to add'}</p>
            </div>
          ) : (
            Object.keys(grouped).sort().map(letter => (
              <div key={letter}>
                <p className="text-xs font-semibold text-[var(--text-2)] uppercase px-4 py-2 bg-[var(--bg-sidebar)]">{letter}</p>
                {grouped[letter].map(u => (
                  <div key={u._id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors group">
                    <Avatar src={u.avatar} name={u.name} size={44} online={u.isOnline} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{u.name}</p>
                      <p className="text-xs text-[var(--text-2)] truncate">{u.username ? '@' + u.username : u.department || u.jobTitle || ''}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isContact(u._id) ? (
                        <>
                          <button onClick={() => startChat(u._id)} title="Message" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--accent-dim)] text-[var(--accent-bright)] transition-colors">
                            <MessageSquare size={15} />
                          </button>
                          <button onClick={() => startCall(u._id, 'audio')} title="Voice call" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--accent-dim)] text-[var(--accent-bright)] transition-colors">
                            <Phone size={15} />
                          </button>
                          <button onClick={() => startCall(u._id, 'video')} title="Video call" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--accent-dim)] text-[var(--accent-bright)] transition-colors">
                            <Video size={15} />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => addContact(u._id)} title="Add contact"
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[var(--accent-dim)] text-[var(--accent-bright)] hover:bg-[var(--accent-dim)] transition-colors">
                          <UserPlus size={12} /> Add
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 hidden md:flex items-center justify-center text-[var(--text-2)]">
        <div className="text-center">
          <UserPlus size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a contact to view their profile</p>
        </div>
      </div>
    </div>
  );
}
