import { create } from 'zustand';

const useCallStore = create((set, get) => ({
  activeCall: null,
  incomingCall: null,
  localStream: null,
  remoteStreams: {},    // { userId: MediaStream }
  peerConnections: {}, // { userId: RTCPeerConnection }
  isCallMinimized: false,
  isMuted: false,
  isCameraOff: false,
  isScreenSharing: false,

  setIncomingCall: (call) => set({ incomingCall: call }),
  clearIncomingCall: () => set({ incomingCall: null }),

  setActiveCall: (call) => set({ activeCall: call }),
  clearActiveCall: () => set({
    activeCall: null,
    localStream: null,
    remoteStreams: {},
    peerConnections: {},
    isMuted: false,
    isCameraOff: false,
    isScreenSharing: false,
  }),

  setLocalStream: (stream) => set({ localStream: stream }),

  addRemoteStream: (userId, stream) => set(state => ({
    remoteStreams: { ...state.remoteStreams, [userId]: stream },
  })),

  removeRemoteStream: (userId) => set(state => {
    const { [userId]: _, ...rest } = state.remoteStreams;
    return { remoteStreams: rest };
  }),

  addPeerConnection: (userId, pc) => set(state => ({
    peerConnections: { ...state.peerConnections, [userId]: pc },
  })),

  toggleMute: () => {
    const { localStream, isMuted } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach(t => t.enabled = isMuted);
    }
    set({ isMuted: !isMuted });
  },

  toggleCamera: () => {
    const { localStream, isCameraOff } = get();
    if (localStream) {
      localStream.getVideoTracks().forEach(t => t.enabled = isCameraOff);
    }
    set({ isCameraOff: !isCameraOff });
  },

  setScreenSharing: (isSharing) => set({ isScreenSharing: isSharing }),
  setCallMinimized: (minimized) => set({ isCallMinimized: minimized }),

  cleanup: () => {
    const { localStream, peerConnections } = get();
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
    }
    Object.values(peerConnections).forEach(pc => pc.close());
    set({
      activeCall: null,
      incomingCall: null,
      localStream: null,
      remoteStreams: {},
      peerConnections: {},
      isMuted: false,
      isCameraOff: false,
      isScreenSharing: false,
    });
  },
}));

export default useCallStore;
