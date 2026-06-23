const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', async (req, res) => {
  const notifications = await Notification.find({ recipient: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('sender', 'name avatar')
    .lean();
  const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
  res.json({ success: true, notifications, unreadCount });
});

router.put('/read-all', async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true, readAt: new Date() });
  res.json({ success: true });
});

router.put('/:id/read', async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, { isRead: true, readAt: new Date() });
  res.json({ success: true });
});

module.exports = router;
