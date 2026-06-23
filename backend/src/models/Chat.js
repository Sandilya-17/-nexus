const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['direct', 'group', 'channel', 'broadcast'],
    default: 'direct',
    index: true,
  },

  // Direct chat
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

  // Group/Channel specific
  name: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  avatar: String,
  avatarPublicId: String,

  // Group members with roles
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: {
      type: String,
      enum: ['member', 'admin', 'owner'],
      default: 'member',
    },
    joinedAt: { type: Date, default: Date.now },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    mutedUntil: Date,
    nickname: String,
  }],

  // Group settings
  settings: {
    onlyAdminsCanSend: { type: Boolean, default: false },
    onlyAdminsCanAddMembers: { type: Boolean, default: false },
    onlyAdminsCanEditInfo: { type: Boolean, default: false },
    disappearingMessages: { type: Number, default: 0 }, // seconds, 0 = off
    joinLink: String,
    joinLinkEnabled: { type: Boolean, default: false },
  },

  // Last message for listing
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
  },
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true,
  },

  // Pinned messages
  pinnedMessages: [{
    message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    pinnedAt: { type: Date, default: Date.now },
  }],

  // Per-user chat mute / archive / hide
  userSettings: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    mutedUntil: Date,
    archived: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false },
    customName: String,
    wallpaper: String,
  }],

  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

}, { timestamps: true });

// Indexes
chatSchema.index({ participants: 1 });
chatSchema.index({ 'members.user': 1 });
chatSchema.index({ lastActivity: -1 });
chatSchema.index({ type: 1, isActive: 1 });
chatSchema.index({ name: 'text', description: 'text' });

// Get participant ids for direct chats
chatSchema.methods.getOtherParticipant = function (userId) {
  return this.participants.find(p => p.toString() !== userId.toString());
};

module.exports = mongoose.model('Chat', chatSchema);
