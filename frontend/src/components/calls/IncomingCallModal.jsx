import { useEffect, useRef } from 'react';
import { Phone, Video, PhoneOff } from 'lucide-react';
import useCallStore from '../../context/callStore';
import { getSocket } from '../../services/socket';
import Avatar from '../ui/Avatar';
import api from '../../services/api';

export default function IncomingCallModal() {
  const { incomingCall, clearIncomingCall, setActiveCall } = useCallStore();
  const audioRef = useRef(null);

  useEffect(() => {
    // Ringtone
    const audio = new Audio('/ringtone.mp3');
    audio.loop = true;
    audioRef.current = audio;
    audio.play().catch(() => {});
    if ('vibrate' in navigator) navigator.vibrate([500, 200, 500, 200, 500]);

    // ✅ FIX: dismiss if caller cancels
    const socket = getSocket();
    const onCallEnded = ({ callId }) => {
      if (callId === incomingCall?.call?._id) dismiss();
    };
    socket?.on('call:ended', onCallEnded);

    // 45-second missed-call auto-timeout — must call reject() (not just
    // dismiss()) so the backend is told and can notify the caller. Without
    // this, letting a call ring out leaves the caller's screen frozen with
    // no feedback, since the backend never learns the call went unanswered.
    const timer = setTimeout(reject, 45000);

    return () => {
      stopRingtone();
      socket?.off('call:ended', onCallEnded);
      clearTimeout(timer);
    };
  }, []);

  const stopRingtone = () => {
    audioRef.current?.pause();
    if ('vibrate' in navigator) navigator.vibrate(0);
  };

  const dismiss = () => {
    stopRingtone();
    clearIncomingCall();
  };

  const accept = async () => {
    stopRingtone();
    try {
      const { data } = await api.post(`/calls/${incomingCall.call._id}/answer`, { accepted: true });
      setActiveCall({ ...incomingCall.call, roomId: data.roomId, isInitiator: false });
      clearIncomingCall();
    } catch {
      clearIncomingCall();
    }
  };

  const reject = async () => {
    stopRingtone();
    try { await api.post(`/calls/${incomingCall.call._id}/answer`, { accepted: false }); } catch {}
    clearIncomingCall();
  };

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center z-[100] p-4">
      <div className="w-full max-w-xs rounded-3xl p-7 text-center shadow-2xl animate-scale-in"
        style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)' }}>

        {/* Pulsing avatar */}
        <div className="relative w-24 h-24 mx-auto mb-5">
          <div className="absolute inset-[-10px] rounded-full animate-ping opacity-25"
            style={{ background: 'radial-gradient(circle,#00a884,transparent)' }} />
          <div className="absolute inset-[-5px] rounded-full animate-ping opacity-30"
            style={{ background: 'radial-gradient(circle,#00a884,transparent)', animationDelay: '0.3s' }} />
          <div className="relative z-10 w-24 h-24 rounded-full overflow-hidden border-2"
            style={{ borderColor: 'var(--accent-bright)' }}>
            <Avatar src={incomingCall.from?.avatar} name={incomingCall.from?.name} size={96} />
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs mb-3"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent-bright)' }}>
          {incomingCall.call.type === 'video' ? <Video size={11} /> : <Phone size={11} />}
          Incoming {incomingCall.call.type} call
        </div>

        <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-1)' }}>
          {incomingCall.from?.name}
        </h2>
        <p className="text-sm mb-8" style={{ color: 'var(--text-2)' }}>is calling you…</p>

        <div className="flex items-center justify-center gap-10">
          <button onClick={reject} className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-all active:scale-95 shadow-lg shadow-red-500/40">
              <PhoneOff size={24} />
            </div>
            <span className="text-xs" style={{ color: 'var(--text-2)' }}>Decline</span>
          </button>

          <button onClick={accept} className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white transition-all active:scale-95 shadow-lg shadow-green-500/40">
              {incomingCall.call.type === 'video' ? <Video size={24} /> : <Phone size={24} />}
            </div>
            <span className="text-xs" style={{ color: 'var(--text-2)' }}>Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
}
