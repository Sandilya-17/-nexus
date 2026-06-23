import { useState, useEffect } from 'react';
import { X, Search, Camera, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import Avatar from '../ui/Avatar';
import toast from 'react-hot-toast';
import useChatStore from '../../context/chatStore';
import clsx from 'clsx';

export default function NewGroupModal({ onClose }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { addChat } = useChatStore();

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await api.get(`/users/search?q=${query}`);
      setResults(data.users.filter(u => !selected.some(s => s._id === u._id)));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selected]);

  const toggleSelect = (user) => {
    setSelected(prev =>
      prev.some(u => u._id === user._id)
        ? prev.filter(u => u._id !== user._id)
        : [...prev, user]
    );
  };

  const handleAvatar = (e) => {
    const file = e.target.files[0];
    if (file) { setAvatar(file); setAvatarPreview(URL.createObjectURL(file)); }
  };

  const createGroup = async () => {
    if (!name.trim()) return toast.error('Group name required');
    if (selected.length === 0) return toast.error('Add at least 1 member');
    setCreating(true);
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('description', description.trim());
      selected.forEach(u => fd.append('memberIds', u._id));
      if (avatar) fd.append('avatar', avatar);

      const { data } = await api.post('/groups', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      addChat(data.group);
      navigate(`/chats/${data.group._id}`);
      onClose();
    } catch (e) {
      toast.error('Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="text-[var(--text-2)] hover:text-[var(--text-primary)]">←</button>
            )}
            <h2 className="font-semibold">{step === 1 ? 'Add Members' : 'Group Info'}</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>

        {step === 1 ? (
          <div className="p-4">
            {/* Selected members */}
            {selected.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-3 mb-3 hide-scrollbar">
                {selected.map(u => (
                  <div key={u._id} className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className="relative">
                      <Avatar src={u.avatar} name={u.name} size={44} />
                      <button onClick={() => toggleSelect(u)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white">
                        <X size={10} />
                      </button>
                    </div>
                    <span className="text-[10px] text-[var(--text-2)] w-12 text-center truncate">{u.name.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-2)]" />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                className="input-field pl-9 text-sm" placeholder="Search team members..." />
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {results.map(user => (
                <button key={user._id} onClick={() => toggleSelect(user)}
                  className={clsx('w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left',
                    selected.some(u => u._id === user._id) ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/20' : 'hover:bg-[var(--bg-hover)]')}>
                  <Avatar src={user.avatar} name={user.name} size={36} />
                  <div>
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-[var(--text-2)]">{user.department || user.email}</p>
                  </div>
                  {selected.some(u => u._id === user._id) && <span className="ml-auto text-[var(--accent-bright)]">✓</span>}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-between items-center">
              <span className="text-sm text-[var(--text-2)]">{selected.length} selected</span>
              <button onClick={() => setStep(2)} disabled={selected.length === 0} className="btn-primary px-6">
                Next →
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Avatar */}
            <div className="flex justify-center">
              <label className="relative cursor-pointer group">
                <div className="w-20 h-20 rounded-full bg-[var(--bg-hover)] overflow-hidden flex items-center justify-center">
                  {avatarPreview
                    ? <img src={avatarPreview} alt="Group" className="w-full h-full object-cover" />
                    : <Users size={28} className="text-[var(--text-2)]" />}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={20} className="text-white" />
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
              </label>
            </div>
            <input value={name} onChange={e => setName(e.target.value)}
              className="input-field" placeholder="Group name *" />
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              className="input-field resize-none" rows={3} placeholder="Group description (optional)" />
            <div className="text-sm text-[var(--text-2)]">
              <span className="font-medium text-[var(--text-primary)]">{selected.length + 1}</span> members (including you)
            </div>
            <button onClick={createGroup} disabled={creating} className="btn-primary w-full py-3">
              {creating ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
