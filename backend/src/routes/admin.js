const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect, restrictTo('admin', 'superadmin'));

router.get('/stats', async (req, res) => {
  const [users, chats, messages] = await Promise.all([
    User.countDocuments(),
    Chat.countDocuments(),
    Message.countDocuments(),
  ]);
  const onlineUsers = await User.countDocuments({ isOnline: true });
  res.json({ success: true, stats: { users, chats, messages, onlineUsers } });
});

router.get('/users', async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const query = search ? { $or: [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }] } : {};
  const users = await User.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .select('-password -refreshToken')
    .lean();
  const total = await User.countDocuments(query);
  res.json({ success: true, users, total });
});

router.put('/users/:userId/toggle-active', async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  user.isActive = !user.isActive;
  await user.save();
  res.json({ success: true, isActive: user.isActive });
});

router.put('/users/:userId/role', async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role.' });
  const user = await User.findByIdAndUpdate(req.params.userId, { role }, { new: true });
  res.json({ success: true, user: user.toPublicProfile() });
});

module.exports = router;
