import { useState, useEffect } from 'react';
import { Users, MessageSquare, Phone, Activity, Shield, UserCheck, UserX, ChevronDown } from 'lucide-react';
import api from '../services/api';
import Avatar from '../components/ui/Avatar';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/users?limit=20'),
    ]).then(([s, u]) => {
      setStats(s.data.stats);
      setUsers(u.data.users);
      setTotal(u.data.total);
    }).catch(() => toast.error('Failed to load admin data'))
      .finally(() => setLoading(false));
  }, []);

  const toggleActive = async (userId) => {
    const { data } = await api.put(`/admin/users/${userId}/toggle-active`);
    setUsers(prev => prev.map(u => u._id === userId ? { ...u, isActive: data.isActive } : u));
    toast.success(data.isActive ? 'User activated' : 'User deactivated');
  };

  const changeRole = async (userId, role) => {
    await api.put(`/admin/users/${userId}/role`, { role });
    setUsers(prev => prev.map(u => u._id === userId ? { ...u, role } : u));
    toast.success('Role updated');
  };

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value?.toLocaleString() ?? '—'}</p>
          <p className="text-sm text-[var(--text-2)]">{label}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Shield size={20} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-[var(--text-2)]">Manage your Nexus workspace</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Users} label="Total Users" value={stats?.users} color="bg-[var(--accent)]" />
          <StatCard icon={Activity} label="Online Now" value={stats?.onlineUsers} color="bg-green-500" />
          <StatCard icon={MessageSquare} label="Messages" value={stats?.messages} color="bg-purple-500" />
          <StatCard icon={Phone} label="Chats" value={stats?.chats} color="bg-amber-500" />
        </div>

        {/* Users table */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
            <h2 className="font-semibold">Users ({total})</h2>
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="input-field text-sm py-1.5 w-48" placeholder="Search users..." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--bg-hover)] text-xs text-[var(--text-2)] uppercase">
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Joined</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-t border-[var(--border)]">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-[var(--bg-hover)] rounded animate-pulse w-24" /></td>
                      ))}
                    </tr>
                  ))
                ) : users.filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.includes(search)).map(u => (
                  <tr key={u._id} className="border-t border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={u.avatar} name={u.name} size={32} online={u.isOnline} />
                        <span className="text-sm font-medium">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-2)]">{u.email}</td>
                    <td className="px-4 py-3">
                      <select value={u.role} onChange={e => changeRole(u._id, e.target.value)}
                        className="text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded px-2 py-1 text-[var(--text-primary)]">
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-2)]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(u._id)}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                          u.isActive
                            ? 'text-red-400 hover:bg-red-500/10'
                            : 'text-green-400 hover:bg-green-500/10'
                        }`}>
                        {u.isActive ? <><UserX size={12} /> Deactivate</> : <><UserCheck size={12} /> Activate</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
