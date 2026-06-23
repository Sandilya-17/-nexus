import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, ArrowRight, User, UserPlus, ChevronLeft } from 'lucide-react';
import useAuthStore from '../context/authStore';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [mode, setMode] = useState('welcome'); // welcome | login | register
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const { login, register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim()) return toast.error('Enter your username');
    const result = await login(username.trim());
    if (result.success) {
      toast.success('Welcome back!');
      navigate('/chats');
    } else {
      toast.error(result.message || 'Username not found');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Enter your name');
    if (!username.trim()) return toast.error('Choose a username');
    const result = await register(name.trim(), username.trim());
    if (result.success) {
      toast.success('Welcome to Nexus!');
      navigate('/chats');
    } else {
      toast.error(result.message || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-app)' }}>
      <div className="w-full max-w-sm animate-fade-in-up">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'linear-gradient(135deg,#00a884,#06cf9c)', boxShadow: '0 0 32px rgba(0,168,132,0.4)' }}>
            <MessageCircle size={32} className="text-white" fill="white" strokeWidth={0} />
          </div>
          <h1 className="text-2xl font-bold text-gradient" style={{ fontFamily: 'Plus Jakarta Sans' }}>Nexus</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Team communication, reimagined</p>
        </div>

        {/* Welcome screen */}
        {mode === 'welcome' && (
          <div className="space-y-3">
            <button onClick={() => setMode('login')}
              className="btn-primary w-full py-3.5 text-base gap-3">
              <User size={18} /> Sign in
            </button>
            <button onClick={() => setMode('register')}
              className="w-full py-3.5 rounded-xl text-base font-medium flex items-center justify-center gap-3 transition-all"
              style={{ background: 'var(--bg-card)', color: 'var(--text-1)', border: '1px solid var(--border)' }}>
              <UserPlus size={18} /> Create account
            </button>
            <p className="text-center text-xs pt-2" style={{ color: 'var(--text-3)' }}>
              No email or password required
            </p>
          </div>
        )}

        {/* Login */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <button type="button" onClick={() => setMode('welcome')}
              className="flex items-center gap-1 text-sm mb-2" style={{ color: 'var(--text-3)' }}>
              <ChevronLeft size={16} /> Back
            </button>
            <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text-1)' }}>Sign in</h2>
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-2)' }}>Username</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: 'var(--text-3)' }}>@</span>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  className="input pl-8"
                  placeholder="your_username"
                  autoComplete="username"
                  autoFocus
                  autoCapitalize="none"
                />
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="btn-primary w-full py-3 gap-2">
              {isLoading ? <Spinner /> : <><ArrowRight size={16} /> Sign in</>}
            </button>
            <p className="text-center text-sm" style={{ color: 'var(--text-2)' }}>
              No account?{' '}
              <button type="button" onClick={() => setMode('register')}
                className="font-medium" style={{ color: 'var(--accent-bright)' }}>
                Create one
              </button>
            </p>
          </form>
        )}

        {/* Register */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <button type="button" onClick={() => setMode('welcome')}
              className="flex items-center gap-1 text-sm mb-2" style={{ color: 'var(--text-3)' }}>
              <ChevronLeft size={16} /> Back
            </button>
            <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text-1)' }}>Create account</h2>
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-2)' }}>Display name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                className="input" placeholder="Jane Doe" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-2)' }}>Username</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: 'var(--text-3)' }}>@</span>
                <input type="text" value={username}
                  onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                  className="input pl-8" placeholder="jane_doe"
                  autoCapitalize="none" autoComplete="username" />
              </div>
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>Letters, numbers, and _ only. Min 3 chars.</p>
            </div>
            <button type="submit" disabled={isLoading} className="btn-primary w-full py-3 gap-2">
              {isLoading ? <Spinner /> : <><UserPlus size={16} /> Create account</>}
            </button>
            <p className="text-center text-sm" style={{ color: 'var(--text-2)' }}>
              Have an account?{' '}
              <button type="button" onClick={() => setMode('login')}
                className="font-medium" style={{ color: 'var(--accent-bright)' }}>Sign in</button>
            </p>
          </form>
        )}
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
