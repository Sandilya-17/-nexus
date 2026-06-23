const mongoose = require('mongoose');

const statusSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video'],
    required: true,
  },
  content: String,      // text content or caption
  mediaUrl: String,
  mediaPublicId: String,
  mediaThumbnail: String,
  mediaDuration: Number,

  // Text status styling
  backgroundColor: { type: String, default: '#1a1a2e' },
  fontStyle: { type: String, default: 'normal' },
  fontSize: { type: Number, default: 24 },

  // Visibility
  visibility: {
    type: String,
    enum: ['everyone', 'contacts', 'selected', 'except'],
    default: 'contacts',
  },
  selectedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Views
  views: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    viewedAt: { type: Date, default: Date.now },
    reaction: String,
  }],

  // Replies
  replies: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: String,
    repliedAt: { type: Date, default: Date.now },
  }],

  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    index: { expireAfterSeconds: 0 },
  },

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

statusSchema.index({ user: 1, createdAt: -1 });
statusSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Status', statusSchema);
