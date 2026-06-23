const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['audio', 'video'],
    required: true,
  },
  callType: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct',
  },
  initiator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['pending', 'ringing', 'accepted', 'rejected', 'missed', 'busy', 'ended'],
      default: 'pending',
    },
    joinedAt: Date,
    leftAt: Date,
    duration: Number, // seconds
    isMuted: { type: Boolean, default: false },
    isCameraOff: { type: Boolean, default: false },
    isScreenSharing: { type: Boolean, default: false },
  }],
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
  },
  status: {
    type: String,
    enum: ['initiating', 'ringing', 'ongoing', 'ended', 'missed', 'failed'],
    default: 'initiating',
    index: true,
  },
  startedAt: Date,
  endedAt: Date,
  duration: Number, // total seconds
  
  // WebRTC signaling
  roomId: {
    type: String,
    unique: true,
    sparse: true,
  },
  
  // Recording
  recording: {
    enabled: { type: Boolean, default: false },
    url: String,
    duration: Number,
  },
  
  endReason: {
    type: String,
    enum: ['normal', 'no_answer', 'rejected', 'network_error', 'failed'],
    default: 'normal',
  },
}, { timestamps: true });

callSchema.index({ initiator: 1, createdAt: -1 });
callSchema.index({ 'participants.user': 1 });
callSchema.index({ chat: 1 });
callSchema.index({ status: 1 });

module.exports = mongoose.model('Call', callSchema);
