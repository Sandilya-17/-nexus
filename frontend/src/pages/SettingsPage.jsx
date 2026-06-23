import { useState } from 'react';
import { Camera, Save, Bell, Eye, ChevronRight, ChevronLeft } from 'lucide-react';
import useAuthStore from '../context/authStore';
import api from '../services/api';
import Avatar from '../components/ui/Avatar';
import toast from 'react-hot-toast';

const SECTIONS = ['Profile', 'Privacy', 'Notifications'];

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore();
  const [activeSection, setActiveSection] = useState('Profile');
  const [showSection, setShowSection] = useState(false); // mobile: show content panel
  const [form, setForm] = useState({
    name: user?.name || '',
    about: user?.about || '',
    username: user?.username || '',
    phone: user?.phone || '',
    department: user?.department || '',
    jobTitle: user?.jobTitle || '',
  });
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [privacy, setPrivacy] = useState(user?.privacySettings || {
    lastSeenVisibility: 'everyone', profilePhotoVisibility: 'everyone',
    aboutVisibility: 'everyone', readReceipts: true,
  });
  const [notifs, setNotifs] = useState(user?.notificationPreferences || {
    messages: true, calls: true, statusUpdates: true, sound: true, desktop: true,
  });

  const saveProfile = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (avatar) fd.append('avatar', avatar);
      const { data } = await api.put('/users/profile', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      updateUser(data.user);
      toast.success('Profile updated');
      setAvatar(null); setAvatarPreview(null);
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const savePrivacy = async () => {
    try {
      await api.put('/users/privacy', { privacySettings: privacy });
      updateUser({ privacySettings: privacy });
      toast.success('Privacy settings saved');
    } catch { toast.error('Failed to save'); }
  };

  const saveNotifs = async () => {
    try {
      await api.put('/users/notifications', { notificationPreferences: notifs });
      updateUser({ notificationPreferences: notifs });
      toast.success('Notification settings saved');
    } catch { toast.error('Failed to save'); }
  };

  const pickAvatar = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAvatar(f);
    setAvatarPreview(URL.createObjectURL(f));
  };

  const selectSection = (s) => { setActiveSection(s); setShowSection(true); };

  const VisibilitySelect = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between py-3.5 border-b border-[var(--border)]">
      <span className="text-sm" style={{ color: 'var(--text-1)' }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="text-sm rounded-lg px-3 py-1.5 border border-[var(--border)] focus:outline-none focus:border-[var(--accent)]"
        style={{ background: 'var(--bg-input)', color: 'var(--text-1)' }}>
        <option value="everyone">Everyone</option>
        <option value="contacts">Contacts</option>
        <option value="nobody">Nobody</option>
      </select>
    </div>
  );

  const Toggle = ({ label, checked, onChange, desc }) => (
    <div className="flex items-center justify-between py-3.5 border-b border-[var(--border)]">
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{label}</p>
        {desc && <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{desc}</p>}
      </div>
      <button onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-[var(--accent)]' : 'bg-[var(--bg-hover)]'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  );

  return (
    <div className="flex h-full" style={{ background: 'var(--bg-app)' }}>

      {/* Sidebar — always visible on desktop, hidden on mobile when section open */}
      <div className={`
        w-full md:w-60 border-r border-[var(--border)] flex flex-col flex-shrink-0
        ${showSection ? 'hidden md:flex' : 'flex'}
      `} style={{ background: 'var(--bg-sidebar)' }}>
        <div className="px-4 py-4 border-b border-[var(--border)]">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Settings</h1>
        </div>

        {/* Avatar summary */}
        <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
          <Avatar src={user?.avatar} name={user?.name} size={48} />
          <div className="min-w-0">
            <p className="font-semibold truncate" style={{ color: 'var(--text-1)' }}>{user?.name}</p>
            <p className="text-sm truncate" style={{ color: 'var(--text-3)' }}>@{user?.username}</p>
          </div>
        </div>

        <nav className="p-2 space-y-1 flex-1">
          {SECTIONS.map(s => (
            <button key={s} onClick={() => selectSection(s)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all ${
                activeSection === s && showSection
                  ? 'text-white'
                  : 'hover:bg-[var(--bg-hover)]'
              }`}
              style={activeSection === s && showSection ? { background: 'var(--accent-dim)', color: 'var(--accent-bright)' } : { color: 'var(--text-2)' }}>
              {s} <ChevronRight size={14} />
            </button>
          ))}
        </nav>
      </div>

      {/* Content panel */}
      <div className={`
        flex-1 overflow-y-auto
        ${showSection ? 'flex flex-col' : 'hidden md:flex md:flex-col'}
      `}>
        {/* Mobile back */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]"
          style={{ background: 'var(--bg-sidebar)' }}>
          <button onClick={() => setShowSection(false)} className="btn-icon">
            <ChevronLeft size={20} />
          </button>
          <h2 className="font-semibold" style={{ color: 'var(--text-1)' }}>{activeSection}</h2>
        </div>

        <div className="p-4 md:p-6 max-w-2xl w-full mx-auto">
          {/* Profile */}
          {activeSection === 'Profile' && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold hidden md:block" style={{ color: 'var(--text-1)' }}>Profile</h2>

              {/* Avatar */}
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="relative">
                  <Avatar src={avatarPreview || user?.avatar} name={user?.name} size={80} />
                  <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                    style={{ background: 'var(--accent)' }}>
                    <Camera size={15} className="text-white" />
                    <input type="file" accept="image/*" onChange={pickAvatar} className="hidden" />
                  </label>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>Tap to change photo</p>
              </div>

              {[
                { key: 'name', label: 'Display name', placeholder: 'Jane Doe' },
                { key: 'username', label: 'Username', placeholder: 'jane_doe', prefix: '@' },
                { key: 'about', label: 'About', placeholder: 'Hey there! I am using Nexus.' },
                { key: 'phone', label: 'Phone (optional)', placeholder: '+1 555 0100' },
                { key: 'department', label: 'Department (optional)', placeholder: 'Engineering' },
                { key: 'jobTitle', label: 'Job title (optional)', placeholder: 'Software Engineer' },
              ].map(({ key, label, placeholder, prefix }) => (
                <div key={key}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>{label}</label>
                  <div className="relative">
                    {prefix && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-3)' }}>{prefix}</span>}
                    {key === 'about'
                      ? <textarea value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                          className="input resize-none" rows={3} placeholder={placeholder} />
                      : <input type="text" value={form[key]}
                          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                          className={`input ${prefix ? 'pl-8' : ''}`} placeholder={placeholder} />
                    }
                  </div>
                </div>
              ))}

              <button onClick={saveProfile} disabled={saving} className="btn-primary w-full py-3 gap-2">
                {saving ? <Spinner /> : <><Save size={15} /> Save changes</>}
              </button>
            </div>
          )}

          {/* Privacy */}
          {activeSection === 'Privacy' && (
            <div>
              <h2 className="text-lg font-semibold hidden md:block mb-4" style={{ color: 'var(--text-1)' }}>Privacy</h2>
              <div className="card p-4 space-y-1 mb-4">
                <VisibilitySelect label="Last seen" value={privacy.lastSeenVisibility}
                  onChange={v => setPrivacy(p => ({ ...p, lastSeenVisibility: v }))} />
                <VisibilitySelect label="Profile photo" value={privacy.profilePhotoVisibility}
                  onChange={v => setPrivacy(p => ({ ...p, profilePhotoVisibility: v }))} />
                <VisibilitySelect label="About" value={privacy.aboutVisibility}
                  onChange={v => setPrivacy(p => ({ ...p, aboutVisibility: v }))} />
                <Toggle label="Read receipts" desc="Show when you've read messages"
                  checked={privacy.readReceipts}
                  onChange={v => setPrivacy(p => ({ ...p, readReceipts: v }))} />
              </div>
              <button onClick={savePrivacy} className="btn-primary w-full py-3 gap-2">
                <Save size={15} /> Save privacy settings
              </button>
            </div>
          )}

          {/* Notifications */}
          {activeSection === 'Notifications' && (
            <div>
              <h2 className="text-lg font-semibold hidden md:block mb-4" style={{ color: 'var(--text-1)' }}>Notifications</h2>
              <div className="card p-4 space-y-1 mb-4">
                <Toggle label="Messages" checked={notifs.messages} onChange={v => setNotifs(n => ({ ...n, messages: v }))} />
                <Toggle label="Calls" checked={notifs.calls} onChange={v => setNotifs(n => ({ ...n, calls: v }))} />
                <Toggle label="Status updates" checked={notifs.statusUpdates} onChange={v => setNotifs(n => ({ ...n, statusUpdates: v }))} />
                <Toggle label="Sound" checked={notifs.sound} onChange={v => setNotifs(n => ({ ...n, sound: v }))} />
                <Toggle label="Desktop notifications" checked={notifs.desktop} onChange={v => setNotifs(n => ({ ...n, desktop: v }))} />
              </div>
              <button onClick={saveNotifs} className="btn-primary w-full py-3 gap-2">
                <Save size={15} /> Save notification settings
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
