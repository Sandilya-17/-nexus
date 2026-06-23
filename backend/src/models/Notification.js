const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: [
      'new_message',
      'missed_call',
      'group_invite',
      'group_mention',
      'status_reaction',
      'contact_joined',
      'message_reaction',
      'file_shared',
      'poll_vote',
      'admin_action',
    ],
    required: true,
  },
  title: String,
  body: String,
  data: {
    chatId: String,
    messageId: String,
    callId: String,
    userId: String,
    statusId: String,
  },
  isRead: { type: Boolean, default: false, index: true },
  readAt: Date,
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
