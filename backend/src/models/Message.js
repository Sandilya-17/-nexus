const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  emoji: { type: String, required: true },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { _id: false });

const messageSchema = new mongoose.Schema({
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'voice', 'file', 'location', 'sticker', 'gif', 'system', 'poll'],
    default: 'text',
  },
  content: {
    type: String,
    trim: true,
  },
  // For media messages
  mediaUrl: String,
  mediaPublicId: String,
  mediaThumbnail: String,
  mediaSize: Number,
  mediaDuration: Number, // seconds for audio/video
  mediaName: String,
  mediaMimeType: String,
  
  // Location
  location: {
    lat: Number,
    lng: Number,
    address: String,
  },

  // Poll
  poll: {
    question: String,
    options: [{
      text: String,
      votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    }],
    multipleChoice: { type: Boolean, default: false },
    expiresAt: Date,
  },

  // Reply to a message
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
  },

  // Forward info
  forwardedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
  },

  // Mentions
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Reactions
  reactions: [reactionSchema],

  // Read receipts
  readBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now },
  }],

  // Delivered to
  deliveredTo: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deliveredAt: { type: Date, default: Date.now },
  }],

  // Starred by users
  starredBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Edited
  isEdited: { type: Boolean, default: false },
  editedAt: Date,
  editHistory: [{
    content: String,
    editedAt: Date,
  }],

  // Deleted
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isDeletedForEveryone: { type: Boolean, default: false },
  deletedAt: Date,

  // System message data
  systemData: {
    action: String,
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    data: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
});

// Indexes
messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ 'readBy.user': 1 });
messageSchema.index({ content: 'text' });
messageSchema.index({ isDeletedForEveryone: 1 });

// Virtual for unread count — done at query level

module.exports = mongoose.model('Message', messageSchema);
