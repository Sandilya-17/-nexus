import { MessageCircle, Lock } from 'lucide-react';

export default function NoChatSelected() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8" style={{ background: 'var(--bg-chat)' }}>
      <div className="w-28 h-28 rounded-full flex items-center justify-center mb-6" style={{ background: 'var(--bg-card)' }}>
        <MessageCircle size={52} style={{ color: 'var(--accent)' }} fill="var(--accent)" strokeWidth={0} />
      </div>
      <h2 className="text-3xl font-light mb-3" style={{ color: 'var(--text-1)' }}>Nexus for Web</h2>
      <p className="max-w-sm text-sm" style={{ color: 'var(--text-2)' }}>
        Send and receive messages without keeping your phone online.
        Select a chat or start a new one to begin messaging your team.
      </p>
      <div className="mt-10 flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-3)' }}>
        <Lock size={12} />
        <span>Your personal messages are end-to-end encrypted</span>
      </div>
    </div>
  );
}
