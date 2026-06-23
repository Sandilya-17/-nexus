import { useState, useEffect } from 'react';
import { Phone, Video, PhoneIncoming, PhoneMissed, PhoneOutgoing, Clock } from 'lucide-react';
import api from '../services/api';
import Avatar from '../components/ui/Avatar';
import useAuthStore from '../context/authStore';
import { format } from 'date-fns';

export default function CallsPage() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    api.get('/calls/history').then(({ data }) => {
      setCalls(data.calls);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const getCallInfo = (call) => {
    const isInitiator = call.initiator?._id === user?._id;
    const other = call.participants.find(p => (p.user?._id || p.user) !== user?._id);
    const myParticipant = call.participants.find(p => (p.user?._id || p.user) === user?._id);

    let Icon, label, color;
    if (call.status === 'missed' || myParticipant?.status === 'missed') {
      Icon = PhoneMissed; label = 'Missed'; color = 'text-red-400';
    } else if (isInitiator) {
      Icon = PhoneOutgoing; label = 'Outgoing'; color = 'text-[var(--text-2)]';
    } else {
      Icon = PhoneIncoming; label = 'Incoming'; color = 'text-[var(--accent-bright)]';
    }

    return { other, Icon, label, color, isInitiator };
  };

  const formatDuration = (s) => {
    if (!s) return '';
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex h-full">
      <div className="w-full max-w-lg border-r border-[var(--border)] flex flex-col">
        <div className="p-4 border-b border-[var(--border)]">
          <h1 className="text-xl font-bold">Calls</h1>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-[var(--bg-hover)]" />
                <div className="flex-1"><div className="h-4 bg-[var(--bg-hover)] rounded w-32 mb-2" /><div className="h-3 bg-[var(--bg-hover)] rounded w-24" /></div>
              </div>
            ))
          ) : calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[var(--text-2)]">
              <Phone size={40} className="mb-3 opacity-30" />
              <p>No call history yet</p>
            </div>
          ) : (
            calls.map(call => {
              const { other, Icon, label, color } = getCallInfo(call);
              const otherUser = other?.user;
              return (
                <div key={call._id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border)]/30">
                  <Avatar src={otherUser?.avatar} name={otherUser?.name} size={48} />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{otherUser?.name || 'Unknown'}</p>
                    <div className={`flex items-center gap-1.5 text-xs ${color}`}>
                      <Icon size={12} />
                      <span>{label}</span>
                      {call.duration && <span className="text-[var(--text-2)]">· {formatDuration(call.duration)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-[var(--text-2)]">{format(new Date(call.createdAt), 'MMM d, HH:mm')}</span>
                    <div className="flex items-center gap-1">
                      {call.type === 'video'
                        ? <Video size={14} className="text-[var(--text-2)]" />
                        : <Phone size={14} className="text-[var(--text-2)]" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex-1 hidden md:flex items-center justify-center text-[var(--text-2)]">
        <div className="text-center">
          <Phone size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a contact to start a call</p>
        </div>
      </div>
    </div>
  );
}
