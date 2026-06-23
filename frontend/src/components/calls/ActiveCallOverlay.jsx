import { useEffect, useRef, useState } from 'react';
import {
  Phone, Video, VideoOff, Mic, MicOff, Monitor, MonitorOff,
  Maximize2, Minimize2, PhoneOff
} from 'lucide-react';
import useCallStore from '../../context/callStore';
import { getSocket } from '../../services/socket';
import api from '../../services/api';
import Avatar from '../ui/Avatar';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// Fallback if the /calls/ice-config request fails — STUN only, which works
// for many calls but can fail across strict NATs/firewalls without a TURN
// relay. See backend ICE config endpoint for how to add a TURN server.
const FALLBACK_ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function ActiveCallOverlay() {
  const {
    activeCall, localStream, remoteStreams, isMuted, isCameraOff,
    isScreenSharing, isCallMinimized, toggleMute, toggleCamera,
    setLocalStream, addRemoteStream, addPeerConnection, peerConnections,
    setScreenSharing, setCallMinimized, cleanup,
  } = useCallStore();

  const localVideoRef = useRef(null);
  const [callDuration, setCallDuration] = useState(0);
  const durationTimer = useRef(null);
  // Store peer connections by socketId
  const pcBySocket = useRef({});
  const iceServersRef = useRef(FALLBACK_ICE_SERVERS);

  useEffect(() => {
    const socket = getSocket();
    // Fetch TURN/STUN config from the backend before doing anything else,
    // so calls also work across NATs/firewalls that STUN alone can't punch
    // through (common on mobile data and corporate networks).
    api.get('/calls/ice-config')
      .then(({ data }) => {
        if (data?.iceServers?.length) {
          iceServersRef.current = { iceServers: data.iceServers };
        }
      })
      .catch(() => {})
      .finally(() => {
        startMedia();
      });

    durationTimer.current = setInterval(() => setCallDuration(d => d + 1), 1000);

    if (socket) {
      socket.on('call:webrtc-offer', handleOffer);
      socket.on('call:webrtc-answer', handleAnswer);
      socket.on('call:ice-candidate', handleIceCandidate);
      socket.on('call:participant-socket', handleParticipantSocket);
      socket.on('call:answered', handleCallAnswered);
      socket.on('call:participant-joined', handleParticipantJoined);
      socket.on('call:ended', handleRemoteEnded);
    }

    return () => {
      clearInterval(durationTimer.current);
      if (socket) {
        socket.off('call:webrtc-offer', handleOffer);
        socket.off('call:webrtc-answer', handleAnswer);
        socket.off('call:ice-candidate', handleIceCandidate);
        socket.off('call:participant-socket', handleParticipantSocket);
        socket.off('call:answered', handleCallAnswered);
        socket.off('call:participant-joined', handleParticipantJoined);
        socket.off('call:ended', handleRemoteEnded);
      }
    };
  }, []);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const startMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: activeCall.type === 'video',
      });
      setLocalStream(stream);

      // Important: do NOT request participant sockets / send the offer here
      // for the initiator. The callee's ActiveCallOverlay doesn't mount
      // (and so isn't listening for call:webrtc-offer) until they actually
      // tap Accept on the incoming-call screen — sending the offer the
      // instant media is ready races ahead of that and the offer gets
      // dropped on the floor, so the call never connects even after accept.
      // Instead we wait for the backend's call:answered event (handled
      // below), which only fires once the callee has accepted and is
      // therefore guaranteed to be listening.
      if (activeCall.isInitiator && activeCall.status === 'ongoing') {
        // Call was already answered before our media was ready (rare, but
        // possible) — safe to request sockets immediately.
        socket?.emit('call:get-participant-sockets', { callId: activeCall._id });
      }
    } catch (e) {
      toast.error('Failed to access camera/microphone. Please allow permissions.');
    }
  };

  // Fired once the backend confirms the callee accepted or rejected.
  const handleCallAnswered = ({ callId, accepted }) => {
    if (callId !== activeCall._id) return;
    if (!activeCall.isInitiator) return;
    if (accepted) {
      socket?.emit('call:get-participant-sockets', { callId });
    } else {
      toast.error('Call declined');
      cleanup();
    }
  };

  // Fired to existing participants when someone new joins an ongoing
  // (e.g. group) call, so they can also set up a peer connection to them.
  const handleParticipantJoined = ({ callId, userId, userSocketId }) => {
    if (callId !== activeCall._id) return;
    const { localStream: stream, peerConnections: existing } = useCallStore.getState();
    if (existing[userId] || !userSocketId) return;
    if (stream) {
      createPeerConnection(userSocketId, userId, stream, true);
    }
  };

  const handleRemoteEnded = ({ callId }) => {
    if (callId !== activeCall._id) return;
    cleanup();
  };

  // Server sends back participant socket IDs so we can send offers
  const handleParticipantSocket = ({ socketId, userId }) => {
    const { localStream: stream } = useCallStore.getState();
    if (stream) {
      createPeerConnection(socketId, userId, stream, true);
    }
  };

  const createPeerConnection = async (targetSocketId, targetUserId, stream, isInitiator) => {
    const pc = new RTCPeerConnection(iceServersRef.current);
    pcBySocket.current[targetSocketId] = pc;
    addPeerConnection(targetUserId || targetSocketId, pc);

    stream?.getTracks().forEach(track => pc.addTrack(track, stream));

    const remoteStream = new MediaStream();
    pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
      addRemoteStream(targetUserId || targetSocketId, remoteStream);
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && socket) {
        socket.emit('call:ice-candidate', {
          targetSocketId,
          candidate: e.candidate,
          callId: activeCall._id,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        toast.error('Call connection failed. Please try again.');
      }
    };

    if (isInitiator) {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: activeCall.type === 'video',
      });
      await pc.setLocalDescription(offer);
      socket?.emit('call:webrtc-offer', {
        targetSocketId,
        offer: pc.localDescription,
        callId: activeCall._id,
      });
    }

    return pc;
  };

  const handleOffer = async ({ offer, callId, fromSocketId, fromUser }) => {
    if (callId !== activeCall._id) return;
    const { localStream: stream } = useCallStore.getState();
    const pc = await createPeerConnection(fromSocketId, fromUser?._id, stream, false);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket?.emit('call:webrtc-answer', {
      targetSocketId: fromSocketId,
      answer: pc.localDescription,
      callId,
    });
  };

  const handleAnswer = async ({ answer, callId, fromSocketId }) => {
    if (callId !== activeCall._id) return;
    const pc = pcBySocket.current[fromSocketId];
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
  };

  const handleIceCandidate = async ({ candidate, callId, fromSocketId }) => {
    if (callId !== activeCall._id) return;
    const pc = pcBySocket.current[fromSocketId];
    if (pc && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {}
    }
  };

  const handleEndCall = async () => {
    try {
      await api.post(`/calls/${activeCall._id}/end`);
    } catch (e) {}
    cleanup();
  };

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: activeCall.type === 'video',
        });
        setLocalStream(stream);
        Object.values(peerConnections).forEach(pc => {
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            sender?.replaceTrack(videoTrack);
          }
        });
        socket?.emit('screen-share:stop', { chatId: activeCall.chat, callId: activeCall._id });
        setScreenSharing(false);
      } catch (e) {}
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        Object.values(peerConnections).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          sender?.replaceTrack(screenTrack);
        });
        screenTrack.onended = () => handleScreenShare();
        socket?.emit('screen-share:start', { chatId: activeCall.chat, callId: activeCall._id });
        setScreenSharing(true);
      } catch (e) {}
    }
  };

  const formatDuration = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const remoteStreamEntries = Object.entries(remoteStreams);

  if (isCallMinimized) {
    return (
      <div className="fixed bottom-24 right-4 z-50 w-64 card shadow-2xl overflow-hidden">
        <div className="bg-[var(--bg-sidebar)] flex items-center gap-3 p-3">
          <div className="w-8 h-8 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
            {activeCall.type === 'video'
              ? <Video size={14} className="text-[var(--accent-bright)]" />
              : <Phone size={14} className="text-[var(--accent-bright)]" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Ongoing call</p>
            <p className="text-xs text-[var(--text-2)]">{formatDuration(callDuration)}</p>
          </div>
          <button onClick={() => setCallMinimized(false)} className="btn-ghost p-1"><Maximize2 size={14} /></button>
          <button onClick={handleEndCall} className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center text-white">
            <PhoneOff size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a15] flex flex-col">
      <div className="flex-1 relative overflow-hidden">
        {activeCall.type === 'video' ? (
          <div className={clsx(
            'w-full h-full grid gap-2 p-2',
            remoteStreamEntries.length === 0 ? 'grid-cols-1' :
            remoteStreamEntries.length === 1 ? 'grid-cols-2' :
            remoteStreamEntries.length <= 3 ? 'grid-cols-2 grid-rows-2' :
            'grid-cols-3'
          )}>
            {remoteStreamEntries.map(([userId, stream]) => (
              <RemoteVideo key={userId} stream={stream} />
            ))}
            <div className="absolute bottom-4 right-4 w-32 h-24 rounded-xl overflow-hidden border-2 border-white/20 shadow-xl">
              {isCameraOff ? (
                <div className="w-full h-full bg-[var(--bg-card)] flex items-center justify-center">
                  <VideoOff size={20} className="text-[var(--text-2)]" />
                </div>
              ) : (
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-[var(--accent)]/20 flex items-center justify-center animate-pulse">
                <div className="w-24 h-24 rounded-full bg-[var(--accent)]/30 flex items-center justify-center">
                  <Phone size={36} className="text-[var(--accent-bright)]" />
                </div>
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold">Voice Call</h2>
              <p className="text-[var(--text-2)] mt-1">{formatDuration(callDuration)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-black/60 backdrop-blur-md px-6 py-6">
        <div className="flex items-center justify-center gap-4">
          <ControlBtn icon={isMuted ? MicOff : Mic} active={isMuted} label={isMuted ? 'Unmute' : 'Mute'} onClick={toggleMute} />
          {activeCall.type === 'video' && (
            <ControlBtn icon={isCameraOff ? VideoOff : Video} active={isCameraOff} label={isCameraOff ? 'Cam On' : 'Cam Off'} onClick={toggleCamera} />
          )}
          {activeCall.type === 'video' && (
            <ControlBtn icon={isScreenSharing ? MonitorOff : Monitor} active={isScreenSharing} label="Screen" onClick={handleScreenShare} />
          )}
          <ControlBtn icon={isCallMinimized ? Maximize2 : Minimize2} label="Minimize" onClick={() => setCallMinimized(true)} />
          <button onClick={handleEndCall}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-all active:scale-95 shadow-lg shadow-red-500/30">
            <PhoneOff size={24} />
          </button>
        </div>
        <p className="text-center text-xs text-[var(--text-2)] mt-3">{formatDuration(callDuration)}</p>
      </div>
    </div>
  );
}

function ControlBtn({ icon: Icon, active, label, onClick }) {
  return (
    <button onClick={onClick} title={label} className="flex flex-col items-center gap-1.5 group">
      <div className={clsx(
        'w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95',
        active ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'
      )}>
        <Icon size={20} />
      </div>
      <span className="text-[10px] text-[var(--text-2)]">{label}</span>
    </button>
  );
}

function RemoteVideo({ stream }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return <video ref={ref} autoPlay playsInline className="w-full h-full object-cover rounded-xl bg-[var(--bg-card)]" />;
}
