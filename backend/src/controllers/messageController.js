const Message = require('../models/Message');
const Chat = require('../models/Chat');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { uploadToCloudinary, generateVideoThumbnail } = require('../middleware/upload');
const { getIO, getSocketId } = require('../socket');
const logger = require('../utils/logger');

// Helper to emit to chat participants
const emitToChat = async (chatId, event, data, excludeUserId = null) => {
  const io = getIO();
  const chat = await Chat.findById(chatId);
  if (!chat) return;

  const recipients = chat.type === 'direct'
    ? chat.participants
    : chat.members.map(m => m.user);

  recipients.forEach(userId => {
    if (excludeUserId && userId.toString() === excludeUserId.toString()) return;
    const socketId = getSocketId(userId.toString());
    if (socketId) io.to(socketId).emit(event, data);
  });
};

// @GET /api/messages/:chatId
exports.getMessages = async (req, res) => {
  const { chatId } = req.params;
  const { page = 1, limit = 50, before } = req.query;

  const chat = await Chat.findById(chatId);
  if (!chat) return res.status(404).json({ success: false, message: 'Chat not found.' });

  // Check access
  const isMember = chat.type === 'direct'
    ? chat.participants.includes(req.user._id)
    : chat.members.some(m => m.user.toString() === req.user._id.toString());

  if (!isMember) return res.status(403).json({ success: false, message: 'Access denied.' });

  const query = {
    chat: chatId,
    isDeletedForEveryone: false,
    deletedFor: { $ne: req.user._id },
  };

  if (before) query.createdAt = { $lt: new Date(before) };

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .populate('sender', 'name avatar username isOnline')
    .populate('replyTo', 'content type sender mediaUrl mediaName')
    .populate('mentions', 'name username')
    .lean();

  // Mark messages as read
  const unreadIds = messages
    .filter(m => m.sender._id.toString() !== req.user._id.toString() &&
      !m.readBy?.some(r => r.user.toString() === req.user._id.toString()))
    .map(m => m._id);

  if (unreadIds.length > 0) {
    await Message.updateMany(
      { _id: { $in: unreadIds } },
      { $addToSet: { readBy: { user: req.user._id, readAt: new Date() } } }
    );

    // Emit read receipt to sender
    const io = getIO();
    unreadIds.forEach(async (msgId) => {
      const msg = messages.find(m => m._id.toString() === msgId.toString());
      if (msg) {
        const senderSocketId = getSocketId(msg.sender._id.toString());
        if (senderSocketId) {
          io.to(senderSocketId).emit('message:read', {
            messageId: msgId,
            chatId,
            readBy: req.user._id,
            readAt: new Date(),
          });
        }
      }
    });
  }

  res.json({
    success: true,
    messages: messages.reverse(),
    hasMore: messages.length === parseInt(limit),
  });
};

// @POST /api/messages/:chatId
exports.sendMessage = async (req, res) => {
  const { chatId } = req.params;
  const { content, type = 'text', replyTo, mentions, pollData } = req.body;

  const chat = await Chat.findById(chatId).populate('members.user', '_id');
  if (!chat) return res.status(404).json({ success: false, message: 'Chat not found.' });

  // Check access
  const member = chat.type === 'direct'
    ? chat.participants.find(p => p.toString() === req.user._id.toString())
    : chat.members.find(m => m.user._id.toString() === req.user._id.toString());

  if (!member) return res.status(403).json({ success: false, message: 'You are not in this chat.' });

  // Check if only admins can send
  if (chat.settings?.onlyAdminsCanSend && chat.type !== 'direct') {
    const memberData = chat.members.find(m => m.user._id.toString() === req.user._id.toString());
    if (memberData?.role === 'member') {
      return res.status(403).json({ success: false, message: 'Only admins can send messages.' });
    }
  }

  const messageData = {
    chat: chatId,
    sender: req.user._id,
    type,
    content: content?.trim(),
    replyTo: replyTo || null,
    mentions: mentions || [],
  };

  // Handle file uploads
  if (req.file) {
    const result = await uploadToCloudinary(
      req.file.buffer,
      req.file.mimetype,
      `nexus/messages/${chatId}`
    );
    messageData.mediaUrl = result.secure_url;
    messageData.mediaPublicId = result.public_id;
    messageData.mediaName = req.file.originalname;
    messageData.mediaSize = req.file.size;
    messageData.mediaMimeType = req.file.mimetype;
    messageData.mediaDuration = result.duration;

    if (type === 'video') {
      messageData.mediaThumbnail = generateVideoThumbnail(result.public_id);
    }
  }

  // Poll
  if (type === 'poll' && pollData) {
    const parsed = typeof pollData === 'string' ? JSON.parse(pollData) : pollData;
    messageData.poll = {
      question: parsed.question,
      options: parsed.options.map(o => ({ text: o, votes: [] })),
      multipleChoice: parsed.multipleChoice || false,
    };
  }

  const message = await Message.create(messageData);
  
  await message.populate([
    { path: 'sender', select: 'name avatar username' },
    { path: 'replyTo', select: 'content type sender mediaUrl mediaName' },
    { path: 'mentions', select: 'name username' },
  ]);

  // Update chat last message & activity
  await Chat.findByIdAndUpdate(chatId, {
    lastMessage: message._id,
    lastActivity: new Date(),
  });

  // Emit to all participants
  await emitToChat(chatId, 'message:new', { message, chatId }, null);

  // Create notifications for offline users
  const io = getIO();
  const recipients = chat.type === 'direct' ? chat.participants : chat.members.map(m => m.user._id || m.user);
  
  for (const recipientId of recipients) {
    if (recipientId.toString() === req.user._id.toString()) continue;
    const recipientSocketId = getSocketId(recipientId.toString());
    
    if (!recipientSocketId) {
      // User is offline, create notification
      await Notification.create({
        recipient: recipientId,
        type: 'new_message',
        title: chat.type === 'direct' ? req.user.name : `${chat.name}`,
        body: type === 'text' ? content : `Sent a ${type}`,
        sender: req.user._id,
        data: { chatId: chatId.toString(), messageId: message._id.toString() },
      });
    }
  }

  res.status(201).json({ success: true, message });
};

// @PUT /api/messages/:messageId/edit
exports.editMessage = async (req, res) => {
  const { messageId } = req.params;
  const { content } = req.body;

  const message = await Message.findById(messageId);
  if (!message) return res.status(404).json({ success: false, message: 'Message not found.' });

  if (message.sender.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Cannot edit others\' messages.' });
  }

  if (message.type !== 'text') {
    return res.status(400).json({ success: false, message: 'Only text messages can be edited.' });
  }

  // Time limit: 15 minutes
  const timeDiff = (Date.now() - message.createdAt) / 1000 / 60;
  if (timeDiff > 15) {
    return res.status(400).json({ success: false, message: 'Messages can only be edited within 15 minutes.' });
  }

  message.editHistory.push({ content: message.content, editedAt: new Date() });
  message.content = content.trim();
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();

  await emitToChat(message.chat.toString(), 'message:edited', { messageId, content: content.trim(), editedAt: message.editedAt });

  res.json({ success: true, message });
};

// @DELETE /api/messages/:messageId
exports.deleteMessage = async (req, res) => {
  const { messageId } = req.params;
  const { deleteFor } = req.query; // 'me' or 'everyone'

  const message = await Message.findById(messageId);
  if (!message) return res.status(404).json({ success: false, message: 'Message not found.' });

  if (deleteFor === 'everyone') {
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Cannot delete others\' messages for everyone.' });
    }
    message.isDeletedForEveryone = true;
    message.deletedAt = new Date();
    message.content = null;
    message.mediaUrl = null;
    await message.save();

    await emitToChat(message.chat.toString(), 'message:deleted', { messageId, deletedForEveryone: true });
  } else {
    message.deletedFor.addToSet(req.user._id);
    await message.save();
  }

  res.json({ success: true, message: 'Message deleted.' });
};

// @POST /api/messages/:messageId/react
exports.reactToMessage = async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body;

  const message = await Message.findById(messageId);
  if (!message) return res.status(404).json({ success: false, message: 'Message not found.' });

  const existingReaction = message.reactions.find(r => r.emoji === emoji);
  
  if (existingReaction) {
    const userIndex = existingReaction.users.indexOf(req.user._id.toString());
    if (userIndex > -1) {
      existingReaction.users.splice(userIndex, 1);
      if (existingReaction.users.length === 0) {
        message.reactions = message.reactions.filter(r => r.emoji !== emoji);
      }
    } else {
      existingReaction.users.push(req.user._id);
    }
  } else {
    message.reactions.push({ emoji, users: [req.user._id] });
  }

  await message.save();

  await emitToChat(message.chat.toString(), 'message:reaction', {
    messageId,
    reactions: message.reactions,
    userId: req.user._id,
    emoji,
  });

  res.json({ success: true, reactions: message.reactions });
};

// @POST /api/messages/:messageId/star
exports.starMessage = async (req, res) => {
  const { messageId } = req.params;
  const message = await Message.findById(messageId);
  if (!message) return res.status(404).json({ success: false, message: 'Message not found.' });

  const isStarred = message.starredBy.includes(req.user._id);
  if (isStarred) {
    message.starredBy.pull(req.user._id);
  } else {
    message.starredBy.push(req.user._id);
  }
  await message.save();

  res.json({ success: true, starred: !isStarred });
};

// @GET /api/messages/:chatId/starred
exports.getStarredMessages = async (req, res) => {
  const { chatId } = req.params;
  const messages = await Message.find({
    chat: chatId,
    starredBy: req.user._id,
    isDeletedForEveryone: false,
  }).populate('sender', 'name avatar').lean();

  res.json({ success: true, messages });
};

// @POST /api/messages/:messageId/poll-vote
exports.votePoll = async (req, res) => {
  const { messageId } = req.params;
  const { optionIndex } = req.body;

  const message = await Message.findById(messageId);
  if (!message || message.type !== 'poll') {
    return res.status(404).json({ success: false, message: 'Poll not found.' });
  }

  if (!message.poll || !message.poll.options[optionIndex]) {
    return res.status(400).json({ success: false, message: 'Invalid option.' });
  }

  if (!message.poll.multipleChoice) {
    // Remove existing votes from this user
    message.poll.options.forEach(opt => {
      opt.votes = opt.votes.filter(v => v.toString() !== req.user._id.toString());
    });
  }

  const option = message.poll.options[optionIndex];
  if (!option.votes.includes(req.user._id)) {
    option.votes.push(req.user._id);
  }

  await message.save();

  await emitToChat(message.chat.toString(), 'message:poll-updated', {
    messageId,
    poll: message.poll,
  });

  res.json({ success: true, poll: message.poll });
};

// @GET /api/messages/search
exports.searchMessages = async (req, res) => {
  const { q, chatId } = req.query;
  if (!q) return res.status(400).json({ success: false, message: 'Query required.' });

  const query = {
    $text: { $search: q },
    isDeletedForEveryone: false,
    deletedFor: { $ne: req.user._id },
  };

  if (chatId) query.chat = chatId;

  const messages = await Message.find(query)
    .sort({ score: { $meta: 'textScore' } })
    .limit(50)
    .populate('sender', 'name avatar')
    .populate('chat', 'name type')
    .lean();

  res.json({ success: true, messages });
};
