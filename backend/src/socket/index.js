const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const Call = require('../models/Call');
const logger = require('../utils/logger');

let io;
const onlineUsers = new Map(); // userId -> socketId
const socketToUser = new Map(); // socketId -> userId

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

const getSocketId = (userId) => onlineUsers.get(userId.toString());

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('name avatar isActive');
      if (!user || !user.isActive) return next(new Error('Invalid user'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    logger.info(`Socket connected: ${userId} (${socket.id})`);

    onlineUsers.set(userId, socket.id);
    socketToUser.set(socket.id, userId);

    await User.findByIdAndUpdate(userId, { isOnline: true, socketId: socket.id, lastSeen: new Date() });

    const user = await User.findById(userId).populate('contacts', '_id');
    if (user?.contacts) {
      user.contacts.forEach(contact => {
        const contactSocketId = onlineUsers.get(contact._id.toString());
        if (contactSocketId) {
          io.to(contactSocketId).emit('user:online', { userId, isOnline: true });
        }
      });
    }

    const chats = await Chat.find({
      $or: [
        { participants: userId, type: 'direct' },
        { 'members.user': userId },
      ],
    }).select('_id');

    chats.forEach(chat => socket.join(chat._id.toString()));

    // ─── Chat Events ─────────────────────────────────────────────
    socket.on('chat:join', (chatId) => socket.join(chatId));
    socket.on('chat:leave', (chatId) => socket.leave(chatId));

    // ─── Typing ───────────────────────────────────────────────────
    socket.on('typing:start', async ({ chatId }) => {
      socket.to(chatId).emit('typing:start', {
        chatId,
        user: { _id: socket.user._id, name: socket.user.name, avatar: socket.user.avatar },
      });
    });

    socket.on('typing:stop', ({ chatId }) => {
      socket.to(chatId).emit('typing:stop', { chatId, userId: socket.user._id });
    });

    // ─── Message Read ─────────────────────────────────────────────
    socket.on('message:read', async ({ messageIds, chatId }) => {
      try {
        await Message.updateMany(
          { _id: { $in: messageIds }, 'readBy.user': { $ne: userId } },
          { $push: { readBy: { user: userId, readAt: new Date() } } }
        );
        socket.to(chatId).emit('message:read-receipt', { messageIds, chatId, readBy: userId, readAt: new Date() });
      } catch (err) {
        logger.error('Error marking messages read:', err);
      }
    });

    // ─── WebRTC Signaling ─────────────────────────────────────────
    // Frontend requests socket IDs of other call participants
    socket.on('call:get-participant-sockets', async ({ callId }) => {
      try {
        const call = await Call.findById(callId).populate('participants.user', '_id');
        if (!call) return;
        call.participants.forEach(p => {
          const pUserId = (p.user?._id || p.user).toString();
          if (pUserId === userId) return; // skip self
          const pSocketId = onlineUsers.get(pUserId);
          if (pSocketId) {
            // Tell initiator about this participant's socket
            socket.emit('call:participant-socket', { socketId: pSocketId, userId: pUserId });
          }
        });
      } catch (err) {
        logger.error('Error getting participant sockets:', err);
      }
    });

    socket.on('call:webrtc-offer', ({ targetSocketId, offer, callId }) => {
      io.to(targetSocketId).emit('call:webrtc-offer', {
        offer,
        callId,
        fromSocketId: socket.id,
        fromUser: { _id: socket.user._id, name: socket.user.name, avatar: socket.user.avatar },
      });
    });

    socket.on('call:webrtc-answer', ({ targetSocketId, answer, callId }) => {
      io.to(targetSocketId).emit('call:webrtc-answer', { answer, callId, fromSocketId: socket.id });
    });

    socket.on('call:ice-candidate', ({ targetSocketId, candidate, callId }) => {
      io.to(targetSocketId).emit('call:ice-candidate', { candidate, callId, fromSocketId: socket.id });
    });

    socket.on('call:toggle-media', ({ chatId, callId, type, enabled }) => {
      socket.to(chatId).emit('call:media-toggled', { userId, type, enabled, callId });
    });

    // ─── Screen Share ─────────────────────────────────────────────
    socket.on('screen-share:start', ({ chatId, callId }) => {
      socket.to(chatId).emit('screen-share:started', { userId, callId });
    });

    socket.on('screen-share:stop', ({ chatId, callId }) => {
      socket.to(chatId).emit('screen-share:stopped', { userId, callId });
    });

    // ─── Presence ─────────────────────────────────────────────────
    socket.on('user:status-update', async ({ status }) => {
      await User.findByIdAndUpdate(userId, { presenceStatus: status });
      const userDoc = await User.findById(userId).populate('contacts', '_id');
      if (userDoc?.contacts) {
        userDoc.contacts.forEach(contact => {
          const contactSocketId = onlineUsers.get(contact._id.toString());
          if (contactSocketId) {
            io.to(contactSocketId).emit('user:presence-update', { userId, status });
          }
        });
      }
    });

    // ─── Group Events ─────────────────────────────────────────────
    socket.on('group:join-room', (groupId) => socket.join(groupId));

    // ─── Disconnect ───────────────────────────────────────────────
    socket.on('disconnect', async () => {
      logger.info(`Socket disconnected: ${userId}`);
      onlineUsers.delete(userId);
      socketToUser.delete(socket.id);

      const lastSeen = new Date();
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen, socketId: null });

      const userDoc = await User.findById(userId).populate('contacts', '_id');
      if (userDoc?.contacts) {
        userDoc.contacts.forEach(contact => {
          const contactSocketId = onlineUsers.get(contact._id.toString());
          if (contactSocketId) {
            io.to(contactSocketId).emit('user:online', { userId, isOnline: false, lastSeen });
          }
        });
      }
    });
  });

  logger.info('Socket.IO initialized');
  return io;
};

module.exports = { initSocket, getIO, getSocketId, onlineUsers };
