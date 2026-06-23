import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  MessageCircle, CircleDot, Phone, Users,
  Settings, LogOut, Shield, Menu, X
} from 'lucide-react';
import useAuthStore from '../../context/authStore';
import useChatStore from '../../context/chatStore';
import IncomingCallModal from '../calls/IncomingCallModal';
import ActiveCallOverlay from '../calls/ActiveCallOverlay';
import useCallStore from '../../context/callStore';
import Avatar from '../ui/Avatar';
import clsx from 'clsx';

const NAV = [
  { to: '/chats',    icon: MessageCircle, label: 'Chats' },
  { to: '/status',   icon: CircleDot,     label: 'Status'   },
  { to: '/calls',    icon: Phone,         label: 'Calls'    },
  { to: '/contacts', icon: Users,         label: 'Contacts' },
];

export default function MainLayout({ children }) {
  const { user, logout } = useAuthStore();
  const { chats } = useChatStore();
  const { incomingCall, activeCall } = useCallStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const totalUnread = chats.reduce((s, c) => s + (c.unreadCount || 0), 0);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-full" style={{ background: 'var(--bg-app)' }}>
      {incomingCall && <IncomingCallModal />}
      {activeCall && <ActiveCallOverlay />}

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-40 flex flex-col w-[64px] transition-transform duration-300 lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )} style={{
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
      }}>

        {/* Logo */}
        <div className="flex items-center justify-center h-16" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{
            background: 'var(--accent)',
          }}>
            <MessageCircle size={18} className="text-white" fill="white" strokeWidth={0} />
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 flex flex-col items-center gap-1 py-4 px-2">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => clsx('nav-item', isActive && 'nav-item-active')}
            >
              <Icon size={20} />
              {to === '/chats' && totalUnread > 0 && (
                <span className="badge absolute -top-1 -right-1 text-[10px]">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="flex flex-col items-center gap-1 pb-4 px-2" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          {user?.role !== 'user' && (
            <NavLink to="/admin" title="Admin"
              className={({ isActive }) => clsx('nav-item', isActive && 'text-amber-400 bg-amber-400/10')}>
              <Shield size={19} />
            </NavLink>
          )}
          <NavLink to="/settings" title="Settings"
            className={({ isActive }) => clsx('nav-item', isActive && 'nav-item-active')}>
            <Settings size={19} />
          </NavLink>

          <button onClick={() => navigate('/settings')} className="mt-1" title={user?.name}>
            <div className="relative">
              <Avatar src={user?.avatar} name={user?.name} size={34} />
              <span className="online-dot absolute -bottom-0.5 -right-0.5" />
            </div>
          </button>

          <button
            onClick={handleLogout}
            title="Sign out"
            className="nav-item hover:text-red-400 hover:bg-red-500/10 mt-1"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between h-14 px-4"
        style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="btn-icon">
          {mobileOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'var(--accent)' }}>
            <MessageCircle size={14} className="text-white" fill="white" strokeWidth={0} />
          </div>
          <span className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Nexus</span>
        </div>
        <Avatar src={user?.avatar} name={user?.name} size={30} />
      </div>

      {/* Page content */}
      <main className="flex-1 lg:ml-[64px] mt-14 lg:mt-0 h-full overflow-hidden">
        {children}
      </main>
    </div>
  );
}
