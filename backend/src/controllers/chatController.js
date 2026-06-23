const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const { getIO, getSocketId } = require('../socket');

// @GET /api/chats
exports.getChats = async (req, res) => {
  const userId = req.user._id;

  const chats = await Chat.find({
    $or: [
      { participants: userId, type: 'direct' },
      { 'members.user': userId, type: { $in: ['group', 'channel', 'broadcast'] } },
    ],
    isActive: true,
    'userSettings': {
      $not: {
        $elemMatch: { user: userId, hidden: true }
      }
    }
  })
    .sort({ lastActivity: -1 })
    .populate('participants', 'name avatar username isOnline lastSeen')
    .populate('members.user', 'name avatar username isOnline')
    .populate({
      path: 'lastMessage',
      populate: { path: 'sender', select: 'name' },
    })
    .lean();

  // Compute unread counts per chat
  const chatIds = chats.map(c => c._id);
  const unreadCounts = await Message.aggregate([
    {
      $match: {
        chat: { $in: chatIds },
        sender: { $ne: userId },
        'readBy.user': { $ne: userId },
        isDeletedForEveryone: false,
        deletedFor: { $ne: userId },
      },
    },
    { $group: { _id: '$chat', count: { $sum: 1 } } },
  ]);

  const unreadMap = {};
  unreadCounts.forEach(u => { unreadMap[u._id.toString()] = u.count; });

  const enriched = chats.map(chat => ({
    ...chat,
    unreadCount: unreadMap[chat._id.toString()] || 0,
  }));

  res.json({ success: true, chats: enriched });
};

// @POST /api/chats/direct
exports.createDirectChat = async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, message: 'userId required.' });

  const otherUser = await User.findById(userId);
  if (!otherUser) return res.status(404).json({ success: false, message: 'User not found.' });

  // Check if chat already exists
  let chat = await Chat.findOne({
    type: 'direct',
    participants: { $all: [req.user._id, userId], $size: 2 },
  })
    .populate('participants', 'name avatar username isOnline lastSeen')
    .populate('lastMessage');

  if (chat) {
    // Unhide if hidden
    const userSetting = chat.userSettings?.find(s => s.user.toString() === req.user._id.toString());
    if (userSetting?.hidden) {
      await Chat.updateOne(
        { _id: chat._id, 'userSettings.user': req.user._id },
        { $set: { 'userSettings.$.hidden': false } }
      );
    }
    return res.json({ success: true, chat, isNew: false });
  }

  chat = await Chat.create({
    type: 'direct',
    participants: [req.user._id, userId],
    createdBy: req.user._id,
  });

  await chat.populate('participants', 'name avatar username isOnline lastSeen');

  // Notify other user
  const socketId = getSocketId(userId);
  if (socketId) {
    getIO().to(socketId).emit('chat:new', { chat });
  }

  res.status(201).json({ success: true, chat, isNew: true });
};

// @GET /api/chats/:chatId
exports.getChatById = async (req, res) => {
  const chat = await Chat.findById(req.params.chatId)
    .populate('participants', 'name avatar username isOnline lastSeen about')
    .populate('members.user', 'name avatar username isOnline lastSeen')
    .populate('members.addedBy', 'name')
    .populate({ path: 'pinnedMessages', populate: { path: 'message', populate: { path: 'sender', select: 'name' } } })
    .populate('createdBy', 'name');

  if (!chat) return res.status(404).json({ success: false, message: 'Chat not found.' });

  const isMember = chat.type === 'direct'
    ? chat.participants.some(p => p._id.toString() === req.user._id.toString())
    : chat.members.some(m => m.user._id.toString() === req.user._id.toString());

  if (!isMember) return res.status(403).json({ success: false, message: 'Access denied.' });

  res.json({ success: true, chat });
};

// @PUT /api/chats/:chatId/archive
exports.archiveChat = async (req, res) => {
  const { chatId } = req.params;
  const { archived } = req.body;

  await Chat.updateOne(
    { _id: chatId, 'userSettings.user': req.user._id },
    { $set: { 'userSettings.$.archived': archived } },
    { upsert: false }
  );

  // If no userSettings entry exists, push one
  const chat = await Chat.findById(chatId);
  const hasSetting = chat.userSettings.some(s => s.user.toString() === req.user._id.toString());
  if (!hasSetting) {
    await Chat.findByIdAndUpdate(chatId, {
      $push: { userSettings: { user: req.user._id, archived } }
    });
  }

  res.json({ success: true, archived });
};

// @PUT /api/chats/:chatId/mute
exports.muteChat = async (req, res) => {
  const { chatId } = req.params;
  const { duration } = req.body; // duration in hours, 0 = unmute

  const mutedUntil = duration > 0 ? new Date(Date.now() + duration * 60 * 60 * 1000) : null;

  const chat = await Chat.findById(chatId);
  const hasSetting = chat.userSettings.some(s => s.user.toString() === req.user._id.toString());

  if (hasSetting) {
    await Chat.updateOne(
      { _id: chatId, 'userSettings.user': req.user._id },
      { $set: { 'userSettings.$.mutedUntil': mutedUntil } }
    );
  } else {
    await Chat.findByIdAndUpdate(chatId, {
      $push: { userSettings: { user: req.user._id, mutedUntil } }
    });
  }

  res.json({ success: true, mutedUntil });
};

// @POST /api/chats/:chatId/pin/:messageId
exports.pinMessage = async (req, res) => {
  const { chatId, messageId } = req.params;

  const chat = await Chat.findById(chatId);
  if (!chat) return res.status(404).json({ success: false, message: 'Chat not found.' });

  const alreadyPinned = chat.pinnedMessages.some(p => p.message.toString() === messageId);
  if (alreadyPinned) {
    await Chat.findByIdAndUpdate(chatId, {
      $pull: { pinnedMessages: { message: messageId } }
    });
  } else {
    await Chat.findByIdAndUpdate(chatId, {
      $push: { pinnedMessages: { message: messageId, pinnedBy: req.user._id } }
    });
  }

  getIO().to(chatId).emit('chat:pinned', { chatId, messageId, pinned: !alreadyPinned, pinnedBy: req.user._id });

  res.json({ success: true, pinned: !alreadyPinned });
};

// @DELETE /api/chats/:chatId/clear
exports.clearChat = async (req, res) => {
  const { chatId } = req.params;
  await Message.updateMany(
    { chat: chatId },
    { $addToSet: { deletedFor: req.user._id } }
  );
  res.json({ success: true, message: 'Chat cleared.' });
};
