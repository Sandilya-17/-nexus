const Call = require('../models/Call');
const Chat = require('../models/Chat');
const User = require('../models/User');
const { getIO, getSocketId } = require('../socket/index'); // ✅ FIXED: was ../socket (circular)
const { v4: uuidv4 } = require('uuid');

// @POST /api/calls/initiate
exports.initiateCall = async (req, res) => {
  const { chatId, type, participants } = req.body;

  if (!['audio', 'video'].includes(type)) {
    return res.status(400).json({ success: false, message: 'Call type must be audio or video.' });
  }

  const roomId = uuidv4();
  const callParticipants = (participants || []).map(userId => ({ user: userId, status: 'ringing' }));
  callParticipants.unshift({ user: req.user._id, status: 'accepted', joinedAt: new Date() });

  const call = await Call.create({
    type,
    callType: participants?.length > 1 ? 'group' : 'direct',
    initiator: req.user._id,
    participants: callParticipants,
    chat: chatId,
    status: 'ringing',
    roomId,
  });

  await call.populate('initiator', 'name avatar');
  await call.populate('participants.user', 'name avatar');

  const io = getIO();
  callParticipants.slice(1).forEach(p => {
    const socketId = getSocketId(p.user.toString());
    if (socketId) {
      io.to(socketId).emit('call:incoming', {
        call,
        roomId,
        from: { _id: req.user._id, name: req.user.name, avatar: req.user.avatar },
      });
    }
  });

  res.status(201).json({ success: true, call, roomId });
};

// @POST /api/calls/:callId/answer
exports.answerCall = async (req, res) => {
  const { callId } = req.params;
  const { accepted } = req.body;

  const call = await Call.findById(callId);
  if (!call) return res.status(404).json({ success: false, message: 'Call not found.' });

  const participant = call.participants.find(p => p.user.toString() === req.user._id.toString());
  if (!participant) return res.status(403).json({ success: false, message: 'Not a participant.' });

  if (accepted) {
    participant.status = 'accepted';
    participant.joinedAt = new Date();
    if (call.status === 'ringing') {
      call.status = 'ongoing';
      call.startedAt = new Date();
    }
  } else {
    participant.status = 'rejected';
    const allRejected = call.participants.slice(1).every(p => p.status === 'rejected');
    if (allRejected) {
      call.status = 'ended';
      call.endedAt = new Date();
      call.endReason = 'rejected';
    }
  }

  await call.save();

  const io = getIO();

  // Notify initiator
  const initiatorSocketId = getSocketId(call.initiator.toString());
  if (initiatorSocketId) {
    io.to(initiatorSocketId).emit('call:answered', {
      callId, userId: req.user._id, accepted, roomId: call.roomId,
    });
  }

  // ✅ NEW: If accepted, tell all existing participants so WebRTC can start
  if (accepted) {
    const mySocketId = getSocketId(req.user._id.toString());
    call.participants.forEach(p => {
      if (p.status === 'accepted' && p.user.toString() !== req.user._id.toString()) {
        const socketId = getSocketId(p.user.toString());
        if (socketId) {
          io.to(socketId).emit('call:participant-joined', {
            callId,
            userId: req.user._id,
            userSocketId: mySocketId,
          });
        }
      }
    });
  }

  res.json({ success: true, call, roomId: call.roomId });
};

// @POST /api/calls/:callId/end
exports.endCall = async (req, res) => {
  const { callId } = req.params;

  const call = await Call.findById(callId);
  if (!call) return res.status(404).json({ success: false, message: 'Call not found.' });

  call.status = 'ended';
  call.endedAt = new Date();
  if (call.startedAt) {
    call.duration = Math.round((call.endedAt - call.startedAt) / 1000);
  }

  const participant = call.participants.find(p => p.user.toString() === req.user._id.toString());
  if (participant) {
    participant.leftAt = new Date();
    participant.status = 'ended';
    if (participant.joinedAt) {
      participant.duration = Math.round((participant.leftAt - participant.joinedAt) / 1000);
    }
  }

  await call.save();

  const io = getIO();
  call.participants.forEach(p => {
    const socketId = getSocketId(p.user.toString());
    if (socketId) {
      io.to(socketId).emit('call:ended', {
        callId, endedBy: req.user._id, duration: call.duration,
      });
    }
  });

  res.json({ success: true, call });
};

// @GET /api/calls/history
exports.getCallHistory = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const calls = await Call.find({ 'participants.user': req.user._id })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .populate('initiator', 'name avatar')
    .populate('participants.user', 'name avatar')
    .lean();
  res.json({ success: true, calls });
};

// @POST /api/calls/:callId/signal
exports.signal = async (req, res) => {
  const { callId } = req.params;
  const { targetUserId, signal } = req.body;
  const call = await Call.findById(callId);
  if (!call) return res.status(404).json({ success: false, message: 'Call not found.' });
  const targetSocketId = getSocketId(targetUserId);
  if (targetSocketId) {
    getIO().to(targetSocketId).emit('call:signal', { callId, fromUserId: req.user._id, signal });
  }
  res.json({ success: true });
};

// ✅ NEW: @GET /api/calls/ice-config — return TURN/STUN servers to frontend
exports.getIceConfig = async (req, res) => {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  if (process.env.TURN_SERVER_URL) {
    // Preferred: your own TURN server (most reliable for production).
    iceServers.push({
      urls: process.env.TURN_SERVER_URL,
      username: process.env.TURN_USERNAME || '',
      credential: process.env.TURN_CREDENTIAL || '',
    });
  } else {
    // Fallback: Open Relay Project's free public TURN servers. STUN alone
    // fails to connect calls for a large share of real users — anyone
    // behind symmetric NAT/CGNAT (very common on mobile carriers and some
    // corporate/campus networks) needs an actual TURN relay, not just
    // STUN. This keeps calls working out of the box; swap in your own
    // TURN_SERVER_URL/TURN_USERNAME/TURN_CREDENTIAL env vars for production
    // traffic, since the free relay has bandwidth limits.
    iceServers.push(
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    );
  }

  res.json({ success: true, iceServers });
};
